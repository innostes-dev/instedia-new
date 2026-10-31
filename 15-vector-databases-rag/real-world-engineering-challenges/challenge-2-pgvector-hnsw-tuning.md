# Challenge 2: High-Throughput HNSW Index Optimization on pgvector

## Problem Statement
You are migrating an e-commerce platform's semantic search feature to PostgreSQL using the `pgvector` extension. The table has 5 million products.

Initially, you tested a simple `ORDER BY embedding <=> query_vector` query, but it took **4.5 seconds** per query because it forced a sequential scan across all 5 million rows. You need sub-50ms latency.

Your task is to:
1. Define the correct SQL schema for the products table.
2. Create an **HNSW** (Hierarchical Navigable Small World) index optimized for high throughput.
3. Write a parameterized Hybrid SQL query that filters by `category` and `in_stock` status *before* calculating vector similarity, utilizing the index perfectly.

## Starter Code (SQL Template)

```sql
-- 1. Enable the extension
CREATE EXTENSION IF NOT EXISTS vector;

-- 2. Create the Table
-- TODO: Define columns: id (serial), name (text), category (text), in_stock (boolean), embedding (vector, dimension 768)
CREATE TABLE products (
    -- ...
);

-- 3. Create the Indexes
-- We need standard B-Tree indexes for the exact match filters
CREATE INDEX idx_category ON products(category);
CREATE INDEX idx_in_stock ON products(in_stock);

-- TODO: Create the HNSW index on the embedding column.
-- Use cosine distance. Tune the 'm' and 'ef_construction' parameters for a 5M row table.
-- CREATE INDEX ... USING hnsw ...

-- 4. The Query
-- TODO: Write the SQL query to find the Top 5 most similar products to a given vector '[0.1, 0.2, ...]'
-- Condition 1: Category MUST be 'electronics'
-- Condition 2: MUST be in stock
-- ...
```

---

## Solution Walkthrough

<details>
<summary>Click to view the complete production solution</summary>

### The Architecture
To achieve sub-50ms latency on 5 million rows, we cannot rely on sequential mathematical calculations. We must build a graph.
- **HNSW** is the state-of-the-art algorithm for this.
- `m` controls the maximum number of connections (edges) per node in the graph. `m=16` is standard, `m=32` or `64` is better for high-dimensional data (768d) if you have the RAM.
- `ef_construction` controls the size of the dynamic candidate list when building the index. Higher (e.g., 100-200) means a better quality graph and higher recall, but takes longer to build.

Crucially, PostgreSQL executes queries sequentially based on cost. If our `WHERE` clause filters 5M rows down to 500 rows, Postgres will use the B-Tree index for the filter, and then calculate exact vector math on the remaining 500 rows (bypassing the HNSW graph because exact math on 500 rows is faster than a graph traversal). This "Hybrid Search" optimization is the magic of pgvector.

### Complete SQL Script

```sql
-- 1. Enable the extension
CREATE EXTENSION IF NOT EXISTS vector;

-- 2. Create the Table
CREATE TABLE products (
    id SERIAL PRIMARY KEY,
    name TEXT NOT NULL,
    category TEXT NOT NULL,
    in_stock BOOLEAN DEFAULT true,
    -- 768 dimensions is standard for models like Nomic, Cohere English, or old OpenAI Ada.
    embedding vector(768) NOT NULL
);

-- 3. Create Standard Filtering Indexes (B-Tree)
-- These are critical for the Hybrid Query to be fast
CREATE INDEX idx_products_category ON products(category);
CREATE INDEX idx_products_in_stock ON products(in_stock);

-- 4. Create the HNSW Vector Index
-- vector_cosine_ops tells the index to optimize the graph for Cosine Distance (<=>)
-- m=24 balances memory usage with dense connectivity for 768d vectors.
-- ef_construction=128 ensures high recall during the build phase.
CREATE INDEX idx_products_embedding ON products
USING hnsw (embedding vector_cosine_ops)
WITH (m = 24, ef_construction = 128);


-- 5. The Production Hybrid Query
-- To tune the search speed/accuracy dynamically at query time, you can set the search `ef`
-- SET hnsw.ef_search = 100;

SELECT
    id,
    name,
    -- Calculate Cosine Distance between the row and the user's query vector
    -- Note: 1 - cosine_distance = cosine_similarity
    1 - (embedding <=> '[0.12, -0.05, 0.88, ...]') AS similarity_score
FROM
    products
WHERE
    category = 'electronics'
    AND in_stock = true
ORDER BY
    embedding <=> '[0.12, -0.05, 0.88, ...]' ASC -- ASC because smaller distance = higher similarity
LIMIT 5;
```

### Why this is Production-Grade
- **Correct Operator Mapping:** We used `vector_cosine_ops` in the index, and we matched it perfectly by using `<=>` in the `ORDER BY` clause. If you use the wrong operator in the query (e.g., `<->`), Postgres will silently ignore the index and do a 5-second sequential scan.
- **Index Parameter Tuning:** `m=24` and `ef=128` are heavily researched defaults for massive tables where recall accuracy is paramount, avoiding the default `m=16` which can struggle slightly at 5M scale.
- **True Hybrid Search:** By combining standard B-Tree indexing (Category/Stock) with HNSW, we guarantee perfectly consistent business logic alongside fuzzy semantic matching in a single database transaction.

</details>
