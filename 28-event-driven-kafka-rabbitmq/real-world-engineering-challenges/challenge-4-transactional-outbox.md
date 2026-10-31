# Challenge 4: Transactional Outbox Pattern

## The Challenge

You are building the Checkout Service for an e-commerce platform. When a user checks out, two things must happen:
1. Save the `Order` into your primary PostgreSQL database.
2. Publish an `OrderCreated` event to Kafka so the Inventory and Shipping services can begin their work.

**The Dual-Write Problem:**
If you save to Postgres, then publish to Kafka, what happens if Kafka is down? The DB has the order, but downstream services never know about it. The order is lost.
If you publish to Kafka, then save to Postgres, what happens if Postgres is down? Downstream services ship the item, but the order doesn't exist in your DB.

Your task: Implement the **Transactional Outbox Pattern** to guarantee dual-write consistency.

## Starter Template

```javascript
const { Client } = require('pg');
const { Kafka } = require('kafkajs');

// Assume Express route handler
async function checkout(req, res) {
  const db = new Client({ connectionString: 'postgres://localhost:5432/ecommerce' });
  await db.connect();

  const orderData = req.body; // { userId: 1, total: 100 }

  // YOUR CODE HERE
  // 1. Begin a Postgres Transaction
  // 2. Insert into the `orders` table
  // 3. Insert the Kafka event payload into the `outbox_events` table (in the SAME transaction)
  // 4. Commit transaction

  res.send({ status: 'Order processing' });
  await db.end();
}

// Write a secondary worker process (The "Relay") that reads from `outbox_events` and publishes to Kafka.
```

## Solution & Walkthrough

<details>
<summary><strong>View Full Production Solution</strong></summary>

### 1. The Database Schema
```sql
CREATE TABLE orders (
    id SERIAL PRIMARY KEY,
    user_id INT,
    total DECIMAL
);

CREATE TABLE outbox_events (
    id SERIAL PRIMARY KEY,
    aggregatetype VARCHAR(50),
    aggregateid INT,
    type VARCHAR(50),
    payload JSONB,
    published BOOLEAN DEFAULT FALSE
);
```

### 2. The Application Service (The Producer)
```javascript
const { Client } = require('pg');

async function checkout(orderData) {
  const db = new Client({ connectionString: 'postgres://localhost:5432/ecommerce' });
  await db.connect();

  try {
    // 1. Start ACID Transaction
    await db.query('BEGIN');

    // 2. Insert the Business Entity
    const orderRes = await db.query(
      'INSERT INTO orders(user_id, total) VALUES($1, $2) RETURNING id',
      [orderData.userId, orderData.total]
    );
    const orderId = orderRes.rows[0].id;

    // 3. Insert the Event into the Outbox table (Same Transaction!)
    const eventPayload = { orderId, ...orderData, timestamp: new Date() };
    await db.query(
      `INSERT INTO outbox_events(aggregatetype, aggregateid, type, payload)
       VALUES($1, $2, $3, $4)`,
      ['Order', orderId, 'OrderCreated', JSON.stringify(eventPayload)]
    );

    // 4. Commit. If DB fails here, BOTH order and event are rolled back.
    // If it succeeds, BOTH are saved securely to disk. Zero chance of inconsistency.
    await db.query('COMMIT');
    console.log(`Order ${orderId} saved to DB and Outbox.`);

  } catch (error) {
    await db.query('ROLLBACK');
    throw error;
  } finally {
    await db.end();
  }
}
```

### 3. The Relay Worker (The Publisher)
*This runs as a background process, completely decoupled from the web request.*

```javascript
const { Client } = require('pg');
const { Kafka } = require('kafkajs');

async function runOutboxRelay() {
  const db = new Client({ connectionString: 'postgres://localhost:5432/ecommerce' });
  await db.connect();

  const kafka = new Kafka({ clientId: 'outbox-relay', brokers: ['localhost:9092'] });
  const producer = kafka.producer();
  await producer.connect();

  // Poll the database every 2 seconds for unpublished events
  setInterval(async () => {
    try {
      // Get batch of unpublished events (FOR UPDATE SKIP LOCKED prevents concurrent relay workers from grabbing the same rows)
      const res = await db.query(`
        SELECT * FROM outbox_events
        WHERE published = false
        ORDER BY id ASC LIMIT 50
        FOR UPDATE SKIP LOCKED
      `);

      for (const row of res.rows) {
        console.log(`[Relay] Publishing event ${row.id}...`);

        // 1. Publish to Kafka
        await producer.send({
          topic: 'order-events',
          messages: [{
            key: row.aggregateid.toString(), // Important for partitioning!
            value: JSON.stringify(row.payload)
          }]
        });

        // 2. Mark as published in DB
        await db.query('UPDATE outbox_events SET published = true WHERE id = $1', [row.id]);

        // Note: Real implementations often just DELETE the row to keep the outbox table small.
      }
    } catch (err) {
      console.error("Relay error:", err);
    }
  }, 2000);
}
```

### Architecture Diagram
```text
[ Web Request ]
      |
      v
[ Checkout Handler ] --(ACID Transaction)--> [ PostgreSQL DB ]
                                                 |-- (Table: orders)
                                                 |-- (Table: outbox_events)  <-- (Events queue up here)
                                                       ^
                                                       | (Polling / CDC)
                                                       v
                                                [ Outbox Relay Worker ]
                                                       |
                                                       v
                                                [ Kafka Broker ]
                                                       |
                                                       v
                                         [ Downstream Microservices ]
```

### Walkthrough & Concepts
The Transactional Outbox pattern is the definitive answer to the "Dual Write Problem". By saving the event payload directly into the relational database alongside the business entity, we leverage the DB's ACID properties. It is impossible for the order to exist without the event also existing.
The Relay worker operates asynchronously. If Kafka is down for 2 hours, the web server doesn't crash; it keeps writing to the Outbox table. When Kafka comes back, the Relay worker resumes polling and pushes the 2-hour backlog of events to Kafka.
*(Pro Tip: In massive scale systems, instead of polling the DB with `SELECT`, teams use Change Data Capture (CDC) tools like Debezium, which tail the Postgres Write-Ahead Log (WAL) and stream changes directly to Kafka).*
</details>
