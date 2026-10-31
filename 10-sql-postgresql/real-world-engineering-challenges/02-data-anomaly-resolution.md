# Challenge 2: Data Anomaly Resolution & Refactoring

## Objective
Identify severe architectural flaws in a denormalized legacy table and write the SQL to refactor it into 3rd Normal Form (3NF) without losing data, then query it.

## Problem Statement
Your company bought a startup. Their core "Database" is a single massive table called `raw_events`.

```sql
CREATE TABLE raw_events (
    event_id SERIAL PRIMARY KEY,
    user_email VARCHAR(255),
    user_full_name VARCHAR(255),
    product_sku VARCHAR(50),
    product_name VARCHAR(255),
    product_price NUMERIC(10,2),
    purchase_time TIMESTAMP
);
```

**The Pain Points:**
1.  **Update Anomalies:** If a product's price changes, you have to update millions of rows.
2.  **Insert Anomalies:** You cannot add a new product to the system until someone buys it.

## Challenge Instructions
1.  **Schema Design:** Design three normalized tables: `customers`, `products`, and `purchases`.
2.  **Data Migration:** Write the `INSERT INTO ... SELECT DISTINCT` statements required to migrate data from `raw_events` into your three new tables. (Assume `raw_events` has data).
3.  **Validation:** Write a `JOIN` query combining your three new tables to recreate the exact output of the original `raw_events` table to prove no data was lost.

<details>
<summary>Principal Engineer Solution & Walkthrough</summary>

### The Complete Solution

```sql
-- Phase 1: Create Normalized Schema
CREATE TABLE customers (
    id SERIAL PRIMARY KEY,
    email VARCHAR(255) UNIQUE NOT NULL,
    full_name VARCHAR(255)
);

CREATE TABLE products (
    sku VARCHAR(50) PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    current_price NUMERIC(10,2) NOT NULL
);

CREATE TABLE purchases (
    id SERIAL PRIMARY KEY,
    customer_id INT REFERENCES customers(id),
    product_sku VARCHAR(50) REFERENCES products(sku),
    purchase_time TIMESTAMP NOT NULL,
    price_at_time NUMERIC(10,2) NOT NULL -- Crucial for historical accuracy
);

-- Phase 2: Data Migration (ETL)

-- 2a. Extract and load unique Customers
INSERT INTO customers (email, full_name)
SELECT DISTINCT user_email, user_full_name
FROM raw_events
WHERE user_email IS NOT NULL;

-- 2b. Extract and load unique Products
-- Note: If a product had multiple prices over time, we just take the most recent one for 'current_price'
-- For simplicity in this challenge, we assume the price in the latest event is current.
INSERT INTO products (sku, name, current_price)
SELECT DISTINCT ON (product_sku)
    product_sku,
    product_name,
    product_price
FROM raw_events
ORDER BY product_sku, purchase_time DESC;

-- 2c. Load the transactional relationships
INSERT INTO purchases (customer_id, product_sku, purchase_time, price_at_time)
SELECT
    c.id,
    r.product_sku,
    r.purchase_time,
    r.product_price
FROM raw_events r
INNER JOIN customers c ON r.user_email = c.email;

-- Phase 3: Validation Query (Recreating the Flat View)
SELECT
    p.id AS event_id,
    c.email AS user_email,
    c.full_name AS user_full_name,
    pr.sku AS product_sku,
    pr.name AS product_name,
    p.price_at_time AS product_price, -- Use the historical price!
    p.purchase_time
FROM purchases p
INNER JOIN customers c ON p.customer_id = c.id
INNER JOIN products pr ON p.product_sku = pr.sku;
```

### Walkthrough & Architecture Notes
-   **The `price_at_time` Column:** This is the hallmark of a Senior/Principal engineer. Normalization dictates we move `price` to the `products` table. However, if a product costs $10 today, and a customer bought it for $5 last year, our historical financial records will be destroyed if we just `JOIN` to `products.current_price`. Therefore, the `purchases` join table *must* store a snapshot of the price at the time of the transaction.
-   **`SELECT DISTINCT ON`:** Postgres provides a powerful tool to solve the "latest record" problem. By using `DISTINCT ON (product_sku)` and `ORDER BY product_sku, purchase_time DESC`, we grab exactly one row per SKU, specifically the one with the most recent timestamp.
-   **Data Integrity:** We can now insert a new Product without a user buying it, and we can change a user's name in exactly one place. We have successfully reached 3NF.
</details>

## Starter Template

```sql
-- Phase 1: Create Normalized Schema
-- customers

-- products

-- purchases

-- Phase 2: Data Migration (ETL)

-- Phase 3: Validation Query
```

## Test Suite

```sql
-- Test 1: Run the Validation Query
-- Ensure the row count matches `SELECT COUNT(*) FROM raw_events`.

-- Test 2: Check for Duplicates
-- `SELECT COUNT(email), email FROM customers GROUP BY email HAVING COUNT(email) > 1;`
-- This should return 0 rows.

-- Test 3: Verify Historical Prices
-- Find a product whose price changed over time in `raw_events`.
-- Verify that the `purchases` table has different `price_at_time` values for different purchases of that product.
```
