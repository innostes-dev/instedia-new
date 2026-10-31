# Real-World Engineering Challenge: Multi-Tenant Enterprise SaaS Backend with Dynamic PostgreSQL Schema Isolation per Tenant

## 1. Context & Architecture
In B2B SaaS, data isolation is critical. If Coca-Cola and Pepsi both use your software, Pepsi cannot, under any circumstances, query Coca-Cola's data. Adding `tenant_id` to every table (Row-Level Security) is one approach, but many enterprise clients demand physical isolation at the database level.

In this challenge, you will implement **Schema-Level Multi-Tenancy** in PostgreSQL using NestJS.
- **Public Schema:** Holds a `Tenants` table mapping custom subdomains (e.g., `pepsi.myapp.com`) to their respective DB schema names (e.g., `tenant_pepsi`).
- **Tenant Schemas:** Isolated schemas containing business tables (e.g., `Users`, `Invoices`).

### Architecture Diagram
```text
[HTTP GET pepsi.myapp.com/api/users]
       │
       ▼
┌───────────────────────┐
│ TenantResolution      │ -> Middleware extracts "pepsi" from host header.
│ Middleware            │ -> Queries Public Schema to verify tenant exists.
└──────────┬────────────┘ -> Attaches `tenant_id` to Request object.
           │
           ▼
┌───────────────────────┐
│ ConnectionService     │ -> Request-Scoped Provider.
│ (Custom Provider)     │ -> Receives Request via DI.
└──────────┬────────────┘ -> Configures TypeORM/Prisma connection to use `SET search_path TO tenant_pepsi`.
           │
           ▼
┌───────────────────────┐
│ BusinessController    │ -> Injects the dynamic ConnectionService.
└───────────────────────┘ -> Executes query. Data is guaranteed isolated.
```

---

## 2. Starter Template

```typescript
// 1. Install dependencies (Context):
// npm i @nestjs/common @nestjs/core @nestjs/typeorm typeorm pg

import { Injectable, NestMiddleware, Scope, Inject, Controller, Get, Module } from '@nestjs/common';
import { REQUEST } from '@nestjs/core';
import { Request, Response, NextFunction } from 'express';
import { DataSource } from 'typeorm';

// --- MIDDLEWARE ---
@Injectable()
export class TenantMiddleware implements NestMiddleware {
  async use(req: Request, res: Response, next: NextFunction) {
    // TODO: Extract subdomain from req.headers.host
    // TODO: Look up tenant in a mocked Map or DB
    // TODO: Attach tenantId to req object, or throw 401 if not found
    next();
  }
}

// --- REQUEST-SCOPED SERVICE ---
@Injectable({ scope: Scope.REQUEST })
export class TenantConnectionService {
  constructor(
    @Inject(REQUEST) private request: Request,
    // Inject global DataSource here
  ) {}

  async getTenantConnection(): Promise<DataSource> {
    // TODO: Get tenantId from this.request
    // TODO: Dynamically set the PostgreSQL search_path for the current connection
    // Return the ready-to-use DataSource
    return {} as DataSource;
  }
}

// --- CONTROLLER ---
@Controller('users')
export class TenantUserController {
  constructor(private readonly connectionService: TenantConnectionService) {}

  @Get()
  async getUsers() {
    // TODO: Get the dynamic connection
    // TODO: Query the 'User' entity
    return [];
  }
}
```

---

## 3. Boss Level Challenge
Implement the architecture described above.
1. The `TenantMiddleware` must extract the tenant identifier from the `x-tenant-id` header (for simplicity in testing, instead of full subdomain parsing).
2. The `TenantConnectionService` must be `Scope.REQUEST`. It must inject the base TypeORM `DataSource`.
3. It must execute `await dataSource.query(\`SET search_path TO \${tenantSchema}\`)` before returning the connection for use.
4. Provide a full production-ready NestJS Module setup demonstrating this.

<details>
<summary>Click here for Hints</summary>

- Middleware: `req['tenantId'] = req.headers['x-tenant-id']`.
- Service: Since it is request-scoped, every incoming request creates a new instance of `TenantConnectionService`. This is safe for modifying the connection state *if* you manage connection pooling carefully (or use Prisma Extensions for a safer approach).
- In TypeORM, modifying `search_path` directly on the global DataSource can be dangerous under concurrency because connections are pooled. A safer approach is to use the TypeORM `manager` or `queryRunner` specifically for that request.
</details>

<details>
<summary>Click here for Full Production Solution Walkthrough</summary>

### Full Solution Code

```typescript
import {
  Injectable, NestMiddleware, Scope, Inject, Controller, Get,
  Module, MiddlewareConsumer, NestModule, HttpException, HttpStatus
} from '@nestjs/common';
import { REQUEST } from '@nestjs/core';
import { TypeOrmModule, InjectDataSource } from '@nestjs/typeorm';
import { DataSource, EntityManager } from 'typeorm';
import { Request, Response, NextFunction } from 'express';

// ==========================================
// 1. Tenant Resolution Middleware
// ==========================================
@Injectable()
export class TenantMiddleware implements NestMiddleware {
  // Mock DB of valid tenants
  private validTenants = {
    'tenant-a': 'schema_a',
    'tenant-b': 'schema_b',
  };

  use(req: Request, res: Response, next: NextFunction) {
    const tenantId = req.headers['x-tenant-id'] as string;

    if (!tenantId || !this.validTenants[tenantId]) {
      throw new HttpException('Tenant not found or header missing', HttpStatus.UNAUTHORIZED);
    }

    // Attach the mapped schema name to the request
    req['tenantSchema'] = this.validTenants[tenantId];
    next();
  }
}

// ==========================================
// 2. Request-Scoped Tenant Connection Provider
// ==========================================
// Pro-Tip: Instead of returning the global DataSource (which is pooled and shared),
// we return a specific EntityManager or run our logic via a dedicated QueryRunner
// to ensure thread safety under concurrent requests.
@Injectable({ scope: Scope.REQUEST })
export class TenantConnectionService {
  constructor(
    @Inject(REQUEST) private request: Request,
    @InjectDataSource() private dataSource: DataSource,
  ) {}

  /**
   * Executes a callback function within an isolated transaction/query runner
   * where the search_path is safely set to the tenant's schema.
   */
  async executeIsolated<T>(runInTenantContext: (manager: EntityManager) => Promise<T>): Promise<T> {
    const tenantSchema = this.request['tenantSchema'];
    const queryRunner = this.dataSource.createQueryRunner();

    await queryRunner.connect();

    try {
      // Switch schema for THIS specific connection in the pool
      await queryRunner.query(`SET search_path TO ${tenantSchema}`);

      // Execute the business logic passing the isolated manager
      return await runInTenantContext(queryRunner.manager);
    } finally {
      // Revert search_path so the connection pool isn't corrupted when returned
      await queryRunner.query(`SET search_path TO public`);
      await queryRunner.release();
    }
  }
}

// ==========================================
// 3. Business Controller
// ==========================================
@Controller('invoices')
export class InvoiceController {
  constructor(private readonly tenantDb: TenantConnectionService) {}

  @Get()
  async getInvoices() {
    // The controller doesn't know or care WHICH tenant this is.
    // It just asks the TenantDb service to execute its logic.
    return this.tenantDb.executeIsolated(async (manager) => {
      // Assuming 'Invoice' entity exists and is mapped
      // return manager.find('Invoice');

      // Mocking DB result for demonstration:
      const result = await manager.query(`SELECT current_schema()`);
      return {
        msg: 'Data fetched securely',
        activeSchema: result[0].current_schema
      };
    });
  }
}

// ==========================================
// 4. Wiring it up in the Module
// ==========================================
@Module({
  imports: [
    TypeOrmModule.forRoot({
      type: 'postgres',
      host: 'localhost',
      port: 5432,
      username: 'postgres',
      password: 'password',
      database: 'saas_db',
      synchronize: false, // Do not sync dynamically in prod
    })
  ],
  controllers: [InvoiceController],
  providers: [TenantConnectionService],
})
export class AppModule implements NestModule {
  configure(consumer: MiddlewareConsumer) {
    // Apply Tenant resolution to all routes
    consumer.apply(TenantMiddleware).forRoutes('*');
  }
}
```

### Walkthrough & Architecture Notes
1. **Thread Safety:** The most common mistake (the "Noob Trap") in Node.js multi-tenancy is running `SET search_path` globally on a shared connection pool. If Request A (Pepsi) and Request B (Coke) hit the server at the exact same millisecond, Request B might overwrite the global state, causing Request A to query Coke's data.
2. **The Fix (QueryRunner):** We solve this by injecting the `DataSource`, explicitly checking out a single connection (`createQueryRunner`), setting the schema *only on that connection*, executing the query, and critically, resetting the schema before releasing the connection back to the pool.
3. **Decoupling:** The `InvoiceController` is beautifully clean. It has no idea multi-tenancy even exists. It just uses the injected `tenantDb.executeIsolated()` method.
</details>
