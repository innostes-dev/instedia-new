# Challenge 4: Async Database Connection Pool & Cleanup

## The Challenge
Connections to a database are expensive to establish and limited in number. You must create a mock asynchronous database pool manager using FastAPI's dependency injection to ensure connections are acquired from a pool at the start of a request, used safely, and guaranteed to be returned to the pool at the end, even if the application crashes.

**Requirements:**
1. Create a dummy `MockDBPool` class with an `acquire()` method (returns a string `"db_connection"`) and a `release(conn)` method.
2. Instantiate a global `pool = MockDBPool()`.
3. Create a dependency `get_db_connection()`.
   - It should acquire a connection.
   - It should `yield` the connection.
   - In a `finally` block, it must release the connection back to the pool.
4. Create a `POST /users` endpoint that uses this connection to "save" a user, but explicitly raises an `HTTPException(500)` halfway through to simulate a crash.
5. Prove that the `finally` block still executes and releases the connection.

<details>
<summary><b>Solution Walkthrough</b></summary>

```python
from fastapi import FastAPI, Depends, HTTPException

app = FastAPI(title="Async DB Pool Manager")

# 1. Mock DB Infrastructure
class MockDBPool:
    def __init__(self):
        self.active_connections = 0

    def acquire(self):
        self.active_connections += 1
        print(f"[POOL] Connection Acquired. Active: {self.active_connections}")
        return "db_connection_obj"

    def release(self, conn):
        self.active_connections -= 1
        print(f"[POOL] Connection Released. Active: {self.active_connections}")

# 2. Global Pool Instance
pool = MockDBPool()

# 3. The Generator Dependency
def get_db_connection():
    # Setup Phase (Before the endpoint runs)
    conn = pool.acquire()
    try:
        # Hand control over to the route handler
        yield conn
    finally:
        # Teardown Phase (After the endpoint runs, or crashes!)
        pool.release(conn)

# 4. The Crash-Prone Endpoint
@app.post("/users")
async def create_user(db=Depends(get_db_connection)):
    print(f"[ROUTE] Processing request using {db}...")

    # Simulate a critical failure (e.g., UniqueConstraint violation)
    print("[ROUTE] Oh no! Database error occurred!")
    raise HTTPException(status_code=500, detail="Database write failed")

    return {"status": "created"} # This never runs
```

**Why this matters:**
This is the exact pattern used for integrating async SQLAlchemy or asyncpg with FastAPI. If you simply did `conn = pool.acquire()` inside the endpoint and the endpoint crashed before `pool.release(conn)`, that connection is leaked. If your pool size is 20, and this endpoint crashes 20 times, your entire application will freeze because the pool is empty. By using the `yield` / `finally` dependency pattern, FastAPI's execution engine guarantees the `finally` block runs, keeping your infrastructure bulletproof against leaks.
</details>
