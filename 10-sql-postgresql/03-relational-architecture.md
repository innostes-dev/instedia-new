# Module 03: Relational Architecture (Normalization 3NF, INNER/LEFT/SELF JOINs, Category Trees)

## Phase A: The Core Concept

### 1. Real-World Pain Point (The Why)
You build an app and put everything in one massive `orders` table: `order_id`, `customer_name`, `customer_address`, `product_name`, `product_price`.
A customer moves to a new city. To update their address, you must find and update every single historical order they ever placed. If you miss one, their data is inconsistent. If a product price changes, do you update old orders? (No, that breaks historical accounting!). This is **Data Anomaly Hell**.

### 2. Plain English Metaphor (The What)
Imagine a restaurant menu. Instead of writing "Beef Burger (Contains: Beef, Bun, Cheese, Lettuce) - $10" 50 times on every single receipt, you have a central `Menu` (one table). The receipt (another table) just says "1x Item #4".

**Normalization (3NF)** is the process of breaking data into distinct, logical tables (Users, Products, Orders) so that every piece of data lives in exactly *one* place.
**JOINs** are the database's magical glue that temporarily stitches these separate tables back together only when you need to read them.

### 3. Complete Runnable Code
```sql
-- 1. Setup Normalized Tables (Users and Orders)
CREATE TABLE users (
    id SERIAL PRIMARY KEY,
    name VARCHAR(100) NOT NULL
);

CREATE TABLE orders (
    id SERIAL PRIMARY KEY,
    user_id INT REFERENCES users(id) ON DELETE CASCADE, -- The Foreign Key
    total NUMERIC(10,2) NOT NULL
);

INSERT INTO users (name) VALUES ('Alice'), ('Bob'), ('Charlie');
INSERT INTO orders (user_id, total) VALUES (1, 50.00), (1, 120.00), (2, 15.00);
-- Note: Charlie has 0 orders.

-- 2. INNER JOIN (Only matches)
SELECT users.name, orders.total
FROM users
INNER JOIN orders ON users.id = orders.user_id;

-- 3. LEFT JOIN (Everything from left, plus matches if they exist)
SELECT users.name, orders.total
FROM users
LEFT JOIN orders ON users.id = orders.user_id;
```

### 4. Progressive Step-by-Step Breakdown

#### Step 1: The Foreign Key (The Anchor)
```sql
    user_id INT REFERENCES users(id) ON DELETE CASCADE,
```
- The `orders` table doesn't store the user's name, just their `user_id`.
- `REFERENCES users(id)`: This is a **Foreign Key**. It enforces Referential Integrity. Postgres will physically prevent you from inserting an order for `user_id = 99` if user 99 doesn't exist.
- `ON DELETE CASCADE`: If Alice (user 1) deletes her account, Postgres automatically deletes all her orders. (Alternative: `RESTRICT` prevents deleting Alice if she has orders).

#### Step 2: INNER JOIN (The Intersection)
```sql
SELECT users.name, orders.total
FROM users
INNER JOIN orders ON users.id = orders.user_id;
```
- `INNER JOIN`: "Give me data ONLY where a user has an order."
- Charlie has no orders. Therefore, Charlie is completely excluded from the result set.

#### Step 3: LEFT JOIN (The Inclusive Fetch)
```sql
SELECT users.name, orders.total
FROM users
LEFT JOIN orders ON users.id = orders.user_id;
```
- `LEFT JOIN`: "Give me ALL users (the left table), regardless of whether they have an order. If they have orders, attach the totals. If they don't, attach NULL."
- Charlie will appear in these results, with `NULL` as his order total. This is crucial for reports like "Users who haven't bought anything yet."

### 5. ASCII Data Flow
```text
[ Table: users ]          [ Table: orders ]
| id | name    |          | id | user_id | total |
|----|---------|          |----|---------|-------|
| 1  | Alice   | <---+    | 10 | 1       | 50.00 |
| 2  | Bob     | <---|--- | 11 | 1       | 120.0 |
| 3  | Charlie |     +--- | 12 | 2       | 15.00 |

     INNER JOIN             LEFT JOIN
(Only connected rows)   (All Users, missing orders are NULL)
| name  | total |       | name    | total |
|-------|-------|       |---------|-------|
| Alice | 50.00 |       | Alice   | 50.00 |
| Alice | 120.0 |       | Alice   | 120.0 |
| Bob   | 15.00 |       | Bob     | 15.00 |
                        | Charlie | NULL  | <-- The difference!
```

### 6. Noob Trap vs Pro Tip
- **Noob Trap:** Using `SELECT *` with JOINs. It returns all columns from all tables, often resulting in duplicated columns (e.g., `id` from users, `id` from orders, `user_id` from orders), confusing backend ORMs. Always explicitly alias and select columns: `SELECT u.id as user_id, o.id as order_id`.
- **Pro Tip:** Self-Joins for Hierarchies. You don't always join *different* tables. You can join a table to itself to build things like category trees or employee-manager relationships (e.g., `employee.manager_id REFERENCES employee.id`).

---

## Phase B: Engineering Challenges

### Level 1: Warm-Up
**Task:** Given two tables: `departments` (id, name) and `employees` (id, name, department_id). Write an `INNER JOIN` query to list all employee names alongside their department names.

<details>
<summary>Hint</summary>
Use the <code>ON</code> clause to link <code>employees.department_id</code> to <code>departments.id</code>.
</details>

<details>
<summary>Solution Walkthrough</summary>

```sql
SELECT employees.name AS employee_name, departments.name AS department_name
FROM employees
INNER JOIN departments
  ON employees.department_id = departments.id;
```
- We use `AS` to alias the columns because both tables have a column called `name`. Without aliases, the output would have two indistinguishable `name` columns.
</details>

### Level 2: Real-World
**Task:** You are doing an audit. Write a query to find all `departments` that currently have **zero** employees. (Assume you have the tables from Level 1).

<details>
<summary>Hint</summary>
Use a <code>LEFT JOIN</code> starting from <code>departments</code>. What is the value of <code>employees.id</code> if a department has no matches in the employees table? (Use a <code>WHERE</code> clause).
</details>

<details>
<summary>Solution Walkthrough</summary>

```sql
SELECT departments.name
FROM departments
LEFT JOIN employees
  ON departments.id = employees.department_id
WHERE employees.id IS NULL;
```
- We start with `departments` and `LEFT JOIN` employees. This gives us ALL departments.
- If a department has no employees, the database fills the employee columns with `NULL` for that row.
- `WHERE employees.id IS NULL` filters the list to *only* show the departments where the join failed to find an employee. This is a classic "Anti-Join" pattern.
</details>

### Level 3: Boss Level
**Task:** (Cumulative) Create a self-referencing `categories` table (id, name, parent_id). `parent_id` should reference the `id` of the same table.
Insert three categories: "Electronics" (Top level, no parent), "Laptops" (Child of Electronics), and "Gaming Laptops" (Child of Laptops).
Write a query using a `LEFT JOIN` on the same table to show every category and the name of its immediate parent (if it has one). Use table aliases (`c1`, `c2`).

<details>
<summary>Hint</summary>
When joining a table to itself, you MUST use aliases. E.g., <code>FROM categories child LEFT JOIN categories parent</code>.
</details>

<details>
<summary>Solution Walkthrough</summary>

```sql
-- 1. Setup the Self-Referencing Table
CREATE TABLE categories (
    id SERIAL PRIMARY KEY,
    name VARCHAR(100) NOT NULL,
    parent_id INT REFERENCES categories(id) -- References itself!
);

-- 2. Insert Hierarchical Data
INSERT INTO categories (id, name, parent_id) VALUES
(1, 'Electronics', NULL),
(2, 'Laptops', 1),
(3, 'Gaming Laptops', 2);

-- 3. The Self-Join Query
SELECT
    child.name AS category_name,
    parent.name AS parent_category_name
FROM categories child
LEFT JOIN categories parent
  ON child.parent_id = parent.id;
```
- **Why this is Principal level:** We are modeling a Tree structure in a flat relational database.
- We alias the single `categories` table into two conceptual tables: `child` and `parent`.
- `child.parent_id = parent.id`: We ask, "Find the row in this same table where the ID matches this child's parent_id."
- We use a `LEFT JOIN` because "Electronics" has no parent (`parent_id` is NULL), and an `INNER JOIN` would exclude the top-level categories entirely!
</details>
