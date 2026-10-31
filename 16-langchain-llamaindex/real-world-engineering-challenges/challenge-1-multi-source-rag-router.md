# Real-World Engineering Challenge: Multi-Source RAG Router

## Architecture Diagram
```text
[ User Query ]
      │
      ▼
[ LlamaIndex Router Query Engine ]
      │
      ├─► (Tech Docs Tool) ──► [ Tech VectorStoreIndex ]
      │
      ├─► (HR Docs Tool) ────► [ HR VectorStoreIndex ]
      │
      └─► (Finance Tool) ────► [ Finance SimpleKeywordTableIndex ]
```

## Challenge Objective
Build a comprehensive routing system that directs user queries to one of three different knowledge bases (HR, Tech, Finance) depending on the semantic intent of the query.

## Production Solution
```python
import os
from llama_index.core import VectorStoreIndex, SimpleKeywordTableIndex, Document
from llama_index.core.tools import QueryEngineTool, ToolMetadata
from llama_index.core.query_engine import RouterQueryEngine
from llama_index.core.selectors import LLMSingleSelector

def setup_router_engine():
    # 1. Setup Data Sources
    tech_docs = [Document(text="Server architecture uses AWS ECS with auto-scaling.")]
    hr_docs = [Document(text="Employees receive 25 days of PTO. Sick leave is unlimited.")]
    finance_docs = [Document(text="Q3 Earnings Report: Revenue increased by 15%. Target budget XYZ-99.")]

    # 2. Setup Indexes
    tech_index = VectorStoreIndex.from_documents(tech_docs)
    hr_index = VectorStoreIndex.from_documents(hr_docs)
    # Using keyword index for finance to simulate exact match requirements
    finance_index = SimpleKeywordTableIndex.from_documents(finance_docs)

    # 3. Setup Tools with strict descriptions
    tools = [
        QueryEngineTool(
            query_engine=tech_index.as_query_engine(),
            metadata=ToolMetadata(
                name="engineering_docs",
                description="Use for technical questions, architecture, servers, and code."
            )
        ),
        QueryEngineTool(
            query_engine=hr_index.as_query_engine(),
            metadata=ToolMetadata(
                name="human_resources_docs",
                description="Use for employee benefits, PTO, rules, and company culture."
            )
        ),
        QueryEngineTool(
            query_engine=finance_index.as_query_engine(),
            metadata=ToolMetadata(
                name="financial_reports",
                description="Use strictly for budget numbers, earnings, and exact financial IDs like XYZ-99."
            )
        )
    ]

    # 4. Initialize Router
    router = RouterQueryEngine(
        selector=LLMSingleSelector.from_defaults(),
        query_engine_tools=tools,
    )

    return router

if __name__ == "__main__":
    # Test the router
    router = setup_router_engine()

    queries = [
        "How much PTO do I have?",
        "Where are our servers hosted?",
        "What was the revenue increase in Q3?"
    ]

    for q in queries:
        print(f"\nQuery: {q}")
        # Note: Actual execution requires valid LLM API keys
        # response = router.query(q)
        # print(f"Response: {response}")
```
