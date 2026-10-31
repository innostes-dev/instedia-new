# Module 01: Flat File Catastrophe (Concurrency Data Corruption, Tables, Strict Data Types, CRUD)

## Phase A: The Core Concept

### 1. Real-World Pain Point (The Why)
Imagine running a booming e-commerce store. Initially, you store all orders in a simple CSV file. It works fine for 10 orders a day. But on Black Friday, 100 customers hit "Buy" at the exact same millisecond. Your web server attempts to write 100 new lines to the same CSV file simultaneously.
**The Result:** The file gets locked, overwritten, or corrupted. Order #501 gets half-written over Order #502. Money is taken from customers, but the orders disappear. This is the **Flat File Catastrophe**. Flat files provide zero guarantees for concurrency, data integrity, or strict typing.

### 2. Plain English Metaphor (The What)
A flat file is like a shared paper notepad in a busy kitchen. If five chefs try to write down their recipes on the exact same page with different pens at the same time, you get an unreadable mess.

A **PostgreSQL Database Table** is like an automated, indestructible filing cabinet with an iron-fisted librarian.
- **Strict Data Types:** The librarian checks every piece of paper. If a form asks for an "Age" (Integer) and you write "Twenty" (Text), the librarian rejects it instantly.
- **Concurrency:** The librarian carefully queues multiple chefs, ensuring every recipe gets its own clean slot without overlapping, even if 1,000 chefs submit recipes simultaneously.
- **CRUD:** The librarian allows you to Create, Read, Update, and Delete records safely.

### 3. Complete Runnable Code
```sql
-- 1. Create a table with strict data types
CREATE TABLE users (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    email VARCHAR(255) UNIQUE NOT NULL,
    age INT CHECK (age >= 18),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- 2. Create (Insert)
INSERT INTO users (email, age)
VALUES ('pro_engineer@example.com', 32);

-- 3. Read (Select)
SELECT id, email, age
FROM users
WHERE email = 'pro_engineer@example.com';

-- 4. Update
UPDATE users
SET age = 33
WHERE email = 'pro_engineer@example.com';

-- 5. Delete
DELETE FROM users
WHERE email = 'pro_engineer@example.com';
```

### 4. Progressive Step-by-Step Breakdown

#### Step 1: Designing the Vault (CREATE)
```sql
CREATE TABLE users (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    email VARCHAR(255) UNIQUE NOT NULL,
```
- `CREATE TABLE users`: Tells Postgres to create our structured filing cabinet named "users".
- `id UUID PRIMARY KEY`: A universally unique identifier. It guarantees no two rows can have the same ID. `PRIMARY KEY` makes this the main way to uniquely identify a record.
- `DEFAULT gen_random_uuid()`: If we don't provide an ID, Postgres auto-generates one.
- `UNIQUE NOT NULL`: Ensures no duplicate emails exist in our system and that an email is always provided.

#### Step 2: Enforcing Rules (Constraints)
```sql
    age INT CHECK (age >= 18),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);
```
- `age INT CHECK (age >= 18)`: The data type is Integer. The `CHECK` constraint acts as a bouncer. If you try to insert an age of 17, Postgres aborts the operation.
- `TIMESTAMP WITH TIME ZONE`: Stores the exact date and time along with the time zone. `DEFAULT CURRENT_TIMESTAMP` automatically stamps the current time when a row is created.

#### Step 3: Manipulating Data (CRUD Operations)
```sql
INSERT INTO users (email, age) VALUES ('test@example.com', 25);
UPDATE users SET age = 26 WHERE email = 'test@example.com';
DELETE FROM users WHERE email = 'test@example.com';
```
- `INSERT`: Adds a new row. We only specify `email` and `age` because `id` and `created_at` have defaults.
- `UPDATE`: Modifies existing rows. **Crucial:** Always use a `WHERE` clause, or you will update every single user in the table!
- `DELETE`: Removes rows. Again, omitting `WHERE` wipes the entire table.

### 5. ASCII Data Flow
```text
[Web Server 1] --(INSERT User A)--> \
[Web Server 2] --(INSERT User B)-->  [ Postgres Connection Pool ]
[Web Server 3] --(INSERT User C)--> /            |
                                                 v
                                    [ Postgres Transaction Manager ]
                                     (Ensures rows are written safely,
                                      one after another, on disk)
                                                 |
                                                 v
                                      +-------------------------+
                                      | TABLE: users            |
                                      |-------------------------|
                                      | 1. User A (UUID-1)      |
                                      | 2. User B (UUID-2)      |
                                      | 3. User C (UUID-3)      |
                                      +-------------------------+
```

### 6. Noob Trap vs Pro Tip
- **Noob Trap:** Using `SERIAL` (auto-incrementing integers) for primary keys in distributed systems. It creates bottlenecks and exposes how many users you have (if someone sees user ID 500, they know you have 500 users).
- **Pro Tip:** Use `UUID` (specifically v4 or v7) for primary keys. They are globally unique, unguessable, and can be generated on the client side before even reaching the database, which is crucial for modern distributed apps.

---

## Phase B: Engineering Challenges

### Level 1: Warm-Up
**Task:** Create a table named `products` to store inventory. It should have an `id` (UUID), `name` (text, not empty), `price` (decimal/numeric, must be greater than 0), and `stock_quantity` (integer, cannot be negative).

<details>
<summary>Hint</summary>
Use <code>NUMERIC(10, 2)</code> for precise currency values. Use <code>CHECK</code> constraints for the rules.
</details>

<details>
<summary>Solution Walkthrough</summary>

```sql
CREATE TABLE products (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(255) NOT NULL,
    price NUMERIC(10, 2) CHECK (price > 0),
    stock_quantity INT CHECK (stock_quantity >= 0)
);
```
- `NUMERIC(10, 2)`: Stores up to 10 digits total, with 2 decimal places. Ideal for money because it avoids floating-point math errors.
- `CHECK (stock_quantity >= 0)`: Prevents negative inventory, solving a massive pain point in e-commerce.
</details>

### Level 2: Real-World
**Task:** Insert a new product called 'Mechanical Keyboard' with a price of 120.50 and 50 in stock. Then, simulate a customer buying 2 keyboards (Update the stock). Finally, verify the current stock using a SELECT statement.

<details>
<summary>Hint</summary>
When updating, you can reference the current value: <code>SET stock_quantity = stock_quantity - 2</code>.
</details>

<details>
<summary>Solution Walkthrough</summary>

```sql
-- Insert
INSERT INTO products (name, price, stock_quantity)
VALUES ('Mechanical Keyboard', 120.50, 50);

-- Update (Customer buys 2)
UPDATE products
SET stock_quantity = stock_quantity - 2
WHERE name = 'Mechanical Keyboard';

-- Verify
SELECT name, stock_quantity
FROM products
WHERE name = 'Mechanical Keyboard';
```
- By doing `stock_quantity = stock_quantity - 2`, we safely decrement the stock without needing to know the exact number prior to the update.
</details>

### Level 3: Boss Level
**Task:** Imagine an application where user emails must be unique, but you want to allow users to have a `username` that might be NULL (if they haven't set it yet). If they DO set a username, it must be at least 3 characters long. Create the table, insert a user with no username, insert a user with a valid username, and write an UPDATE statement that would intentionally fail the constraint to test it.

<details>
<summary>Hint</summary>
Use <code>LENGTH(username) >= 3</code> in your check constraint. Remember that <code>NULL</code> values usually pass CHECK constraints unless explicitly prevented.
</details>

<details>
<summary>Solution Walkthrough</summary>

```sql
-- Create table
CREATE TABLE players (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    email VARCHAR(255) UNIQUE NOT NULL,
    username VARCHAR(50) CHECK (LENGTH(username) >= 3)
);

-- Insert user with NO username (NULL passes the check constraint)
INSERT INTO players (email, username)
VALUES ('ghost@example.com', NULL);

-- Insert user with valid username
INSERT INTO players (email, username)
VALUES ('pro@example.com', 'ProGamer');

-- UPDATE that intentionally FAILS (Username too short)
-- This will throw an error: new row for relation "players" violates check constraint
UPDATE players
SET username = 'ab'
WHERE email = 'ghost@example.com';
```
- A crucial PostgreSQL behavior: If a column is `NULL`, the `CHECK (LENGTH(username) >= 3)` constraint evaluates to `NULL` (unknown), which Postgres allows. It only blocks `FALSE` evaluations.
</details>
