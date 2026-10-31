# Challenge 1: Self-Correcting Code Generation Agent

## Architecture Diagram

```text
                      [ User Prompt: "Write a sorting function" ]
                                           │
                                           ▼
┌─────────────────────────────────────────────────────────────────────────────────┐
│ StateGraph (Code Agent)                                                         │
│                                                                                 │
│   ┌───────────────┐                  ┌─────────────────┐                        │
│   │ Node: Draft   │ ──(code str)──►  │ Node: TestCode  │                        │
│   └───────────────┘                  └─────────────────┘                        │
│         ▲                                     │                                 │
│         │                                     ▼                                 │
│         │                             [ Router: success? ]                      │
│         │                                     │                                 │
│         │ (NO - append error to state)        │ (YES)                           │
│         └─────────────────────────────────────┘                                 │
│                                               │                                 │
└───────────────────────────────────────────────┼─────────────────────────────────┘
                                                ▼
                                         [ Final Code ]
```

## Starter Template

```python
# starter.py
from typing import TypedDict, Annotated
import operator
from langgraph.graph import StateGraph, END

class AgentState(TypedDict):
    prompt: str
    code: str
    errors: Annotated[list[str], operator.add]
    iterations: int

def draft_code(state: AgentState):
    # TODO: Use an LLM to generate python code based on prompt and past errors.
    pass

def execute_tests(state: AgentState):
    # TODO: Safely execute the code (e.g., using a local try/except block with exec for this challenge).
    # Return the error string if it fails.
    pass

def route(state: AgentState):
    # TODO: If iterations > 3, return END. If error exists, return "draft". Else END.
    pass

# TODO: Build and compile graph
```

## Production Solution

```python
# solution.py
import os
import operator
from typing import TypedDict, Annotated
from langgraph.graph import StateGraph, END
from langchain_openai import ChatOpenAI
from langchain_core.messages import SystemMessage, HumanMessage

os.environ["OPENAI_API_KEY"] = os.getenv("OPENAI_API_KEY", "mock-key")
llm = ChatOpenAI(model="gpt-4", temperature=0)

class AgentState(TypedDict):
    prompt: str
    code: str
    errors: Annotated[list[str], operator.add]
    iterations: int
    success: bool

def draft_code(state: AgentState):
    sys_prompt = "You are an expert Python developer. Output ONLY raw python code. No markdown formatting."
    user_prompt = f"Task: {state['prompt']}\n\nPast Errors:\n{state['errors']}"

    response = llm.invoke([SystemMessage(content=sys_prompt), HumanMessage(content=user_prompt)])
    code = response.content.strip().replace("```python", "").replace("```", "")

    return {"code": code, "iterations": state["iterations"] + 1}

def execute_tests(state: AgentState):
    code = state["code"]
    try:
        # DANGER: exec is used here for local challenge simulation only.
        # In production, use e2b or modal sandboxes.
        exec_globals = {}
        exec(code, exec_globals)

        # We assume the prompt asks for a function named 'solution_func'
        if "solution_func" not in exec_globals:
            raise ValueError("Function 'solution_func' not found in generated code.")

        return {"success": True}
    except Exception as e:
        error_msg = f"{type(e).__name__}: {str(e)}"
        return {"success": False, "errors": [error_msg]}

def route(state: AgentState):
    if state["success"]:
        return END
    if state["iterations"] >= 3:
        return END
    return "draft"

builder = StateGraph(AgentState)
builder.add_node("draft", draft_code)
builder.add_node("test", execute_tests)
builder.set_entry_point("draft")
builder.add_edge("draft", "test")
builder.add_conditional_edges("test", route)
app = builder.compile()

if __name__ == "__main__":
    initial = {
        "prompt": "Write a python function `solution_func(lst)` that returns a reversed list.",
        "code": "",
        "errors": [],
        "iterations": 0,
        "success": False
    }
    result = app.invoke(initial)
    print(f"Final Code:\n{result['code']}\nSuccess: {result['success']}")
```

## Test Suite (Pytest)

```python
# test_solution.py
import pytest
from solution import app

@pytest.mark.skipif(not os.getenv("OPENAI_API_KEY"), reason="Requires OpenAI Key")
def test_self_correcting_agent():
    initial = {
        "prompt": "Write a python function `solution_func(a, b)` that adds two numbers. Add a deliberate syntax error first, but you are an LLM so just write the correct one.",
        "code": "",
        "errors": [],
        "iterations": 0,
        "success": False
    }

    result = app.invoke(initial)

    assert result["success"] is True
    assert "solution_func" in result["code"]
    assert result["iterations"] >= 1
```
