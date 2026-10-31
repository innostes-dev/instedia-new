# Challenge 2: High-Volume CQRS Trading Order Engine

## Scenario
You are architecting a stock trading engine. When a user places an order (`PlaceOrderCommand`), the system must ensure they have sufficient funds, record the order, and emit a domain event (`OrderPlacedEvent`).
Because financial systems require absolute auditability, you are using **Event Sourcing** (via Marten/PostgreSQL). Instead of saving the current state to a table, you append events to a stream.

## The Challenge
Implement the Write-Side of a CQRS architecture using MediatR.
1. Create a `PlaceOrderCommand` and its MediatR `IRequestHandler`.
2. Implement basic validation in the handler (simulate balance check).
3. Simulate appending an event to an Event Sourcing store.
4. Publish a MediatR `INotification` so other parts of the system (like an Email Service) can react completely decoupled.

---

## Starter Template

```csharp
using System;
using System.Threading;
using System.Threading.Tasks;
using MediatR;

namespace Challenges.Trading
{
    // 1. Define the Command
    public class PlaceOrderCommand
    {
        public string UserId { get; set; }
        public string Ticker { get; set; }
        public int Quantity { get; set; }
        public decimal Price { get; set; }
    }

    // 2. Define the Event
    public class OrderPlacedEvent
    {
        // TODO
    }

    // 3. Implement the Handler
    public class PlaceOrderHandler
    {
        // TODO: Implement MediatR Handler
    }
}
```

---

<details>
<summary>View Complete Production Solution Walkthrough</summary>

## Production Solution Walkthrough

### 1. The Core Infrastructure (Commands & Events)
First, we structure our Command to return a `Guid` (the new Order ID). We also create our notification event.

```csharp
using System;
using System.Threading;
using System.Threading.Tasks;
using MediatR;

// The Intent (Command)
public class PlaceOrderCommand : IRequest<Guid>
{
    public string UserId { get; set; }
    public string Ticker { get; set; }
    public int Quantity { get; set; }
    public decimal Price { get; set; }
}

// The Fact (Domain Event for Event Sourcing / Notifications)
public class OrderPlacedEvent : INotification
{
    public Guid OrderId { get; }
    public string UserId { get; }
    public string Ticker { get; }
    public decimal TotalCost { get; }

    public OrderPlacedEvent(Guid orderId, string userId, string ticker, decimal totalCost)
    {
        OrderId = orderId;
        UserId = userId;
        Ticker = ticker;
        TotalCost = totalCost;
    }
}
```

### 2. The MediatR Handler (The Write Side)
The handler executes business logic, simulates saving to the Event Store, and then publishes the event.

```csharp
public class PlaceOrderHandler : IRequestHandler<PlaceOrderCommand, Guid>
{
    private readonly IMediator _mediator;
    // In production, inject Marten IDocumentSession or similar Event Store here

    public PlaceOrderHandler(IMediator mediator)
    {
        _mediator = mediator;
    }

    public async Task<Guid> Handle(PlaceOrderCommand request, CancellationToken cancellationToken)
    {
        // 1. Business Validation
        decimal totalCost = request.Quantity * request.Price;
        if (totalCost > 100000) // Simulated balance limit check
        {
            throw new InvalidOperationException("Insufficient Funds.");
        }

        // 2. Generate ID and create Fact
        var orderId = Guid.NewGuid();
        var orderEvent = new OrderPlacedEvent(orderId, request.UserId, request.Ticker, totalCost);

        // 3. Event Sourcing Save (Simulated)
        // e.g., _martenSession.Events.Append(orderId, orderEvent);
        // await _martenSession.SaveChangesAsync(cancellationToken);
        Console.WriteLine($"[EventStore] Appended OrderPlacedEvent for {orderId}");

        // 4. Broadcast to other decoupled systems (Read-Models, Email, etc.)
        await _mediator.Publish(orderEvent, cancellationToken);

        return orderId;
    }
}
```

### 3. Decoupled Sub-Systems (Notification Handlers)
Because we used `_mediator.Publish`, any class implementing `INotificationHandler<OrderPlacedEvent>` will automatically be triggered.

```csharp
// Update the Read-Side Database (CQRS Projection)
public class UpdateTradingReadModelHandler : INotificationHandler<OrderPlacedEvent>
{
    public Task Handle(OrderPlacedEvent notification, CancellationToken cancellationToken)
    {
        Console.WriteLine($"[Projection] Updating fast-read SQL table for User {notification.UserId}. New Ticker: {notification.Ticker}");
        return Task.CompletedTask;
    }
}

// Send Email Confirmation
public class EmailConfirmationHandler : INotificationHandler<OrderPlacedEvent>
{
    public Task Handle(OrderPlacedEvent notification, CancellationToken cancellationToken)
    {
        Console.WriteLine($"[EmailService] Sending receipt for {notification.TotalCost:C} to User {notification.UserId}");
        return Task.CompletedTask;
    }
}
```

### Architecture Review
By strictly separating the Command (Place Order) from the Event (Order Placed), we create an extremely extensible system. If the marketing team wants an alert every time an order > $50,000 is placed, we don't touch `PlaceOrderHandler`. We just create a new `MarketingAlertHandler : INotificationHandler<OrderPlacedEvent>`. This adheres perfectly to the Open/Closed Principle.
</details>
