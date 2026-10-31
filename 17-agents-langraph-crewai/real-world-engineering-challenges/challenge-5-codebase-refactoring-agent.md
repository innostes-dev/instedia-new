# Challenge 5: Multi-Agent Codebase Refactoring Engine

## Architecture Diagram

```text
                                [ GitHub Issue Trigger ]
                                           │
                                           ▼
┌─────────────────────────────────────────────────────────────────────────────────┐
│ CrewAI Engine                                                                   │
│                                                                                 │
│   ┌────────────────────────┐      ┌─────────────────────┐      ┌────────────┐   │
│   │ Agent: Code Analyzer   │ ──►  │ Agent: Refactor     │ ──►  │ Agent: QA  │   │
│   │ Task: Identify smells  │      │ Task: Write updates │      │ Task: Test │   │
│   └────────────────────────┘      └─────────────────────┘      └────────────┘   │
│                                                                       │         │
│                                       (Delegates back to Refactor if fails)     │
└───────────────────────────────────────────────────────────────────────┼─────────┘
                                                                        ▼
                                                             [ Final PR Diff ]
```

## Starter Template

```python
# starter.py
from crewai import Agent, Task, Crew, Process

# TODO: Define a custom Tool that reads a local file `mock_code.py`.

# TODO: Define 3 Agents: Analyzer, Refactorer, QA. Give QA allow_delegation=True.

# TODO: Define 3 Tasks linked to the agents.

# TODO: Assemble Crew and run.
```

## Production Solution

```python
# solution.py
import os
from crewai import Agent, Task, Crew, Process
from langchain_openai import ChatOpenAI
from langchain.tools import tool

os.environ["OPENAI_API_KEY"] = os.getenv("OPENAI_API_KEY", "mock-key")
llm = ChatOpenAI(model="gpt-4", temperature=0)

# 1. Custom Tools
@tool
def read_codebase(filepath: str) -> str:
    """Reads a local python file."""
    try:
        with open(filepath, "r") as f:
            return f.read()
    except Exception as e:
        return f"Error: {e}"

# 2. Agents
analyzer = Agent(
    role="Senior Staff Architect",
    goal="Identify code smells and architectural flaws in python code.",
    backstory="You have 20 years of experience designing scalable python systems.",
    tools=[read_codebase],
    allow_delegation=False,
    llm=llm,
    verbose=True
)

refactor_agent = Agent(
    role="Senior Software Engineer",
    goal="Rewrite python code to be clean, typed, and efficient.",
    backstory="You are a python core contributor who hates messy code.",
    allow_delegation=False,
    llm=llm,
    verbose=True
)

qa_agent = Agent(
    role="Lead QA Engineer",
    goal="Review refactored code and ensure it meets standards. Reject bad code.",
    backstory="You are extremely strict. You will delegate work back to the Engineer if it lacks type hints or docstrings.",
    allow_delegation=True, # Crucial: Can push back to refactor_agent
    llm=llm,
    verbose=True
)

# 3. Tasks
t1 = Task(
    description="Read the file 'legacy.py' and list 3 specific code smells.",
    expected_output="A list of 3 code smells.",
    agent=analyzer
)

t2 = Task(
    description="Using the smells identified, write a completely refactored version of the code.",
    expected_output="Raw python code, refactored.",
    agent=refactor_agent
)

t3 = Task(
    description="Review the refactored code. It MUST have type hints and a docstring. If it does not, delegate a task back to the Engineer to fix it.",
    expected_output="The final, approved python code.",
    agent=qa_agent
)

# 4. Assembly
crew = Crew(
    agents=[analyzer, refactor_agent, qa_agent],
    tasks=[t1, t2, t3],
    process=Process.sequential,
    verbose=True
)

if __name__ == "__main__":
    # Create a mock legacy file
    with open("legacy.py", "w") as f:
        f.write("def do_math(a,b):\n  return a+b\n")

    print("Kicking off Refactor Crew...")
    result = crew.kickoff()
    print("\n--- Final Approved Code ---")
    print(result)

    # Cleanup
    os.remove("legacy.py")
```

## Test Suite (Pytest)

```python
# test_solution.py
import os
import pytest
from solution import crew

@pytest.mark.skipif(not os.getenv("OPENAI_API_KEY"), reason="Requires OpenAI Key")
def test_refactoring_crew():
    # Setup legacy code
    with open("legacy.py", "w") as f:
        f.write("def add_nums(x,y): return x+y")

    try:
        # Run crew
        result = crew.kickoff()
        result_str = str(result)

        # Verify QA agent enforced type hints and docstrings
        assert "->" in result_str or ":" in result_str # Type hints
        assert '"""' in result_str or "'''" in result_str # Docstrings
        assert "def add_nums" in result_str # Maintained functionality
    finally:
        if os.path.exists("legacy.py"):
            os.remove("legacy.py")
```
