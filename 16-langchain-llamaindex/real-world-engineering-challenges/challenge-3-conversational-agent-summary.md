# Real-World Engineering Challenge: Conversational Agent with Summary Memory

## Architecture Diagram
```text
[ User Input ]
      │
      ▼
[ AgentExecutor ] ◄──(Injects condensed history)── [ ConversationSummaryBufferMemory ]
      │                                                │
      ├──► [ LLM (Decides tool or response) ]          │ (Runs background summaries
      │                                                │  when token limit is hit)
      └──► [ Tools (Web Search, Math) ]
```

## Challenge Objective
Create an Agent that can use tools (e.g., a mock database lookup) while maintaining a long-running conversation state. Prevent context window overflow by using `ConversationSummaryBufferMemory`.

## Production Solution
```python
from langchain_openai import ChatOpenAI
from langchain.agents import create_tool_calling_agent, AgentExecutor
from langchain_core.prompts import ChatPromptTemplate, MessagesPlaceholder
from langchain_core.tools import tool
from langchain.memory import ConversationSummaryBufferMemory

@tool
def lookup_customer_tier(customer_name: str) -> str:
    """Looks up the membership tier of a customer in the database."""
    db = {"alice": "Platinum", "bob": "Standard"}
    return db.get(customer_name.lower(), "Unknown")

def setup_agent():
    llm = ChatOpenAI(temperature=0)
    tools = [lookup_customer_tier]

    # 1. Setup Prompt with MessagesPlaceholder for memory
    prompt = ChatPromptTemplate.from_messages([
        ("system", "You are a helpful customer support agent."),
        MessagesPlaceholder(variable_name="chat_history"),
        ("human", "{input}"),
        MessagesPlaceholder(variable_name="agent_scratchpad"),
    ])

    # 2. Setup Summary Memory
    # max_token_limit is small here to demonstrate summarization quickly
    memory = ConversationSummaryBufferMemory(
        llm=llm,
        max_token_limit=100,
        memory_key="chat_history",
        return_messages=True
    )

    # 3. Create Agent and Executor
    agent = create_tool_calling_agent(llm, tools, prompt)

    # Pass memory to the Executor
    agent_executor = AgentExecutor(
        agent=agent,
        tools=tools,
        memory=memory,
        verbose=True
    )

    return agent_executor

if __name__ == "__main__":
    executor = setup_agent()
    # Simulating a multi-turn conversation
    # executor.invoke({"input": "Hi, my name is Alice."})
    # executor.invoke({"input": "What is my current membership tier?"})
```
