# Challenge 5: Principal Architecture - AI Hybrid Search Platform

## Objective
Design a multi-tenant Document Knowledge Base that combines rigid SQL filtering (security, categorization) with advanced AI Semantic Search, optimizing the schema for high-dimensional vectors and large-scale performance.

## Problem Statement
You are building an enterprise AI tool. Companies upload their private PDF documents. Employees can chat with an AI that retrieves context from these documents (Retrieval-Augmented Generation / RAG).

**Requirements:**
1.  **Strict Isolation:** Tenant A must *never* be able to search Tenant B's documents.
2.  **Metadata Filtering:** Employees can optionally filter their search by `category` (e.g., "HR", "Engineering").
3.  **Semantic Search:** The database must use OpenAI's 1536-dimensional embeddings to find the most conceptually relevant chunks of text.
4.  **Performance:** The table will eventually hold 10 million text chunks. Standard Cosine Distance operations will become too slow. We need specialized indexing.

## Challenge Instructions
1.  Write the SQL to enable the `vector` extension.
2.  Design the `document_chunks` table to satisfy the requirements (Tenant ID, Category, Content, Embedding).
3.  Write the SQL to create an `HNSW` (Hierarchical Navigable Small World) index on the embedding column using the cosine distance operator class to ensure performance at scale.
4.  Write the "Hybrid Search" `SELECT` query to find the top 3 most relevant document chunks for Tenant 5, specifically in the "Engineering" category, matching a given search vector.

<details>
<summary>Principal Engineer Solution & Walkthrough</summary>

### The Complete Solution

```sql
-- 1. Enable pgvector
CREATE EXTENSION IF NOT EXISTS vector;

-- 2. Schema Architecture
CREATE TABLE document_chunks (
    id BIGSERIAL PRIMARY KEY, -- Use BIGSERIAL for millions of chunks
    tenant_id INT NOT NULL,   -- The hard security boundary
    category VARCHAR(50),     -- Metadata for filtering
    content TEXT NOT NULL,    -- The actual text to send to the LLM
    embedding VECTOR(1536)    -- OpenAI's standard dimensionality
);

-- 3. High-Performance Indexing (The Principal Move)
-- Standard B-Trees don't work for vectors. We use HNSW.
-- vector_cosine_ops tells the index to optimize for Cosine Distance (<=>).
CREATE INDEX idx_document_chunks_embedding_hnsw
ON document_chunks
USING hnsw (embedding vector_cosine_ops);

-- We also heavily index the standard filters to narrow the search space BEFORE doing vector math
CREATE INDEX idx_document_chunks_tenant_category
ON document_chunks (tenant_id, category);

-- 4. The Hybrid Search Query
-- Assume the user's question was converted into a 1536-dimensional vector array.
-- For brevity, we use [...] to represent it.

SELECT
    id,
    content,
    1 - (embedding <=> '[0.12, 0.45, -0.02, ...]') AS similarity_score
FROM document_chunks
WHERE tenant_id = 5            -- Hard Security Boundary
  AND category = 'Engineering' -- Metadata Filter
ORDER BY embedding <=> '[0.12, 0.45, -0.02, ...]' ASC -- Semantic AI Search
LIMIT 3;
```

### Walkthrough & Architecture Notes
-   **The Hybrid Approach:** LLMs are great at understanding concepts, but terrible at hard facts like "Only look at documents from 2023." By combining a SQL `WHERE` clause (for hard facts and security) with an `ORDER BY` vector clause (for concepts), we get the best of both worlds.
-   **HNSW (Hierarchical Navigable Small World):** This is the state-of-the-art index for vector databases. It creates a multi-layered graph. Instead of comparing your search vector to all 10 million rows, it drops your vector into the top layer, navigates to the closest "neighborhood", drops down a layer, navigates closer, and repeats. It reduces search time from seconds to milliseconds with a marginal cost to accuracy (Approximate Nearest Neighbor).
-   **Similarity Score:** The `<=>` operator returns the *distance*. A distance of 0 means identical. A distance of 1 means orthogonal (unrelated). A distance of 2 means opposite. By doing `1 - distance`, we convert it into a "Similarity Score" where `1.0` (or 100%) is a perfect match, which is much more intuitive to display on a frontend UI.
</details>

## Starter Template

```sql
-- 1. Enable pgvector

-- 2. Schema Architecture

-- 3. High-Performance Indexing

-- 4. The Hybrid Search Query
```

## Test Suite

```sql
-- Test 1: Security Boundary
-- Insert documents for Tenant A and Tenant B.
-- Run a search as Tenant A.
-- Verify NO documents from Tenant B are returned, regardless of semantic similarity.

-- Test 2: Metadata Filtering
-- Insert "Engineering" documents and "HR" documents for Tenant A.
-- Run a search for "Engineering".
-- Verify NO "HR" documents are returned.

-- Test 3: Semantic Ordering
-- Insert documents with embeddings representing "Cat", "Dog", and "Car".
-- Search for a vector conceptually close to "Wolf".
-- Verify the result order is "Dog", "Cat", "Car".
```
