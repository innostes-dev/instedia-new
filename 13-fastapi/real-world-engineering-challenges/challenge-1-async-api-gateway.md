# Challenge 1: High-Concurrency Async API Gateway

## The Challenge
You are building the front-door API Gateway for a new AI startup. This gateway receives hundreds of requests per second. It needs to accept incoming requests, validate them strictly, make an asynchronous downstream call to a slow AI model, and return the result.

**Requirements:**
1. Create a Pydantic v2 model `AIRequest` that accepts:
   - `prompt`: string, strictly between 10 and 1000 characters.
   - `temperature`: float, between 0.0 and 1.0 (default 0.7).
   - `models`: A list of strings, containing exactly 1 or 2 items.
2. Create an endpoint `POST /gateway/v1/generate`.
3. The endpoint must use `asyncio.gather` to mock-query the requested models concurrently.
   - For each model in the list, `await asyncio.sleep(1.5)` to simulate the inference time, and return `f"Result from {model}"`.
4. If a user asks for 2 models, the total request time must still be ~1.5 seconds, proving concurrency works.

<details>
<summary><b>Solution Walkthrough</b></summary>

```python
import asyncio
import time
from typing import List
from fastapi import FastAPI
from pydantic import BaseModel, Field

app = FastAPI(title="AI API Gateway")

# 1. Strict Payload Sanitization
class AIRequest(BaseModel):
    prompt: str = Field(..., min_length=10, max_length=1000)
    temperature: float = Field(default=0.7, ge=0.0, le=1.0)
    models: List[str] = Field(..., min_length=1, max_length=2)

# 2. Mock downstream async call
async def call_model(model_name: str, prompt: str, temp: float):
    # Simulate network I/O and GPU inference time
    await asyncio.sleep(1.5)
    return {
        "model": model_name,
        "content": f"Simulated response for '{prompt[:10]}...' at temp {temp}"
    }

# 3. The Gateway Endpoint
@app.post("/gateway/v1/generate")
async def generate_gateway(req: AIRequest):
    start_time = time.time()

    # Create a list of async tasks
    tasks = [call_model(m, req.prompt, req.temperature) for m in req.models]

    # 4. Execute all downstream requests concurrently!
    results = await asyncio.gather(*tasks)

    end_time = time.time()

    return {
        "gateway_status": "success",
        "total_time_seconds": round(end_time - start_time, 2),
        "results": results
    }
```

**Why this matters:**
This is the standard architectural pattern for modern AI Gateways (like LiteLLM or Portkey). By using `asyncio.gather`, we achieve fan-out/fan-in concurrency. If the user wants to compare GPT-4 and Claude-3 side-by-side, we don't wait 1.5s for GPT-4 and then *another* 1.5s for Claude. We fire both requests over the network simultaneously, returning to the user in half the time, while never blocking the Uvicorn worker from accepting new incoming API requests.
</details>
