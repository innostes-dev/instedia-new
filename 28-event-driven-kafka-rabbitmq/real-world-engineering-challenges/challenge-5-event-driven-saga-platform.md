# Challenge 5: Event-Driven Saga Pattern (Choreography)

## The Challenge

You are building the backend for a FinTech stock trading application.
When a user buys a stock, a distributed transaction must occur across three completely separate microservices:
1. **Order Service**: Creates the `PENDING` order.
2. **Wallet Service**: Deducts the $ funds from the user's cash wallet.
3. **Portfolio Service**: Adds the stock shares to the user's portfolio.

Because these are microservices, you cannot use a single SQL `BEGIN...COMMIT`. If the Wallet deduction succeeds, but the Portfolio service fails (e.g., market closed), you must roll back the Wallet deduction!

Your task: Implement a **Choreographed Saga Pattern** using Kafka.

## Starter Template

```javascript
// Assume 3 independent Node.js processes running Kafkajs consumers/producers

// --- ORDER SERVICE ---
async function createOrder(userId, stock, amount, cost) {
  // 1. Save order as PENDING in DB
  // 2. Publish `OrderCreated` event to Kafka
}

// --- WALLET SERVICE ---
// Listens to: `OrderCreated`
// Actions:
// 1. Check if user has enough money.
// 2. If yes: Deduct money, publish `FundsReserved` event.
// 3. If no: Publish `FundsFailed` event.
// Listens to: `PortfolioFailed` (Compensating Transaction!)
// Actions: Refund the money back to the wallet.

// --- PORTFOLIO SERVICE ---
// Listens to: `FundsReserved`
// Actions:
// 1. Attempt to add stock to portfolio.
// 2. If success: Publish `PortfolioUpdated` event.
// 3. If fail: Publish `PortfolioFailed` event.
```

## Solution & Walkthrough

<details>
<summary><strong>View Full Production Solution</strong></summary>

### 1. Order Service (The Initiator)
```javascript
const { Kafka } = require('kafkajs');
const kafka = new Kafka({ clientId: 'order-service', brokers: ['localhost:9092'] });

async function createOrder(orderId, userId, ticker, totalCost) {
  const producer = kafka.producer();
  await producer.connect();

  console.log(`[Order DB] Insert Order ${orderId} (STATUS: PENDING)`);

  await producer.send({
    topic: 'saga-events',
    messages: [{
      key: orderId, // Crucial to keep all saga events for an order on the same partition
      value: JSON.stringify({
        type: 'OrderCreated', orderId, userId, ticker, totalCost
      })
    }]
  });
  await producer.disconnect();
}

// Order Service also listens for final resolution
async function startOrderListener() {
  const consumer = kafka.consumer({ groupId: 'order-service-group' });
  await consumer.connect();
  await consumer.subscribe({ topic: 'saga-events' });

  await consumer.run({
    eachMessage: async ({ message }) => {
      const event = JSON.parse(message.value.toString());
      if (event.type === 'PortfolioUpdated') {
        console.log(`[Order DB] Update Order ${event.orderId} (STATUS: COMPLETED) ✅`);
      } else if (event.type === 'FundsFailed' || event.type === 'PortfolioFailed') {
        console.log(`[Order DB] Update Order ${event.orderId} (STATUS: CANCELLED) ❌ Reason: ${event.reason}`);
      }
    }
  });
}
```

### 2. Wallet Service (The Financier)
```javascript
async function startWalletService() {
  const consumer = kafka.consumer({ groupId: 'wallet-service-group' });
  const producer = kafka.producer();
  await consumer.connect();
  await producer.connect();
  await consumer.subscribe({ topic: 'saga-events' });

  // Simulated DB
  const userWallets = { 'user_1': 1000 }; // Starts with $1000

  await consumer.run({
    eachMessage: async ({ message }) => {
      const event = JSON.parse(message.value.toString());

      // Handle Forward Action
      if (event.type === 'OrderCreated') {
        console.log(`[Wallet] Received OrderCreated for ${event.orderId}`);
        const balance = userWallets[event.userId] || 0;

        if (balance >= event.totalCost) {
          userWallets[event.userId] -= event.totalCost;
          console.log(`[Wallet DB] Deducted $${event.totalCost}. New balance: $${userWallets[event.userId]}`);

          await producer.send({
            topic: 'saga-events',
            messages: [{ key: event.orderId, value: JSON.stringify({
              type: 'FundsReserved', ...event
            })}]
          });
        } else {
          console.log(`[Wallet] Insufficient funds for ${event.userId}!`);
          await producer.send({
            topic: 'saga-events',
            messages: [{ key: event.orderId, value: JSON.stringify({
              type: 'FundsFailed', orderId: event.orderId, reason: 'NSF'
            })}]
          });
        }
      }

      // Handle Compensating Action (Rollback)
      if (event.type === 'PortfolioFailed') {
        console.log(`[Wallet] Received PortfolioFailed! Rolling back funds for ${event.orderId}`);
        userWallets[event.userId] += event.totalCost;
        console.log(`[Wallet DB] Refunded $${event.totalCost}. New balance: $${userWallets[event.userId]}`);
      }
    }
  });
}
```

### 3. Portfolio Service (The Executor)
```javascript
async function startPortfolioService() {
  const consumer = kafka.consumer({ groupId: 'portfolio-service-group' });
  const producer = kafka.producer();
  await consumer.connect();
  await producer.connect();
  await consumer.subscribe({ topic: 'saga-events' });

  await consumer.run({
    eachMessage: async ({ message }) => {
      const event = JSON.parse(message.value.toString());

      if (event.type === 'FundsReserved') {
        console.log(`[Portfolio] Received FundsReserved for ${event.orderId}. Attempting market buy...`);

        // Simulate a failure 50% of the time (e.g. market closed, liquidity issue)
        const marketBuySuccess = Math.random() > 0.5;

        if (marketBuySuccess) {
          console.log(`[Portfolio DB] Added ${event.ticker} to ${event.userId}'s portfolio.`);
          await producer.send({
            topic: 'saga-events',
            messages: [{ key: event.orderId, value: JSON.stringify({
              type: 'PortfolioUpdated', orderId: event.orderId
            })}]
          });
        } else {
          console.log(`[Portfolio] Market Buy Failed! Triggering compensation...`);
          await producer.send({
            topic: 'saga-events',
            messages: [{ key: event.orderId, value: JSON.stringify({
              type: 'PortfolioFailed', orderId: event.orderId, reason: 'Market Error', totalCost: event.totalCost, userId: event.userId
            })}]
          });
        }
      }
    }
  });
}
```

### Architecture Diagram
```text
(Happy Path)
[Order] --(OrderCreated)--> [Wallet] --(FundsReserved)--> [Portfolio] --(PortfolioUpdated)--> [Order: COMPLETED]

(Failure Path with Compensation)
[Order] --(OrderCreated)--> [Wallet] --(FundsReserved)--> [Portfolio] (FAILS!)
                                                              |
                                                      (PortfolioFailed)
                                                              |
                                                              v
 [Order: CANCELLED] <------------------------------------- [Wallet] (Refunds user cash)
```

### Walkthrough & Concepts
In a microservices architecture, you must design for failure. The **Saga Pattern** manages distributed transactions by breaking them into local ACID transactions, chained together by events.
If a downstream step fails (Portfolio), it publishes a failure event (`PortfolioFailed`). Upstream services (Wallet) must listen for this event and execute a **Compensating Transaction** (refunding the money).
This specific implementation is called *Choreography*, because there is no central "Manager" service telling people what to do. Each service independently observes the event stream and reacts (like dancers in a choreography). The alternative is *Orchestration*, where a central state machine issues explicit commands.
</details>
