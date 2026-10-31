# Real-World Engineering Challenges (Principal Level)

This document contains 5 progressive engineering challenges that combine all 5 modules (Syntax, Data Structures, Pipelines, Architecture, Modern Python). These are designed to take you from a Junior Developer to a Principal Engineer capable of designing resilient, scalable, production-grade Python systems.

---

## Level 1: The Resilient Client (Robustness)

**Scenario**: You are writing an SDK for an unstable external AI service.
**Requirements**:
1. Create a `RequestConfig` dataclass (`endpoint: str`, `timeout: int`).
2. Write a `@retry` decorator that catches `ConnectionError` and retries up to 3 times with exponential backoff (sleep 1s, 2s, 4s).
3. Write a function `fetch_data(config: RequestConfig) -> dict` that randomly raises `ConnectionError` (using `random.random() < 0.7`) to simulate instability, otherwise returns `{"status": 200}`. Apply the decorator.

<details>
<summary>Solution & Architecture</summary>

### Architecture
```text
[Client] -> [@retry Wraps Function]
                 |--> Attempt 1 -> FAIL (ConnectionError) -> Sleep 1s
                 |--> Attempt 2 -> FAIL (ConnectionError) -> Sleep 2s
                 |--> Attempt 3 -> SUCCESS -> Returns Data
```

### Complete Code
```python
import time
import random
from dataclasses import dataclass

@dataclass
class RequestConfig:
    endpoint: str
    timeout: int = 30

def retry_exponential(max_attempts=3):
    def decorator(func):
        def wrapper(*args, **kwargs):
            delay = 1
            for attempt in range(1, max_attempts + 1):
                try:
                    return func(*args, **kwargs)
                except ConnectionError as e:
                    print(f"Attempt {attempt} failed: {e}")
                    if attempt == max_attempts:
                        raise
                    time.sleep(delay)
                    delay *= 2
        return wrapper
    return decorator

@retry_exponential(max_attempts=4)
def fetch_data(config: RequestConfig) -> dict:
    if random.random() < 0.7:
        raise ConnectionError("Network Reset")
    return {"status": 200, "data": f"Fetched from {config.endpoint}"}

# Test Suite
if __name__ == "__main__":
    cfg = RequestConfig("https://api.openai.com/v1")
    try:
        res = fetch_data(cfg)
        print("Success:", res)
    except ConnectionError:
        print("Final Failure.")
```
</details>

---

## Level 2: Out-of-Core Dataset Streamer (Memory Efficiency)

**Scenario**: You need to parse a 50GB CSV file of transaction logs, filter out invalid rows, and aggregate total sales by user. You cannot load the file into memory.
**Requirements**:
1. Write a generator `stream_csv(file_path: str)` that yields one line at a time.
2. Write a Generator Comprehension that filters out lines containing "ERROR".
3. Write a standard dictionary aggregator to sum sales by user.

<details>
<summary>Solution & Architecture</summary>

### Architecture
```text
[Disk: 50GB CSV] -> `stream_csv()` -> yields line
   -> [Generator Expr filters "ERROR"]
   -> [Aggregator updates Dict] (Total Memory: ~5MB for the Dict)
```

### Complete Code
```python
def stream_csv(dummy_data: list[str]):
    # In reality, this would be:
    # with open(file_path, 'r') as f:
    #     for line in f: yield line
    for line in dummy_data:
        yield line

def aggregate_sales(data_stream) -> dict[str, float]:
    user_sales = {}
    for line in data_stream:
        # Expected format: "user,amount"
        parts = line.strip().split(",")
        user = parts[0]
        amount = float(parts[1])
        # Dict update
        user_sales[user] = user_sales.get(user, 0.0) + amount
    return user_sales

if __name__ == "__main__":
    # Simulate a massive file
    raw_data = [
        "alice,50.5",
        "ERROR: network drop",
        "bob,20.0",
        "alice,10.0"
    ]

    # 1. Stream (Yields)
    stream = stream_csv(raw_data)

    # 2. Filter Pipeline (Zero Memory)
    valid_stream = (line for line in stream if "ERROR" not in line)

    # 3. Aggregate
    totals = aggregate_sales(valid_stream)
    print("Totals:", totals) # {'alice': 60.5, 'bob': 20.0}
```
</details>

---

## Level 3: Contextual Resource Manager (Safety)

**Scenario**: You are building a secure file vault. Whenever a file is accessed, the system must acquire a lock, log the access time, allow the user to read the file, and GUARANTEE the lock is released and logged when done.
**Requirements**:
1. Create a `VaultContext` using `__enter__` and `__exit__`.
2. Inside `__enter__`, print "Lock Acquired at {time}".
3. Inside `__exit__`, print "Lock Released at {time}". If an exception occurs, print "CRITICAL ERROR: {exc_val}".
4. Use it to safely access a resource that throws an exception.

<details>
<summary>Solution & Architecture</summary>

### Complete Code
```python
import time

class VaultContext:
    def __init__(self, resource_id: str):
        self.resource_id = resource_id

    def __enter__(self):
        self.start_time = time.time()
        print(f"🔒 Lock Acquired for {self.resource_id} at {self.start_time:.2f}")
        return self

    def __exit__(self, exc_type, exc_val, exc_tb):
        if exc_type:
            print(f"🚨 CRITICAL ERROR during access: {exc_val}")

        print(f"🔓 Lock Released for {self.resource_id} at {time.time():.2f}")
        # Returning False allows the exception to bubble up
        return False

if __name__ == "__main__":
    try:
        with VaultContext("secret_file.txt") as vault:
            print("Reading file...")
            raise ValueError("Unauthorized access attempt!")
    except ValueError:
        print("Handled the exception safely.")
```
</details>

---

## Level 4: Asyncio Concurrent Web Crawler (Speed)

**Scenario**: You need to scrape 100 API endpoints. Doing it synchronously takes 100 seconds (1s per endpoint).
**Requirements**:
1. Write `async def fetch_url(url: str) -> str:` that sleeps for 1 second.
2. Write an `async def crawl(urls: list[str]) -> dict:` that uses `asyncio.gather` to fetch all URLs concurrently.
3. Use a Dict Comprehension on the results to map `url -> data`.

<details>
<summary>Solution & Architecture</summary>

### Complete Code
```python
import asyncio
import time

async def fetch_url(url: str) -> str:
    # Simulate network latency
    await asyncio.sleep(1.0)
    return f"<html>Data from {url}</html>"

async def crawl(urls: list[str]) -> dict[str, str]:
    print(f"Crawling {len(urls)} URLs concurrently...")

    # Create tasks
    tasks = [fetch_url(url) for url in urls]

    # Run them all at the exact same time
    results = await asyncio.gather(*tasks)

    # Zip URLs and Results using a Dict Comprehension
    return {url: result for url, result in zip(urls, results)}

if __name__ == "__main__":
    start = time.time()

    urls_to_crawl = [f"http://site.com/page{i}" for i in range(1, 6)]
    # We use asyncio.run to execute the async event loop
    final_data = asyncio.run(crawl(urls_to_crawl))

    end = time.time()

    for k, v in final_data.items():
        print(f"{k} -> {v}")
    print(f"Total Time: {end - start:.2f}s") # Should be ~1 second!
```
</details>

---

## Level 5: Principal Boss Architecture (The Ultimate Test)

**Scenario**: You are building the ingestion pipeline for a new AI startup.
**Requirements**:
You must combine EVERYTHING from Modules 1-5.
1. `@dataclass Document(id: str, text: str, parsed: bool = False)`.
2. `async def download_doc(doc_id: str) -> Document` (Simulates async network fetch).
3. Decorate `download_doc` with a sync `@retry` decorator (Trick question! Standard retry decorators break on async functions. You must write an *async* retry decorator!).
4. Use `asyncio.gather` to download 10 documents.
5. Filter out documents using a List Comprehension if `text` is empty.
6. Group the valid documents into a Dictionary using Dict Comprehensions.

<details>
<summary>Solution & Architecture</summary>

### Architecture
```text
[Main Event Loop]
       |
       |-- (List Comp creates 10 tasks) --|
       |                                  |
       V                                  V
[Async Retry Decorator]           [Async Retry Decorator]
       |                                  |
[download_doc(id=1)]              [download_doc(id=2)] ... (x10 Concurrent)
       |                                  |
       |------- asyncio.gather() ---------|
       V
[List of Documents]
       |
[List Comp (Filter empty)]
       |
[Dict Comp (ID -> Document)]
       |
[Final Production State]
```

### Complete Code
```python
import asyncio
import time
import random
from dataclasses import dataclass
from typing import Callable, Any

# 1. Architecture (Module 4)
@dataclass
class Document:
    doc_id: str
    text: str
    parsed: bool = False

# 2. Modern Python (Module 5) + Decorators (Module 4)
def async_retry(max_attempts: int = 3):
    """A custom decorator that works on ASYNC functions."""
    def decorator(func: Callable) -> Callable:
        async def wrapper(*args, **kwargs) -> Any:
            for attempt in range(1, max_attempts + 1):
                try:
                    return await func(*args, **kwargs)
                except Exception as e:
                    print(f"Attempt {attempt} for {args} failed: {e}")
                    if attempt == max_attempts:
                        raise
                    await asyncio.sleep(0.5)
        return wrapper
    return decorator

# 3. Async Task
@async_retry(max_attempts=3)
async def download_doc(doc_id: str) -> Document:
    # 40% chance to fail and trigger the async retry
    if random.random() < 0.4:
        raise ConnectionError("Network glitch!")

    await asyncio.sleep(0.5)

    # 20% chance to return empty text
    text = "" if random.random() < 0.2 else f"Content for {doc_id}"
    return Document(doc_id=doc_id, text=text)

# 4. Pipelines (Module 3) & Structures (Module 2) & Syntax (Module 1)
async def main_pipeline():
    start = time.time()
    print("Initiating Principal Level Pipeline...")

    # Create Tasks
    tasks = [download_doc(f"DOC_{i:03d}") for i in range(10)]

    # Execute Concurrently
    results: list[Document] = await asyncio.gather(*tasks, return_exceptions=True)

    # Clean results (remove exceptions if any made it through retries)
    clean_results = [r for r in results if isinstance(r, Document)]

    # Filter out empty texts using List Comprehension
    valid_docs = [doc for doc in clean_results if doc.text]

    # Map to Dictionary using Dict Comprehension
    doc_map = {doc.doc_id: doc for doc in valid_docs}

    end = time.time()

    print("\n--- Pipeline Complete ---")
    for d_id, d in doc_map.items():
        print(f"{d_id}: {d}")

    print(f"\nStats: Started 10, Valid {len(doc_map)}, Time {end - start:.2f}s")

if __name__ == "__main__":
    asyncio.run(main_pipeline())
```
</details>
