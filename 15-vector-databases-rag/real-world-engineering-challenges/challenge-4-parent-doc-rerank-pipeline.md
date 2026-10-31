# Challenge 4: Two-Tier Parent-Document Retrieval with Cross-Encoder Re-Ranking

## Problem Statement
You are architecting the ultimate, no-compromise Retrieval pipeline for a Legal AI Assistant. Legal documents are massive, and missing a single clause is unacceptable.

To achieve maximum accuracy, you must combine two advanced techniques into a single pipeline:
1. **Parent-Child Retrieval:** Search over dense, tiny "Child" sentences to find the exact match, but retrieve the full "Parent" paragraph.
2. **Cross-Encoder Re-Ranking:** Take the retrieved Parent paragraphs and re-rank them against the original user query using a highly accurate Cross-Encoder to ensure the linguistic relationship holds up in the broader context.

## Starter Code

```python
import numpy as np
# In a real environment, you would use sentence-transformers CrossEncoder
# We will simulate the CrossEncoder prediction for this challenge.

# --- 1. Mock Document Store (The Truth) ---
parents = {
    "para_1": "The tenant must provide 30 days written notice before vacating the premises. Failure to do so will result in forfeiture of the security deposit.",
    "para_2": "The landlord is responsible for all structural repairs, including roof leaks and HVAC failures. The tenant is responsible for minor cosmetic wear and tear.",
    "para_3": "Security deposits will be returned within 14 days of vacating, minus any deductions for unpaid rent or damages beyond normal wear and tear."
}

# --- 2. Mock Vector DB Output (Child Search) ---
# User Query: "When do I get my deposit back?"
# The Vector DB searched small child chunks and found these 3 hits.
# Notice they include the parent_id!
retrieved_children = [
    {"parent_id": "para_3", "child_text": "Security deposits will be returned within 14 days of vacating.", "vector_score": 0.92},
    {"parent_id": "para_1", "child_text": "Failure to do so will result in forfeiture of the security deposit.", "vector_score": 0.85},
    {"parent_id": "para_3", "child_text": "minus any deductions for unpaid rent or damages", "vector_score": 0.78}
]

# --- 3. Simulated Cross-Encoder ---
def mock_cross_encoder_predict(query, document_text):
    """Simulates a heavy Neural Network evaluating the query against the full paragraph."""
    # A real model would do this mathematically. We mock it based on keyword overlap for pedagogy.
    if "14 days" in document_text:
        return 9.8  # Perfect relation
    elif "forfeiture" in document_text:
        return -2.4 # Irrelevant to 'when'
    return 1.0


# ==========================================
# YOUR TASK: IMPLEMENT THE 2-TIER PIPELINE
# ==========================================

def execute_advanced_pipeline(query, children_results, parent_store):
    # Step 1: Extract unique parent_ids from the children_results
    # TODO: Deduplicate parent IDs

    # Step 2: Fetch the full parent texts from the parent_store
    # TODO: Create a list of full paragraphs to re-rank

    # Step 3: Run the Cross-Encoder on the (Query, Full Parent Text) pairs
    # TODO: Use mock_cross_encoder_predict to get new scores

    # Step 4: Sort the parents by the new Cross-Encoder score descending
    # TODO: Return the final sorted list of full texts

    return []

# final_context = execute_advanced_pipeline("When do I get my deposit back?", retrieved_children, parents)
# print(final_context)
```

---

## Solution Walkthrough

<details>
<summary>Click to view the complete production solution</summary>

### The Architecture
This is RAG 2.0.
1. **Precision Search (Bi-Encoder):** We use fast vector math to search millions of tiny sentences. We find that sentence A ("Security deposits returned within 14 days") and sentence B ("minus deductions") both strongly match the query.
2. **Context Expansion (Parent Lookup):** Both sentences point to `para_3`. We deduplicate them. We fetch the full `para_3` string.
3. **Accuracy Verification (Cross-Encoder):** Just because the small sentence matched doesn't mean the full paragraph is perfectly relevant in context. We pass the *full parent paragraph* and the *query* into the Cross-Encoder. The Cross-Encoder acts as an AI Judge, reading the whole paragraph and giving a final definitive score. We sort by this score and send the winner to the LLM generation phase.

### Complete Code

```python
parents = {
    "para_1": "The tenant must provide 30 days written notice before vacating the premises. Failure to do so will result in forfeiture of the security deposit.",
    "para_2": "The landlord is responsible for all structural repairs, including roof leaks and HVAC failures. The tenant is responsible for minor cosmetic wear and tear.",
    "para_3": "Security deposits will be returned within 14 days of vacating, minus any deductions for unpaid rent or damages beyond normal wear and tear."
}

retrieved_children = [
    {"parent_id": "para_3", "child_text": "Security deposits will be returned within 14 days of vacating.", "vector_score": 0.92},
    {"parent_id": "para_1", "child_text": "Failure to do so will result in forfeiture of the security deposit.", "vector_score": 0.85},
    {"parent_id": "para_3", "child_text": "minus any deductions for unpaid rent or damages", "vector_score": 0.78}
]

def mock_cross_encoder_predict(query, document_text):
    if "14 days" in document_text:
        return 9.8
    elif "forfeiture" in document_text:
        return -2.4
    return 1.0

def execute_advanced_pipeline(query, children_results, parent_store):
    print("--- 1. Deduplicating Child Matches ---")
    unique_parent_ids = []
    # Preserve order of highest vector score first while deduplicating
    for child in children_results:
        if child["parent_id"] not in unique_parent_ids:
            unique_parent_ids.append(child["parent_id"])

    print(f"Unique Parents to Fetch: {unique_parent_ids}")

    print("\n--- 2. Parent Context Expansion ---")
    parent_documents = []
    for pid in unique_parent_ids:
        # In a real app, this is a database fetch (e.g., MongoDB, DynamoDB)
        full_text = parent_store.get(pid)
        parent_documents.append({
            "id": pid,
            "text": full_text
        })
        print(f"Fetched [{pid}]: {full_text[:30]}...")

    print("\n--- 3. Cross-Encoder Re-Ranking ---")
    reranked_results = []
    for doc in parent_documents:
        # The Heavy compute step: Evaluate Query against FULL context
        score = mock_cross_encoder_predict(query, doc["text"])
        reranked_results.append({
            "id": doc["id"],
            "text": doc["text"],
            "ce_score": score
        })
        print(f"Evaluated [{doc['id']}] -> Cross-Encoder Score: {score}")

    print("\n--- 4. Final Sorting ---")
    # Sort descending by the highly accurate Cross-Encoder score
    reranked_results.sort(key=lambda x: x["ce_score"], reverse=True)

    return reranked_results

# Execute Pipeline
query = "When do I get my deposit back?"
print(f"USER QUERY: '{query}'\n")

final_contexts = execute_advanced_pipeline(query, retrieved_children, parents)

print("\n=== FINAL CONTEXT SENT TO LLM ===")
for rank, context in enumerate(final_contexts):
    print(f"\nRank {rank+1} (Score: {context['ce_score']}):\n{context['text']}")
```

### Output Analysis
The pipeline beautifully handled the deduplication (preventing `para_3` from being evaluated twice). It then correctly identified that `para_1` (which the vector DB thought was a great match) was actually a terrible match (-2.4 score) when read in full context by the Cross-Encoder.

The LLM is now guaranteed to receive the most accurate, contextually rich information possible.
</details>
