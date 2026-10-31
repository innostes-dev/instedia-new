# Challenge 3: Distributed Tracing & Observability Pipeline with Automated Alerting

## 1. Scenario
Your multi-agent customer support workflow (built with LangChain/LangGraph) is deployed to production. It involves a vector database retrieval step, an external API call to check order status, and an LLM generation step.
Recently, the system occasionally hangs for over 20 seconds, causing customers to abandon the chat. You need to implement distributed tracing using LangSmith.
Furthermore, you must build an automated alerting mechanism: if any step in the trace takes longer than 10 seconds, it should automatically trigger a Slack/Discord webhook alert.

## 2. Architecture Diagram
```text
[User Request] -> [LangChain App (Instrumented with LangSmith)]
                          |
                          +-- Span 1: Retriever (Expected: 1s, Actual: 15s)
                          +-- Span 2: Order API (Expected: 1s, Actual: 1s)
                          +-- Span 3: LLM Generation (Expected: 3s, Actual: 3s)
                                      |
                                      v (Background Thread)
                          [LangSmith SaaS API] -> Visual Waterfall UI
                                      |
                                      v (Webhook / SDK Query)
                          [Custom Monitoring Script]
                          Reads recent traces -> IF span latency > 10s
                                      |
                                      v
                             [Slack Alert Triggered]
```

## 3. Starter Template
`agent.py`
```python
import os
import time
from langchain_openai import ChatOpenAI
from langchain_core.prompts import ChatPromptTemplate
# TODO: Import the LangSmith traceable decorator

# TODO: Set LangSmith environment variables here or in .env

# TODO: Decorate this function so it appears as a separate span in the trace
def check_order_status(order_id: str):
    time.sleep(1) # Simulate fast API
    return "Order is shipped."

# TODO: Decorate this function. Simulate a bug by making it sleep for 12 seconds.
def slow_retriever(query: str):
    time.sleep(12) # Simulate database deadlock
    return "Refund policy allows 30 days."

def run_agent(query: str):
    # TODO: Execute the slow retriever and order check
    # TODO: Execute an LLM call to synthesize the answer
    # return the final answer
    pass

if __name__ == "__main__":
    run_agent("Where is order 123 and what is the refund policy?")
```

## 4. Production Solution Walkthrough

### The Code (`agent.py` & `monitor.py`)

**`agent.py` (The Instrumented Application)**
```python
import os
import time
from langsmith import traceable
from langchain_openai import ChatOpenAI
from langchain_core.prompts import ChatPromptTemplate

# 1. Enable Tracing
os.environ["LANGCHAIN_TRACING_V2"] = "true"
os.environ["LANGCHAIN_PROJECT"] = "Customer-Support-Agent"
os.environ["LANGCHAIN_ENDPOINT"] = "https://api.smith.langchain.com"
# Requires LANGCHAIN_API_KEY and OPENAI_API_KEY

# 2. Instrument Custom Functions
@traceable(name="Order_API_Call")
def check_order_status(order_id: str):
    time.sleep(1)
    return "Order is shipped."

@traceable(name="Vector_DB_Retrieval")
def slow_retriever(query: str):
    # Simulate a database hang that causes the timeout
    time.sleep(12)
    return "Refund policy allows 30 days."

@traceable(name="Main_Agent_Workflow")
def run_agent(query: str):
    order_info = check_order_status("123")
    policy_info = slow_retriever(query)

    # LangChain primitives are automatically traced
    prompt = ChatPromptTemplate.from_template(
        "Answer the user using this info: {order} and {policy}. User: {query}"
    )
    llm = ChatOpenAI(model="gpt-4o-mini")

    chain = prompt | llm
    result = chain.invoke({
        "order": order_info,
        "policy": policy_info,
        "query": query
    })

    return result.content

if __name__ == "__main__":
    print("Running Agent...")
    run_agent("Where is order 123 and what is the refund policy?")
    print("Agent Finished. Trace sent to LangSmith.")
```

**`monitor.py` (The Alerting CRON Script)**
```python
import os
import requests
from langsmith import Client
from datetime import datetime, timedelta

# Initialize LangSmith SDK Client
client = Client()

# Mock Slack Webhook URL
SLACK_WEBHOOK_URL = os.environ.get("SLACK_WEBHOOK_URL", "http://localhost:9999/mock-slack")

def check_for_latency_spikes():
    # 1. Query LangSmith for recent runs in the last 15 minutes
    project_name = "Customer-Support-Agent"
    start_time = datetime.utcnow() - timedelta(minutes=15)

    print(f"Checking for high latency traces since {start_time}...")

    runs = client.list_runs(
        project_name=project_name,
        execution_order=1, # Only get root traces
        start_time=start_time,
        error=False
    )

    for run in runs:
        # Calculate total latency
        latency_seconds = (run.end_time - run.start_time).total_seconds()

        # 2. Threshold Logic
        if latency_seconds > 10.0:
            msg = (
                f"🚨 *HIGH LATENCY ALERT* 🚨\n"
                f"Trace ID: `{run.id}`\n"
                f"Project: `{project_name}`\n"
                f"Latency: `{latency_seconds:.2f} seconds`\n"
                f"Link: [View in LangSmith]({run.url})"
            )
            print("Alert triggered!")

            # 3. Fire Webhook
            try:
                requests.post(SLACK_WEBHOOK_URL, json={"text": msg})
            except Exception as e:
                pass # Ignore missing webhook in dev

if __name__ == "__main__":
    check_for_latency_spikes()
```

## 5. Test Suite (Pytest)

`pytest monitor_test.py`
```python
import pytest
from unittest.mock import MagicMock, patch
import datetime
from monitor import check_for_latency_spikes

# Mock a LangSmith Run Object
class MockRun:
    def __init__(self, id, start, end, url):
        self.id = id
        self.start_time = start
        self.end_time = end
        self.url = url

@patch('monitor.requests.post')
@patch('monitor.client.list_runs')
def test_latency_alerting(mock_list_runs, mock_post):

    now = datetime.datetime.utcnow()

    # 1. Setup Mock Data
    # Run 1: 3 seconds (Should not alert)
    run_normal = MockRun(
        "run-1", now, now + datetime.timedelta(seconds=3), "http://ls/1"
    )
    # Run 2: 15 seconds (Should alert)
    run_slow = MockRun(
        "run-2", now, now + datetime.timedelta(seconds=15), "http://ls/2"
    )

    mock_list_runs.return_value = [run_normal, run_slow]

    # 2. Execute
    check_for_latency_spikes()

    # 3. Assertions
    # Webhook should only be called once (for the slow run)
    assert mock_post.call_count == 1

    # Verify the payload contained the correct Trace ID and Latency
    called_json = mock_post.call_args[1]['json']['text']
    assert "run-2" in called_json
    assert "15.00 seconds" in called_json
    assert "run-1" not in called_json
```