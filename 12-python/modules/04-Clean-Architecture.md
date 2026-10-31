# Module 04: Clean Architecture (@dataclass, Decorators, Context Managers)

## Phase A: Core Concepts

### 1. Real-World Pain Point (The Why)
Writing classes in Python historically required writing repetitive `__init__` boilerplate just to store data. Furthermore, adding timeout or retry logic to functions meant copying and pasting `try/except` blocks everywhere, violating DRY (Don't Repeat Yourself). Finally, failing to close database connections or files properly leads to resource leaks and server crashes.

### 2. Plain English Metaphor (The What)
**@dataclass**: Instead of custom-building a storage box (writing `__init__`, `__repr__`), you just tell Python "I want a box that holds a String and an Int", and it builds the perfect box for you automatically.
**Decorators (@retry)**: A wrapper around a gift. The gift is your function. The wrapper is extra behavior (like "try unwrapping this 3 times before giving up") applied *without* changing the gift inside.
**Context Managers (`with`)**: Renting a car. You pick it up (`__enter__`), drive it, and the rental company guarantees they will take it back (`__exit__`) even if you crash it, ensuring no cars are left abandoned on the road.

### 3. Complete Runnable Code

```python
import time
from dataclasses import dataclass
from typing import Any

# 1. @dataclass (Clean Data Objects)
@dataclass
class DatabaseConfig:
    host: str
    port: int
    password: str = "default_pass" # Default value

# 2. Decorators (Wrappers)
def retry(max_attempts=3):
    def decorator(func):
        def wrapper(*args, **kwargs):
            for attempt in range(1, max_attempts + 1):
                try:
                    return func(*args, **kwargs)
                except Exception as e:
                    print(f"Attempt {attempt} failed: {e}")
                    if attempt == max_attempts:
                        raise
                    time.sleep(0.1)
        return wrapper
    return decorator

@retry(max_attempts=2)
def unstable_api_call():
    raise ValueError("Network Timeout")

# 3. Context Managers (Resource Safety)
class DatabaseConnection:
    def __enter__(self):
        print("--> Connecting to Database")
        return self

    def __exit__(self, exc_type, exc_val, exc_tb):
        print("<-- Closing Database Connection")
        # Returning False means "don't suppress exceptions"
        return False

    def query(self, sql):
        print(f"Executing: {sql}")

if __name__ == "__main__":
    # Dataclass in action
    cfg = DatabaseConfig("localhost", 5432)
    print(cfg) # Automatically generated __repr__!

    # Context Manager in action
    with DatabaseConnection() as db:
        db.query("SELECT * FROM users")

    # Decorator in action
    try:
        unstable_api_call()
    except ValueError:
        print("API finally failed after retries.")
```

### 4. Progressive Step-by-Step Breakdown

**Step 1: The @dataclass Generator**
Adding `@dataclass` above a class automatically generates `__init__`, `__repr__`, and `__eq__` based on your Type Hints.
```python
@dataclass
class Point:
    x: float
    y: float
```

**Step 2: Anatomy of a Decorator**
A decorator is a function that takes a function, and returns a new (wrapped) function.
```python
def my_decorator(func):
    def wrapper():
        print("Before")
        func()
        print("After")
    return wrapper
```

**Step 3: Anatomy of a Context Manager**
Any class with `__enter__` and `__exit__` can be used with the `with` keyword. `__exit__` runs *even if an error occurs inside the block*, guaranteeing cleanup.

### 5. ASCII Data Flow

```text
Decorators:
[Call Function] -> [Runs Wrapper Logic BEFORE] -> [Runs Actual Function] -> [Runs Wrapper Logic AFTER] -> [Returns Result]

Context Managers:
[with Block Starts] -> [__enter__()] -> [Runs code in block] -> (Error happens?) -> [__exit__()] runs anyway! -> (Raises Error)
```

### 6. Noob Trap vs Pro Tip
**Noob Trap**: Opening files with `f = open('file.txt')` and forgetting `f.close()`. Or using mutable default arguments inside Dataclasses without `field(default_factory=list)`.
**Pro Tip**: Use `@dataclass(frozen=True)` to make the object immutable (like a Tuple), making it thread-safe and hashable. Always use `with open(...)` for files.

---

## Phase B: Engineering Challenges

### Level 1: Warm-Up
**Task**: Create a Dataclass `User` with fields `username` (str), `role` (str), and `active` (bool, default True).
<details>
<summary>Hint</summary>
Import <code>dataclass</code>. Define fields with type hints. Put the default value last.
</details>
<details>
<summary>Solution Walkthrough</summary>
```python
from dataclasses import dataclass

@dataclass
class User:
    username: str
    role: str
    active: bool = True
```
</details>

### Level 2: Real-World
**Task**: Write a `@timer` decorator that calculates how long a function takes to run and prints it.
<details>
<summary>Hint</summary>
Use <code>time.time()</code> before and after <code>func(*args, **kwargs)</code>.
</details>
<details>
<summary>Solution Walkthrough</summary>
```python
import time

def timer(func):
    def wrapper(*args, **kwargs):
        start = time.time()
        result = func(*args, **kwargs)
        end = time.time()
        print(f"{func.__name__} took {end - start:.4f}s")
        return result
    return wrapper

@timer
def slow_func():
    time.sleep(0.1)
```
</details>

### Level 3: Boss Level (Cumulative)
**Task**: Combine all three!
1. Create a `Transaction` dataclass (`amount: float`, `status: str = "pending"`).
2. Create a Context Manager `DB_Lock` that prints "Lock Acquired" on enter and "Lock Released" on exit.
3. Write a `@timer` decorated function `process_payment` that takes a `Transaction`, uses `with DB_Lock():`, sets the status to "success", and returns the `Transaction`.
<details>
<summary>Hint</summary>
Define the dataclass. Define the context manager class (<code>__enter__</code>, <code>__exit__</code>). Define the timer decorator. Apply decorator to function.
</details>
<details>
<summary>Solution Walkthrough</summary>
```python
from dataclasses import dataclass
import time

@dataclass
class Transaction:
    amount: float
    status: str = "pending"

class DB_Lock:
    def __enter__(self):
        print("Lock Acquired")
        return self
    def __exit__(self, exc_type, exc_val, exc_tb):
        print("Lock Released")
        return False

def timer(func):
    def wrapper(*args, **kwargs):
        start = time.time()
        res = func(*args, **kwargs)
        print(f"Time: {time.time() - start:.4f}s")
        return res
    return wrapper

@timer
def process_payment(tx: Transaction) -> Transaction:
    with DB_Lock():
        # Simulate processing
        time.sleep(0.1)
        tx.status = "success"
    return tx
```
</details>
