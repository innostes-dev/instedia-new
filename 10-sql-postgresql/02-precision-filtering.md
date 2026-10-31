# Module 02: Precision Filtering (WHERE Operators, Pagination, ORDER BY, Preventing Server Timeouts)

## Phase A: The Core Concept

### 1. Real-World Pain Point (The Why)
Your application's "All Users" page was built when you had 50 users. The backend simply requested `SELECT * FROM users;` and rendered the HTML. A year later, you have 500,000 users. Someone clicks the "All Users" tab. The database attempts to load half a million records into memory and send them across the network. The database CPU spikes to 100%, the web server runs out of RAM, and the entire application crashes for everyone. This is the classic "Server Timeout by Data Dumping".

### 2. Plain English Metaphor (The What)
Imagine walking into the Library of Congress (which has millions of books) and yelling at the librarian, "Bring me every book you have!" The librarian will collapse trying to carry them, and you won't be able to read them all anyway.

**Precision Filtering** is telling the librarian: "Bring me only books about 'PostgreSQL' (`WHERE`), sorted by publication date newest to oldest (`ORDER BY`), and just give me the first 10 books on the list for now (`LIMIT` / `OFFSET`)."

### 3. Complete Runnable Code
```sql
-- 1. Setup sample data
CREATE TABLE logs (
    id SERIAL PRIMARY KEY,
    event_type VARCHAR(50),
    severity INT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

INSERT INTO logs (event_type, severity) VALUES
('LOGIN_SUCCESS', 1), ('LOGIN_FAILED', 3),
('DB_CONNECTION_ERROR', 5), ('LOGIN_SUCCESS', 1),
('PAYMENT_FAILED', 4);

-- 2. Precision Filtering (The Safe Query)
SELECT event_type, severity, created_at
FROM logs
WHERE severity >= 3
  AND event_type LIKE '%FAILED%'
ORDER BY severity DESC, created_at ASC
LIMIT 10 OFFSET 0;
```

### 4. Progressive Step-by-Step Breakdown

#### Step 1: Filtering the Noise (WHERE)
```sql
WHERE severity >= 3
  AND event_type LIKE '%FAILED%'
```
- `WHERE`: The gatekeeper. It evaluates every row and only allows it through if the condition is `TRUE`.
- `severity >= 3`: Only grabs high-severity logs (Warning, Error, Critical).
- `LIKE '%FAILED%'`: A pattern match. `%` is a wildcard meaning "any characters". This matches `LOGIN_FAILED`, `PAYMENT_FAILED`, etc. (Note: `ILIKE` is case-insensitive in Postgres).

#### Step 2: Imposing Order (ORDER BY)
```sql
ORDER BY severity DESC, created_at ASC
```
- Sorting is crucial for UI consistency.
- `severity DESC`: Sorts by severity highest to lowest (5, 4, 3...).
- `, created_at ASC`: If two logs have the *exact same* severity, it breaks the tie by sorting them oldest to newest.

#### Step 3: Pagination (Preventing Timeouts)
```sql
LIMIT 10 OFFSET 0;
```
- `LIMIT 10`: The absolute cap. Only return a maximum of 10 rows. This guarantees the database and network won't be overwhelmed.
- `OFFSET 0`: Skip 0 rows.
- **To get page 2:** You would use `LIMIT 10 OFFSET 10;` (Skip the first 10, grab the next 10).

### 5. ASCII Data Flow
```text
[ Table: 500,000 Rows ]
         |
         v
[ WHERE Clause ] -- Filters out 499,950 rows that don't match
         |
         v
[ 50 Matching Rows ]
         |
         v
[ ORDER BY Clause ] -- Sorts the 50 rows in memory
         |
         v
[ LIMIT / OFFSET ] -- Snips exactly 10 rows
         |
         v
[ Network Response to Client ] (Lightning Fast, Low RAM usage)
```

### 6. Noob Trap vs Pro Tip
- **Noob Trap:** Using `SELECT *` in production code. If a DBA adds a massive 5MB `TEXT` column to the table later, your `SELECT *` will suddenly start pulling megabytes of useless data over the network, slowing down the app.
- **Pro Tip:** Keyset Pagination (Cursor Pagination). `OFFSET` gets progressively slower the deeper you go (e.g., `OFFSET 100000` forces Postgres to scan and discard 100,000 rows). For high-performance apps, paginate using the last seen ID: `WHERE id > last_seen_id ORDER BY id ASC LIMIT 10`.

---

## Phase B: Engineering Challenges

### Level 1: Warm-Up
**Task:** Given a `users` table with columns `id`, `name`, `status` (can be 'active', 'banned', 'pending'), and `last_login` (timestamp). Write a query to find all 'banned' users, sorted so the most recently logged-in users appear at the top.

<details>
<summary>Hint</summary>
Use the <code>=</code> operator for exact matches. Sort using <code>DESC</code> on the timestamp column.
</details>

<details>
<summary>Solution Walkthrough</summary>

```sql
SELECT id, name, status, last_login
FROM users
WHERE status = 'banned'
ORDER BY last_login DESC;
```
- We filter exactly for 'banned'.
- We sort `DESC` on `last_login` because a larger (newer) timestamp means they logged in more recently.
</details>

### Level 2: Real-World
**Task:** You are building an admin dashboard for a blog. The table is `articles` (id, title, view_count, is_published).
Write a query to fetch "Page 3" of published articles, where each page shows 20 articles, sorted by `view_count` highest to lowest. Only fetch the title and view_count.

<details>
<summary>Hint</summary>
If Page 1 skips 0, and Page 2 skips 20, how many does Page 3 skip?
</details>

<details>
<summary>Solution Walkthrough</summary>

```sql
SELECT title, view_count
FROM articles
WHERE is_published = TRUE
ORDER BY view_count DESC
LIMIT 20 OFFSET 40;
```
- Page 1: `OFFSET 0`
- Page 2: `OFFSET 20`
- Page 3: `OFFSET 40`
- We explicitly select only `title` and `view_count` to minimize network payload.
</details>

### Level 3: Boss Level
**Task:** (Cumulative) Combine Module 1 and 2.
1. Create a `transactions` table (id UUID, amount NUMERIC(10,2), description VARCHAR).
2. Insert 4 records (two under 100, two over 100).
3. Write a Keyset Pagination query (no OFFSET) that fetches transactions greater than $100, ordered by ID. Assume you already fetched the first one and its ID is 'a1b2...' (replace with a real UUID from your inserts). Fetch the next 2.

<details>
<summary>Hint</summary>
In PostgreSQL, you can compare UUIDs using standard operators like <code>></code>. This is the basis of keyset pagination.
</details>

<details>
<summary>Solution Walkthrough</summary>

```sql
-- 1. Setup
CREATE TABLE transactions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    amount NUMERIC(10,2) CHECK (amount > 0),
    description VARCHAR(255)
);

-- 2. Insert (Note: UUIDs are random, so yours will be different)
INSERT INTO transactions (amount, description) VALUES
(50.00, 'Coffee'),
(150.00, 'Headphones'),  -- Let's pretend this gets ID '11111111-1111-1111-1111-111111111111'
(500.00, 'Monitor'),
(20.00, 'Snack');

-- 3. The Keyset Pagination Query
-- To run this, you must copy a real UUID from your table that belongs to an amount > 100
SELECT id, amount, description
FROM transactions
WHERE amount > 100
  AND id > '11111111-1111-1111-1111-111111111111' -- The "cursor" from the last seen row
ORDER BY id ASC
LIMIT 2;
```
- **Why this is Principal level:** We used `amount > 100` (Business Logic Filter) combined with `id > 'last_uuid'` (Keyset Cursor). This completely bypasses the massive performance penalty of `OFFSET` on huge tables because Postgres can use an index to instantly jump to that specific UUID and grab the next 2 rows.
</details>
