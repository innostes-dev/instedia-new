# Challenge 3: Idempotent Event Consumer with Redis Deduplication

## The Challenge

In distributed systems, "Exactly-Once Delivery" is incredibly hard to achieve. Message brokers (Kafka, RabbitMQ) typically guarantee "At-Least-Once Delivery". This means your consumer *will* occasionally receive the exact same message twice (e.g., due to a network timeout during an acknowledgment).

You are building a Loyalty Points service. When a user completes a purchase, an event is emitted. The Loyalty service adds 100 points to the user's account. If a message is duplicated, a user might accidentally receive 200 points!

Your task: Use Redis as a state store to implement the **Idempotent Consumer Pattern**. Ensure that even if the `award_points` event for `transaction_999` is received 5 times, the user is only awarded points exactly once.

## Starter Template

```javascript
const { createClient } = require('redis');

// Assume a generic Message Queue consumer loop
async function processMessage(message) {
  const payload = JSON.parse(message.value);
  // payload = { transactionId: 'tx_999', userId: 'user_1', points: 100 }

  const redis = createClient();
  await redis.connect();

  // YOUR CODE HERE:
  // 1. Check if transactionId has already been processed
  // 2. If yes, skip processing (Idempotent return)
  // 3. If no, update DB (simulated) AND mark transactionId as processed in Redis
  // 4. Ensure there is no race condition if 2 duplicate messages arrive at the exact same millisecond!

  await redis.disconnect();
}
```

## Solution & Walkthrough

<details>
<summary><strong>View Full Production Solution</strong></summary>

```javascript
const { createClient } = require('redis');

async function simulateDatabaseUpdate(userId, points) {
  console.log(`[Database] Added ${points} points to ${userId}`);
  await new Promise(res => setTimeout(res, 50));
}

async function processMessage(messagePayload) {
  const payload = JSON.parse(messagePayload);
  const { transactionId, userId, points } = payload;

  const redis = createClient({ url: 'redis://localhost:6379' });
  await redis.connect();

  const idempotencyKey = `processed:loyalty:tx:${transactionId}`;

  try {
    // 1. ATTEMPT TO ACQUIRE THE LOCK (Deduplication Check)
    // SET NX (Not eXists) EX (Expire in 24 hours)
    // This is an ATOMIC operation. It returns "OK" if it set the key,
    // or null if the key already existed.
    const lockAcquired = await redis.set(idempotencyKey, 'processing', {
      NX: true,
      EX: 86400 // Keep memory clean, assume duplicates won't arrive 24h later
    });

    if (!lockAcquired) {
      console.log(`[Idempotency] Message ${transactionId} already processed or in progress. Skipping!`);
      return { status: 'skipped_duplicate' };
    }

    // 2. PROCESS BUSINESS LOGIC
    console.log(`[Processor] Processing new transaction ${transactionId}...`);
    await simulateDatabaseUpdate(userId, points);

    // 3. MARK AS COMPLETELY DONE
    await redis.set(idempotencyKey, 'done', { EX: 86400 });

    return { status: 'success' };

  } catch (error) {
    // If the DB update fails, we MUST delete the idempotency key so that
    // when the message broker retries the message, we don't skip it!
    console.error(`[Error] DB update failed for ${transactionId}. Removing lock.`);
    await redis.del(idempotencyKey);
    throw error;
  } finally {
    await redis.disconnect();
  }
}

// --- TEST SUITE (Simulating duplicate delivery) ---
async function runTest() {
  const event = JSON.stringify({ transactionId: 'tx_999', userId: 'user_1', points: 100 });

  // Simulate the broker delivering the same message twice concurrently!
  console.log("Simulating concurrent duplicate delivery...");
  await Promise.all([
    processMessage(event),
    processMessage(event)
  ]);
}

// runTest();
```

### Architecture Diagram
```text
(Duplicate Messages Arrive Simultaneously)
[Msg A: tx_999]       [Msg B: tx_999]
       |                     |
       v                     v
[ Worker 1 ]          [ Worker 2 ]
       |                     |
       +--------+   +--------+
                |   |
                v   v
       [ Redis: SET NX processed:tx_999 ]
                |
    (Redis atomic single-threaded execution)
                |
   +------------+------------+
   |                         |
 Worker 1 receives "OK"     Worker 2 receives null
   |                         |
   v                         v
[ Update SQL DB ]       [ Silently Ack & Skip ]
```

### Walkthrough & Concepts
The most common mistake developers make here is a "Read-Modify-Write" anti-pattern:
1. `let exists = redis.get('tx_999')`
2. `if (!exists) { redis.set('tx_999', true); processDB(); }`

If two identical messages arrive at the exact same millisecond, Worker 1 and Worker 2 both run Step 1. Both see `exists == null`. Both proceed to Step 2, and both write to the DB, resulting in 200 points awarded.

By using Redis `SET ... NX`, we leverage Redis's single-threaded atomic nature. Only one worker will receive the "OK" lock. The other will instantly know it is holding a duplicate message.
Furthermore, the `catch` block is critical. If the DB goes down mid-process, we must release the lock (`redis.del()`), otherwise the broker's retry will be incorrectly ignored, and the user gets 0 points!
</details>
