# Challenge 4: Automated CI/CD RAG Evaluation Gate

## 1. Scenario
Your team develops a legal RAG chatbot. Hallucinations in the legal domain are unacceptable. A developer recently changed the system prompt to make the bot "more conversational", but you suspect this causes the LLM to invent facts not present in the legal documents.
You need to build a Python script using the `ragas` library that runs as a CI/CD check. It must evaluate a standard dataset of 3 legal questions. If the `faithfulness` metric (which measures hallucinations against the retrieved context) drops below `0.90`, the script must exit with a non-zero status code, effectively rejecting the Pull Request.

## 2. Architecture Diagram
```text
[Developer opens PR with new prompt]
               |
               v
[GitHub Actions CI/CD Pipeline]
               |
               +-> 1. Runs Legal RAG App locally with new prompt
               |      (Generates Answers for 3 Golden Questions)
               |
               +-> 2. Feeds [Questions, Contexts, Answers] to Ragas
               |
               +-> 3. Ragas LLM Judge (GPT-4o) evaluates Faithfulness
               |
               +-> 4. Averages the Faithfulness Score (e.g., 0.85)
               |
               v
       [Gate Check: Is Score >= 0.90?]
          /                     \
      YES (0.95)              NO (0.85)
         |                       |
     exit(0)                  exit(1)
   [PR Merged]              [PR Blocked]
```

## 3. Starter Template
`ci_evaluate.py`
```python
import os
import sys
from datasets import Dataset
from ragas import evaluate
from ragas.metrics import faithfulness
from langchain_openai import ChatOpenAI

# TODO: Define the test dataset (Questions, Contexts, Generated Answers)
# Simulate a scenario where one of the answers includes a hallucinated fact
data = {
    "question": [...],
    "contexts": [...],
    "answer": [...]
}

def run_evaluation():
    # TODO: Convert data to HuggingFace Dataset
    # TODO: Initialize the GPT-4o judge LLM
    # TODO: Run ragas.evaluate using only the faithfulness metric
    # TODO: Extract the final faithfulness score from the result

    # TODO: Implement the CI/CD Gate Logic (exit 0 if >= 0.90, exit 1 if < 0.90)
    pass

if __name__ == "__main__":
    run_evaluation()
```

## 4. Production Solution Walkthrough

### The Code (`ci_evaluate.py`)
```python
import os
import sys
import pandas as pd
from datasets import Dataset
from ragas import evaluate
from ragas.metrics import faithfulness
from langchain_openai import ChatOpenAI

# 1. The Evaluation Dataset
# In a real CI pipeline, 'answer' would be generated dynamically by your app
# using the code from the current PR. Here, we hardcode it to simulate the test.
eval_data = {
    "question": [
        "What is the penalty for early lease termination?",
        "Are pets allowed in the building?"
    ],
    "contexts": [
        ["Section 4: Early termination incurs a fee of two months rent."],
        ["Section 9: Dogs under 20lbs are permitted. Cats are prohibited."]
    ],
    "answer": [
        # Good answer (High faithfulness expected)
        "You will be charged a fee equal to two months rent.",
        # BAD ANSWER: The prompt made it conversational, but it hallucinated cats!
        "Yes! We love pets! You can bring your small dog or cat!"
    ]
}

def run_evaluation():
    print("Starting CI/CD RAG Evaluation...")
    dataset = Dataset.from_dict(eval_data)

    # 2. Configure the Judge
    # Always use a highly capable model for judging, temperature 0
    judge_llm = ChatOpenAI(model="gpt-4o", temperature=0.0)

    # 3. Execute Ragas
    result = evaluate(
        dataset,
        metrics=[faithfulness],
        llm=judge_llm,
    )

    # Output detailed results for the PR comment
    df = result.to_pandas()
    print("\n--- Detailed Results ---")
    print(df[['question', 'answer', 'faithfulness']].to_string())

    # 4. The CI/CD Gate Logic
    # Ragas returns a dictionary containing the average score for the metric
    final_score = result["faithfulness"]
    print(f"\nAGGREGATE FAITHFULNESS SCORE: {final_score:.4f}")

    THRESHOLD = 0.90

    if final_score >= THRESHOLD:
        print(f"✅ PASSED. Score is above {THRESHOLD}.")
        sys.exit(0) # Standard OS success code
    else:
        print(f"❌ FAILED. Regressions detected. Score is below {THRESHOLD}.")
        sys.exit(1) # OS Error code -> Fails the GitHub Action

if __name__ == "__main__":
    # Setup mock keys if running locally without OpenAI
    if not os.environ.get("OPENAI_API_KEY"):
        print("Mocking for demonstration. (Set OPENAI_API_KEY for real eval).")
        sys.exit(1) # Will fail gracefully

    run_evaluation()
```

## 5. Test Suite (Pytest)
Testing an evaluation script requires mocking the LLM API, as we don't want unit tests to cost money or fail due to network errors.

`pytest test_ci.py`
```python
import pytest
import sys
from unittest.mock import patch, MagicMock
from ci_evaluate import run_evaluation

@patch('ci_evaluate.evaluate')
@patch('ci_evaluate.ChatOpenAI')
def test_pipeline_passes_when_score_high(mock_llm, mock_evaluate):
    # Mock a high faithfulness score from Ragas
    mock_result = MagicMock()
    mock_result.__getitem__.return_value = 0.95  # The final score
    mock_result.to_pandas.return_value = MagicMock()
    mock_evaluate.return_value = mock_result

    # sys.exit(0) throws a SystemExit exception in Python
    with pytest.raises(SystemExit) as pytest_wrapped_e:
        run_evaluation()

    # Assert it exited with 0 (Success)
    assert pytest_wrapped_e.type == SystemExit
    assert pytest_wrapped_e.value.code == 0

@patch('ci_evaluate.evaluate')
@patch('ci_evaluate.ChatOpenAI')
def test_pipeline_fails_when_score_low(mock_llm, mock_evaluate):
    # Mock a low faithfulness score (Hallucination detected)
    mock_result = MagicMock()
    mock_result.__getitem__.return_value = 0.50
    mock_result.to_pandas.return_value = MagicMock()
    mock_evaluate.return_value = mock_result

    with pytest.raises(SystemExit) as pytest_wrapped_e:
        run_evaluation()

    # Assert it exited with 1 (Failure)
    assert pytest_wrapped_e.type == SystemExit
    assert pytest_wrapped_e.value.code == 1
```