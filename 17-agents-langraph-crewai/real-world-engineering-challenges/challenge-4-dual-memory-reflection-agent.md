# Challenge 4: Dual-Memory Agent with Reflection

## Architecture Diagram

```text
       [ User Message ]
              │
              ▼
    ┌───────────────────┐
    │ Node: Chat        │ ◄── (Retrieves Short-Term Memory)
    └───────────────────┘
              │
              ▼
    ┌───────────────────┐
    │ Node: Reflection  │ ── (Extracts Core Facts -> Saves to Long-Term DB)
    └───────────────────┘
              │
             END
```

## Starter Template

```python
# starter.py
from typing import TypedDict, Annotated
import operator
from langgraph.graph import StateGraph, END
from langgraph.graph.message import add_messages

class MemoryState(TypedDict):
    messages: Annotated[list, add_messages]
    long_term_facts: Annotated[list[str], operator.add]

def chat_node(state: MemoryState):
    # TODO: Chat with user using LLM, passing in messages and long_term_facts as context.
    pass

def reflection_node(state: MemoryState):
    # TODO: Read the last message, extract new permanent facts, and return to long_term_facts.
    pass

# TODO: Build Graph
```

## Production Solution

```python
# solution.py
import os
import operator
from typing import TypedDict, Annotated
from langgraph.graph import StateGraph, END
from langgraph.graph.message import add_messages
from langchain_openai import ChatOpenAI
from langchain_core.messages import HumanMessage, SystemMessage, AIMessage
from langgraph.checkpoint.memory import MemorySaver

os.environ["OPENAI_API_KEY"] = os.getenv("OPENAI_API_KEY", "mock-key")
llm = ChatOpenAI(model="gpt-3.5-turbo", temperature=0)

class MemoryState(TypedDict):
    messages: Annotated[list, add_messages]
    long_term_facts: Annotated[list[str], operator.add]

def chat_node(state: MemoryState):
    # Contextualize with long-term memory
    sys = f"You are a helpful assistant. Here are facts you know about the user: {state.get('long_term_facts', [])}"
    messages = [SystemMessage(content=sys)] + state["messages"]

    response = llm.invoke(messages)
    return {"messages": [response]}

def reflection_node(state: MemoryState):
    # Look at the last message pair to extract facts
    history = state["messages"][-2:]

    sys = "Extract permanent facts about the user from the conversation. Output a bulleted list. If no facts, output 'NONE'."
    response = llm.invoke([SystemMessage(content=sys)] + history).content

    if "NONE" in response.upper():
        return {}

    facts = [f.strip("- ") for f in response.split("\n") if f.strip("- ")]
    return {"long_term_facts": facts}

builder = StateGraph(MemoryState)
builder.add_node("chat", chat_node)
builder.add_node("reflect", reflection_node)

builder.set_entry_point("chat")
builder.add_edge("chat", "reflect")
builder.add_edge("reflect", END)

# Checkpointer handles the short-term message history automatically!
app = builder.compile(checkpointer=MemorySaver())

if __name__ == "__main__":
    config = {"configurable": {"thread_id": "u_1"}}

    print(app.invoke({"messages": [HumanMessage("Hi, I'm Jules and I'm allergic to peanuts.")]}, config)["messages"][-1].content)

    # We clear the short term memory by simulating a new thread, BUT we pass in the facts manually
    # (In a real DB, facts would be stored in a VectorDB indexed by User ID, completely outside of Thread ID)
    saved_state = app.get_state(config).values
    facts = saved_state.get("long_term_facts", [])
    print(f"\nSaved Facts: {facts}")

    config2 = {"configurable": {"thread_id": "u_2"}}
    # Notice we pass the facts into the new thread!
    print(app.invoke({"messages": [HumanMessage("Can you recommend a snack?")], "long_term_facts": facts}, config2)["messages"][-1].content)
```

## Test Suite (Pytest)

```python
# test_solution.py
import pytest
from solution import app
from langchain_core.messages import HumanMessage

@pytest.mark.skipif(not os.getenv("OPENAI_API_KEY"), reason="Requires OpenAI Key")
def test_dual_memory():
    config = {"configurable": {"thread_id": "test_mem"}}

    # 1. State a fact
    app.invoke({"messages": [HumanMessage("I have a dog named Max.")]}, config)

    state = app.get_state(config).values
    facts = state.get("long_term_facts", [])

    assert len(facts) > 0
    assert any("Max" in f or "dog" in f for f in facts)

    # 2. Check if agent remembers
    res = app.invoke({"messages": [HumanMessage("What is my pet's name?")]}, config)
    assert "Max" in res["messages"][-1].content
```
