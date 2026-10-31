# Challenge 5: Multi-Tenant Production RAG Gateway with Ragas Evaluation

## Problem Statement
You are the Lead Engineer for an Enterprise SaaS Customer Support platform. You have hundreds of corporate clients (Tenants), each with their own private documentation.

You must build the central "RAG Gateway" class that processes all incoming user queries. It must:
1. **Enforce Tenant Security:** Never allow User A to query Tenant B's vectors.
2. **Execute RAG:** Perform the vector search, construct the prompt, and simulate an LLM generation.
3. **Automated Evaluation:** After every generation, automatically send the Question, Context, and Answer to an LLM Judge (simulated) to calculate a "Faithfulness" score. If the score is below 0.8, log a severe alert.

## Starter Code

```python
import json

# --- Mock Vector Database (Chroma/Qdrant style) ---
class MockVectorDB:
    def __init__(self):
        # Data is stored as a list of dicts with payloads/metadata
        self.data = [
            {"id": 1, "text": "AcmeCorp refund policy: 30 days.", "tenant": "org_acme"},
            {"id": 2, "text": "AcmeCorp support email: help@acme.com", "tenant": "org_acme"},
            {"id": 3, "text": "Globex refund policy: No refunds ever.", "tenant": "org_globex"}
        ]

    def search(self, query, tenant_filter, top_k=1):
        """Simulates vector search with a strict tenant filter."""
        results = []
        for doc in self.data:
            if doc["tenant"] == tenant_filter:
                # Naive text match to simulate vector similarity
                if "refund" in query.lower() and "refund" in doc["text"].lower():
                    results.append(doc)
        return results[:top_k]

# --- Mock LLMs ---
def generate_llm_answer(prompt):
    """Simulates an LLM generating an answer."""
    # We purposefully make it hallucinate for the demo
    if "AcmeCorp" in prompt:
        return "You have 30 days to get a refund, and we will also give you a $50 gift card."
    return "I don't know."

def llm_judge_evaluate(question, context, answer):
    """Simulates the RAGAS LLM-as-a-judge for Faithfulness."""
    if "gift card" in answer and "gift card" not in context:
        return {"faithful": False, "score": 0.0, "reason": "Hallucinated a gift card policy."}
    return {"faithful": True, "score": 1.0, "reason": "Strictly adheres to context."}


# ==========================================
# YOUR TASK: IMPLEMENT THE RAG GATEWAY
# ==========================================

class EnterpriseRAGGateway:
    def __init__(self, vector_db):
        self.db = vector_db

    def handle_request(self, user_query, tenant_id):
        print(f"\nIncoming Request | Tenant: {tenant_id} | Query: {user_query}")

        # 1. Secure Retrieval
        # TODO: Call self.db.search passing the tenant_id securely. Extract text.

        # 2. Augmentation & Generation
        # TODO: Build a prompt combining the context and query. Call generate_llm_answer.

        # 3. RAGAS Evaluation Check
        # TODO: Call llm_judge_evaluate. If score < 0.8, print a SEVERE ALERT.

        # Return final answer
        return ""

# gateway = EnterpriseRAGGateway(MockVectorDB())
# response = gateway.handle_request("What is the refund policy?", tenant_id="org_acme")
# print(f"User sees: {response}")
```

---

## Solution Walkthrough

<details>
<summary>Click to view the complete production solution</summary>

### The Architecture
This challenge ties together Multi-Tenancy (Module 2.5 / 4.3), standard RAG Generation (Module 1.3), and CI/CD Observability (Module 5.3) into a single, production-grade Gateway class.

1. **Security at the Gateway:** The `tenant_id` is passed directly from the authentication layer (JWT token) into the `handle_request` method. The user cannot manipulate this. The Vector DB physically enforces this filter.
2. **Synchronous Evaluation (or Async in production):** Before returning the answer to the user, we run a secondary LLM call to evaluate the output. In high-traffic production, this is usually fired off to a message queue (like Kafka or RabbitMQ) so the user doesn't wait for the judge, but for this architecture, we run it inline to trigger the alert immediately.

### Complete Code

```python
import json

class MockVectorDB:
    def __init__(self):
        self.data = [
            {"id": 1, "text": "AcmeCorp refund policy: 30 days.", "tenant": "org_acme"},
            {"id": 2, "text": "AcmeCorp support email: help@acme.com", "tenant": "org_acme"},
            {"id": 3, "text": "Globex refund policy: No refunds ever.", "tenant": "org_globex"}
        ]

    def search(self, query, tenant_filter, top_k=1):
        print(f"[Vector DB] Executing search restricted to Namespace: {tenant_filter}")
        results = []
        for doc in self.data:
            if doc["tenant"] == tenant_filter:
                if "refund" in query.lower() and "refund" in doc["text"].lower():
                    results.append(doc)
        return results[:top_k]

def generate_llm_answer(prompt):
    if "AcmeCorp" in prompt:
        return "You have 30 days to get a refund, and we will also give you a $50 gift card."
    return "I don't know."

def llm_judge_evaluate(question, context, answer):
    if "gift card" in answer and "gift card" not in context:
        return {"faithful": False, "score": 0.0, "reason": "Hallucinated a gift card policy."}
    return {"faithful": True, "score": 1.0, "reason": "Strictly adheres to context."}


class EnterpriseRAGGateway:
    def __init__(self, vector_db):
        self.db = vector_db

    def handle_request(self, user_query, tenant_id):
        print(f"\n{'='*50}\nIncoming Request | Tenant: {tenant_id} | Query: '{user_query}'\n{'='*50}")

        # 1. Secure Retrieval
        retrieved_docs = self.db.search(query=user_query, tenant_filter=tenant_id)

        if not retrieved_docs:
            return "I couldn't find any relevant information in your company's knowledge base."

        context_text = "\n".join([doc["text"] for doc in retrieved_docs])
        print(f"[Gateway] Retrieved Context: '{context_text}'")

        # 2. Augmentation & Generation
        prompt = f"Context: {context_text}\nQuestion: {user_query}\nAnswer:"
        print(f"[Gateway] Sending Prompt to Generator LLM...")
        final_answer = generate_llm_answer(prompt)

        # 3. Observability & RAGAS Evaluation Check
        print(f"[Gateway] Sending Payload to Evaluator LLM Judge...")
        evaluation = llm_judge_evaluate(
            question=user_query,
            context=context_text,
            answer=final_answer
        )

        # 4. Enforce Guardrails
        if evaluation["score"] < 0.8:
            print(f"\n[🚨 SEVERE ALERT 🚨]")
            print(f"Hallucination Detected in Production!")
            print(f"Reason: {evaluation['reason']}")
            print(f"Tenant: {tenant_id}")
            print(f"Offending Output: '{final_answer}'")
            print(f"------------------------------------")

            # Optional: Fallback to a safe answer if hallucination is detected inline
            # return "I'm sorry, I am having trouble verifying the answer. Please contact support."

        return final_answer

# Execute
gateway = EnterpriseRAGGateway(MockVectorDB())

# Test 1: AcmeCorp user (Triggers Hallucination)
response_1 = gateway.handle_request("What is the refund policy?", tenant_id="org_acme")
print(f"\nFinal API Response sent to user: {response_1}")

# Test 2: Prove Tenant Isolation.
# If Globex asks, they should NOT see Acme's generous 30 day policy, they should see "No refunds".
# (In our mock DB, the LLM will just say "I don't know" because the prompt doesn't contain "AcmeCorp")
response_2 = gateway.handle_request("What is the refund policy?", tenant_id="org_globex")
print(f"\nFinal API Response sent to user: {response_2}")
```

### Output Analysis
The console output clearly shows the lifecycle of an enterprise query.
First, the database restricts the search purely to `org_acme`.
Second, the generator hallucinates a $50 gift card.
Third, the LLM Judge instantly catches the hallucination, grades it a 0.0, and triggers the `[🚨 SEVERE ALERT 🚨]`.

This automated evaluation loop is how companies like Notion, Intercom, and Mendable deploy autonomous AI agents with confidence.
</details>
