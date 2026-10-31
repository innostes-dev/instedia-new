# Real-World Engineering Challenge: LCEL Fallback Chain

## Architecture Diagram
```text
[ Input ] ──► [ Primary Model (GPT-4) ] ──(Success)──► [ Parser ] ──► [ Output ]
                      │
                   (Timeout/RateLimit)
                      │
                      ▼
              [ Fallback Model (GPT-3.5) ] ──► [ Parser ] ──► [ Output ]
```

## Challenge Objective
Build a robust LCEL pipeline that attempts to use an expensive/slow model (like GPT-4), but gracefully falls back to a cheaper/faster model (like GPT-3.5-turbo) if the primary model fails or is rate-limited.

## Production Solution
```python
import os
from langchain_openai import ChatOpenAI
from langchain_core.prompts import ChatPromptTemplate
from langchain_core.output_parsers import StrOutputParser

def build_fallback_chain():
    prompt = ChatPromptTemplate.from_template("Summarize this text in exactly 5 words: {text}")
    parser = StrOutputParser()

    # 1. Primary Model (Simulating a potentially flaky/expensive call)
    # We set max_retries=0 to force failure immediately on network issues for this demo
    primary_llm = ChatOpenAI(model="gpt-4", max_retries=0, request_timeout=2)

    # 2. Fallback Model (Reliable/Cheap)
    fallback_llm = ChatOpenAI(model="gpt-3.5-turbo", max_retries=3)

    # 3. Create individual chains
    primary_chain = prompt | primary_llm | parser
    fallback_chain = prompt | fallback_llm | parser

    # 4. Attach fallback using .with_fallbacks()
    robust_chain = primary_chain.with_fallbacks([fallback_chain])

    return robust_chain

if __name__ == "__main__":
    chain = build_fallback_chain()
    text = "The quick brown fox jumps over the lazy dog in the middle of the dark night."

    # Executing the chain. If GPT-4 times out, it silently uses GPT-3.5
    # result = chain.invoke({"text": text})
    # print(result)
```
