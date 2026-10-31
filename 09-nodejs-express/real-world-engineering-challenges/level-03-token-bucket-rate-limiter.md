# Challenge Level 3: Token Bucket Rate Limiter

## 1. Scenario
Standard rate limiters (like `express-rate-limit`) use a "Fixed Window" algorithm. You get 10 requests per minute. If you make 10 requests at 1:00:59, and 10 more at 1:01:01, you technically made 20 requests in 2 seconds, which can overwhelm your server. You need to implement a more advanced algorithm: The **Token Bucket**.

## 2. The Requirements
Write a custom Rate Limiting middleware from scratch using the Token Bucket algorithm.
- Imagine a bucket for every user IP.
- The bucket can hold a maximum of 5 tokens (`capacity = 5`).
- Making an API request costs 1 token.
- The bucket refills at a constant rate: 1 token every 2 seconds (`refillRate`).
- If a user sends a request and the bucket is empty (0 tokens), reject it with HTTP 429.
- You must track the `lastRefillTime` for each IP to calculate how many tokens to add when they make their next request.

## 3. Architecture Diagram
```text
[ Bucket Max: 5, Current: 5 ]
       |
(User makes 3 rapid requests)
       |
[ Current: 2 ] -> (Allows 3 requests immediately)
       |
(User waits 4 seconds)
       |
(Refill adds 2 tokens)
       |
[ Current: 4 ]
```

## 4. Starter Template
```javascript
const express = require('express');
const app = express();

const CAPACITY = 5;
const REFILL_RATE_MS = 2000; // 1 token every 2 seconds

// Store buckets in memory
// Key: IP Address, Value: { tokens: number, lastRefill: number(timestamp) }
const buckets = new Map();

const tokenBucketLimiter = (req, res, next) => {
  const ip = req.ip;

  // TODO: Implement Token Bucket logic
  // 1. Get or create bucket for IP
  // 2. Calculate time passed since lastRefill and add tokens (don't exceed CAPACITY)
  // 3. Update lastRefill to now
  // 4. If tokens >= 1, subtract 1 and call next()
  // 5. If tokens < 1, return 429 Too Many Requests
};

app.use('/api', tokenBucketLimiter);

app.get('/api/data', (req, res) => res.send('Success'));

module.exports = app;
```

## 5. Solution Walkthrough

### The Code
```javascript
const express = require('express');
const app = express();

const CAPACITY = 5;
const REFILL_RATE_MS = 2000;

const buckets = new Map();

const tokenBucketLimiter = (req, res, next) => {
  const ip = req.ip;
  const now = Date.now();

  // 1. Create a new bucket if they don't exist
  if (!buckets.has(ip)) {
    buckets.set(ip, {
      tokens: CAPACITY,
      lastRefill: now
    });
  }

  const bucket = buckets.get(ip);

  // 2. Calculate how much time has passed
  const timePassed = now - bucket.lastRefill;

  // 3. Calculate how many tokens they earned in that time
  const tokensToAdd = Math.floor(timePassed / REFILL_RATE_MS);

  if (tokensToAdd > 0) {
    // Add tokens, but cap it at the max CAPACITY
    bucket.tokens = Math.min(CAPACITY, bucket.tokens + tokensToAdd);

    // CRITICAL: We only advance the timer by the exact chunks of REFILL_RATE_MS we used.
    // If 3000ms passed, we add 1 token, but leave the 1000ms remainder intact for next time.
    bucket.lastRefill = bucket.lastRefill + (tokensToAdd * REFILL_RATE_MS);
  }

  // 4. Check if they have enough tokens to make the request
  if (bucket.tokens >= 1) {
    bucket.tokens -= 1;
    buckets.set(ip, bucket); // Save state
    next();
  } else {
    // 5. Bucket empty!
    res.status(429).json({
      error: 'Rate limit exceeded',
      // Tell the client exactly when they will get their next token
      retryAfterMs: REFILL_RATE_MS - (now - bucket.lastRefill)
    });
  }
};

app.use('/api', tokenBucketLimiter);
app.get('/api/data', (req, res) => res.send('Success'));
module.exports = app;
```

### Why this is Principal Level
The Token Bucket is the exact algorithm used by AWS API Gateway and Stripe. It handles "bursty" traffic beautifully. Users can make 5 rapid-fire requests if they need to (a burst), but over time, they are strictly limited to the refill rate. It guarantees your server never experiences sudden devastating spikes that Fixed Window algorithms allow.

## 6. Test Suite (Jest & Supertest)
```javascript
const request = require('supertest');
const app = require('./app');

describe('Level 3: Token Bucket Rate Limiter', () => {
  it('should allow up to capacity and block subsequent requests', async () => {
    // Capacity is 5
    for (let i = 0; i < 5; i++) {
      const res = await request(app).get('/api/data');
      expect(res.status).toBe(200);
    }

    // 6th request should be blocked (429)
    const blockedRes = await request(app).get('/api/data');
    expect(blockedRes.status).toBe(429);
    expect(blockedRes.body.error).toBe('Rate limit exceeded');
    expect(blockedRes.body.retryAfterMs).toBeGreaterThan(0);
  });
});
```
