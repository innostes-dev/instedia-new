# Module 06: Modern Postgres & AI (JSONB Webhooks, pgvector Cosine Hybrid Search)

## Phase A: The Core Concept

### 1. Real-World Pain Point (The Why)
**Pain 1 (Unstructured Data):** You integrate with Stripe for payments. Stripe sends you a webhook payload. Today, the payload has 5 fields. Tomorrow, Stripe adds 2 new fields. If you map this to strict SQL columns, your app crashes when the schema changes.
**Pain 2 (AI Search):** A user searches for "Cozy winter jacket." Your database only has "Warm snow coat." A standard `LIKE '%Cozy winter jacket%'` returns zero results. You need the database to understand *meaning*, not just characters.

### 2. Plain English Metaphor (The What)
- **JSONB:** It's a flexible storage box inside your strict filing cabinet. You can throw any shape of document into it without defining the columns beforehand, but Postgres can still peek inside the box instantly using special indexes.
- **pgvector:** Imagine a massive 3D universe mapping out concepts. "Jacket" and "Coat" are planets right next to each other. "Dog" is in another galaxy. pgvector turns text into coordinates (vectors/embeddings) in this universe and finds the closest planets using math (Cosine Distance), enabling semantic AI search.

### 3. Complete Runnable Code
```sql
-- ENABLE the pgvector extension (Required for AI search)
CREATE EXTENSION IF NOT EXISTS vector;

-- 1. Setup Table with JSONB and VECTOR columns
CREATE TABLE products (
    id SERIAL PRIMARY KEY,
    name VARCHAR(255),
    attributes JSONB, -- Flexible schema
    embedding VECTOR(3) -- A 3-dimensional vector for AI (usually 1536 for OpenAI)
);

-- 2. Insert Data
INSERT INTO products (name, attributes, embedding) VALUES
('Warm Snow Coat', '{"color": "red", "sizes": ["S", "M", "L"], "brand": "Arctic"}', '[0.9, 0.8, 0.2]'),
('Summer T-Shirt', '{"color": "blue", "sizes": ["M", "L"], "material": "cotton"}', '[0.1, 0.2, 0.9]');

-- 3. Querying JSONB
SELECT name
FROM products
WHERE attributes->>'color' = 'red';

-- 4. Querying pgvector (Cosine Distance)
-- Find the product whose concept (vector) is closest to our search vector
SELECT name, embedding <=> '[0.8, 0.7, 0.3]' AS semantic_distance
FROM products
ORDER BY embedding <=> '[0.8, 0.7, 0.3]' ASC
LIMIT 1;
```

### 4. Progressive Step-by-Step Breakdown

#### Step 1: The Flexible JSONB Container
```sql
    attributes JSONB,
```
- `JSONB` stores a JSON object in a binary format. Unlike raw `TEXT`, Postgres parses it, so you can query keys and arrays efficiently.

#### Step 2: Extracting from JSONB
```sql
WHERE attributes->>'color' = 'red'
```
- `->>` extracts a key as plain text. We ask: "Look inside the JSON box, find the key 'color', convert it to text, and check if it is 'red'."
- You can even create GIN (Generalized Inverted Index) indexes on JSONB to make this search instantaneous across millions of unstructured documents.

#### Step 3: The Vector Column and Cosine Distance
```sql
    embedding VECTOR(3)
...
ORDER BY embedding <=> '[0.8, 0.7, 0.3]' ASC
```
- `VECTOR(3)` stores an array of 3 floating-point numbers. (In production with OpenAI, this is usually `VECTOR(1536)`).
- `<=>` is the **Cosine Distance** operator. It calculates the angle between two vectors.
- A smaller distance (closer to 0) means the concepts are more mathematically similar. We sort by the smallest distance to find the most relevant AI match.

### 5. ASCII Data Flow
**Vector Semantic Search:**
```text
User Search: "Cozy Winter Wear"
         |
[ Embedding API (e.g., OpenAI) ] --> Converts text to: [0.8, 0.7, 0.3]
         |
[ pgvector Database (products table) ]
  |-- "Warm Snow Coat"  [0.9, 0.8, 0.2] --> Distance: 0.05 (Very Close!)
  |-- "Summer T-Shirt"  [0.1, 0.2, 0.9] --> Distance: 0.85 (Far Away)
         |
[ ORDER BY <=> ASC LIMIT 1 ]
         |
Returns: "Warm Snow Coat"
```

### 6. Noob Trap vs Pro Tip
- **Noob Trap:** Using standard B-Tree indexes for vectors. They do not work. To speed up vector search on millions of rows, you must use specialized indexes like `HNSW` (Hierarchical Navigable Small World) or `IVFFlat`.
- **Pro Tip:** Hybrid Search. The best search engines combine both. Use standard SQL to filter (e.g., `WHERE price < 50`) and then use pgvector to rank the results (`ORDER BY embedding <=> search_vector`). This is lightning-fast and highly accurate.

---

## Phase B: Engineering Challenges

### Level 1: Warm-Up
**Task:** You have a `webhooks` table with a column `payload` (JSONB). You receive an event: `{"type": "payment_failed", "amount": 500, "user_id": 99}`. Write an `INSERT` statement to store this payload in the table.

<details>
<summary>Hint</summary>
JSON strings must be wrapped in single quotes in SQL.
</details>

<details>
<summary>Solution Walkthrough</summary>

```sql
CREATE TABLE webhooks (id SERIAL, payload JSONB);

INSERT INTO webhooks (payload)
VALUES ('{"type": "payment_failed", "amount": 500, "user_id": 99}');
```
- Because it's JSONB, Postgres will validate that the string is actual valid JSON before inserting it.
</details>

### Level 2: Real-World
**Task:** Write a `SELECT` query on the `webhooks` table to find all rows where the JSON key `type` is exactly equal to `'payment_failed'`.

<details>
<summary>Hint</summary>
Use the <code>->></code> operator to extract the text value of a key.
</details>

<details>
<summary>Solution Walkthrough</summary>

```sql
SELECT *
FROM webhooks
WHERE payload->>'type' = 'payment_failed';
```
- `->>` returns the value as a SQL string, allowing us to use standard `=` comparisons.
</details>

### Level 3: Boss Level
**Task:** (Cumulative: Hybrid Search).
Create a `documents` table with `id`, `tenant_id` (INT), `content` (TEXT), and `embedding` (VECTOR(3)).
Insert three documents. Two belong to Tenant 1, one belongs to Tenant 2.
Write a query for Tenant 1 that finds the most semantically similar document to `[0.5, 0.5, 0.5]`.
**Critical:** You MUST filter by `tenant_id` first to ensure one user cannot search another user's private documents.

<details>
<summary>Hint</summary>
Combine a standard <code>WHERE</code> clause with an <code>ORDER BY</code> vector distance clause.
</details>

<details>
<summary>Solution Walkthrough</summary>

```sql
-- 1. Setup
CREATE TABLE documents (
    id SERIAL PRIMARY KEY,
    tenant_id INT,
    content TEXT,
    embedding VECTOR(3)
);

-- 2. Insert Data
INSERT INTO documents (tenant_id, content, embedding) VALUES
(1, 'Private Financials A', '[0.9, 0.1, 0.1]'),
(1, 'Private Marketing B', '[0.2, 0.8, 0.2]'),
(2, 'Top Secret C', '[0.9, 0.2, 0.1]'); -- Tenant 2 data

-- 3. Hybrid Search (Security + AI)
SELECT content, embedding <=> '[0.8, 0.15, 0.1]' AS distance
FROM documents
WHERE tenant_id = 1  -- 1. Security Filter (Standard SQL)
ORDER BY embedding <=> '[0.8, 0.15, 0.1]' ASC -- 2. Semantic Ranking (pgvector)
LIMIT 1;
```
- **Why this is Principal level:** We combine traditional hard-filtering (`tenant_id = 1`) with fuzzy mathematical ranking. Notice that Document C is extremely close to our search vector, but it belongs to Tenant 2. The `WHERE` clause safely eliminates it before the vector math even runs, ensuring multitenant data security.
</details>
