# Module 05: Performance & Safety (B-Tree Indexes & EXPLAIN ANALYZE, ACID Transactions & Locks, CTEs, Window Functions)

## Phase A: The Core Concept

### 1. Real-World Pain Point (The Why)
**Pain 1 (Performance):** Searching for `user@email.com` in a table of 10 million users takes 5 seconds because Postgres scans every single row from top to bottom (Sequential Scan).
**Pain 2 (Safety):** A user transfers $100 to a friend. The database deducts $100 from User A, but the server crashes right before it adds $100 to User B. The money has vanished into the digital void.

### 2. Plain English Metaphor (The What)
- **Indexes:** Trying to find a topic in a 1,000-page textbook by reading every page is a Sequential Scan. Looking at the Index at the back of the book, finding the topic, and jumping straight to page 742 is a **B-Tree Index**. It makes lookups nearly instantaneous.
- **ACID Transactions:** Imagine a bank teller. You give them a check to deposit, and you want cash back. If the bank catches on fire halfway through the transaction, the transaction is completely rolled back as if it never happened. It's "All or Nothing." This is **Atomicity**.

### 3. Complete Runnable Code
```sql
-- 1. Setup Data
CREATE TABLE accounts (
    id SERIAL PRIMARY KEY,
    name VARCHAR(50),
    balance NUMERIC(10,2) CHECK (balance >= 0) -- Constraint prevents overdrafts
);
INSERT INTO accounts (name, balance) VALUES ('Alice', 500.00), ('Bob', 100.00);

-- 2. Performance: Indexes and EXPLAIN ANALYZE
CREATE INDEX idx_accounts_name ON accounts(name);

EXPLAIN ANALYZE
SELECT * FROM accounts WHERE name = 'Bob';

-- 3. Safety: ACID Transactions
BEGIN; -- Starts the transaction wrapper

UPDATE accounts SET balance = balance - 100 WHERE name = 'Alice';
-- If the server crashes here, the database will ROLLBACK automatically.
UPDATE accounts SET balance = balance + 100 WHERE name = 'Bob';

COMMIT; -- Commits the changes permanently to disk
```

### 4. Progressive Step-by-Step Breakdown

#### Step 1: The B-Tree Index (CREATE INDEX)
```sql
CREATE INDEX idx_accounts_name ON accounts(name);
```
- Postgres copies all the names into a separate data structure called a B-Tree (Balanced Tree).
- It sorts them alphabetically. When you search for 'Bob', it doesn't scan Alice or Charlie; it navigates the tree to find 'Bob' in `O(log N)` time, then uses a pointer to fetch the full row from the main table.

#### Step 2: Looking Under the Hood (EXPLAIN ANALYZE)
```sql
EXPLAIN ANALYZE SELECT * FROM accounts WHERE name = 'Bob';
```
- `EXPLAIN` tells you the *plan* Postgres intends to use (e.g., "Index Scan" vs "Seq Scan").
- `ANALYZE` actually *executes* the query and tells you exactly how many milliseconds it took.
- This is your primary diagnostic tool when queries are slow.

#### Step 3: The All-or-Nothing Wrapper (BEGIN / COMMIT)
```sql
BEGIN;
UPDATE ...
UPDATE ...
COMMIT;
```
- `BEGIN` opens a temporary sandbox.
- The two `UPDATE` statements happen inside this sandbox. To the rest of the application, Alice still has $500. (Isolation).
- If anything fails, or if you type `ROLLBACK;`, the sandbox is destroyed, and the database remains untouched.
- `COMMIT` takes the sandbox and applies it to the permanent database atomically.

### 5. ASCII Data Flow
**Transaction Flow:**
```text
[ Current State: Alice 500, Bob 100 ]
         |
      (BEGIN) --> Opens Transaction Sandbox
         |
    (UPDATE 1) -> Alice becomes 400 (In Sandbox)
         |
    (UPDATE 2) -> Bob becomes 200 (In Sandbox)
         |
     (COMMIT) --> [ New Permanent State: Alice 400, Bob 200 ]
```

### 6. Noob Trap vs Pro Tip
- **Noob Trap:** Indexing every single column. Indexes speed up `SELECT` (reads) but slow down `INSERT/UPDATE/DELETE` (writes) because every time you modify the table, Postgres has to update every B-Tree. Only index columns used heavily in `WHERE` or `JOIN` clauses.
- **Pro Tip:** Using `FOR UPDATE` locks. If two people try to withdraw money from Alice's account at the exact same millisecond, they might both read `$500`, both deduct `$500`, and both save `$0`. Alice just spent `$1000` but only `$500` was deducted.
Use `SELECT balance FROM accounts WHERE name = 'Alice' FOR UPDATE;`. This locks the row. The second transaction must wait in line until the first transaction `COMMIT`s.

---

## Phase B: Engineering Challenges

### Level 1: Warm-Up
**Task:** You have a `logs` table that is slow. You frequently run `SELECT * FROM logs WHERE created_at > '2023-01-01'`. Write the SQL to create an index that will speed up this specific query.

<details>
<summary>Hint</summary>
Name the index something descriptive like <code>idx_logs_created_at</code> and index the <code>created_at</code> column.
</details>

<details>
<summary>Solution Walkthrough</summary>

```sql
CREATE INDEX idx_logs_created_at ON logs(created_at);
```
- By indexing the timestamp, Postgres can jump straight to the '2023-01-01' node in the B-Tree and read forward, rather than scanning all logs from 2020.
</details>

### Level 2: Real-World
**Task:** Write a transaction to delete a user (`id = 5`) from a `users` table, and simultaneously insert a record into an `audit_logs` table stating "User 5 deleted". Ensure both happen or neither happens.

<details>
<summary>Hint</summary>
Wrap the <code>DELETE</code> and <code>INSERT</code> statements in a <code>BEGIN;</code> and <code>COMMIT;</code> block.
</details>

<details>
<summary>Solution Walkthrough</summary>

```sql
BEGIN;

DELETE FROM users WHERE id = 5;

INSERT INTO audit_logs (action, description)
VALUES ('DELETE', 'User 5 deleted');

COMMIT;
```
- If the database disk fills up exactly after the `DELETE` but before the `INSERT`, the transaction fails and the user is NOT deleted. This guarantees your audit logs are perfectly synchronized with your actual data.
</details>

### Level 3: Boss Level
**Task:** (Cumulative) Common Table Expressions (CTEs) & Window Functions.
You have an `employees` table (id, name, department_id, salary).
Write a query using a `WITH` clause (CTE) to first find the average salary per department.
Then, `JOIN` that CTE to the main `employees` table to find all employees who earn *more* than their department's average.

*(Note: While this can be done with Window Functions like `AVG() OVER (PARTITION BY department_id)`, practice using CTEs to break down complex logic into readable steps).*

<details>
<summary>Hint</summary>
A CTE looks like this: <code>WITH DeptAvg AS (SELECT department_id, AVG(salary) as avg_sal FROM employees GROUP BY department_id)</code>. Then write your main SELECT statement referencing <code>DeptAvg</code>.
</details>

<details>
<summary>Solution Walkthrough</summary>

```sql
-- 1. Setup
CREATE TABLE employees (id SERIAL, name VARCHAR, department_id INT, salary NUMERIC);
INSERT INTO employees VALUES (1, 'Dev A', 1, 100000), (2, 'Dev B', 1, 80000), (3, 'HR A', 2, 60000), (4, 'HR B', 2, 70000);

-- 2. The CTE Query
WITH DepartmentAverages AS (
    SELECT
        department_id,
        AVG(salary) AS avg_department_salary
    FROM employees
    GROUP BY department_id
)
SELECT
    e.name,
    e.salary,
    da.avg_department_salary
FROM employees e
INNER JOIN DepartmentAverages da
    ON e.department_id = da.department_id
WHERE e.salary > da.avg_department_salary;
```
- **Why this is Principal level:** CTEs (`WITH` clauses) allow you to create temporary, virtual tables that exist only for the duration of the query.
- Step 1 creates a virtual table of averages.
- Step 2 treats that virtual table like a real table, joins it to the original employees table, and allows us to do a row-by-row comparison against the aggregated data. It makes insanely complex SQL highly readable.
</details>
