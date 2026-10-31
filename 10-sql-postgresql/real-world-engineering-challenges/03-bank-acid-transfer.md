# Challenge 3: Bank ACID Transfer & Deadlock Avoidance

## Objective
Write a bulletproof financial transaction that transfers funds between two accounts, adhering to strict ACID properties while architecturally avoiding distributed deadlocks under high concurrency.

## Problem Statement
You are building the core ledger for a Fintech app.
Table: `accounts (id UUID PRIMARY KEY, balance NUMERIC(15,2) CHECK (balance >= 0))`.

Two massive spikes of traffic happen simultaneously:
- Thread 1: User A transfers $50 to User B.
- Thread 2: User B transfers $20 to User A.

**The Deadlock Danger:**
If Thread 1 locks A to deduct money, and Thread 2 locks B to deduct money, Thread 1 will then try to lock B (to add money) and wait. Thread 2 will try to lock A (to add money) and wait. Both threads wait forever. Postgres will detect this and violently kill one of the transactions, resulting in failed API calls for your users.

## Challenge Instructions
Write the SQL transaction block (`BEGIN` to `COMMIT`) to transfer `$50.00` from `Account A` to `Account B`.
**Constraint:** You must use row-level locking (`FOR UPDATE`) to prevent race conditions, and you must structure the locking order to mathematically guarantee a deadlock can never occur, regardless of who is sending money to whom.

<details>
<summary>Principal Engineer Solution & Walkthrough</summary>

### The Complete Solution

```sql
-- Assume Account A ID is '11111111-...' and Account B ID is '22222222-...'
-- In application code (Python/Node), we MUST sort these IDs alphabetically first.
-- Since '1111...' < '2222...', we lock '1111...' first.

BEGIN;

-- 1. Lock the accounts in a consistent, deterministic order (Lexicographical)
-- We lock both rows simultaneously to prevent any other transaction from touching them.
SELECT id, balance
FROM accounts
WHERE id IN ('11111111-1111-1111-1111-111111111111', '22222222-2222-2222-2222-222222222222')
ORDER BY id ASC -- THE MAGIC SAUCE FOR DEADLOCK AVOIDANCE
FOR UPDATE;

-- 2. Perform the Deductions/Additions
-- (Application code would check balances here, but our CHECK constraint handles negatives)
UPDATE accounts
SET balance = balance - 50.00
WHERE id = '11111111-1111-1111-1111-111111111111';

UPDATE accounts
SET balance = balance + 50.00
WHERE id = '22222222-2222-2222-2222-222222222222';

-- 3. Record the ledger entry (Crucial for auditability)
INSERT INTO ledger (from_account, to_account, amount)
VALUES ('11111111-1111-1111-1111-111111111111', '22222222-2222-2222-2222-222222222222', 50.00);

COMMIT;
```

### Walkthrough & Architecture Notes
-   **Deadlock Prevention via Ordering:** This is a classic Operating Systems and Database concept. Deadlocks occur when resources are locked in different orders by competing threads (T1: A then B. T2: B then A). The solution is to force *every* thread in your entire application to lock resources in the exact same deterministic order.
-   By querying `ORDER BY id ASC FOR UPDATE`, whether A sends to B, or B sends to A, the database will *always* lock the lower UUID first.
-   If T1 (A->B) and T2 (B->A) happen concurrently:
    - T1 tries to lock A. Success.
    - T2 tries to lock A (because A < B). T2 is placed in a queue and waits.
    - T1 locks B. Success. T1 finishes, commits, and releases locks.
    - T2 wakes up, locks A, locks B, finishes. No deadlocks. 100% success rate.
-   **The `CHECK` Constraint:** Because our table has `CHECK (balance >= 0)`, if Account A only has $40, the `UPDATE` subtracting $50 will violate the constraint, throw an error, and the entire transaction will `ROLLBACK` automatically. We get atomic financial safety for free at the database layer.
</details>

## Starter Template

```sql
BEGIN;
-- Your deterministic locking logic here

-- Your update logic here

-- Your ledger logic here

COMMIT;
```

## Test Suite

```sql
-- Test 1: Successful Transfer
-- Setup Account A with $100 and Account B with $100.
-- Run your transaction.
-- Verify Account A has $50 and Account B has $150.

-- Test 2: Insufficient Funds
-- Setup Account A with $40 and Account B with $100.
-- Run your transaction.
-- Verify it throws a constraint violation error and that balances remain $40 and $100.

-- Test 3: Concurrent Deadlock Avoidance (Conceptual)
-- Imagine two terminal windows running psql.
-- Window 1 runs: BEGIN; SELECT ... WHERE id IN (A, B) ORDER BY id FOR UPDATE;
-- Window 2 runs the exact same query.
-- Window 2 should block and wait, not crash.
-- Window 1 runs UPDATEs and COMMIT;
-- Window 2 unblocks, runs UPDATEs and COMMIT;
```
