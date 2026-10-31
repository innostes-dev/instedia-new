# Real-World Engineering Challenge: Resilient Rate-Limiter Guard using Redis & Lua Scripts

## 1. Context & Architecture
An enterprise API might receive millions of requests. If one malicious (or poorly coded) client sends 10,000 requests per second, your database will crash, affecting all other customers.

NestJS provides a built-in `@nestjs/throttler` package, but standard implementations often store rate-limit counters in memory. If you scale your NestJS app to 10 instances behind a load balancer, in-memory rate limiting fails (a user gets 100 requests *per instance*, defeating the limit).

To solve this, you need a **Distributed Rate Limiter** using Redis. To ensure atomicity (preventing race conditions when checking and updating the request count simultaneously), you will use a **Redis Lua Script** via a custom NestJS Guard.

### Architecture Diagram
```text
[Incoming Request from IP 192.168.1.5]
       │
       ▼
┌───────────────────────┐
│ RateLimitGuard        │ -> Intercepts request, extracts IP address.
└──────────┬────────────┘ -> Calls RedisService with `ip` and `limit`.
           │
           ▼
┌───────────────────────┐
│ RedisService          │ -> Executes atomic Lua Script on Redis server.
│                       │ -> Script logic:
│                       │    1. Increment count for key `rate:192.168.1.5`.
│                       │    2. If count == 1, set TTL (expiry) to 60s.
│                       │    3. Return current count.
└──────────┬────────────┘
           │
           ▼
┌───────────────────────┐
│ RateLimitGuard        │ -> If count > limit, throw 429 Too Many Requests.
└──────────┬────────────┘ -> Else, allow request to proceed (`return true`).
           │
           ▼
[Controller Execution]
```

---

## 2. Starter Template

```typescript
// npm i @nestjs/common @nestjs/core ioredis

import { Injectable, CanActivate, ExecutionContext, Controller, Get, UseGuards, HttpException, HttpStatus } from '@nestjs/common';
import Redis from 'ioredis';

// --- REDIS SERVICE ---
@Injectable()
export class RedisService {
  private redis: Redis;

  constructor() {
    this.redis = new Redis(); // Connects to localhost:6379 by default
  }

  /**
   * Executes a Lua script to atomically increment and check rate limits.
   * Returns true if allowed, false if limit exceeded.
   */
  async checkRateLimit(key: string, limit: number, windowSeconds: number): Promise<boolean> {
    // TODO: Write a Lua script that:
    // 1. Increments the key
    // 2. Sets the expiration if it's a new key
    // 3. Returns the current count

    const luaScript = `
      -- Your Lua code here
    `;

    // Execute script via this.redis.eval(...)
    return true;
  }
}

// --- RATE LIMIT GUARD ---
@Injectable()
export class DistributedRateLimitGuard implements CanActivate {
  constructor(private redisService: RedisService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    // TODO: Extract IP from context
    // TODO: Call checkRateLimit
    // TODO: Throw HttpException 429 if false, return true if true
    return true;
  }
}

// --- CONTROLLER ---
@Controller('api')
export class ApiController {
  // Apply Guard here

  @Get('data')
  getData() {
    return { success: true };
  }
}
```

---

## 3. Boss Level Challenge
Implement the Guard and the Lua script.
1. The Lua script must atomically `INCR` the key. If the count is 1 (meaning it's the first request in this window), it must use `EXPIRE` to set the TTL to `windowSeconds`. It must return the new count.
2. The `checkRateLimit` method must evaluate the Lua script using `redis.eval`. If the returned count is greater than `limit`, return `false`.
3. The `DistributedRateLimitGuard` must extract the client IP, construct a unique Redis key (e.g., `rate_limit:<ip>`), and enforce a limit of 5 requests per 10 seconds. Throw a `429 Too Many Requests` if exceeded.

<details>
<summary>Click here for Hints</summary>

- Lua Script basic structure:
  ```lua
  local current = redis.call('INCR', KEYS[1])
  if current == 1 then
    redis.call('EXPIRE', KEYS[1], ARGV[1])
  end
  return current
  ```
- Use `this.redis.eval(luaScript, 1, key, windowSeconds)` to execute it.
- In the Guard, use `request.ip` or `request.connection.remoteAddress` to get the IP.
</details>

<details>
<summary>Click here for Full Production Solution Walkthrough</summary>

### Full Solution Code

```typescript
import {
  Injectable, CanActivate, ExecutionContext, Controller, Get,
  UseGuards, HttpException, HttpStatus, Module
} from '@nestjs/common';
import Redis from 'ioredis';

// ==========================================
// 1. Redis Service with Atomic Lua Script
// ==========================================
@Injectable()
export class RedisService {
  private redis: Redis;

  constructor() {
    // In production, inject config instead of hardcoding
    this.redis = new Redis({ host: 'localhost', port: 6379 });
  }

  /**
   * Atomic Fixed-Window Rate Limiting using Lua.
   * Atomicity prevents race conditions when 100 concurrent requests
   * hit the server simultaneously for the same IP.
   */
  async isAllowed(ip: string, limit: number, windowSeconds: number): Promise<boolean> {
    const key = `rate_limit:${ip}`;

    const luaScript = `
      local current = redis.call('INCR', KEYS[1])
      if current == 1 then
        -- If this is the first request, set the expiration window
        redis.call('EXPIRE', KEYS[1], ARGV[1])
      end
      return current
    `;

    // EVAL script, num_keys, key1, arg1
    const currentCount = await this.redis.eval(luaScript, 1, key, windowSeconds) as number;

    return currentCount <= limit;
  }
}

// ==========================================
// 2. Distributed Rate Limit Guard
// ==========================================
@Injectable()
export class DistributedRateLimitGuard implements CanActivate {
  constructor(private readonly redisService: RedisService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest();

    // Fallback chain for extracting real IP behind load balancers
    const ip = request.headers['x-forwarded-for'] || request.socket.remoteAddress || 'unknown';

    const LIMIT = 5;
    const WINDOW_SECONDS = 10;

    const allowed = await this.redisService.isAllowed(ip, LIMIT, WINDOW_SECONDS);

    if (!allowed) {
      throw new HttpException('Too Many Requests', HttpStatus.TOO_MANY_REQUESTS);
    }

    return true; // Allow request
  }
}

// ==========================================
// 3. Controller & Module
// ==========================================
@Controller('heavy-computation')
@UseGuards(DistributedRateLimitGuard) // Protect all routes in this controller
export class ComputeController {

  @Get()
  process() {
    return { data: 'Resource intensive result generated successfully.' };
  }
}

@Module({
  providers: [RedisService, DistributedRateLimitGuard],
  controllers: [ComputeController],
})
export class RateLimitModule {}
```

### Walkthrough & Architecture Notes
1. **Why Lua?** Without Lua, you would have to make two trips to Redis: one to `GET` the count, and another to `SET` it. If two requests from the same user hit your app at the exact same millisecond, they both `GET` a count of `0`, and both `SET` it to `1`, bypassing the limit. Lua executes entirely inside Redis as a single, atomic operation, making race conditions impossible.
2. **Global Scalability:** Because the state (`rate_limit:<ip> = 5`) is stored in a centralized Redis cluster, it doesn't matter if the user's request hits NestJS Instance A or NestJS Instance B. The rate limit is globally enforced across your entire microservice mesh.
3. **`x-forwarded-for`:** The "Noob Trap" is relying solely on `request.socket.remoteAddress`. If your NestJS app sits behind an Nginx proxy or AWS ALB, the `remoteAddress` will be the IP of the proxy itself! You must check `x-forwarded-for` to get the actual client's IP, otherwise you will rate-limit your own proxy.
</details>
