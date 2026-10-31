# Challenge 1: Resilient RabbitMQ Consumer with DLQ

## The Challenge

You are building a microservice that processes profile image uploads for a social network. The system receives messages via RabbitMQ containing the image URL. The worker must download the image, resize it, and save it.

However, external URLs can be flaky (404s, timeouts), and sometimes users submit invalid data (e.g., a URL pointing to a PDF).

Your task is to build a resilient Node.js worker using `amqplib` that implements:
1. **Manual Acknowledgements:** Do not `ack` until the work is fully complete.
2. **Exponential Backoff:** If the download fails (simulate this), wait `attempts * 2` seconds before putting it back on the queue.
3. **Dead Letter Queue (DLQ) Routing:** If a message fails 3 times, route it to a `profile_image_dlq` exchange and `ack` the original message to remove it from the main queue.

## Starter Template

```javascript
const amqp = require('amqplib');

async function processImage(url) {
  // Simulate network conditions
  if (url.includes('.pdf')) throw new Error("Invalid format: PDF");
  if (Math.random() < 0.7) throw new Error("Network timeout");
  return `Resized image from ${url}`;
}

async function startWorker() {
  const conn = await amqp.connect('amqp://localhost');
  const channel = await conn.createChannel();

  const mainQueue = 'profile_images';
  await channel.assertQueue(mainQueue, { durable: true });

  console.log('Worker listening for images...');

  // YOUR CODE HERE: Consume messages, handle retries, and route to DLQ
}

// To test, write a quick producer script!
```

## Solution & Walkthrough

<details>
<summary><strong>View Full Production Solution</strong></summary>

```javascript
const amqp = require('amqplib');

async function processImage(url) {
  if (url.includes('.pdf')) throw new Error("Invalid format: PDF");
  if (Math.random() < 0.7) throw new Error("Network timeout");
  return `Resized image from ${url}`;
}

async function startWorker() {
  const conn = await amqp.connect('amqp://localhost');
  const channel = await conn.createChannel();

  // 1. Setup Main Queue and DLQ infrastructure
  const mainQueue = 'profile_images';
  const dlqExchange = 'profile_images_dlx';
  const dlqQueue = 'profile_images_dlq';

  await channel.assertExchange(dlqExchange, 'direct', { durable: true });
  await channel.assertQueue(dlqQueue, { durable: true });
  await channel.bindQueue(dlqQueue, dlqExchange, 'routing_key_dlq');

  await channel.assertQueue(mainQueue, { durable: true });

  channel.prefetch(1);
  console.log('Worker listening for images...');

  // Local state for retries (Note: In production RabbitMQ, you'd ideally use x-death headers,
  // but local state is acceptable for this code challenge pattern).
  const retryMap = new Map();

  channel.consume(mainQueue, async (msg) => {
    if (msg === null) return;

    const payload = JSON.parse(msg.content.toString());
    const messageId = payload.jobId || msg.fields.deliveryTag.toString();
    const attempts = (retryMap.get(messageId) || 0) + 1;
    retryMap.set(messageId, attempts);

    try {
      console.log(`[Attempt ${attempts}] Processing ${payload.url}...`);
      const result = await processImage(payload.url);

      console.log(`✅ Success: ${result}`);
      channel.ack(msg);
      retryMap.delete(messageId); // Clean up state

    } catch (error) {
      if (attempts >= 3 || error.message.includes('Invalid format')) {
        // Poison Pill or Max Retries: Route to DLQ
        console.error(`❌ Permanent Failure for ${payload.url}. Routing to DLQ. Reason: ${error.message}`);

        const dlqPayload = {
            original_payload: payload,
            error: error.message,
            failed_at: new Date().toISOString()
        };

        channel.publish(dlqExchange, 'routing_key_dlq', Buffer.from(JSON.stringify(dlqPayload)));

        // Acknowledge to remove from MAIN queue!
        channel.ack(msg);
        retryMap.delete(messageId);

      } else {
        // Transient Failure: Exponential Backoff & Requeue
        console.warn(`⚠️ Transient Failure. Backing off for ${attempts * 2} seconds...`);

        await new Promise(res => setTimeout(res, attempts * 2000));

        // nack with requeue=true
        channel.nack(msg, false, true);
      }
    }
  }, { noAck: false }); // Ensure manual acks
}
```

### Architecture Diagram
```text
[ Producer ] -> (Queue: profile_images) -> [ Worker Consumer ]
                                                |
                                          (Success) -> [ ack() ]
                                                |
                                        (Fail < 3x) -> [ wait(N) ] -> [ nack(requeue=true) ]
                                                |
                               (Fail 3x or Fatal) -> [ publish to DLX ] -> [ ack() main msg ]
                                                v
                                  (Exchange: profile_images_dlx)
                                                v
                                  (Queue: profile_images_dlq)
```

### Testing the Solution
Use a simple script or tests (e.g. using Jest) to publish messages like `{"jobId": 1, "url": "http://image.jpg"}` and `{"jobId": 2, "url": "http://doc.pdf"}`. You will see the `.jpg` fail up to 2 times, waiting 2s then 4s, before eventually succeeding or DLQing. The `.pdf` will immediately route to the DLQ on attempt 1 because of the `includes('Invalid format')` fast-fail check.
</details>
