# Module 03: Data Pipelines (List/Dict Comprehensions, Memory-Saving 10GB Dataset Generators with yield)

## Phase A: Core Concepts

### 1. Real-World Pain Point (The Why)
Imagine writing a script to process a 10GB log file. If you read the entire file into a List, your server will run out of memory (OOM) and crash. By using Generators with the `yield` keyword, you stream the data line-by-line, consuming almost zero memory. Additionally, developers often write 5-line `for` loops to filter arrays, polluting the codebase. List comprehensions reduce this to a clean, highly optimized single line of C-level execution.

### 2. Plain English Metaphor (The What)
**List Comprehension**: Instead of telling a factory worker to "take an apple, slice it, put it in a box, repeat," you order a "Box of Sliced Apples." It’s an all-in-one manufacturing order.
**Generators (`yield`)**: Instead of a chef cooking all 1,000 pizzas before serving anyone (putting them in a List, taking up all kitchen space), the chef cooks ONE pizza, hands it to you (`yield`), pauses, and waits for you to eat it before cooking the next one.

### 3. Complete Runnable Code

```python
import sys

def data_pipeline_showdown():
    # 1. List Comprehensions
    raw_prices = [10, 20, 30, 40, 50]
    # "New Price = price * 1.2 FOR EACH price IN raw_prices IF price is over 20"
    taxed_prices = [p * 1.2 for p in raw_prices if p > 20]

    # 2. Dictionary Comprehensions
    users = ["alice", "bob", "charlie"]
    user_lengths = {user: len(user) for user in users}

    # 3. Generators (Memory Savers)
    def generate_huge_dataset(limit):
        for i in range(limit):
            yield f"Data_Row_{i}" # PAUSES here and hands data back

    # Let's compare memory usage
    # A list of 1 million items
    list_mem = [f"Data_Row_{i}" for i in range(1000000)]

    # A generator ready to produce 1 million items
    gen_mem = generate_huge_dataset(1000000)

    return taxed_prices, user_lengths, sys.getsizeof(list_mem), sys.getsizeof(gen_mem)

if __name__ == "__main__":
    t_prices, u_lengths, mem_list, mem_gen = data_pipeline_showdown()
    print(f"Taxed Prices: {t_prices}")
    print(f"User Lengths: {u_lengths}")
    print(f"List Memory: {mem_list} bytes")
    print(f"Generator Memory: {mem_gen} bytes (Massive Savings!)")
```

### 4. Progressive Step-by-Step Breakdown

**Step 1: The List Comprehension Formula**
Formula: `[EXPRESSION for ITEM in ITERABLE if CONDITION]`
```python
nums = [1, 2, 3, 4]
evens = [x for x in nums if x % 2 == 0]
```

**Step 2: Dictionary Comprehensions**
Same logic, but use `{}` and separate key/value with a colon `:`.
```python
keys = ["a", "b"]
my_dict = {k: k.upper() for k in keys} # {'a': 'A', 'b': 'B'}
```

**Step 3: The `yield` Keyword**
When Python sees `yield` in a function, it doesn't run the function normally. It creates a Generator object. When you iterate over it (`for item in generator:`), the function runs until `yield`, spits out the value, and freezes its state.
```python
def count_to_two():
    yield 1  # Freezes here on first loop
    yield 2  # Freezes here on second loop
```

**Step 4: Chaining Generators (Pipelines)**
You can pass generators into other generators to create infinite data pipelines that take up zero memory.

### 5. ASCII Data Flow

```text
[LIST - Bad for Memory]
Memory RAM: [Row1, Row2, Row3, Row4, ... Row1,000,000] -> Server Crashes

[GENERATOR - Good for Memory]
Memory RAM: [Row1]
   | (processed & discarded)
Memory RAM: [Row2]
   | (processed & discarded)
Memory RAM: [Row3] -> Infinite processing, flat memory curve.
```

### 6. Noob Trap vs Pro Tip
**Noob Trap**: Using `return` inside a loop when you meant to return multiple items, or building a giant list in memory just to iterate over it once later.
**Pro Tip**: If you see `[x for x in data]`, but you only need to iterate over it once, change brackets to parentheses `(x for x in data)` to create a Generator Expression instead of a List Comprehension!

---

## Phase B: Engineering Challenges

### Level 1: Warm-Up
**Task**: Given a list of integers `[5, 10, -3, 8, -1]`, write a List Comprehension that returns only the positive numbers, multiplied by 10.
<details>
<summary>Hint</summary>
Use the <code>[expr for x in iterable if condition]</code> pattern.
</details>
<details>
<summary>Solution Walkthrough</summary>
```python
def process_numbers(nums: list[int]) -> list[int]:
    return [x * 10 for x in nums if x > 0]
```
</details>

### Level 2: Real-World
**Task**: Write a Generator function `read_large_file(file_path)` that simulates reading a file. It should take a list of strings (simulated file lines), and `yield` each line, but ONLY if the line contains the word "ERROR".
<details>
<summary>Hint</summary>
Use a <code>for</code> loop and check <code>if "ERROR" in line</code>, then <code>yield</code>.
</details>
<details>
<summary>Solution Walkthrough</summary>
```python
def filter_errors(lines: list[str]):
    for line in lines:
        if "ERROR" in line:
            yield line
```
</details>

### Level 3: Boss Level (Cumulative)
**Task**: Build a `Streaming_Log_Parser`.
1. Write a generator `stream_logs()` that yields raw logs: `["ID:1 latency:50", "ID:2 latency:120", "ID:3 latency:30"]`.
2. Write a Dict Comprehension that takes the generator output and creates a dictionary mapping `ID` -> `latency`, but ONLY for latencies > 100.
3. Be careful! Don't consume the generator into a list first. Pass the generator directly into the dictionary comprehension.
<details>
<summary>Hint</summary>
Generator: <code>yield log</code>. Comprehension: <code>{parse_id: parse_latency for log in stream_logs() if ...}</code>. Use string splitting (Module 2).
</details>
<details>
<summary>Solution Walkthrough</summary>
```python
def stream_logs():
    logs = ["ID:1 latency:50", "ID:2 latency:120", "ID:3 latency:30"]
    for log in logs:
        yield log

def process_slow_requests() -> dict:
    # We pass the generator directly into the Dict Comprehension!
    # log.split(" ")[0].split(":")[1] gets the ID
    # int(log.split(" ")[1].split(":")[1]) gets the latency

    return {
        log.split(" ")[0].split(":")[1]: int(log.split(" ")[1].split(":")[1])
        for log in stream_logs()
        if int(log.split(" ")[1].split(":")[1]) > 100
    }
```
This is a highly advanced memory-efficient pipeline!
</details>
