# Challenge 2: Financial Wire Transfer Agent with Human Gate

## Architecture Diagram

```text
[ Initial Request ] ──► [ Node: Assess Risk ]
                              │
                              ▼
                        [ Router ]
                        /        \
                  (Low Risk)  (High Risk)
                      /            \
                     ▼              ▼
            [ Node: Execute ]   [ Node: Human Approval ] ◄── (interrupt_before pauses here)
                                    │
                              (Human updates DB)
                                    │
                               (Resume Graph)
                                    │
                                    ▼
                             [ Node: Execute ]
```

## Starter Template

```python
# starter.py
from typing import TypedDict
from langgraph.graph import StateGraph, END
from langgraph.checkpoint.memory import MemorySaver

class TransferState(TypedDict):
    sender: str
    recipient: str
    amount: float
    risk_score: int # 1-10
    approved: bool

def assess_risk(state: TransferState):
    # TODO: Calculate risk. If amount > 10000, risk is high.
    pass

def human_gate(state: TransferState):
    # TODO: Dummy node for interrupt.
    pass

def execute_transfer(state: TransferState):
    # TODO: Execute if approved or low risk.
    pass

# TODO: Build graph, add nodes/edges/router, compile with checkpointer and interrupt.
```

## Production Solution

```python
# solution.py
from typing import TypedDict
from langgraph.graph import StateGraph, END
from langgraph.checkpoint.memory import MemorySaver

class TransferState(TypedDict):
    sender: str
    recipient: str
    amount: float
    risk_score: int
    approved: bool
    status: str

def assess_risk(state: TransferState):
    # Mocking a risk assessment API
    score = 9 if state["amount"] > 10000 else 2
    return {"risk_score": score, "status": "ASSESSED"}

def human_gate(state: TransferState):
    # This node does nothing computationally. It serves as a named checkpoint.
    return {"status": "AWAITING_REVIEW"}

def execute_transfer(state: TransferState):
    if state["risk_score"] >= 8 and not state["approved"]:
        return {"status": "FAILED: High risk, not approved."}

    # Mock executing a wire API
    return {"status": f"SUCCESS: Transferred ${state['amount']} to {state['recipient']}"}

def risk_router(state: TransferState):
    if state["risk_score"] >= 8:
        return "human_gate"
    return "execute"

builder = StateGraph(TransferState)
builder.add_node("assess", assess_risk)
builder.add_node("human_gate", human_gate)
builder.add_node("execute", execute_transfer)

builder.set_entry_point("assess")
builder.add_conditional_edges("assess", risk_router)
builder.add_edge("human_gate", "execute")
builder.add_edge("execute", END)

# Production requires checkpointer for interrupts
memory = MemorySaver()
app = builder.compile(checkpointer=memory, interrupt_before=["human_gate"])

if __name__ == "__main__":
    config = {"configurable": {"thread_id": "tx_001"}}
    initial_state = {
        "sender": "Alice",
        "recipient": "Bob",
        "amount": 50000.0,
        "risk_score": 0,
        "approved": False,
        "status": "PENDING"
    }

    print("1. Initiating Transfer...")
    app.invoke(initial_state, config)

    # Check state
    current = app.get_state(config)
    print(f"2. Graph Paused. Status: {current.values.get('status')}")

    if current.next and current.next[0] == "human_gate":
        print("3. Human reviewing high-risk transfer...")
        # Human approves
        app.update_state(config, {"approved": True})
        print("4. Resuming Graph...")
        result = app.invoke(None, config) # Pass None to resume
        print(f"5. Final Status: {result['status']}")
```

## Test Suite (Pytest)

```python
# test_solution.py
from solution import app

def test_low_risk_auto_executes():
    config = {"configurable": {"thread_id": "tx_low"}}
    initial = {"amount": 500.0, "approved": False, "risk_score": 0, "status": ""}

    result = app.invoke(initial, config)

    # Should not pause, should go straight to END
    assert "SUCCESS" in result["status"]
    assert len(app.get_state(config).next) == 0

def test_high_risk_interrupts():
    config = {"configurable": {"thread_id": "tx_high"}}
    initial = {"amount": 50000.0, "approved": False, "risk_score": 0, "status": ""}

    app.invoke(initial, config)
    state = app.get_state(config)

    # Should be paused at human_gate
    assert state.next == ("human_gate",)

    # Resume with rejection
    app.update_state(config, {"approved": False})
    result = app.invoke(None, config)

    assert "FAILED" in result["status"]
```
