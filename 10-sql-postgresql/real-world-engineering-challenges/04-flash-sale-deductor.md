# Challenge 4: High-Concurrency Flash Sale Deductor

## Objective
Implement an atomic inventory deduction mechanism capable of handling extreme concurrency (e.g., a Black Friday flash sale) without overselling inventory, utilizing the `RETURNING` clause to minimize network round-trips.

## Problem Statement
You are selling 100 limited-edition sneakers. 50,000 bots hit your "Buy" endpoint at the exact same millisecond.

If your application code does this:
1. `SELECT stock FROM products WHERE id = 1;` (Returns 100)
2. `if stock > 0`
3. `UPDATE products SET stock = stock - 1 WHERE id = 1;`

All 50,000 bots will read `100` at step 1. All 50,000 bots will pass the `if` statement. All 50,000 will decrement the stock. Your stock will become -49,900. You have oversold and your company is ruined.

## Challenge Instructions
Write a **single** SQL query that:
1. Filters for the product ID.
2. Ensures the stock is greater than 0.
3. Decrements the stock by 1.
4. Returns the updated stock number back to the application in the exact same network request.

<details>
<summary>Principal Engineer Solution & Walkthrough</summary>

### The Complete Solution

```sql
-- Assume product ID is 1.

UPDATE products
SET stock_quantity = stock_quantity - 1
WHERE id = 1
  AND stock_quantity > 0  -- The atomic gatekeeper
RETURNING stock_quantity;
```

### Walkthrough & Architecture Notes
-   **The Atomic Gatekeeper:** By moving the `stock_quantity > 0` check into the `WHERE` clause of the `UPDATE` statement, we hand the concurrency problem directly to the PostgreSQL Transaction Manager.
-   PostgreSQL handles `UPDATE` statements atomically on a per-row basis. When the 50,000 bots hit the database, Postgres queues them up in a microscopic, invisible line.
-   Bot 1 updates the stock from 100 to 99.
-   Bot 100 updates the stock from 1 to 0.
-   Bot 101 tries to update. The `WHERE` clause evaluates: `is id = 1? Yes. is stock_quantity > 0? No (it is 0).` The `WHERE` clause fails. The row is *not* updated.
-   **The `RETURNING` Clause:** Normally, an `UPDATE` just returns a tag like `UPDATE 1` (meaning 1 row was affected). If your backend needs to know what the new stock level is, you would normally have to do a `SELECT` after the `UPDATE`, which takes another 10ms network round trip. `RETURNING stock_quantity` attaches the newly updated data to the response of the `UPDATE` statement, cutting network latency in half and increasing throughput.
-   **Backend Logic:** In your Python/Node app, you simply check if the database returned a row. If it returned `99`, the sale was successful. If it returned nothing (an empty array/result set), it means the `WHERE` clause failed because the stock was 0, and you can safely return an "Out of Stock" error to the bot.
</details>

## Starter Template

```sql
-- Your Atomic UPDATE statement here
-- Remember to use the RETURNING clause!
```

## Test Suite

```sql
-- Test 1: Successful Deduction
-- Set product stock to 5.
-- Run your query.
-- Verify it returns 4.

-- Test 2: Out of Stock
-- Set product stock to 0.
-- Run your query.
-- Verify it returns NO ROWS (not an error, just an empty result set).

-- Test 3: Partial Stock
-- Set product stock to 1.
-- Run your query. It should return 0.
-- Run it again. It should return NO ROWS.
```
