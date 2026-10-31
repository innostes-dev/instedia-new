# Challenge 5: Boss Level - Production Model Microservice

## The Challenge
Combine everything you've learned. You are building a production microservice for an embedding model. It needs strict validation, custom error handling, and background task offloading for telemetry.

**Requirements:**
1. **Validation:** Create an `EmbeddingRequest` Pydantic model. It requires `text` (min 5, max 500 chars) and an optional `user_id`.
2. **Response:** Create an `EmbeddingResponse` model. It returns `embedding` (a list of 3 floats) and `tokens_used`. Do *not* return the original text in the response.
3. **Background Task:** Create a function `log_telemetry(user_id, tokens)` that sleeps 1s and prints telemetry data.
4. **Exception Handling:** Create a custom exception `ModelOverloadedError`. Write a global exception handler that catches it and returns HTTP 503 Service Unavailable with a `Retry-After: 30` header.
5. **Endpoint:** `POST /v1/embeddings`.
   - Takes the validated Pydantic payload.
   - If `text` contains the word "crash", raise `ModelOverloadedError`.
   - Calculate mock tokens (`len(text)`). Add the `log_telemetry` background task.
   - Return the response matched to `EmbeddingResponse`.

<details>
<summary><b>Solution Walkthrough</b></summary>

```python
import time
from typing import List, Optional
from fastapi import FastAPI, BackgroundTasks, Request
from fastapi.responses import JSONResponse
from pydantic import BaseModel, Field

app = FastAPI(title="Production Embedding Microservice")

# --- 1. Custom Exceptions & Handlers ---
class ModelOverloadedError(Exception):
    pass

@app.exception_handler(ModelOverloadedError)
async def overloaded_handler(request: Request, exc: ModelOverloadedError):
    # Returns 503 with standard Retry-After header
    return JSONResponse(
        status_code=503,
        content={"error": "GPU cluster currently overloaded."},
        headers={"Retry-After": "30"}
    )

# --- 2. Data Contracts (Pydantic) ---
class EmbeddingRequest(BaseModel):
    text: str = Field(..., min_length=5, max_length=500)
    user_id: Optional[str] = None

class EmbeddingResponse(BaseModel):
    embedding: List[float]
    tokens_used: int
    # Note: 'text' is deliberately excluded from the outbound contract

# --- 3. Background Telemetry Worker ---
def log_telemetry(user_id: str, tokens: int):
    # This runs outside the HTTP request-response cycle
    time.sleep(1)
    print(f"[TELEMETRY] Logged {tokens} tokens for user: {user_id}")

# --- 4. The Core Endpoint ---
@app.post("/v1/embeddings", response_model=EmbeddingResponse)
async def create_embedding(
    req: EmbeddingRequest,
    bg_tasks: BackgroundTasks
):
    # Business Logic / Failure Simulation
    if "crash" in req.text.lower():
        raise ModelOverloadedError()

    tokens = len(req.text)
    mock_vector = [0.123, -0.456, 0.789]

    # Fire and forget telemetry
    if req.user_id:
        bg_tasks.add_task(log_telemetry, req.user_id, tokens)

    # FastAPI will intercept this dict, validate it against EmbeddingResponse,
    # and serialize it cleanly to the user.
    return {
        "embedding": mock_vector,
        "tokens_used": tokens,
        "internal_server_data": "THIS WILL BE STRIPPED OUT"
    }
```

**Why this matters:**
This is a complete, production-grade microservice.
- **Security & Data Safety:** Pydantic strictly validates the inbound size, protecting against Memory out-of-bounds attacks. `response_model` ensures internal data (like `internal_server_data`) never leaks to the client.
- **Resilience:** Instead of wrapping the endpoint in `try...except`, we use a custom Exception and Global Handler. This means if we add 10 more endpoints, they can all just `raise ModelOverloadedError()` and the 503 logic is handled globally.
- **Performance:** We don't block the user's HTTP request waiting for our database/telemetry systems to acknowledge the log. We return the embedding instantly, and let the `BackgroundTask` handle the I/O.
</details>
