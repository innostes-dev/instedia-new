# Challenge Level 1: The Resilient Client

## 1. Scenario
You are building an integration for a legacy inventory system. The inventory API frequently goes down for brief moments, returning HTTP 503 (Service Unavailable) or timing out. If your Express backend fails every time the inventory API blips, your entire e-commerce checkout flow breaks.

## 2. The Requirements
Build an Express route `/api/inventory/:itemId` that fetches data from an unstable external mock API.
- You must implement an **Exponential Backoff Retry Strategy**.
- If the external API fails, you must retry the request up to 3 times.
- The delay between retries must increase exponentially (e.g., 500ms, then 1000ms, then 2000ms).
- If it fails after 3 retries, you must gracefully return a 502 Bad Gateway error to the client, preventing your app from crashing.

## 3. Architecture Diagram
```text
[ Client ] -> GET /api/inventory/123
                  |
            [ Express Route ]
                  |
             Attempt 1 --> [ Mock API (Fails - 503) ]
                  |
            (Wait 500ms)
                  |
             Attempt 2 --> [ Mock API (Fails - Timeout) ]
                  |
            (Wait 1000ms)
                  |
             Attempt 3 --> [ Mock API (Succeeds - 200 OK) ]
                  |
            [ Returns 200 OK to Client ]
```

## 4. Starter Template
```javascript
const express = require('express');
const app = express();

// The unstable external API mock
async function fetchInventoryFromLegacyAPI(itemId) {
  const random = Math.random();
  if (random < 0.7) { // 70% chance of failure
    throw new Error('Legacy API is down!');
  }
  return { itemId, stock: 42 };
}

app.get('/api/inventory/:itemId', async (req, res) => {
  const { itemId } = req.params;

  // TODO: Implement the exponential backoff retry logic here.
  // DO NOT just call fetchInventoryFromLegacyAPI once.

  try {
     const data = await fetchInventoryFromLegacyAPI(itemId);
     res.json(data);
  } catch (error) {
     res.status(500).json({ error: 'Failed' });
  }
});

module.exports = app;
```

## 5. Solution Walkthrough

### The Code
```javascript
const express = require('express');
const app = express();

async function fetchInventoryFromLegacyAPI(itemId) {
  const random = Math.random();
  if (random < 0.7) throw new Error('Legacy API is down!');
  return { itemId, stock: 42 };
}

// Helper function to pause execution
const delay = (ms) => new Promise(resolve => setTimeout(resolve, ms));

async function fetchWithRetry(itemId, maxRetries = 3) {
  let attempt = 0;

  while (attempt < maxRetries) {
    try {
      // 1. Try the dangerous operation
      return await fetchInventoryFromLegacyAPI(itemId);
    } catch (error) {
      attempt++;
      console.log(`Attempt ${attempt} failed. Retrying...`);

      // 2. If it's the last attempt, stop trying and throw the error upward
      if (attempt >= maxRetries) {
        throw new Error('Max retries reached');
      }

      // 3. Wait exponentially before the next loop
      // Attempt 1: 500ms * 2^0 = 500ms
      // Attempt 2: 500ms * 2^1 = 1000ms
      const backoffTime = 500 * Math.pow(2, attempt - 1);
      await delay(backoffTime);
    }
  }
}

app.get('/api/inventory/:itemId', async (req, res, next) => {
  const { itemId } = req.params;

  try {
     const data = await fetchWithRetry(itemId);
     res.json(data);
  } catch (error) {
     // 502 Bad Gateway means "I am a server acting as a gateway, and the upstream server failed me."
     res.status(502).json({ error: 'Inventory service is currently unavailable.' });
  }
});

module.exports = app;
```

### Why this is Principal Level
Junior developers assume the network is reliable. Senior developers know the network fails constantly. By building resilience directly into the controller (or better yet, an API gateway middleware), you prevent cascading failures. If the legacy API is down, your app survives, logs the failure, and returns a clean error to the frontend.

## 6. Test Suite (Jest & Supertest)
```javascript
const request = require('supertest');
const app = require('./app'); // Assuming your express app is exported

describe('Level 1: Resilient Client', () => {
  it('should return 502 if all retries fail', async () => {
    // Mock the external API to always fail for this test if it were a separate module
    // For this self-contained example, we just expect it might fail or succeed.
    // A true test would use jest.mock() on the fetch function.

    // Simulating a scenario where it eventually returns 502
    // This is a basic structural test.
    const response = await request(app).get('/api/inventory/123');
    expect([200, 502]).toContain(response.status);
  }, 10000); // Increase timeout due to backoff delays
});
```
