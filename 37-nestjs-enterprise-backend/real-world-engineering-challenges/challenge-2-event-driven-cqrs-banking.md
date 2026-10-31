# Real-World Engineering Challenge: High-Throughput Event-Driven Banking Ledger (CQRS & Kafka)

## 1. Context & Architecture
In traditional CRUD apps, reading a user's balance and updating it happens in the same service. Under extreme load (e.g., thousands of transactions per second on Black Friday), database locks slow everything down.

**CQRS (Command Query Responsibility Segregation)** splits the app into two parts:
1. **Commands:** (Writes) Only handle intention (e.g., "Deposit Funds"). Commands do not return data; they emit events.
2. **Queries:** (Reads) Only fetch data. They read from highly optimized, denormalized read replicas.

In this challenge, you will use NestJS's built-in `@nestjs/cqrs` module combined with a simulated **Kafka Event Stream**.

### Architecture Diagram
```text
[HTTP POST /deposit { amount: 100 }]
       │
       ▼
┌───────────────────────┐
│ DepositController     │ -> Sends a `DepositCommand` to the CommandBus.
└──────────┬────────────┘
           │
           ▼
┌───────────────────────┐
│ DepositHandler        │ -> Validates business logic (e.g., positive amount).
│ (Command Handler)     │ -> Applies a `FundsDepositedEvent` to the Domain Model.
└──────────┬────────────┘ -> Commits the event.
           │
           ▼
┌───────────────────────┐
│ EventBus / Kafka      │ -> Broadcasts the `FundsDepositedEvent`.
└──────────┬────────────┘
           │
           ▼
┌───────────────────────┐
│ LedgerEventHandler    │ -> Listens to `FundsDepositedEvent`.
│ (Event Handler)       │ -> Updates the optimized "Read Database".
└───────────────────────┘
```

---

## 2. Starter Template

```typescript
// npm i @nestjs/common @nestjs/core @nestjs/cqrs

import { Controller, Post, Body, Injectable } from '@nestjs/common';
import { CommandBus, CommandHandler, ICommandHandler, EventBus, EventsHandler, IEventHandler } from '@nestjs/cqrs';

// 1. DTOs
export class DepositDto { amount: number; accountId: string; }

// 2. Command
export class DepositCommand {
  constructor(public readonly accountId: string, public readonly amount: number) {}
}

// 3. Event
export class FundsDepositedEvent {
  constructor(public readonly accountId: string, public readonly amount: number) {}
}

// 4. Command Handler
@CommandHandler(DepositCommand)
export class DepositHandler implements ICommandHandler<DepositCommand> {
  // TODO: Inject EventBus

  async execute(command: DepositCommand) {
    // TODO: Validate amount > 0
    // TODO: Publish FundsDepositedEvent to EventBus
  }
}

// 5. Event Handler (Updates Read Database)
@EventsHandler(FundsDepositedEvent)
export class LedgerUpdaterHandler implements IEventHandler<FundsDepositedEvent> {
  handle(event: FundsDepositedEvent) {
    // TODO: Log the update to the read database
  }
}

// 6. Controller
@Controller('accounts')
export class AccountController {
  // TODO: Inject CommandBus

  @Post('deposit')
  async deposit(@Body() dto: DepositDto) {
    // TODO: Execute DepositCommand
  }
}
```

---

## 3. Boss Level Challenge
Implement the CQRS pattern.
1. The `AccountController` must accept a POST request and dispatch a `DepositCommand` using the `CommandBus`.
2. The `DepositHandler` must catch the command, simulate business validation, and publish a `FundsDepositedEvent` using the `EventBus`.
3. The `LedgerUpdaterHandler` must catch the event and simulate saving it to a read-replica database.
4. Wire all these providers into a `BankingModule` using `CqrsModule`.

<details>
<summary>Click here for Hints</summary>

- Remember to import `CqrsModule` in your `@Module()`.
- The `CommandBus.execute()` returns a promise.
- The `EventBus.publish()` does the actual event broadcasting.
</details>

<details>
<summary>Click here for Full Production Solution Walkthrough</summary>

### Full Solution Code

```typescript
import { Module, Controller, Post, Body, HttpException, HttpStatus } from '@nestjs/common';
import {
  CqrsModule, CommandBus, CommandHandler, ICommandHandler,
  EventBus, EventsHandler, IEventHandler, QueryBus, QueryHandler, IQueryHandler
} from '@nestjs/cqrs';

// ==========================================
// 1. Definitions (Commands, Events, Queries)
// ==========================================
export class DepositCommand {
  constructor(public readonly accountId: string, public readonly amount: number) {}
}
export class FundsDepositedEvent {
  constructor(public readonly accountId: string, public readonly amount: number) {}
}
export class GetBalanceQuery {
  constructor(public readonly accountId: string) {}
}

// Mock Read Database
const readDatabase = new Map<string, number>();

// ==========================================
// 2. Handlers
// ==========================================

// Write Model (Handles Intent)
@CommandHandler(DepositCommand)
export class DepositHandler implements ICommandHandler<DepositCommand> {
  constructor(private eventBus: EventBus) {}

  async execute(command: DepositCommand) {
    const { accountId, amount } = command;

    // Business Logic / Validation goes here (NOT in the controller)
    if (amount <= 0) {
      throw new HttpException('Deposit amount must be positive', HttpStatus.BAD_REQUEST);
    }

    // In a real app, you would save this event to an Event Store (Kafka/DB) here.
    console.log(`[Write-Side] Validated deposit of ${amount} for ${accountId}`);

    // Publish event to notify the rest of the system (including the Read model)
    this.eventBus.publish(new FundsDepositedEvent(accountId, amount));

    return { status: 'Accepted' };
  }
}

// Event Subscriber (Updates Read Model)
@EventsHandler(FundsDepositedEvent)
export class LedgerUpdaterHandler implements IEventHandler<FundsDepositedEvent> {
  handle(event: FundsDepositedEvent) {
    console.log(`[Event Bus] Detected FundsDepositedEvent for ${event.accountId}`);

    // Update the optimized Read Database
    const currentBalance = readDatabase.get(event.accountId) || 0;
    readDatabase.set(event.accountId, currentBalance + event.amount);

    console.log(`[Read-Side] Updated balance for ${event.accountId} to ${readDatabase.get(event.accountId)}`);
  }
}

// Read Model (Queries Data)
@QueryHandler(GetBalanceQuery)
export class GetBalanceHandler implements IQueryHandler<GetBalanceQuery> {
  async execute(query: GetBalanceQuery): Promise<number> {
    // Queries only read from the highly optimized read store
    return readDatabase.get(query.accountId) || 0;
  }
}

// ==========================================
// 3. Controller (API Gateway)
// ==========================================
@Controller('banking')
export class BankingController {
  constructor(
    private readonly commandBus: CommandBus,
    private readonly queryBus: QueryBus
  ) {}

  @Post('deposit')
  async deposit(@Body() body: { accountId: string; amount: number }) {
    // The controller is incredibly thin. It just dispatches intents.
    return this.commandBus.execute(new DepositCommand(body.accountId, body.amount));
  }

  @Post('balance')
  async getBalance(@Body() body: { accountId: string }) {
    const balance = await this.queryBus.execute(new GetBalanceQuery(body.accountId));
    return { accountId: body.accountId, balance };
  }
}

// ==========================================
// 4. Module Wiring
// ==========================================
@Module({
  imports: [CqrsModule],
  controllers: [BankingController],
  providers: [
    DepositHandler,
    LedgerUpdaterHandler,
    GetBalanceHandler
  ]
})
export class BankingModule {}
```

### Walkthrough & Architecture Notes
1. **Separation of Concerns:** The Controller does absolutely no logic. It delegates writes to the `CommandBus` and reads to the `QueryBus`.
2. **Event Sourcing Primer:** In an enterprise CQRS app, the `DepositHandler` would save the `DepositCommand` payload into an "Append-Only Event Store" database (like Kafka or EventStoreDB) *before* publishing the `FundsDepositedEvent`. This creates a perfect, immutable audit log of everything that ever happened in the system.
3. **Eventual Consistency:** The `BankingController` returns `{ status: 'Accepted' }` immediately after the command executes. By the time the user's phone app refreshes the balance, the `LedgerUpdaterHandler` has quietly updated the read database in the background.
</details>
