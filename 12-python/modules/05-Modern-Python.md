# Module 05: Modern Python (Type Hints & Mypy, Asyncio Concurrent Batch Model Inference)

## Phase A: Core Concepts

### 1. Real-World Pain Point (The Why)
Historically, Python's dynamic typing led to `AttributeError: 'NoneType' has no attribute 'x'` exploding in production because developers didn't know what data type a function returned. Furthermore, waiting for 100 API calls sequentially blocking the CPU (synchronous execution) wastes massive amounts of time. Asyncio allows a single CPU core to juggle thousands of network requests concurrently, drastically speeding up I/O-bound tasks like web scraping or LLM inference.

### 2. Plain English Metaphor (The What)
**Type Hints**: Adding labels to storage bins. The code still works if you put a hammer in the "screws" bin at runtime, but a static checker (Mypy) will flag it before you ever run the code.
**Asyncio (`async/await`)**: A chef in a kitchen. Synchronous: Chef puts bread in the toaster, stands there staring at it for 2 minutes, then takes it out. Asynchronous: Chef puts bread in toaster (`await`), immediately starts chopping onions, and when the toaster pops, goes back to the toast.

### 3. Complete Runnable Code

```python
import asyncio
import time
from typing import List, Dict, Any

# 1. Type Hints
def process_data(data: List[int]) -> Dict[str, Any]:
    return {"sum": sum(data), "count": len(data)}

# 2. Asyncio Concurrent Execution
async def fetch_llm_inference(prompt_id: int) -> str:
    print(f"[{prompt_id}] Sending request...")
    # Simulate network delay (like staring at the toaster)
    await asyncio.sleep(1.0)
    print(f"[{prompt_id}] Received response!")
    return f"Result_{prompt_id}"

async def main_async():
    start = time.time()

    # We create 3 tasks. They run CONCURRENTLY.
    tasks = [
        fetch_llm_inference(1),
        fetch_llm_inference(2),
        fetch_llm_inference(3)
    ]

    # asyncio.gather runs them all at once and waits for all to finish
    results = await asyncio.gather(*tasks)

    end = time.time()
    print(f"All results: {results}")
    print(f"Total time: {end - start:.2f}s") # Takes ~1 second, NOT 3 seconds!

if __name__ == "__main__":
    # How you run async code from a synchronous entry point
    asyncio.run(main_async())
```

### 4. Progressive Step-by-Step Breakdown

**Step 1: Type Hints for Safety**
Use `->` for return types and `:` for variable types. In modern Python, you can use `list[int]` instead of importing `List`.
```python
def greet(name: str) -> str:
    return f"Hello {name}"
```

**Step 2: The `async def` Declaration**
Adding `async` before `def` creates a Coroutine function. Calling it does *not* run it; it creates a Coroutine object.
```python
async def my_task(): pass
task_obj = my_task() # Nothing runs yet
```

**Step 3: The `await` Keyword**
`await` tells Python: "I am waiting for this network/disk operation. Pause me, go run other tasks, and come back when this is done."
```python
await asyncio.sleep(1)
```

**Step 4: Concurrency with `gather`**
To run multiple tasks at the exact same time, unpack them into `asyncio.gather()`.

### 5. ASCII Data Flow

```text
[Sync]
Task 1: [WAIT 1s...] -> Done
Task 2:                 [WAIT 1s...] -> Done
Task 3:                                 [WAIT 1s...] -> Done
Total: 3 seconds

[Async]
Task 1: [WAIT 1s...] -> Done
Task 2: [WAIT 1s...] -> Done
Task 3: [WAIT 1s...] -> Done
Total: 1 second
```

### 6. Noob Trap vs Pro Tip
**Noob Trap**: Putting a blocking synchronous call (like `time.sleep()` or `requests.get()`) inside an `async def` function. This blocks the entire thread and ruins concurrency.
**Pro Tip**: Always use `await asyncio.sleep()` or async libraries like `aiohttp`/`httpx`. Use `mypy` in your CI/CD pipeline to catch type errors before deployment.

---

## Phase B: Engineering Challenges

### Level 1: Warm-Up
**Task**: Add Type Hints to a function `get_config` that takes an integer `version` and an optional string `env` (default "dev"), and returns a Dictionary where keys are strings and values are strings.
<details>
<summary>Hint</summary>
Use <code>env: str = "dev"</code> and <code>-> dict[str, str]:</code>.
</details>
<details>
<summary>Solution Walkthrough</summary>
```python
def get_config(version: int, env: str = "dev") -> dict[str, str]:
    return {"version": str(version), "environment": env}
```
</details>

### Level 2: Real-World
**Task**: Write an async function `download_file(file_name: str)` that awaits `asyncio.sleep(0.5)` and returns the file name. Then write a main function that uses `asyncio.gather` to download "file_A", "file_B", and "file_C" concurrently.
<details>
<summary>Hint</summary>
Use <code>async def</code> for both. Inside main, create a list of coroutines, then <code>await asyncio.gather(*coroutines)</code>.
</details>
<details>
<summary>Solution Walkthrough</summary>
```python
import asyncio

async def download_file(file_name: str) -> str:
    await asyncio.sleep(0.5)
    return f"{file_name}_downloaded"

async def run_downloads():
    files = ["file_A", "file_B", "file_C"]
    tasks = [download_file(f) for f in files]
    results = await asyncio.gather(*tasks)
    print(results)
```
</details>

### Level 3: Boss Level (Cumulative)
**Task**: Combine Modules!
1. Create a `@dataclass` `BatchResult` holding `ids: list[int]` and `status: str`.
2. Write an `async def fetch_batch(batch_id: int) -> BatchResult:` that awaits `asyncio.sleep(0.2)`.
3. In `main`, use a List Comprehension to generate 5 `fetch_batch` coroutines.
4. `await asyncio.gather` them.
5. Use a Dict Comprehension to map `batch_id` -> `BatchResult` from the final list.
<details>
<summary>Hint</summary>
Ensure type hints are perfect. <code>gather</code> returns a list in the same order you passed the coroutines.
</details>
<details>
<summary>Solution Walkthrough</summary>
```python
import asyncio
from dataclasses import dataclass, field

@dataclass
class BatchResult:
    batch_id: int
    ids: list[int] = field(default_factory=list) # Module 4: Mutable defaults in dataclasses
    status: str = "success"

async def fetch_batch(batch_id: int) -> BatchResult:
    await asyncio.sleep(0.2)
    return BatchResult(batch_id=batch_id, ids=[1, 2, 3])

async def main():
    # List comprehension for tasks
    tasks = [fetch_batch(i) for i in range(5)]

    # Gather
    results: list[BatchResult] = await asyncio.gather(*tasks)

    # Dict Comprehension
    final_map = {res.batch_id: res for res in results}
    return final_map

# asyncio.run(main())
```
</details>
