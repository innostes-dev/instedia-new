# Challenge 1: Resilient Network Client with Exponential Backoff & Jitter

## Problem Statement
In production, mobile networks drop packets and microservices get rate-limited (HTTP 429). If your JavaScript app immediately retries a failed fetch in a tight loop, it creates a "Thundering Herd" that accidentally DDoS-attacks your own server.

Build a `fetchWithBackoff` function that:
1. Takes a `url`, `maxRetries` (default 3), and `baseDelayMs` (default 500).
2. Uses `fetch()` to hit the URL.
3. If the response is `!response.ok`, it waits and retries.
4. **Exponential Backoff**: Delay doubles each retry (500ms, 1000ms, 2000ms).
5. **Jitter**: Adds a random variance (+0 to +200ms) to the delay to desynchronize multiple clients.
6. Throws a final Error if `maxRetries` are exhausted.

---

## The Solution Walkthrough

### 1. The Sleep Helper (Event Loop Control)
We need a way to pause our `async` function without freezing the browser. We wrap `setTimeout` in a Promise.

```javascript
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
```

### 2. The Core Recursive/Loop Logic
We can use a `for` loop combined with `await` to handle the retry attempts synchronously over time.

```javascript
async function fetchWithBackoff(url, maxRetries = 3, baseDelayMs = 500) {
  let attempt = 0;

  while (attempt <= maxRetries) {
    try {
      console.log(`Attempt ${attempt + 1}: Fetching ${url}`);

      const response = await fetch(url);

      // If success, return the unpacked JSON!
      if (response.ok) {
        return await response.json();
      }

      // If we get here, it failed (e.g., 404, 500)
      console.warn(`Attempt ${attempt + 1} Failed. Status: ${response.status}`);
      throw new Error(`HTTP Error ${response.status}`);

    } catch (error) {
      // If this was the final attempt, throw the error back to the caller
      if (attempt === maxRetries) {
        throw new Error(`Max retries reached. Final Error: ${error.message}`);
      }

      // Calculate Exponential Backoff (2^attempt * baseDelay)
      const exponentialDelay = baseDelayMs * Math.pow(2, attempt);

      // Calculate Jitter (0 to 200ms)
      const jitter = Math.floor(Math.random() * 200);

      const finalDelay = exponentialDelay + jitter;

      console.log(`Retrying in ${finalDelay}ms...`);

      // Pause the loop!
      await sleep(finalDelay);

      attempt++;
    }
  }
}
```

### 3. Usage & Testing
We test it by hitting an endpoint guaranteed to fail, watching the backoff grow.

```javascript
// Test URL (http.cat returns an image, not json, so we force an error, or just use a broken URL)
const BAD_URL = "https://httpstat.us/500";

async function runTest() {
  try {
    const data = await fetchWithBackoff(BAD_URL);
    console.log("Success:", data);
  } catch (err) {
    console.error("Operation Aborted:", err.message);
  }
}

runTest();
```

### Senior Engineer Takeaways
- **While Loop + Await:** `await` inside a loop perfectly preserves the asynchronous pause.
- **Math.pow:** Exponential backoff ensures the server gets breathing room to recover from high load.
- **Jitter:** The random variance prevents 10,000 clients who all disconnected at 12:00:00 from retrying at exactly 12:00:05, which would instantly crash the server again.
