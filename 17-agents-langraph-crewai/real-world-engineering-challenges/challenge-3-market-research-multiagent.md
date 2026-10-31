# Challenge 3: Market Research Multi-Agent Team

## Architecture Diagram

```text
                        [ Supervisor ]
                              │ (Yields multiple Send objects)
            ┌─────────────────┼─────────────────┐
            ▼                 ▼                 ▼
     [Worker: Apple]   [Worker: Google]   [Worker: MSFT]
            │                 │                 │
            └─────────────────┼─────────────────┘ (Parallel Execution)
                              ▼
                        [ Reducer merges reports ]
                              │
                              ▼
                        [ Final State ]
```

## Starter Template

```python
# starter.py
import operator
from typing import TypedDict, Annotated
from langgraph.graph import StateGraph, END
from langgraph.constants import Send

class MainState(TypedDict):
    query: str
    target_companies: list[str]
    reports: Annotated[list[str], operator.add]

class WorkerState(TypedDict):
    company: str

def supervisor(state: MainState):
    # TODO: Extract list of companies from query
    pass

def research_worker(state: WorkerState):
    # TODO: Generate a mock report for state['company']
    pass

def router(state: MainState):
    # TODO: Return a list of Send("worker", WorkerState) for each company
    pass

# TODO: Build graph
```

## Production Solution

```python
# solution.py
import operator
import time
from typing import TypedDict, Annotated
from langgraph.graph import StateGraph, END
from langgraph.constants import Send

# 1. State Definitions
class MainState(TypedDict):
    query: str
    target_companies: list[str]
    reports: Annotated[list[str], operator.add]

class WorkerState(TypedDict):
    company: str

# 2. Nodes
def supervisor(state: MainState):
    print("Supervisor: Parsing query for targets...")
    # Mocking LLM extraction
    extracted = []
    if "big tech" in state["query"].lower():
        extracted = ["Apple", "Google", "Microsoft"]
    return {"target_companies": extracted}

def research_worker(state: WorkerState):
    print(f"Worker [{state['company']}]: Starting research...")
    time.sleep(1) # Simulate network call
    report = f"[{state['company']}] Market cap is growing."
    print(f"Worker [{state['company']}]: Done.")
    # Must return a dict matching the reducer key in MainState
    return {"reports": [report]}

# 3. Parallel Router
def parallel_router(state: MainState):
    if not state["target_companies"]:
        return END

    # Send API dynamically spins up a node for each target
    return [
        Send("research_worker", {"company": c})
        for c in state["target_companies"]
    ]

# 4. Build
builder = StateGraph(MainState)
builder.add_node("supervisor", supervisor)
builder.add_node("research_worker", research_worker)

builder.set_entry_point("supervisor")
builder.add_conditional_edges("supervisor", parallel_router)
# Workers merge back automatically
builder.add_edge("research_worker", END)

app = builder.compile()

if __name__ == "__main__":
    initial = {"query": "Analyze big tech", "target_companies": [], "reports": []}

    start_time = time.time()
    result = app.invoke(initial)
    duration = time.time() - start_time

    print("\n--- Final Reports ---")
    for r in result["reports"]:
        print(r)

    print(f"\nCompleted in {duration:.2f}s")
    # If duration is ~1s, parallel execution worked! If ~3s, it was sequential.
```

## Test Suite (Pytest)

```python
# test_solution.py
import time
from solution import app

def test_parallel_execution():
    initial = {"query": "Analyze big tech", "target_companies": [], "reports": []}

    start_time = time.time()
    result = app.invoke(initial)
    duration = time.time() - start_time

    assert len(result["reports"]) == 3
    # Check that 3 1-second sleeps took less than 2 seconds total (parallel)
    assert duration < 2.0

    reports_str = " ".join(result["reports"])
    assert "Apple" in reports_str
    assert "Google" in reports_str
    assert "Microsoft" in reports_str
```
