# Challenge 4: Distributed Redlock Mutex for Concurrent E-Commerce Flash Sales

## Business Scenario
You are building an e-commerce platform preparing for a massive "Black Friday" Flash Sale. You have exactly 10 "PlayStation 5" consoles in stock, priced at 90% off.

At exactly 12:00:00 PM, 50,000 users will click "Buy" at the exact same millisecond. Your backend API is scaled horizontally across 20 Node.js servers.

If you just run `SELECT stock FROM inventory WHERE item = 'PS5'`, check if `stock > 0`, and then `UPDATE stock = stock - 1`, all 20 servers will read `10`, and all will deduct the stock. You will sell 50,000 consoles when you only have 10, resulting in catastrophic business losses.

You must implement a strict, single-threaded **Distributed Lock** using the `SET NX` pattern (and conceptualize the Redlock algorithm) to ensure absolute data consistency across all 20 horizontal servers during the purchase flow.

## The Architecture Diagram

```text
       50,000 Concurrent "Buy PS5" Requests
                        |
            [ Load Balancer (Round Robin) ]
                        |
     +------------------+------------------+
     |                  |                  |
[ Node API 1 ]     [ Node API 2 ] ... [ Node API 20 ]
     |                  |                  |
     |          (1) SET 'lock:PS5' NX      |
     +------------------+------------------+
                        |
            +-----------v-----------+
            |      Redis Server     | (Single-Threaded Arbiter)
            |                       |
            | Node 2 Gets Lock (OK) |
            | Node 1 Gets (null)    |
            | Node 20 Gets (null)   |
            +-----------+-----------+
                        |
(2) Node 2 Queries DB: Is stock > 0? (Yes, 10)
(3) Node 2 Updates DB: Stock = 9
(4) Node 2 Deletes Lock: DEL 'lock:PS5'
                        |
     (5) Next node in line acquires lock...
```

## Starter Code Template (Node.js/Express)

```javascript
const express = require('express');
const { createClient } = require('redis');

const app = express();
const redisClient = createClient();
app.use(express.json());

// Mock In-Memory Database (represents PostgreSQL/MySQL)
const database = {
    'PS5': { stock: 10 }
};

const delay = (ms) => new Promise(resolve => setTimeout(resolve, ms));

// Mock Database operation
const processPurchaseInDB = async (itemId) => {
    await delay(100); // Simulate network latency to DB
    if (database[itemId].stock > 0) {
        database[itemId].stock -= 1;
        return true;
    }
    return false;
};

app.post('/api/buy/:itemId', async (req, res) => {
    const itemId = req.params.itemId;

    // TODO: Implement Distributed Lock with Retry Logic (Spin Lock)
    // 1. Try to acquire lock 'lock:inventory:PS5'
    // 2. If busy, wait 50ms and try again
    // 3. Once acquired, call processPurchaseInDB()
    // 4. Safely release lock using Lua script

});

const start = async () => {
    await redisClient.connect();
    app.listen(3000, () => console.log('Flash Sale API running on 3000'));
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
app.use(express.json());

const database = {
    'PS5': { stock: 10 }
};

const delay = (ms) => new Promise(resolve => setTimeout(resolve, ms));

const processPurchaseInDB = async (itemId) => {
    await delay(100); // 100ms artificial DB latency
    if (database[itemId].stock > 0) {
        database[itemId].stock -= 1;
        return true;
    }
    return false;
};

// Generic Distributed Lock Acquisition with Spin-Lock Retry
const acquireLock = async (lockKey, lockValue, maxRetries = 50, retryDelayMs = 100) => {
    for (let i = 0; i < maxRetries; i++) {
        const acquired = await redisClient.set(lockKey, lockValue, {
            NX: true,
            PX: 3000 // 3 second expiration (safety against process crash)
        });

        if (acquired) return true;

        // Wait before trying again
        await delay(retryDelayMs);
    }
    return false; // Failed to acquire after all retries
};

// Generic Safe Lock Release
const releaseLock = async (lockKey, lockValue) => {
    const luaScript = `
        if redis.call("get", KEYS[1]) == ARGV[1] then
            return redis.call("del", KEYS[1])
        else
            return 0
        end
    `;
    await redisClient.eval(luaScript, {
        keys: [lockKey],
        arguments: [lockValue]
    });
};

app.post('/api/buy/:itemId', async (req, res) => {
    const itemId = req.params.itemId;
    const lockKey = `lock:inventory:${itemId}`;
    const lockValue = uuidv4(); // Unique ID for this specific request thread

    try {
        // 1. Acquire Lock (Wait up to 5 seconds: 50 retries * 100ms)
        const hasLock = await acquireLock(lockKey, lockValue, 50, 100);

        if (!hasLock) {
            return res.status(503).json({ error: 'Server busy. Please try again.' });
        }

        // --- CRITICAL SECTION BEGIN ---
        try {
            const success = await processPurchaseInDB(itemId);

            if (success) {
                return res.json({ message: 'Purchase Successful!', remainingStock: database[itemId].stock });
            } else {
                return res.status(400).json({ error: 'Out of Stock!' });
            }
        } finally {
            // --- CRITICAL SECTION END ---
            // 2. ALWAYS release the lock, even if the DB query threw an error
            await releaseLock(lockKey, lockValue);
        }

    } catch (err) {
        console.error(err);
        res.status(500).send('Server Error');
    }
});

const start = async () => {
    await redisClient.connect();
    app.listen(3000, () => console.log('Flash Sale API running on 3000'));
};
start();
```

### Test Suite (Jest + Supertest)

```javascript
// __tests__/flashsale.test.js
const request = require('supertest');
const { app, redisClient, database } = require('../app');

describe('Distributed Lock Flash Sale', () => {
    beforeAll(async () => {
        await redisClient.connect();
    });

    beforeEach(() => {
        // Reset stock to exactly 10 before test
        database['PS5'].stock = 10;
    });

    afterAll(async () => {
        await redisClient.flushAll();
        await redisClient.quit();
    });

    it('should strictly limit sales to exact stock amount under concurrent load', async () => {
        // Simulate 30 users clicking "Buy" at the exact same time
        const requests = [];
        for (let i = 0; i < 30; i++) {
            requests.push(request(app).post('/api/buy/PS5'));
        }

        // Fire them all concurrently
        const responses = await Promise.all(requests);

        let successCount = 0;
        let failCount = 0;
        let busyCount = 0;

        responses.forEach(res => {
            if (res.status === 200) successCount++;
            else if (res.status === 400) failCount++; // Out of stock
            else if (res.status === 503) busyCount++; // Lock timeout
        });

        // The ultimate assertion: We must NEVER sell more than 10.
        expect(successCount).toBe(10);

        // The final DB state must be 0, never negative.
        expect(database['PS5'].stock).toBe(0);

        // The other 20 requests either got "Out of stock" or "Busy" depending on timeout
        expect(failCount + busyCount).toBe(20);
    }, 15000); // 15s timeout for the concurrent delays
});
```

### Pro-Tips for Production
1. **The Redlock Algorithm:** If your single Redis server crashes, you lose all locks. For systems where safety is critical (financial transactions), you must run a Redis Cluster with 3, 5, or 7 master nodes. The **Redlock** algorithm involves attempting to acquire the lock on *all* nodes simultaneously. If you acquire it on a majority ($N/2 + 1$), you have the lock. If not, you release it everywhere. Libraries like `redlock` in Node.js handle this for you.
2. **Lua Decoupling:** In high-throughput flash sales, DB operations inside the lock are a bottleneck. A more advanced pattern is using a Redis Lua script to check and decrement stock entirely within Redis (`DECR` command), and then returning a success token to the user while asynchronously updating the PostgreSQL database via a queue (e.g., RabbitMQ or Redis Streams).
