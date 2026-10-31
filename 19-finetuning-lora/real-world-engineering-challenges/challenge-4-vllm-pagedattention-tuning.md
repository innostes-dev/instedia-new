# Challenge 4: vLLM High-Concurrency Engine

## Architecture Diagram
```text
[ Thousands of Users ]
          | (Concurrent Requests)
          v
[ NGINX Load Balancer ]
          |
[ vLLM OpenAI-Compatible API Server ]
          |
+-----------------------------------+
| Continuous Batching Engine        |
| PagedAttention KV Cache           |
| Multi-GPU Tensor Parallelism (TP) |
+-----------------------------------+
```

## Challenge Overview
Your application is going viral. You need to deploy Llama-3 8B using vLLM to handle thousands of users. You have a node with 2x 24GB GPUs.
Your task is to write a deployment script (bash) that starts the vLLM server using:
1. The OpenAI API entrypoint.
2. Tensor Parallelism across both GPUs.
3. 90% GPU memory utilization.
4. A max model length of 4096 (to prevent memory fragmentation).

Next, write a Python script using `asyncio` and `aiohttp` to simulate 50 concurrent users hitting the vLLM server at the same time to prove its throughput.

## Starter Template
```bash
#!/bin/bash
# start_vllm.sh
# TODO: Write the python -m vllm.entrypoints.openai.api_server command with arguments
```

```python
# load_test.py
import asyncio
import aiohttp
import time

async def fetch(session, url, payload):
    # TODO: Make async POST request
    pass

async def main():
    url = "http://localhost:8000/v1/chat/completions"
    payload = {
        "model": "meta-llama/Meta-Llama-3-8B-Instruct",
        "messages": [{"role": "user", "content": "Write a 5 sentence story."}]
    }
    # TODO: Create 50 tasks and gather them

if __name__ == "__main__":
    asyncio.run(main())
```

## Solution Walkthrough
<details>
<summary>View the Complete Production Solution</summary>

### 1. vLLM Deployment Script
```bash
#!/bin/bash
# start_vllm.sh

MODEL_NAME="meta-llama/Meta-Llama-3-8B-Instruct"

echo "Starting vLLM High-Throughput Server..."

# Breakdown of arguments:
# --model: The HF repo or local path
# --tensor-parallel-size 2: Splits the model weights across 2 GPUs
# --gpu-memory-utilization 0.90: Dedicate 90% of VRAM to weights + PagedAttention KV Cache
# --max-model-len 4096: Cap the context window to save memory and increase batch sizes

python -m vllm.entrypoints.openai.api_server \
    --model $MODEL_NAME \
    --tensor-parallel-size 2 \
    --gpu-memory-utilization 0.90 \
    --max-model-len 4096 \
    --port 8000
```

### 2. Async Load Testing Script
```python
# load_test.py
import asyncio
import aiohttp
import time

async def fetch_llm(session, url, payload, request_id):
    """Sends a single request to the vLLM server."""
    headers = {"Authorization": "Bearer EMPTY"} # vLLM doesn't need a real key by default

    start_time = time.time()
    try:
        async with session.post(url, headers=headers, json=payload) as response:
            result = await response.json()
            latency = time.time() - start_time
            # Get token counts for throughput calculation
            tokens = result['usage']['completion_tokens']
            print(f"Req {request_id} finished in {latency:.2f}s ({tokens} tokens)")
            return tokens, latency
    except Exception as e:
        print(f"Req {request_id} failed: {e}")
        return 0, 0

async def main():
    url = "http://localhost:8000/v1/chat/completions"
    payload = {
        "model": "meta-llama/Meta-Llama-3-8B-Instruct",
        "messages": [{"role": "user", "content": "Write a 3 paragraph story about a brave knight."}],
        "max_tokens": 150
    }

    concurrency = 50
    print(f"Simulating {concurrency} concurrent users hitting vLLM...")

    global_start = time.time()

    async with aiohttp.ClientSession() as session:
        # Create a list of async tasks
        tasks = [fetch_llm(session, url, payload, i) for i in range(concurrency)]
        # Execute them all concurrently
        results = await asyncio.gather(*tasks)

    global_time = time.time() - global_start
    total_tokens = sum(r[0] for r in results)

    print("\n--- vLLM Benchmark Results ---")
    print(f"Total Time: {global_time:.2f} seconds")
    print(f"Total Tokens Generated: {total_tokens}")
    print(f"Throughput: {total_tokens / global_time:.2f} tokens/second")
    print("If you run this against standard HuggingFace, it will crash or take 10x longer.")

if __name__ == "__main__":
    asyncio.run(main())
```
</details>
