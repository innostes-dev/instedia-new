# Challenge 3: Idempotent FinTech Payment Engine

## Architecture Blueprint

This challenge creates a robust, highly-resilient payment settlement pipeline. It combines Idempotency Keys to prevent double charges, Distributed Mutex Locks to handle concurrent race conditions across multiple server instances, and the Transactional Outbox pattern to ensure reliable asynchronous processing.

**Core Requirements:**
1. **Idempotency API:** All payment requests require an `Idempotency-Key` header. Duplicate requests must return the cached result of the original request without re-charging the user.
2. **Distributed Locking (Redlock):** Prevent race conditions where two duplicate requests hit two different load-balanced servers at the exact same millisecond.
3. **Double-Entry Wallet Transfers:** Update the sender and receiver wallets within a single ACID database transaction.
4. **Transactional Outbox:** After a successful transfer, reliably trigger asynchronous notifications (e.g., Email, PDF generation) even if the background worker temporarily fails.

## Starter Template (TypeScript/Node.js/Prisma)

### Backend: Payment API with Redlock and Idempotency

```typescript
import express from 'express';
import { PrismaClient } from '@prisma/client';
import Redis from 'ioredis';
import Redlock from 'redlock';
import crypto from 'crypto';

const app = express();
app.use(express.json());

const prisma = new PrismaClient();
const redisClient = new Redis({ host: 'localhost', port: 6379 });
// 1. Setup Redlock for Distributed Mutex
const redlock = new Redlock([redisClient], { retryCount: 0 });

app.post('/api/payments/transfer', async (req, res) => {
  const idempotencyKey = req.headers['idempotency-key'] as string;
  if (!idempotencyKey) return res.status(400).json({ error: 'Idempotency-Key is required' });

  const { fromUserId, toUserId, amount } = req.body;
  const lockResource = `locks:payment:${idempotencyKey}`;

  try {
    // 2. Acquire Distributed Lock
    // This immediately fails if another server is already processing this EXACT idempotency key
    const lock = await redlock.acquire([lockResource], 10000); // 10s TTL

    try {
      // 3. Check for Idempotency (Has this key been processed already?)
      const existingRecord = await prisma.idempotencyRecord.findUnique({ where: { key: idempotencyKey } });
      if (existingRecord) {
        return res.status(200).json({ message: 'Idempotent cache hit', data: existingRecord.responsePayload });
      }

      // 4. ACID Transaction: Transfer + Outbox + Idempotency Record
      const result = await prisma.$transaction(async (tx) => {
        // A. Pessimistic Lock on Wallets (order IDs to prevent deadlock!)
        const sortedIds = [fromUserId, toUserId].sort();
        await tx.$queryRaw`SELECT id FROM "Wallet" WHERE id IN (${sortedIds[0]}, ${sortedIds[1]}) FOR UPDATE`;

        // B. Verify Balance
        const sender = await tx.wallet.findUnique({ where: { id: fromUserId } });
        if (!sender || sender.balance < amount) throw new Error("Insufficient funds");

        // C. Double-Entry Accounting
        const txId = crypto.randomUUID();
        await tx.wallet.update({ where: { id: fromUserId }, data: { balance: { decrement: amount } } });
        await tx.wallet.update({ where: { id: toUserId }, data: { balance: { increment: amount } } });

        await tx.ledgerEntry.createMany({
          data: [
            { walletId: fromUserId, amount: -amount, transactionId: txId },
            { walletId: toUserId, amount: amount, transactionId: txId }
          ]
        });

        const responsePayload = { status: 'success', transactionId: txId, amount };

        // D. Transactional Outbox (for Email worker)
        await tx.outboxEvent.create({
          data: { type: 'PAYMENT_SUCCESS', payload: responsePayload }
        });

        // E. Save Idempotency Record
        await tx.idempotencyRecord.create({
          data: { key: idempotencyKey, responsePayload }
        });

        return responsePayload;
      });

      res.status(200).json(result);

    } finally {
      // 5. Always release the lock!
      await lock.release();
    }
  } catch (error: any) {
    if (error.name === 'ExecutionError') {
      // Redlock acquire failed (concurrent request is currently running)
      return res.status(409).json({ error: 'Concurrent request detected. Please wait.' });
    }
    res.status(500).json({ error: error.message });
  }
});
```

### Background Worker: Transactional Outbox Relay

```typescript
import { Worker } from 'bullmq';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

// This cron job reads from the Postgres Outbox and pushes to BullMQ (Redis)
setInterval(async () => {
  const pendingEvents = await prisma.outboxEvent.findMany({
    where: { status: 'PENDING' },
    take: 100
  });

  for (const event of pendingEvents) {
    // Push to Redis Queue
    // await emailQueue.add('send_receipt', event.payload, { jobId: event.id });

    // Mark as published in Postgres
    await prisma.outboxEvent.update({
      where: { id: event.id },
      data: { status: 'PUBLISHED' }
    });
  }
}, 5000); // Run every 5 seconds
```

## Production Solution Walkthrough

1. **Redlock Mutex:** When Request A and Request B (duplicates with the same idempotency key) hit Server 1 and Server 2 simultaneously, they both try to execute `redlock.acquire`. Redis guarantees only one server gets the lock. Server 2 throws an `ExecutionError` immediately and returns an HTTP 409, preventing the race condition before it even touches the Postgres database.
2. **ACID Transaction:** The entire transfer block is wrapped in `prisma.$transaction`. We use a raw SQL `SELECT ... FOR UPDATE` to lock the rows of the two wallets being modified. If we didn't do this, a different transfer occurring at the exact same time could read stale balances. We sort the IDs alphabetically before locking to completely eliminate the risk of a database Deadlock.
3. **Idempotency Durability:** We store the `IdempotencyRecord` inside the same Postgres transaction. If the transaction rolls back (e.g., insufficient funds), the idempotency record is never saved. This allows the user to safely retry the request later with the same key once they have added funds.
4. **The Outbox Pattern:** We need to send an email receipt, but we cannot call `sendGrid.send()` inside the transaction. If SendGrid is slow, it holds the database lock open, crashing the app. If SendGrid succeeds but the DB commit fails, the user gets an email for a failed transaction. By inserting into the `outboxEvent` table inside the transaction, we guarantee the "Intent to Send" is safely saved to disk. The background cron job handles the actual network request to SendGrid asynchronously with retries.
