# Challenge 2: Token-by-Token SSE AI Streaming

## The Challenge
Modern UI relies on seeing the text appear instantly as the AI generates it. You need to build a streaming endpoint that simulates this token-by-token generation using Server-Sent Events (SSE). Crucially, GPU time is expensive. If the client disconnects (e.g., closes the browser tab), you must immediately stop the generation process to save money.

**Requirements:**
1. Create a `GET /stream` endpoint that accepts a query parameter `tokens` (integer, max 50).
2. Use an async generator to yield chunks of text formatted as SSE: `data: <content>\n\n`.
3. Yield `tokens` number of chunks, sleeping 0.1s between each chunk to simulate generation.
4. Wrap the generation loop in a `try...except asyncio.CancelledError`.
5. If cancelled, print `"CLIENT DISCONNECTED: Halting GPU generation."` to the console and re-raise.
6. Return the generator wrapped in a `StreamingResponse` with `media_type="text/event-stream"`.

<details>
<summary><b>Solution Walkthrough</b></summary>

```python
import asyncio
from fastapi import FastAPI, Query
from fastapi.responses import StreamingResponse

app = FastAPI(title="Streaming AI Inference")

async def generate_tokens(total_tokens: int):
    try:
        # Simulate generating one token at a time
        for i in range(total_tokens):
            chunk = f"token_{i} "

            # SSE Standard Formatting
            yield f"data: {chunk}\n\n"

            # Simulate GPU compute time
            await asyncio.sleep(0.1)

        # Signal completion to the client
        yield "data: [DONE]\n\n"

    except asyncio.CancelledError:
        # This block triggers the millisecond the client drops the TCP connection
        print("\n[CRITICAL] CLIENT DISCONNECTED: Halting GPU generation.")
        print("Cleaning up CUDA memory...")
        # We MUST re-raise so Uvicorn can finish tearing down the request
        raise

@app.get("/stream")
async def stream_inference(
    tokens: int = Query(default=10, le=50, description="Number of tokens to generate")
):
    return StreamingResponse(
        generate_tokens(tokens),
        media_type="text/event-stream"
    )
```

**Why this matters:**
This is exactly how OpenAI's `/v1/chat/completions` endpoint works when `stream=True`. The `text/event-stream` media type tells the HTTP client to keep the connection open and process data as it arrives. The `asyncio.CancelledError` catching is a pro-level technique. If you are paying $2/hour for a GPU, and a user clicks "Generate" on a 2000-token response but immediately clicks "Cancel" on the frontend, catching this error allows your backend to instantly kill the GPU task, saving massive amounts of compute budget.
</details>
