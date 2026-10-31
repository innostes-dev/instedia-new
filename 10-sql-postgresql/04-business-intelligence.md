# Module 04: Business Intelligence (COUNT/SUM/AVG, GROUP BY, HAVING Thresholds)

## Phase A: The Core Concept

### 1. Real-World Pain Point (The Why)
Your CEO asks: "How much revenue did each product category generate last month? Also, only show categories that made over $10,000."
If you do this in application code (e.g., Python/Node), you have to `SELECT *` on millions of orders, load them into a massive array in memory, loop through them, group them by category, sum the totals, filter the results, and then send the data. Your application server will crash from Out of Memory (OOM) errors, and the report will take 15 minutes to generate.

### 2. Plain English Metaphor (The What)
Imagine you have a jar with thousands of mixed coins.
- **Application Code approach:** You dump the coins on a table, look at each one, write its value on a ledger, and then do the math with a calculator. Very slow.
- **Database Aggregation approach:** You throw the jar into a magical coin-sorting machine. It instantly drops the coins into separate tubes (Pennies, Nickels, Dimes, Quarters) -> This is `GROUP BY`. It then weighs the tubes to tell you the exact dollar amount in each -> This is `SUM()`. It then automatically throws away any tube that has less than $10 in it -> This is `HAVING`.

### 3. Complete Runnable Code
```sql
-- 1. Setup Data
CREATE TABLE sales (
    id SERIAL PRIMARY KEY,
    category VARCHAR(50),
    amount NUMERIC(10,2),
    sale_date DATE
);

INSERT INTO sales (category, amount, sale_date) VALUES
('Electronics', 500.00, '2023-10-01'), ('Electronics', 600.00, '2023-10-02'),
('Clothing', 50.00, '2023-10-01'), ('Clothing', 40.00, '2023-10-03'),
('Books', 20.00, '2023-10-05');

-- 2. Business Intelligence Aggregation
SELECT
    category,
    COUNT(id) AS total_sales_count,
    SUM(amount) AS total_revenue,
    AVG(amount) AS average_order_value
FROM sales
GROUP BY category
HAVING SUM(amount) > 100
ORDER BY total_revenue DESC;
```

### 4. Progressive Step-by-Step Breakdown

#### Step 1: Grouping the Buckets (GROUP BY)
```sql
SELECT category
FROM sales
GROUP BY category
```
- Before `GROUP BY`, Postgres sees 5 individual rows.
- After `GROUP BY category`, Postgres collapses those 5 rows into 3 distinct buckets: 'Electronics', 'Clothing', and 'Books'.

#### Step 2: Running the Math (Aggregate Functions)
```sql
    COUNT(id) AS total_sales_count,
    SUM(amount) AS total_revenue,
    AVG(amount) AS average_order_value
```
- Because we collapsed the rows, we can no longer select individual `amount` values. We *must* use aggregate functions to summarize the data inside each bucket.
- `COUNT`: How many rows are in the bucket?
- `SUM`: What is the total addition of the `amount` column in the bucket?
- `AVG`: What is the mathematical average of the `amount` column?

#### Step 3: Threshold Filtering (HAVING)
```sql
HAVING SUM(amount) > 100
```
- **Crucial Distinction:** `WHERE` filters individual rows *before* they are grouped. `HAVING` filters the buckets *after* they are grouped and the math is done.
- In our data, 'Books' only has a sum of $20.00. The `HAVING` clause destroys the 'Books' bucket before returning the final result to the user.

### 5. ASCII Data Flow
```text
[ Raw Data: 5 Rows ]
Elec(500), Elec(600), Cloth(50), Cloth(40), Book(20)
         |
         v
[ GROUP BY category ]
[ Bucket: Elec ]  [ Bucket: Cloth ]  [ Bucket: Book ]
 (500, 600)          (50, 40)             (20)
         |
         v
[ Aggregate: SUM() ]
   (1100)               (90)              (20)
         |
         v
[ HAVING SUM > 100 ]
     PASS               FAIL              FAIL
         |
         v
[ Final Result: 1 Row Returned ]
| category    | total_revenue |
|-------------|---------------|
| Electronics | 1100.00       |
```

### 6. Noob Trap vs Pro Tip
- **Noob Trap:** Using `WHERE SUM(amount) > 100`. This will cause a syntax error in PostgreSQL. You cannot use aggregate functions in a `WHERE` clause because `WHERE` operates on rows before they are aggregated.
- **Pro Tip:** Using `COUNT(1)` or `COUNT(*)` vs `COUNT(column_name)`. `COUNT(*)` counts total rows in the group. `COUNT(column_name)` counts rows where that specific column is *not null*. If you just want to count total records, use `COUNT(*)`—it is heavily optimized in Postgres.

---

## Phase B: Engineering Challenges

### Level 1: Warm-Up
**Task:** Given a `users` table with columns `id`, `country`, and `is_active` (boolean). Write a query to find out how many total users exist in each `country`.

<details>
<summary>Hint</summary>
You need to select the country, use <code>COUNT(*)</code>, and <code>GROUP BY</code> the country.
</details>

<details>
<summary>Solution Walkthrough</summary>

```sql
SELECT country, COUNT(*) AS user_count
FROM users
GROUP BY country;
```
- The database sorts all users into country buckets, and `COUNT(*)` simply counts how many items landed in each bucket.
</details>

### Level 2: Real-World
**Task:** Using the same `users` table, write a query to find out how many *active* users (`is_active = TRUE`) exist in each country. Sort the results so the country with the most active users is at the top.

<details>
<summary>Hint</summary>
You need to filter the rows *before* grouping them. Which clause does that?
</details>

<details>
<summary>Solution Walkthrough</summary>

```sql
SELECT country, COUNT(*) AS active_user_count
FROM users
WHERE is_active = TRUE
GROUP BY country
ORDER BY active_user_count DESC;
```
- We use `WHERE is_active = TRUE` to discard inactive users before they even reach the grouping phase.
- We can sort by the alias `active_user_count` in the `ORDER BY` clause.
</details>

### Level 3: Boss Level
**Task:** (Cumulative) You have `authors` (id, name) and `books` (id, author_id, title, pages).
Write a report showing the author's name, the number of books they've written, and the average page count of their books.
*Constraints:*
1. Only include books that have more than 100 pages.
2. Only show authors who have written *more than 1* such book.
3. Include authors even if they have 0 books matching the criteria (they will be filtered out by the HAVING clause, but start with a LEFT JOIN to practice robust architecture).

<details>
<summary>Hint</summary>
Use a LEFT JOIN. Use WHERE for the >100 pages rule. Use HAVING for the >1 book rule. When grouping with joined tables, you must GROUP BY the columns from the primary table (e.g., <code>authors.id, authors.name</code>).
</details>

<details>
<summary>Solution Walkthrough</summary>

```sql
-- 1. Setup
CREATE TABLE authors (id SERIAL PRIMARY KEY, name VARCHAR(50));
CREATE TABLE books (id SERIAL PRIMARY KEY, author_id INT, title VARCHAR(50), pages INT);
INSERT INTO authors (name) VALUES ('Tolkien'), ('Rowling'), ('LazyWriter');
INSERT INTO books (author_id, title, pages) VALUES
(1, 'Hobbit', 310), (1, 'LotR', 1000), (2, 'HP1', 309), (2, 'ShortStory', 50);

-- 2. The Boss Query
SELECT
    authors.name,
    COUNT(books.id) AS total_books,
    AVG(books.pages) AS avg_pages
FROM authors
LEFT JOIN books
  ON authors.id = books.author_id
WHERE books.pages > 100 -- Filters individual books
GROUP BY authors.id, authors.name -- Group by the unique author
HAVING COUNT(books.id) > 1; -- Filters the aggregated author groups
```
- **Why this is Principal level:** It perfectly demonstrates the order of operations in SQL.
1. `FROM / JOIN`: Combines authors and books.
2. `WHERE`: Throws away 'ShortStory' because pages <= 100.
3. `GROUP BY`: Collapses the data into author buckets. We group by `authors.id` in case two authors have the same name.
4. `AGGREGATE`: Calculates COUNT and AVG for each author bucket.
5. `HAVING`: Evaluates the aggregates. Rowling only has 1 book > 100 pages. The threshold is `> 1`. Rowling's bucket is destroyed. Tolkien's bucket survives.
</details>
