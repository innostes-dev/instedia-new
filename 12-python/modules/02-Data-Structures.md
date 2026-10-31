# Module 02: Core Data Structures (Lists, Dicts, Sets, Tuples)

## Phase A: Core Concepts

### 1. Real-World Pain Point (The Why)
Imagine searching for a single missing transaction in a list of 10 million bank records. If you use a List, you have to scan them one by one (O(n) time complexity), locking up the CPU for seconds. If you use a Set or a Dictionary, Python uses a Hash Table to jump directly to the memory address of the item in microseconds (O(1) time complexity). Choosing the wrong data structure is the #1 cause of slow Python scripts.

### 2. Plain English Metaphor (The What)
**List**: A bookshelf where books are lined up left to right. To find a book, you start at the left and check each one.
**Dictionary/Hash Table**: A library's digital search terminal. You type the book name, and it instantly gives you the exact aisle and shelf.
**Set**: A bouncer at an exclusive club. If you're on the list, you can't be added again. It guarantees everyone inside is unique.
**Tuple**: A sealed glass box displaying a museum artifact. You can look at it, but you cannot change, add, or remove anything inside.

### 3. Complete Runnable Code

```python
import time

def structure_showdown():
    # 1. Lists (Ordered, Mutable, Slow Lookups)
    ids_list = [101, 102, 103, 104, 105, 101] # Notice 101 is duplicated

    # 2. Sets (Unordered, Mutable, Fast Lookups, Deduplicated)
    ids_set = set(ids_list) # Instantly removes duplicates -> {101, 102, 103, 104, 105}

    # 3. Dictionaries (Key-Value, O(1) Lookups)
    user_cache = {
        101: "alice@company.com",
        102: "bob@company.com"
    }

    # 4. Tuples (Ordered, Immutable, Hashable)
    # Tuples can be used as dictionary keys because they never change!
    coordinates = (40.7128, -74.0060)
    city_map = {coordinates: "New York"}

    return ids_list, ids_set, user_cache, city_map

if __name__ == "__main__":
    lst, st, dct, tup_dict = structure_showdown()
    print(f"List length: {len(lst)} | Set length: {len(st)}")
    print(f"User 101 Email: {dct.get(101)}")
    print(f"City at {(40.7128, -74.0060)}: {tup_dict[(40.7128, -74.0060)]}")
```

### 4. Progressive Step-by-Step Breakdown

**Step 1: Lists for Ordering**
Use lists when order matters or when you need to sort.
```python
queue = ["job_1", "job_2"]
queue.append("job_3") # O(1) to add to the end
```

**Step 2: Dictionaries for O(1) Key Lookups**
Whenever you have an ID mapped to an Object, use a Dict.
```python
cache = {"uuid_x": data_blob}
result = cache["uuid_x"] # Instant
```

**Step 3: Sets for O(1) Membership & Deduplication**
If you just need to check `if item in collection`, Sets are vastly superior to Lists.
```python
seen_urls = {"http://google.com"}
if "http://yahoo.com" not in seen_urls: # Instant check
    seen_urls.add("http://yahoo.com")
```

**Step 4: Tuples for Immutability**
Tuples are structurally identical to lists, but immutable. This makes them "hashable," meaning they can be used as Dictionary keys. Lists cannot.
```python
my_tuple = (1, 2)
# my_tuple[0] = 5  # ERROR!
```

### 5. ASCII Data Flow

```text
[Data Source] -> ["apple", "banana", "apple"] (List)
      |
      V
[set(List)] -> {"apple", "banana"} (Set - Deduplicated)
      |
      V
[Lookup Check] -> is "apple" in Set?
                  -> Hashes "apple" -> Hash Code 998
                  -> Jumps directly to Memory 998 -> FOUND! (O(1) Time)
```

### 6. Noob Trap vs Pro Tip
**Noob Trap**: Using `if item in list:` on a massive list. This forces Python to check every element sequentially.
**Pro Tip**: Convert the list to a Set first: `my_set = set(my_list)`, then check `if item in my_set:`. Also, use `dict.get(key, default)` instead of `try/except KeyError`.

---

## Phase B: Engineering Challenges

### Level 1: Warm-Up
**Task**: You have a list of email addresses, some of which are duplicates. Return a sorted list of unique emails.
<details>
<summary>Hint</summary>
Convert the list to a <code>set</code> to remove duplicates, then cast it back to a <code>list</code> and <code>sort()</code> it.
</details>
<details>
<summary>Solution Walkthrough</summary>
```python
def get_unique_sorted_emails(emails: list[str]) -> list[str]:
    # set() deduplicates. sorted() handles sorting and returns a new list.
    return sorted(set(emails))
```
</details>

### Level 2: Real-World
**Task**: Build a basic In-Memory Cache `get_user_data(user_id, cache)`. If the `user_id` is in the `cache` (dict), return it instantly. If not, simulate an API call by returning "FETCHED_FROM_DB" and add it to the cache so the *next* time it's instant.
<details>
<summary>Hint</summary>
Check if <code>user_id in cache</code>. If false, update the cache.
</details>
<details>
<summary>Solution Walkthrough</summary>
```python
def get_user_data(user_id: int, cache: dict) -> str:
    if user_id in cache:
        return cache[user_id]

    # Simulate DB fetch
    data = f"FETCHED_FROM_DB_FOR_{user_id}"
    cache[user_id] = data
    return data
```
</details>

### Level 3: Boss Level (Cumulative)
**Task**: Write an `Analyze_Logs(logs)` function.
- Input: A list of log strings like `"IP:192.168.1.1 - User:alice - Status:200"`.
- Requirement 1: Extract all unique IP addresses (Sets).
- Requirement 2: Count how many times each user appears (Dicts).
- Requirement 3: Return a Tuple containing `(unique_ips_set, user_counts_dict)`.
- Use f-strings inside if you want to print debug info (Module 1).
<details>
<summary>Hint</summary>
Iterate over the list. Use string <code>.split()</code> to parse. Add IPs to a set. Increment the dictionary key for users.
</details>
<details>
<summary>Solution Walkthrough</summary>
```python
def analyze_logs(logs: list[str]) -> tuple[set, dict]:
    unique_ips = set()
    user_counts = {}

    for log in logs:
        # Example log: "IP:192.168.1.1 - User:alice - Status:200"
        parts = log.split(" - ")
        ip = parts[0].split(":")[1]
        user = parts[1].split(":")[1]

        unique_ips.add(ip)

        # Dict get with default value
        user_counts[user] = user_counts.get(user, 0) + 1

    return (unique_ips, user_counts)
```
</details>
