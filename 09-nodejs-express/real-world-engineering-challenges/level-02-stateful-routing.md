# Challenge Level 2: Stateful Routing (Idempotency)

## 1. Scenario
Your API processes payments. A user clicks "Pay" on the frontend. The request reaches your server and charges their credit card. Before your server can send the HTTP 200 OK back, the user's Wi-Fi drops. The user reconnects, sees the page hasn't updated, and clicks "Pay" again. They just got charged twice! You need to make the payment endpoint **Idempotent**.

## 2. The Requirements
Build an endpoint `POST /api/payments` that prevents double-charging.
- The client will send a unique `Idempotency-Key` header with the request (e.g., a UUID).
- Your server must store successful payment keys in a mock database (an array/Map).
- If a request comes in with an `Idempotency-Key` that you have already successfully processed, DO NOT charge the card again. Instead, immediately return the *exact same successful response* you generated the first time.
- If the payment is new, process it and save the key and response.

## 3. Architecture Diagram
```text
[ Client ] -- POST /payments (Header: Idempotency-Key=ABC) --> [ API ]
                                                                 |
                                                          (Is ABC in DB?) -> NO
                                                                 |
                                                       [ Charge Card ]
                                                                 |
                                                    (Save ABC + Response to DB)
                                                                 |
[ Client ] <-------------------- HTTP 200 OK --------------------+
    |
(Wi-Fi drops, User Retries)
    |
[ Client ] -- POST /payments (Header: Idempotency-Key=ABC) --> [ API ]
                                                                 |
                                                          (Is ABC in DB?) -> YES!
                                                                 |
[ Client ] <-------- HTTP 200 OK (Cached Response) --------------+
```

## 4. Starter Template
```javascript
const express = require('express');
const app = express();
app.use(express.json());

// In-memory store for idempotency keys
const idempotencyStore = new Map();

async function processPaymentWithStripe(amount) {
  // Simulating a slow 3rd party API
  return new Promise(resolve => {
    setTimeout(() => {
      resolve({ status: 'succeeded', transactionId: 'txn_' + Date.now() });
    }, 1000);
  });
}

app.post('/api/payments', async (req, res) => {
  const { amount } = req.body;
  const idempotencyKey = req.headers['idempotency-key'];

  if (!idempotencyKey) {
    return res.status(400).json({ error: 'Idempotency-Key header is required' });
  }

  // TODO: Implement idempotency logic here
  // Check store. If exists, return cached response.
  // If not, call processPaymentWithStripe, store the result, and return it.

});

module.exports = app;
```

## 5. Solution Walkthrough

### The Code
```javascript
const express = require('express');
const app = express();
app.use(express.json());

// In production, this MUST be Redis or a Database, not a local variable
const idempotencyStore = new Map();

async function processPaymentWithStripe(amount) {
  return new Promise(resolve => {
    setTimeout(() => resolve({ status: 'succeeded', transactionId: 'txn_' + Date.now() }), 1000);
  });
}

// Custom Middleware to handle Idempotency cleanly
const requireIdempotency = (req, res, next) => {
  const key = req.headers['idempotency-key'];
  if (!key) {
    return res.status(400).json({ error: 'Idempotency-Key header is required' });
  }

  // 1. Check if we've seen this exact request before
  if (idempotencyStore.has(key)) {
    const cachedResponse = idempotencyStore.get(key);
    // Return the cached response immediately, skipping the controller
    return res.status(cachedResponse.statusCode).json(cachedResponse.body);
  }

  // Attach key to req so the controller can save it later
  req.idempotencyKey = key;
  next();
};

app.post('/api/payments', requireIdempotency, async (req, res) => {
  const { amount } = req.body;

  try {
    // 2. Actually process the payment
    const paymentResult = await processPaymentWithStripe(amount);

    const finalResponse = {
      message: 'Payment successful',
      data: paymentResult
    };

    // 3. Save the result to the store BEFORE sending it back
    idempotencyStore.set(req.idempotencyKey, {
      statusCode: 200,
      body: finalResponse
    });

    res.status(200).json(finalResponse);
  } catch (error) {
    // Note: Do NOT cache 500 errors. If Stripe was down, we WANT the user to retry.
    res.status(500).json({ error: 'Payment failed' });
  }
});

module.exports = app;
```

### Why this is Principal Level
Idempotency is the cornerstone of distributed systems. Stripe requires it for every mutating API call. By implementing this, you guarantee that network partitions, client retries, or accidental double-clicks cannot corrupt your database or steal money from your users. Moving the check into a middleware also makes it reusable across your entire codebase.

## 6. Test Suite (Jest & Supertest)
```javascript
const request = require('supertest');
const app = require('./app');

describe('Level 2: Stateful Routing', () => {
  it('should return 400 if Idempotency-Key is missing', async () => {
    const response = await request(app).post('/api/payments').send({ amount: 100 });
    expect(response.status).toBe(400);
  });

  it('should process payment and cache the result', async () => {
    const key = 'test-key-123';

    // First request - should process
    const res1 = await request(app)
      .post('/api/payments')
      .set('Idempotency-Key', key)
      .send({ amount: 100 });

    expect(res1.status).toBe(200);
    expect(res1.body.message).toBe('Payment successful');

    // Second request with same key - should return cached result instantly
    const res2 = await request(app)
      .post('/api/payments')
      .set('Idempotency-Key', key)
      .send({ amount: 100 });

    expect(res2.status).toBe(200);
    // The transactionId should be exactly the same!
    expect(res2.body.data.transactionId).toBe(res1.body.data.transactionId);
  });
});
```
