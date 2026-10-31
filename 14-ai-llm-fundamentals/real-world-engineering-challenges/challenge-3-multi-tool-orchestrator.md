# Challenge 3: Multi-Tool Orchestrator

## Problem Statement
You need an agent that can answer complex financial queries by using multiple tools. The user might ask: "Get the current stock price of AAPL, and email it to bob@example.com."
The agent must dynamically decide to call the `get_stock_price` tool, wait for the result, and then call the `send_email` tool in a single recursive execution loop.

## Architecture Diagram
```text
User -> Agent Loop -> (1) Call get_stock_price -> (2) Append Result -> (3) Call send_email -> (4) Output Final Answer
```

## Starter Template

```python
import json

def get_stock_price(ticker): return f"Price of {ticker} is $150."
def send_email(to, body): return f"Email sent to {to}."

tools_schema = [
    # TODO: Define schemas for get_stock_price and send_email
]

def run_agent(user_prompt):
    messages = [{"role": "user", "content": user_prompt}]

    # TODO: Implement the while loop that handles multiple tool calls
    pass
```

<details>
<summary>Full Production Solution Walkthrough</summary>

```python
import json

def get_stock_price(ticker): return f"Price of {ticker} is $150."
def send_email(to, body): return f"Email sent to {to} with body: {body}."

tools_schema = [
    {
        "type": "function",
        "function": {
            "name": "get_stock_price",
            "description": "Get the current stock price.",
            "parameters": {
                "type": "object",
                "properties": {"ticker": {"type": "string"}},
                "required": ["ticker"]
            }
        }
    },
    {
        "type": "function",
        "function": {
            "name": "send_email",
            "description": "Send an email.",
            "parameters": {
                "type": "object",
                "properties": {"to": {"type": "string"}, "body": {"type": "string"}},
                "required": ["to", "body"]
            }
        }
    }
]

# Mocking the LLM for the test
def mock_llm(messages):
    history = str(messages)
    class Msg:
        def __init__(self, content, tool_calls=None):
            self.content = content
            self.tool_calls = tool_calls
    class TC:
        def __init__(self, id, name, args):
            self.id = id
            self.function = type('F', (), {'name': name, 'arguments': args})()

    # Turn 1: Decide to get stock
    if "AAPL" in history and "get_stock_price" not in history:
        return Msg(None, [TC("call_1", "get_stock_price", '{"ticker": "AAPL"}')])

    # Turn 2: Decide to send email after getting stock
    if "Price of AAPL is $150" in history and "send_email" not in history:
        return Msg(None, [TC("call_2", "send_email", '{"to": "bob@example.com", "body": "AAPL is 150"}')])

    # Turn 3: Final response
    if "Email sent" in history:
        return Msg("I have checked the price and emailed Bob.")

def run_agent(user_prompt):
    messages = [{"role": "user", "content": user_prompt}]

    max_loops = 5
    for _ in range(max_loops):
        # 1. Call LLM
        response_msg = mock_llm(messages)

        # 2. Check for tool calls
        if not response_msg.tool_calls:
            return response_msg.content # Done!

        # 3. Append the assistant's tool call request
        # (In reality, you append the message object itself)
        messages.append({"role": "assistant", "content": None, "tool_calls": [{"id": tc.id, "function": {"name": tc.function.name, "arguments": tc.function.arguments}} for tc in response_msg.tool_calls]})

        # 4. Execute Tools
        for tc in response_msg.tool_calls:
            args = json.loads(tc.function.arguments)
            if tc.function.name == "get_stock_price":
                result = get_stock_price(args["ticker"])
            elif tc.function.name == "send_email":
                result = send_email(args["to"], args["body"])

            # 5. Append Tool Result
            messages.append({"role": "tool", "tool_call_id": tc.id, "content": result})

    raise Exception("Agent loop hit maximum iterations.")

# Test Suite
def test_agent():
    res = run_agent("Get AAPL and email bob@example.com")
    assert res == "I have checked the price and emailed Bob."
    print("Agent orchestrator test passed!")

test_agent()
```
</details>
