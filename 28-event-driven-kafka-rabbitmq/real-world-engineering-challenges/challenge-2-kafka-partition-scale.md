# Challenge 2: High-Throughput Kafka Partitioning Strategy

## The Challenge

You are the lead engineer for an order fulfillment platform processing 10,000 orders per second globally.
The current setup has a Kafka topic `global-orders` with 1 partition, and a single worker. It is buckling under the load.

Your goals:
1. Scale the topic up to 10 partitions.
2. Ensure that all state updates for a specific `orderId` (e.g., CREATED, SHIPPED, DELIVERED) go to the exact same partition. (If they go to different partitions, `DELIVERED` might be processed before `CREATED` due to varying worker speeds, causing database integrity errors!).
3. Write a simulation script using `kafkajs` (or simulated classes) that proves that events for `order_123` always land on the same partition, while events for `order_456` land elsewhere.

## Starter Template

```javascript
const { Kafka } = require('kafkajs');

// Assume Kafka is running locally on 9092
const kafka = new Kafka({ clientId: 'fulfillment', brokers: ['localhost:9092'] });

async function run() {
  const admin = kafka.admin();
  await admin.connect();

  // 1. Create Topic with 10 partitions
  // YOUR CODE HERE

  const producer = kafka.producer();
  await producer.connect();

  const events = [
    { orderId: 'order_A', status: 'CREATED' },
    { orderId: 'order_B', status: 'CREATED' },
    { orderId: 'order_A', status: 'SHIPPED' },
  ];

  // 2. Publish events ensuring order_A events go to the same partition
  // YOUR CODE HERE

  // 3. Create a consumer group to verify partition assignment
  // YOUR CODE HERE
}
```

## Solution & Walkthrough

<details>
<summary><strong>View Full Production Solution</strong></summary>

```javascript
const { Kafka } = require('kafkajs');

const kafka = new Kafka({ clientId: 'fulfillment', brokers: ['localhost:9092'] });

async function run() {
  const topicName = 'global-orders';

  // 1. Setup Infrastructure
  const admin = kafka.admin();
  await admin.connect();

  // Check if topic exists, if not create with 10 partitions
  const topics = await admin.listTopics();
  if (!topics.includes(topicName)) {
    console.log(`Creating topic ${topicName} with 10 partitions...`);
    await admin.createTopics({
      topics: [{
        topic: topicName,
        numPartitions: 10,
        replicationFactor: 1 // In production, this should be 3!
      }]
    });
  }
  await admin.disconnect();

  // 2. Produce Events with Partition Keys
  const producer = kafka.producer();
  await producer.connect();

  const events = [
    { orderId: 'order_A', status: 'CREATED' },
    { orderId: 'order_B', status: 'CREATED' },
    { orderId: 'order_C', status: 'CREATED' },
    { orderId: 'order_A', status: 'SHIPPED' },
    { orderId: 'order_B', status: 'DELIVERED' },
    { orderId: 'order_A', status: 'DELIVERED' },
  ];

  for (const event of events) {
    await producer.send({
      topic: topicName,
      messages: [
        {
          // THIS IS THE CRITICAL LINE. By using orderId as the key, Kafka's
          // DefaultPartitioner hashes the string and modulo divides it by 10.
          // hash("order_A") % 10 will ALWAYS equal the same partition number.
          key: event.orderId,
          value: JSON.stringify(event)
        }
      ],
    });
  }
  await producer.disconnect();
  console.log('Events published.');

  // 3. Consumer Verification
  const consumer = kafka.consumer({ groupId: 'fulfillment-workers' });
  await consumer.connect();
  // fromBeginning ensures we read the events we just published
  await consumer.subscribe({ topic: topicName, fromBeginning: true });

  await consumer.run({
    eachMessage: async ({ topic, partition, message }) => {
      const key = message.key.toString();
      const value = JSON.parse(message.value.toString());
      console.log(`Partition [${partition}] handled event for ${key} -> ${value.status}`);
    },
  });

  // Keep process alive briefly to receive logs
  setTimeout(() => process.exit(0), 5000);
}

run().catch(console.error);
```

### Architecture Diagram
```text
Producer Array of Events
 [ A_CREATE, B_CREATE, A_SHIP ]
             |
             v (Hash Key)
  Hash("order_A") = Partition 3
  Hash("order_B") = Partition 7
             |
             v
+-----------------------------+
| TOPIC: global-orders        |
| Partition 0:                |
| Partition 3: [ A_CREATE ] -> [ A_SHIP ]   <-- Strict FIFO ordering for 'A'
| Partition 7: [ B_CREATE ]                 <-- Strict FIFO ordering for 'B'
| Partition 9:                |
+-----------------------------+
```

### Walkthrough & Concepts
If you did not provide a `key` (or provided a null key), Kafka would use a "Round Robin" strategy. `A_CREATE` goes to P0, `B_CREATE` goes to P1, `A_SHIP` goes to P2.
If Worker 1 (reading P0) connects to a slow database, and Worker 3 (reading P2) connects to a fast database, Worker 3 might write the `SHIPPED` status to the database *before* Worker 1 writes the `CREATED` status. This results in foreign-key violations or illogical state transitions in your core database.
Partition Keys (`key: orderId`) are the industry-standard way to guarantee ordering for a specific entity in a distributed, parallelized system.
</details>
