# Challenge 5: Distributed Telemetry Streaming Platform

## Architecture Blueprint

This challenge builds the core engine for an IoT or Analytics ingestion platform. It must handle massive bursts of traffic without crashing, protect itself using sliding-window rate limiting, queue events efficiently via Kafka, and provide full OpenTelemetry observability across the pipeline.

**Core Requirements:**
1. **API Ingestion:** A high-throughput REST endpoint that buffers data in RAM and responds with HTTP 202 instantly, avoiding database locks.
2. **Redis Rate Limiting:** A sliding-window rate limiter utilizing Redis Lua scripts to strictly enforce quota policies and prevent DDoS attacks.
3. **Kafka Event Broker:** The API produces events to a Kafka topic. Background consumer groups process this stream sequentially based on partition keys.
4. **OpenTelemetry Mesh:** Distributed traces and metrics (Prometheus) must flow from the Express API all the way down to the background consumer worker.

## Starter Template (TypeScript/Fastify/KafkaJS)

### Backend 1: API Gateway (Ingestion & Rate Limiting)

```typescript
import Fastify from 'fastify';
import Redis from 'ioredis';
import { Kafka, Partitioners } from 'kafkajs';
// Note: OpenTelemetry initialization should happen in a separate tracing.ts file imported before this!

const app = Fastify({ logger: true });
const redis = new Redis({ host: 'localhost', port: 6379 });
const kafka = new Kafka({ clientId: 'telemetry-api', brokers: ['localhost:9092'] });
const producer = kafka.producer({ createPartitioner: Partitioners.DefaultPartitioner });

// 1. Sliding Window Rate Limiter (Simplified Lua for template)
const rateLimitLua = `
  local key = KEYS[1]
  local window_ms = tonumber(ARGV[1])
  local now_ms = tonumber(ARGV[2])
  local limit = tonumber(ARGV[3])
  redis.call('ZREMRANGEBYSCORE', key, 0, now_ms - window_ms)
  if redis.call('ZCARD', key) < limit then
    redis.call('ZADD', key, now_ms, now_ms)
    redis.call('EXPIRE', key, math.ceil(window_ms / 1000))
    return 1
  else
    return 0
  end
`;
redis.defineCommand('slidingLimit', { numberOfKeys: 1, lua: rateLimitLua });

// 2. High-Throughput Buffer
let eventBuffer: any[] = [];

const flushBufferToKafka = async () => {
  if (eventBuffer.length === 0) return;
  const batch = eventBuffer;
  eventBuffer = []; // Atomic swap

  const messages = batch.map(event => ({
    key: event.deviceId, // Partition key guarantees ordering per device
    value: JSON.stringify(event)
  }));

  try {
    await producer.send({ topic: 'telemetry-events', messages });
    app.log.info(`Flushed ${messages.length} events to Kafka`);
  } catch (err) {
    app.log.error('Kafka flush failed', err);
    // Real implementation would save to a Write-Ahead Log (WAL) on disk here
  }
};

setInterval(flushBufferToKafka, 5000); // Flush every 5s

app.post('/api/ingest', async (request, reply) => {
  const deviceId = (request.body as any).deviceId || 'anonymous';

  // Apply Rate Limit (e.g., max 100 requests per 60 seconds)
  const allowed = await (redis as any).slidingLimit(`rl:${deviceId}`, 60000, Date.now(), 100);
  if (allowed === 0) {
    return reply.status(429).send({ error: 'Too Many Requests' });
  }

  // Fast Memory Buffer (O(1) operation)
  eventBuffer.push({ ...request.body as any, receivedAt: Date.now() });

  if (eventBuffer.length >= 1000) setImmediate(flushBufferToKafka);

  return reply.status(202).send({ status: 'Accepted' });
});

const start = async () => {
  await producer.connect();
  await app.listen({ port: 3000 });
};
start();
```

### Backend 2: Kafka Consumer Worker

```typescript
import { Kafka } from 'kafkajs';
// Note: OpenTelemetry initialization should happen in a separate tracing.ts file!

const kafka = new Kafka({ clientId: 'telemetry-worker', brokers: ['localhost:9092'] });
const consumer = kafka.consumer({ groupId: 'data-warehouse-writers' });

const startWorker = async () => {
  await consumer.connect();
  await consumer.subscribe({ topic: 'telemetry-events', fromBeginning: false });

  await consumer.run({
    autoCommit: false, // Manual commits for At-Least-Once delivery
    eachBatchAutoResolve: false,
    eachBatch: async ({ batch, resolveOffset, heartbeat, commitOffsetsIfNecessary }) => {
      const events = batch.messages.map(m => JSON.parse(m.value!.toString()));

      console.log(`Received batch of ${events.length} events. Writing to DB...`);

      try {
        // Simulated Bulk Database Write
        await new Promise(res => setTimeout(res, 100));

        // 3. Mark batch as successfully processed
        const lastOffset = batch.messages[batch.messages.length - 1].offset;
        resolveOffset(lastOffset);
        await commitOffsetsIfNecessary();
        await heartbeat();

      } catch (err) {
        console.error("Batch processing failed. Will retry.", err);
        // Do not commit. Kafka will resend this batch.
      }
    },
  });
};

startWorker();
```

### Docker Compose (Observability Stack)

```yaml
version: '3.8'
services:
  zookeeper:
    image: confluentinc/cp-zookeeper:latest
    environment:
      ZOOKEEPER_CLIENT_PORT: 2181
  kafka:
    image: confluentinc/cp-kafka:latest
    depends_on: [zookeeper]
    ports: ["9092:9092"]
    environment:
      KAFKA_ZOOKEEPER_CONNECT: zookeeper:2181
      KAFKA_ADVERTISED_LISTENERS: PLAINTEXT://kafka:9092
      KAFKA_OFFSETS_TOPIC_REPLICATION_FACTOR: 1
  redis:
    image: redis:alpine
    ports: ["6379:6379"]
  prometheus:
    image: prom/prometheus:latest
    ports: ["9090:9090"]
  grafana:
    image: grafana/grafana:latest
    ports: ["3001:3000"]
  jaeger:
    image: jaegertracing/all-in-one:latest
    ports: ["16686:16686", "4318:4318"]
```

## Production Solution Walkthrough

1. **Sliding Window Lua Script:** By offloading the rate-limiting math to a Redis Lua script, the API Gateway guarantees atomic execution. Even if an IoT device sends 50 requests in the exact same millisecond, the single-threaded nature of Redis executing Lua ensures the limit (100) is never breached. Using a Sorted Set (`ZADD`/`ZREMRANGEBYSCORE`) prevents the burst-bypassing flaws of traditional fixed-window limiters.
2. **Atomic Buffer Swapping:** The API endpoint never waits for Kafka. It pushes objects into a Javascript array and immediately returns `202 Accepted`. The `setInterval` cron job creates a new array reference (`batch = eventBuffer; eventBuffer = [];`). This allows the API to continue pushing to the new empty array simultaneously while the cron job spends network time flushing the `batch` to Kafka.
3. **Partition Key Integrity:** When flushing to Kafka, we set `key: event.deviceId`. This is critical. If Device A sends "Startup" and then "Shutdown", Kafka hashes the `deviceId` and places both events into Partition 2. Because a single worker inside the Consumer Group exclusively reads Partition 2, the events are guaranteed to be written to the database in the exact "Startup -> Shutdown" order.
4. **Batch Processing:** Inside the Consumer, we use `eachBatch` instead of `eachMessage`. Writing 1,000 rows to Postgres one by one is incredibly slow. By grouping them into a batch and executing a single `INSERT INTO ... VALUES (...)` query, database throughput increases exponentially. We disable `autoCommit` and only commit the Kafka offset *after* the bulk insert succeeds, ensuring no data loss.
