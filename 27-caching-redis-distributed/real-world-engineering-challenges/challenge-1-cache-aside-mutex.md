# Challenge 1: Resilient Cache-Aside Layer with Stampede Protection

## Business Scenario
You are the lead backend engineer for a high-traffic media streaming platform. When a major new show is released, millions of users hit the `/api/shows/:id` endpoint simultaneously.

If the show details aren't in the Redis cache, all million requests will hit your PostgreSQL database at the exact same millisecond. This is a **Cache Stampede (Thundering Herd)**, and it will instantly take down your database cluster.

You must build a resilient Cache-Aside data access layer that ensures:
1. Fast cache reads via Redis `GET`.
2. A strict fallback to the database on a Cache Miss.
3. **Stampede Protection:** If a Cache Miss occurs under heavy load, only *one* request is allowed to query the database. All other concurrent requests must wait and poll the cache until the first request populates it.

## The Architecture Diagram

```text
       1M Concurrent Requests for Show ID: 42
                        |
                        v
                 [ Node.js API ]
                        |
                 (1) redis.get('show:42') -> null (Miss)
                        |
       +----------------+-----------------+
       |                                  |
(2a) Request 1                       (2b) Requests 2 - 1,000,000
Acquires Mutex Lock                  Fail to acquire lock
SET 'lock:show:42' NX                Spin/Poll: wait 50ms, check cache again
       |                                  |
(3) Queries PostgreSQL                    |
       |                                  |
(4) SET 'show:42' data                    |
       |                                  |
(5) DEL 'lock:show:42'                    |
       |                                  |
       +----------------------------------+
                        |
            (6) redis.get('show:42') -> OK (Hit for everyone else)
                        |
                  [ Return to Users ]
```

## Starter Code Template (Node.js/Express)

```javascript
const express = require('express');
const { createClient } = require('redis');

const app = express();
const redisClient = createClient();

// Mock Slow Database Query
const fetchShowFromDB = async (showId) => {
    console.log(`[DB] Executing expensive query for show ${showId}...`);
    return new Promise(resolve => setTimeout(() => {
        resolve({ id: showId, title: 'Stranger Things', seasons: 4 });
    }, 2000));
};

app.get('/api/shows/:id', async (req, res) => {
    const showId = req.params.id;

    try {
        // TODO: Implement Cache-Aside with Stampede Protection

    } catch (error) {
        res.status(500).send('Server Error');
    }
});

const start = async () => {
    await redisClient.connect();
    app.listen(3000, () => console.log('Server running on 3000'));
};
start();
```

---

## Full Production Solution Walkthrough

To solve this, we combine standard Cache-Aside logic with a Redis Distributed Lock (`SET NX`).

### The Complete Implementation

```javascript
const express = require('express');
const { createClient } = require('redis');

const app = express();
const redisClient = createClient();

// Mock Slow Database Query
const fetchShowFromDB = async (showId) => {
    console.log(`[DB] Executing expensive query for show ${showId}...`);
    return new Promise(resolve => setTimeout(() => {
        resolve({ id: showId, title: 'Stranger Things', seasons: 4 });
    }, 2000)); // 2 second delay
};

// Helper function to pause execution
const delay = (ms) => new Promise(resolve => setTimeout(resolve, ms));

app.get('/api/shows/:id', async (req, res) => {
    const showId = req.params.id;
    const cacheKey = `show:${showId}`;
    const lockKey = `lock:show:${showId}`;

    try {
        // --- PHASE 1: STANDARD CACHE CHECK ---
        const cachedShow = await redisClient.get(cacheKey);
        if (cachedShow) {
            // Cache Hit! Return instantly.
            return res.json({ source: 'cache', data: JSON.parse(cachedShow) });
        }

        // --- PHASE 2: STAMPEDE PROTECTION (Acquire Lock) ---
        // Cache Miss. We try to become the ONE process allowed to query the DB.
        // NX: Set only if not exists. PX: Lock auto-expires in 5000ms (safety).
        const lockAcquired = await redisClient.set(lockKey, 'locked', {
            NX: true,
            PX: 5000
        });

        if (lockAcquired) {
            // --- WE ARE THE LEADER ---
            try {
                // 1. Fetch from slow DB
                const dbShow = await fetchShowFromDB(showId);

                // 2. Populate the cache (with a 60s TTL)
                await redisClient.set(cacheKey, JSON.stringify(dbShow), { EX: 60 });

                // 3. Return to user
                return res.json({ source: 'database', data: dbShow });
            } finally {
                // 4. ALWAYS release the lock so others don't wait for the 5s PX to expire
                await redisClient.del(lockKey);
            }
        } else {
            // --- WE ARE A FOLLOWER ---
            // Someone else is querying the DB right now. We must wait.
            console.log(`[POLL] Lock busy for show ${showId}. Waiting...`);

            // Poll the cache up to 10 times, waiting 500ms between attempts
            for (let i = 0; i < 10; i++) {
                await delay(500);

                const retryCache = await redisClient.get(cacheKey);
                if (retryCache) {
                    console.log(`[POLL SUCCESS] Data found in cache on attempt ${i + 1}`);
                    return res.json({ source: 'cache (polled)', data: JSON.parse(retryCache) });
                }
            }

            // If we wait 5 seconds and still no data, something went wrong with the leader
            return res.status(504).json({ error: 'Gateway Timeout' });
        }

    } catch (error) {
        console.error(error);
        res.status(500).send('Server Error');
    }
});

const start = async () => {
    await redisClient.connect();
    app.listen(3000, () => console.log('Server running on 3000'));
};
start();
```

### Test Suite (Jest + Supertest)

To verify this protection works, we must simulate concurrent requests. We will use `Promise.all` to fire 5 requests simultaneously.

```javascript
// __tests__/stampede.test.js
const request = require('supertest');
const { app, redisClient } = require('../app'); // Assuming exported

describe('Cache Stampede Protection', () => {
    beforeAll(async () => {
        await redisClient.connect();
    });

    afterAll(async () => {
        await redisClient.flushAll(); // Clean up
        await redisClient.quit();
    });

    it('should only query the database once for concurrent requests', async () => {
        // Fire 5 requests at the EXACT same time
        const req1 = request(app).get('/api/shows/99');
        const req2 = request(app).get('/api/shows/99');
        const req3 = request(app).get('/api/shows/99');
        const req4 = request(app).get('/api/shows/99');
        const req5 = request(app).get('/api/shows/99');

        const results = await Promise.all([req1, req2, req3, req4, req5]);

        // Check the responses
        let dbSourceCount = 0;
        let cacheSourceCount = 0;

        results.forEach(res => {
            expect(res.status).toBe(200);
            if (res.body.source === 'database') dbSourceCount++;
            if (res.body.source.includes('cache')) cacheSourceCount++;
        });

        // The assertions that prove stampede protection works:
        // Only ONE request should have touched the database.
        // The other FOUR should have waited and eventually read from the cache.
        expect(dbSourceCount).toBe(1);
        expect(cacheSourceCount).toBe(4);
    }, 10000); // Increase test timeout to 10s for the mock DB delay
});
```

### Pro-Tips for Production
1. **Jitter:** In the polling loop (`delay(500)`), add random jitter (e.g., `delay(400 + Math.random() * 200)`). If 100,000 requests are polling, you don't want them all waking up and hitting Redis at the exact same millisecond. Jitter smooths out the load on Redis.
2. **Stale-While-Revalidate:** An alternative to locking is serving slightly stale data to users while a background process updates the cache. This completely eliminates waiting for the user, but requires the cache to already be populated. Lock-based protection is necessary for cold-cache scenarios.
