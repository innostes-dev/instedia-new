# Challenge 2: High-Throughput Sliding Window API Rate Limiter in Redis Lua Script

## Business Scenario
You are building the public GraphQL API for a major SaaS product. To prevent abuse and ensure fair usage among your paying tenants, you need to implement a strict Rate Limiter.

The standard "Fixed Window" algorithm (e.g., max 100 requests per minute) has a known flaw: a user can send 100 requests at 1:59:59 and 100 more requests at 2:00:01, resulting in 200 requests within a 2-second span.

You must implement a **Sliding Window Log** algorithm. To ensure maximum performance and atomicity (preventing race conditions from concurrent requests), the entire algorithm logic must be executed *inside* Redis using a custom **Lua Script**.

## The Architecture Diagram

```text
  [ Tenant A ]      [ Tenant A ]      [ Tenant A ]
       |                 |                 |
       +-----------------+-----------------+
                         |
                [ Node.js API Gateway ]
                         |
           EVALSHA (Send Lua Hash + IP Key)
                         |
          +--------------+---------------+
          |         Redis Server         |
          |                              |
          | 1. Lua: ZREMRANGEBYSCORE     | (Remove old timestamps)
          | 2. Lua: ZADD                 | (Add current timestamp)
          | 3. Lua: ZCARD                | (Count total in window)
          | 4. Lua: EXPIRE               | (Cleanup)
          |                              |
          +--------------+---------------+
                         |
      Returns 1 (Allowed) OR 0 (Rate Limited)
```

## Starter Code Template (Node.js/Express)

```javascript
const express = require('express');
const { createClient } = require('redis');

const app = express();
const redisClient = createClient();

// The Sliding Window Log Lua Script
// KEYS[1] = Rate limit key (e.g., 'rate:tenantA')
// ARGV[1] = Current Timestamp in ms
// ARGV[2] = Window Start Timestamp in ms
// ARGV[3] = Max allowed requests
// ARGV[4] = A Unique ID for the current request (UUID)
const SLIDING_WINDOW_LUA = `
    -- TODO: Implement the Redis commands in Lua
    -- Use redis.call('COMMAND', 'key', 'args...')
`;

const slidingWindowLimiter = (limit, windowSeconds) => async (req, res, next) => {
    const tenantId = req.headers['x-tenant-id'] || req.ip;
    const key = `ratelimit:sliding:${tenantId}`;

    // TODO: Calculate timestamps, generate unique ID, and execute the Lua script

    next();
};

app.get('/api/data', slidingWindowLimiter(5, 10), (req, res) => {
    res.json({ data: 'Sensitive SaaS Data' });
});

const start = async () => {
    await redisClient.connect();
    app.listen(3000, () => console.log('API Gateway running on 3000'));
};
start();
```

---

## Full Production Solution Walkthrough

### The Complete Implementation

```javascript
const express = require('express');
const { createClient } = require('redis');
const { v4: uuidv4 } = require('uuid');

const app = express();
const redisClient = createClient();

// The Lua Script executes atomically in Redis.
// It guarantees no race conditions if two requests hit simultaneously.
const SLIDING_WINDOW_LUA = `
    local key = KEYS[1]
    local now = tonumber(ARGV[1])
    local windowStart = tonumber(ARGV[2])
    local limit = tonumber(ARGV[3])
    local uniqueId = ARGV[4]
    local windowSeconds = tonumber(ARGV[5])

    -- 1. Remove all requests older than the sliding window start
    redis.call('ZREMRANGEBYSCORE', key, 0, windowStart)

    -- 2. Count how many requests remain in the window
    local currentCount = redis.call('ZCARD', key)

    -- 3. Check if adding this request would exceed the limit
    if currentCount >= limit then
        return 0 -- DENY
    end

    -- 4. Allowed! Add the current request to the Sorted Set
    redis.call('ZADD', key, now, uniqueId)

    -- 5. Set an expiration on the whole key to clean up memory
    -- The key only needs to live as long as the window itself
    redis.call('EXPIRE', key, windowSeconds)

    return 1 -- ALLOW
`;

const slidingWindowLimiter = (limit, windowSeconds) => async (req, res, next) => {
    const tenantId = req.headers['x-tenant-id'] || req.ip;
    const key = `ratelimit:sliding:${tenantId}`;

    const now = Date.now();
    const windowStart = now - (windowSeconds * 1000);
    const uniqueId = uuidv4(); // Sorted Sets require unique members

    try {
        // Execute the script
        const result = await redisClient.eval(SLIDING_WINDOW_LUA, {
            keys: [key],
            arguments: [
                now.toString(),
                windowStart.toString(),
                limit.toString(),
                uniqueId,
                windowSeconds.toString()
            ]
        });

        if (result === 1) {
            // Set helpful HTTP Headers for the client
            res.setHeader('X-RateLimit-Limit', limit);
            next();
        } else {
            res.status(429).json({ error: 'Too Many Requests', retryAfter: windowSeconds });
        }
    } catch (err) {
        console.error('Rate Limiter Error:', err);
        // Fail Open: If Redis is down, don't break the customer's API access
        next();
    }
};

app.get('/api/data', slidingWindowLimiter(5, 10), (req, res) => {
    res.json({ data: 'Sensitive SaaS Data' });
});

const start = async () => {
    await redisClient.connect();
    app.listen(3000, () => console.log('API Gateway running on 3000'));
};
start();
```

### Test Suite (Jest + Supertest)

```javascript
// __tests__/ratelimiter.test.js
const request = require('supertest');
const { app, redisClient } = require('../app');

const delay = (ms) => new Promise(resolve => setTimeout(resolve, ms));

describe('Sliding Window Lua Rate Limiter', () => {
    beforeAll(async () => {
        await redisClient.connect();
    });

    afterEach(async () => {
        await redisClient.flushAll(); // Clear rate limits between tests
    });

    afterAll(async () => {
        await redisClient.quit();
    });

    it('should allow requests under the limit', async () => {
        for (let i = 0; i < 5; i++) {
            const res = await request(app).get('/api/data').set('x-tenant-id', 'tenant-1');
            expect(res.status).toBe(200);
        }
    });

    it('should block requests over the limit', async () => {
        // Exhaust the limit (5 requests)
        for (let i = 0; i < 5; i++) {
            await request(app).get('/api/data').set('x-tenant-id', 'tenant-1');
        }

        // The 6th request should fail
        const res = await request(app).get('/api/data').set('x-tenant-id', 'tenant-1');
        expect(res.status).toBe(429);
        expect(res.body.error).toBe('Too Many Requests');
    });

    it('should allow requests again after the sliding window passes', async () => {
        // Exhaust the limit
        for (let i = 0; i < 5; i++) {
            await request(app).get('/api/data').set('x-tenant-id', 'tenant-2');
        }

        // Wait for the 10-second window to expire
        // Note: In a real test suite, you should mock Date.now() rather than actually waiting 10s
        await delay(10500);

        // Should be allowed again
        const res = await request(app).get('/api/data').set('x-tenant-id', 'tenant-2');
        expect(res.status).toBe(200);
    }, 15000);
});
```

### Pro-Tips for Production
1. **EVALSHA:** Sending a huge Lua script string over the network on every request wastes bandwidth. In production, load the script into Redis once using `SCRIPT LOAD`. Redis returns a SHA1 hash. Then, on every request, execute `EVALSHA <hash> ...`. If `EVALSHA` throws a `NOSCRIPT` error (e.g., Redis restarted), catch it and fallback to `EVAL` to re-cache the script.
2. **Memory Considerations:** The Sliding Window Log stores a UUID for every single request within the time window. If your limit is 1,000,000 requests per minute, that is 1 million UUIDs stored in RAM per tenant. For ultra-high volume limits, the **Token Bucket** algorithm (Challenge 3 level) is preferred as it only stores two integers (Tokens, LastRefillTime) regardless of volume.
