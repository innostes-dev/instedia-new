# Real-World Engineering Challenge 2: Full-Stack Compose Cluster

## The Challenge Scenario
You are leading the infrastructure design for a new Python-based microservices platform. The stack consists of a FastAPI backend, a PostgreSQL database for persistent relational data, and a Redis instance used as an asynchronous task queue (like Celery) and cache.

Your task is to write a single `docker-compose.yml` file that orchestrates this entire stack for a robust development environment, meeting the following strict requirements:

### Strict Requirements
1. **Three Services:** You must define `db` (PostgreSQL 15), `cache` (Redis 7), and `api` (FastAPI).
2. **Persistent Storage:** The PostgreSQL database data must survive container restarts using a Named Volume.
3. **Environment Injection:** The `api` service must receive the database and redis connection strings via environment variables.
4. **Healthchecks (The Catch):** The `api` service *must not start* until PostgreSQL is actually ready to accept connections. You cannot just use `depends_on: db`. You must implement a Docker Healthcheck on the `db` service, and configure the `api` service to wait for that `service_healthy` condition.
5. **Development Bind Mount:** The `api` service must use a bind mount to map the local `./backend` folder to `/app` inside the container so developers get live code reloading.

---

## Starter Template
Create a `docker-compose.yml` file. Use this skeleton:

```yaml
version: '3.8'

services:
  db:
    image: postgres:15-alpine
    # TODO: Set POSTGRES_USER to "myuser" and POSTGRES_PASSWORD to "mypassword"
    # TODO: Map port 5432
    # TODO: Attach a named volume "pg_data" to /var/lib/postgresql/data
    # TODO: Implement a healthcheck using pg_isready

  cache:
    image: redis:7-alpine
    # TODO: Map port 6379

  api:
    build: ./backend
    # TODO: Map port 8000
    # TODO: Add a bind mount mapping ./backend to /app
    # TODO: Pass DATABASE_URL and REDIS_URL environment variables
    # TODO: Make this service depend on the "db" service, but wait for it to be HEALTHY.
    # TODO: Make this service depend on the "cache" service to just be started.

# TODO: Declare the pg_data volume here
```

---

<details>
<summary><b>Click for Full Production Solution & Walkthrough</b></summary>

### The Complete Production docker-compose.yml

```yaml
version: '3.8'

services:
  db:
    image: postgres:15-alpine
    environment:
      POSTGRES_USER: myuser
      POSTGRES_PASSWORD: mypassword
      POSTGRES_DB: mydatabase
    ports:
      - "5432:5432"
    volumes:
      - pg_data:/var/lib/postgresql/data
    healthcheck:
      # Use the built-in postgres ping utility to verify it can accept connections
      test: ["CMD-SHELL", "pg_isready -U myuser -d mydatabase"]
      interval: 5s
      timeout: 5s
      retries: 5
      start_period: 10s

  cache:
    image: redis:7-alpine
    ports:
      - "6379:6379"
    # Optional: A simple healthcheck for Redis
    healthcheck:
      test: ["CMD", "redis-cli", "ping"]
      interval: 5s
      timeout: 3s
      retries: 5

  api:
    build: ./backend
    ports:
      - "8000:8000"
    volumes:
      # Bind mount for live reloading
      - ./backend:/app
    environment:
      # Leverage Docker Compose internal DNS (db and cache)
      DATABASE_URL: postgresql://myuser:mypassword@db:5432/mydatabase
      REDIS_URL: redis://cache:6379/0
    depends_on:
      db:
        # Wait until the db healthcheck passes before starting the API
        condition: service_healthy
      cache:
        # We also configured a healthcheck for redis, so let's wait for it too
        condition: service_healthy

volumes:
  pg_data:
```

### Walkthrough & Architecture Notes

1. **The Healthcheck Problem:** A standard `depends_on: - db` only tells Docker Compose to wait until the PostgreSQL *container* process is running. However, PostgreSQL takes several seconds to initialize its internal data structures before it actually opens port 5432. If your FastAPI app starts instantly and tries to connect, it will crash.
2. **The `pg_isready` Solution:** We added a `healthcheck` block to the `db` service. Every 5 seconds, Docker runs `pg_isready` *inside* the DB container. Until this command returns a success code (0), the container's status is "starting". Once it succeeds, the status becomes "healthy".
3. **Condition: service_healthy:** In the `api` service, we changed the `depends_on` syntax from an array to an object mapping. We specified `condition: service_healthy` for the `db`. Now, Compose will absolutely not start the API until the database is 100% ready to receive queries.
4. **Internal DNS:** Look at the connection strings: `postgresql://...@db:5432/...` and `redis://cache:6379`. The backend code doesn't need to know IP addresses. Docker Compose resolves the hostnames `db` and `cache` to the internal IPs of those respective containers.
</details>
