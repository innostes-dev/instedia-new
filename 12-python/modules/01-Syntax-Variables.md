# Module 01: Syntax & Variables (Why AI Speaks Python, F-Strings, Mutable Default Argument Leaks)

## Phase A: Core Concepts

### 1. Real-World Pain Point (The Why)
In modern data engineering and AI, strings are constructed constantly for prompts, logs, and queries. Using older string formatting methods (`%s` or `.format()`) leads to unreadable and brittle code. Furthermore, a classic hidden bug in Python occurs when developers use mutable objects (like lists or dictionaries) as default arguments in functions, leading to silent state leakage between function calls—a nightmare for long-running services like APIs or model inference servers.

### 2. Plain English Metaphor (The What)
**F-Strings**: Imagine a fill-in-the-blanks form where the blanks can do math and format themselves instantly.
**Mutable Default Arguments**: Imagine giving every new employee a "new employee handbook", but instead of a fresh copy, you give them the *exact same physical book*. If one employee writes their name in it, the next employee sees it. You want to give them a photocopy (a fresh object), not the original master copy.

### 3. Complete Runnable Code

```python
# F-Strings and AI Prompt Generation
def generate_prompt(user_name: str, items_purchased: int, confidence: float) -> str:
    # Notice the mathematical operation and formatting inside the f-string
    return f"User {user_name.upper()} bought {items_purchased} items. " \
           f"Prediction confidence: {confidence:.2%}"

# Mutable Default Argument Leak
def add_item_bad(item: str, box: list = []):
    box.append(item)
    return box

# The Pro Way
def add_item_good(item: str, box: list | None = None):
    if box is None:
        box = []
    box.append(item)
    return box

if __name__ == "__main__":
    print(generate_prompt("alice", 3, 0.98765))

    # Demonstrating the leak
    print(add_item_bad("apple"))  # ['apple']
    print(add_item_bad("banana")) # ['apple', 'banana'] Wait, where did apple come from?

    # Demonstrating the fix
    print(add_item_good("apple"))  # ['apple']
    print(add_item_good("banana")) # ['banana'] Correct!
```

### 4. Progressive Step-by-Step Breakdown

**Step 1: The F-String Revolution**
F-strings start with `f` or `F`. Inside curly braces `{}`, you can place variables, call methods like `.upper()`, or do math.
```python
name = "Bob"
f"Hello {name.upper()}"
```

**Step 2: Formatting in F-Strings**
You can append a colon `:` inside the braces to specify formatting. `.2%` converts a float to a percentage with 2 decimal places.
```python
confidence = 0.9876
f"Confidence: {confidence:.2%}" # 'Confidence: 98.76%'
```

**Step 3: The Mutable Default Trap**
Default arguments are evaluated *once* when the function is defined, not every time it's called.
```python
def add_item_bad(item, box=[]):
    # 'box' is created once in memory at module load time.
```

**Step 4: The Sentinel Pattern Fix**
Use `None` as a sentinel value, which is immutable. Inside the function, instantiate the fresh mutable object.
```python
def add_item_good(item, box=None):
    if box is None: box = []
```

### 5. ASCII Data Flow

```text
[Function Definition] -> Evaluates default args (box=[]) -> [Stored in Memory ID: 0x123]
       |
[Call 1: add_item_bad] -> Uses ID 0x123 -> Appends 'apple' -> [0x123 contains 'apple']
       |
[Call 2: add_item_bad] -> Uses ID 0x123 -> Appends 'banana' -> [0x123 contains 'apple', 'banana'] LEAK!

FIX:
[Function Definition] -> Evaluates default args (box=None) -> [Stored in Memory None]
       |
[Call 1: add_item_good] -> Sees None -> Creates new list [ID: 0x999] -> Appends 'apple'
       |
[Call 2: add_item_good] -> Sees None -> Creates new list [ID: 0x888] -> Appends 'banana'
```

### 6. Noob Trap vs Pro Tip
**Noob Trap**: Using `.format()` for long SQL queries or AI prompts, resulting in counting variables. Or using `{}` as default arguments for cached configs.
**Pro Tip**: For multiline f-strings, use implicit string concatenation with parentheses. Avoid `` line continuations. Always use `None` for mutable defaults.

---

## Phase B: Engineering Challenges

### Level 1: Warm-Up
**Task**: Write a function `format_llm_log(request_id, latency, tokens)` that returns a formatted string. Latency should show 3 decimal places in ms. Tokens should be zero-padded to 5 digits.
<details>
<summary>Hint</summary>
Use <code>:.3f</code> for float formatting and <code>:05d</code> for zero-padding integers.
</details>
<details>
<summary>Solution Walkthrough</summary>
```python
def format_llm_log(request_id: str, latency: float, tokens: int) -> str:
    return f"REQ-{request_id} | Latency: {latency:.3f}ms | Tokens: {tokens:05d}"
```
This cleanly aligns logs in the terminal.
</details>

### Level 2: Real-World
**Task**: Build a `SessionManager` function that tracks logged-in users. It accepts a `user` and an optional `active_sessions` dictionary. It must correctly add the user to the sessions without leaking state across different servers (simulated by multiple isolated calls).
<details>
<summary>Hint</summary>
Dictionaries are mutable. What should the default value be?
</details>
<details>
<summary>Solution Walkthrough</summary>
```python
def add_session(user: str, active_sessions: dict | None = None) -> dict:
    if active_sessions is None:
        active_sessions = {}
    active_sessions[user] = "active"
    return active_sessions
```
We use the Sentinel Pattern to ensure fresh state.
</details>

### Level 3: Boss Level (Cumulative)
**Task**: Write an `AI_Model_Registry` function that registers model endpoints.
- Takes `model_name` (str), `version` (float), and `metadata` (dict, default empty).
- Formats a log line: "Registered <NAME IN CAPS> v<VERSION TO 1 DECIMAL>. Metadata tags: <COUNT OF METADATA KEYS>".
- Returns the updated metadata dictionary containing a new key `_system_version` set to the formatted log string.
- Must be leak-proof!
<details>
<summary>Hint</summary>
Combine the f-string formatting, the <code>None</code> sentinel check, dictionary manipulation, and string methods.
</details>
<details>
<summary>Solution Walkthrough</summary>
```python
def ai_model_registry(model_name: str, version: float, metadata: dict | None = None) -> dict:
    # 1. Prevent mutable state leak
    if metadata is None:
        metadata = {}

    # 2. Format the log string securely
    log_string = (
        f"Registered {model_name.upper()} v{version:.1f}. "
        f"Metadata tags: {len(metadata)}"
    )

    # 3. Update dict
    metadata['_system_version'] = log_string

    return metadata
```
</details>
