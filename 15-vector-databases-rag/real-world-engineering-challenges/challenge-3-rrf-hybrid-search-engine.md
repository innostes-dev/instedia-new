# Challenge 3: Reciprocal Rank Fusion (RRF) Hybrid Search Engine

## Problem Statement
Relying solely on Vector Search (Dense) often fails on exact part numbers or names (e.g., searching for "iPhone 15 Pro Max"). Relying solely on Keyword Search (Sparse/BM25) fails on synonyms (e.g., searching for "comfortable jogging shoes" when the product is "ergonomic running sneakers").

Your task is to build a **Hybrid Search Engine** that executes both a Dense Vector Search and a Sparse BM25 Search, and then mathematically merges their results using **Reciprocal Rank Fusion (RRF)**.

RRF does not care about the raw scores (which are often on completely different scales, like BM25 being 0-100 and Cosine being 0-1). Instead, RRF merges results based on their *Rank* (position in the list).

The formula for RRF is: `Score = 1 / (Rank + k)` (where k is usually 60).

## Starter Code

```python
import numpy as np

# --- Mock Search Results ---
# The query is: "Sony X900H 65-inch TV"

# 1. Sparse Results (BM25 - Exact Keyword Match)
# Nailed the part number, but missed semantic intent on #2
sparse_results = [
    {"doc_id": "doc_10", "title": "Sony X900H 65-inch 4K TV"},       # Rank 1
    {"doc_id": "doc_11", "title": "Sony TV Remote Control X900H"},    # Rank 2
    {"doc_id": "doc_12", "title": "65-inch TV Wall Mount"}            # Rank 3
]

# 2. Dense Results (Vector Similarity)
# Nailed the concept of TVs, but missed the exact part number
dense_results = [
    {"doc_id": "doc_20", "title": "Samsung 65-inch 4K Smart TV"},     # Rank 1
    {"doc_id": "doc_10", "title": "Sony X900H 65-inch 4K TV"},        # Rank 2 (Found it!)
    {"doc_id": "doc_21", "title": "LG OLED 65-inch Television"}       # Rank 3
]

# ==========================================
# YOUR TASK: IMPLEMENT RRF FUSION
# ==========================================

def reciprocal_rank_fusion(sparse_list, dense_list, k=60):
    """
    Merges two ranked lists using RRF and returns a sorted list of doc_ids.
    Formula: RRF_Score = 1 / (Rank + k)
    Note: Rank is 1-indexed (1st place = 1, 2nd place = 2)
    """
    rrf_scores = {} # Dictionary to hold {doc_id: total_score}

    # TODO: 1. Loop through sparse_list. Calculate RRF score based on its position (rank). Add to dict.
    # TODO: 2. Loop through dense_list. Calculate RRF score. Add to existing dict score if it exists.
    # TODO: 3. Sort the dictionary by total_score descending.

    final_ranked_list = []

    return final_ranked_list

# output = reciprocal_rank_fusion(sparse_results, dense_results)
# print(output)
```

---

## Solution Walkthrough

<details>
<summary>Click to view the complete production solution</summary>

### The Architecture
Reciprocal Rank Fusion is the industry standard for combining completely heterogeneous search algorithms.
Because a BM25 score might be `34.5` and a Cosine Vector score might be `0.82`, you cannot simply add them together.

RRF ignores the raw score entirely. It only looks at the leaderboard position.
If `doc_10` was Rank 1 in Sparse and Rank 2 in Dense, it gets points from both leaderboards:
`1 / (1 + 60)` + `1 / (2 + 60)` = `0.01639` + `0.01612` = `0.03251`

By summing the positional points, documents that appear on *both* lists rocket to the very top, while documents that only appear on one list fall down.

### Complete Code

```python
# --- Mock Search Results ---
sparse_results = [
    {"doc_id": "doc_10", "title": "Sony X900H 65-inch 4K TV"},       # Rank 1
    {"doc_id": "doc_11", "title": "Sony TV Remote Control X900H"},    # Rank 2
    {"doc_id": "doc_12", "title": "65-inch TV Wall Mount"}            # Rank 3
]

dense_results = [
    {"doc_id": "doc_20", "title": "Samsung 65-inch 4K Smart TV"},     # Rank 1
    {"doc_id": "doc_10", "title": "Sony X900H 65-inch 4K TV"},        # Rank 2
    {"doc_id": "doc_21", "title": "LG OLED 65-inch Television"}       # Rank 3
]

def reciprocal_rank_fusion(sparse_list, dense_list, k=60):
    rrf_scores = {}

    # 1. Process Sparse List
    for index, item in enumerate(sparse_list):
        doc_id = item["doc_id"]
        rank = index + 1 # 1-indexed rank
        score = 1.0 / (rank + k)

        # Initialize or add to existing
        if doc_id not in rrf_scores:
            rrf_scores[doc_id] = {"title": item["title"], "score": 0.0}
        rrf_scores[doc_id]["score"] += score

    # 2. Process Dense List
    for index, item in enumerate(dense_list):
        doc_id = item["doc_id"]
        rank = index + 1
        score = 1.0 / (rank + k)

        if doc_id not in rrf_scores:
            rrf_scores[doc_id] = {"title": item["title"], "score": 0.0}
        rrf_scores[doc_id]["score"] += score

    # 3. Sort by aggregated RRF score descending
    # rrf_scores.items() looks like: ('doc_10', {'title': '...', 'score': 0.32})
    sorted_results = sorted(rrf_scores.items(), key=lambda x: x[1]["score"], reverse=True)

    return sorted_results

# Execute Pipeline
print("--- Final Hybrid RRF Ranking ---")
fused_results = reciprocal_rank_fusion(sparse_results, dense_results)

for rank, (doc_id, data) in enumerate(fused_results):
    print(f"Rank {rank + 1} | Score {data['score']:.5f} | {data['title']} ({doc_id})")

```

### Output Analysis
Notice the magic of the output:
1. **doc_10 (Sony X900H TV):** Won Rank 1 overall because it appeared high on *both* lists. It perfectly satisfies the exact keyword and the semantic intent.
2. **doc_20 (Samsung TV):** Won Rank 2 because it was #1 on the Dense list, even though it wasn't on the Sparse list at all.
3. **doc_11 (Sony Remote):** Won Rank 3 because it was #2 on the Sparse list, even though it wasn't on the Dense list.

This is exactly how ElasticSearch and Azure AI Search handle Hybrid retrieval under the hood!
</details>
