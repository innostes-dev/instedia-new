# Challenge 4: EF Core Read-Write Separation Architecture

## Scenario
You are scaling a global SaaS application. You have a Primary SQL Server (Write/Master) in US-East, and several Read Replica databases in Europe and Asia.
Currently, all API requests (GET, POST, PUT) connect to the Primary DB, causing high latency for European users trying to load their dashboard, and heavy load on the Primary server.

## The Challenge
Implement EF Core Read-Write separation.
1. Configure `AppDbContext` to accept multiple connection strings.
2. Create an Interceptor or a Database Strategy to dynamically route `AsNoTracking()` queries to the Read Replica.
3. Keep all tracked changes (Insert/Update) routed to the Primary Master Database.

---

## Starter Template

```csharp
using Microsoft.EntityFrameworkCore;
using System;
using System.Threading.Tasks;

namespace Challenges.EFCore
{
    public class Customer
    {
        public int Id { get; set; }
        public string Name { get; set; }
    }

    public class AppDbContext : DbContext
    {
        public DbSet<Customer> Customers { get; set; }

        public AppDbContext(DbContextOptions<AppDbContext> options) : base(options) { }
    }

    public class CustomerService
    {
        // TODO: Ensure this goes to the Replica
        public async Task<Customer> GetCustomerAsync(int id)
        {
            throw new NotImplementedException();
        }

        // TODO: Ensure this goes to the Master
        public async Task CreateCustomerAsync(Customer c)
        {
            throw new NotImplementedException();
        }
    }
}
```

---

<details>
<summary>View Complete Production Solution Walkthrough</summary>

## Production Solution Walkthrough

To achieve true enterprise read-write separation without changing the `CustomerService` code wildly, we inject a Connection Resolver and use EF Core `DbCommandInterceptor` to swap connection strings on the fly based on the query type.

### 1. The Connection Resolver
First, we define a service that knows our connection strings.

```csharp
public class DbConnectionResolver
{
    public string MasterConnectionString { get; } = "Server=MasterDB;...";
    public string ReplicaConnectionString { get; } = "Server=ReplicaDB;...";
}
```

### 2. The Command Interceptor
EF Core allows intercepting the raw SQL command right before execution. We intercept `ReaderExecuting` (SELECT queries) and dynamically change the connection string on the `DbConnection` object to the Replica.

*Note: In advanced scenarios, you check if the `DbContext` currently has pending changes in the ChangeTracker. If it does, you force even SELECTs to go to the Master to prevent reading stale data due to replication lag.*

```csharp
using Microsoft.EntityFrameworkCore.Diagnostics;
using System.Data.Common;
using System.Threading;
using System.Threading.Tasks;

public class ReplicaRoutingInterceptor : DbCommandInterceptor
{
    private readonly DbConnectionResolver _resolver;

    public ReplicaRoutingInterceptor(DbConnectionResolver resolver)
    {
        _resolver = resolver;
    }

    // Intercept SELECT statements
    public override InterceptionResult<DbDataReader> ReaderExecuting(
        DbCommand command,
        CommandEventData eventData,
        InterceptionResult<DbDataReader> result)
    {
        RouteToReplicaIfPossible(command, eventData);
        return base.ReaderExecuting(command, eventData, result);
    }

    public override ValueTask<InterceptionResult<DbDataReader>> ReaderExecutingAsync(
        DbCommand command,
        CommandEventData eventData,
        InterceptionResult<DbDataReader> result,
        CancellationToken cancellationToken = default)
    {
        RouteToReplicaIfPossible(command, eventData);
        return base.ReaderExecutingAsync(command, eventData, result, cancellationToken);
    }

    private void RouteToReplicaIfPossible(DbCommand command, CommandEventData eventData)
    {
        // Simple logic: If it's a SELECT, route to replica.
        // If it contains INSERT/UPDATE/DELETE, it stays on Master.
        if (command.CommandText.StartsWith("SELECT", StringComparison.OrdinalIgnoreCase))
        {
            // Note: In real life, ensure you manage connection state properly
            if (command.Connection.ConnectionString != _resolver.ReplicaConnectionString)
            {
                // Close current master connection
                bool wasOpen = command.Connection.State == System.Data.ConnectionState.Open;
                if (wasOpen) command.Connection.Close();

                // Swap string
                command.Connection.ConnectionString = _resolver.ReplicaConnectionString;

                // Reopen
                if (wasOpen) command.Connection.Open();

                Console.WriteLine("[Interceptor] Routed SELECT to Replica.");
            }
        }
    }
}
```

### 3. Wiring it up in Dependency Injection
We register the interceptor when configuring the `DbContext`.

```csharp
using Microsoft.Extensions.DependencyInjection;
using Microsoft.EntityFrameworkCore;

public static class ServiceExtensions
{
    public static void AddDbServices(this IServiceCollection services)
    {
        var resolver = new DbConnectionResolver();
        services.AddSingleton(resolver);

        services.AddDbContext<AppDbContext>((sp, options) =>
        {
            // Default to master
            options.UseSqlServer(resolver.MasterConnectionString);

            // Add Interceptor
            options.AddInterceptors(new ReplicaRoutingInterceptor(resolver));
        });
    }
}
```

### 4. The Service Layer
The beautiful part is that the Service layer developers don't even need to know the replica exists. They just write standard EF Core code.

```csharp
public class CustomerService
{
    private readonly AppDbContext _context;
    public CustomerService(AppDbContext context) => _context = context;

    public async Task<Customer> GetCustomerAsync(int id)
    {
        // The interceptor sees SELECT, swaps to Replica string!
        // We use AsNoTracking() for Mod 3.1 optimization.
        return await _context.Customers.AsNoTracking().FirstOrDefaultAsync(c => c.Id == id);
    }

    public async Task CreateCustomerAsync(Customer c)
    {
        _context.Customers.Add(c);
        // SaveChangesAsync uses INSERT, interceptor ignores it, stays on Master!
        await _context.SaveChangesAsync();
    }
}
```

### Architecture Review
This approach centralizes infrastructure concerns. By using `DbCommandInterceptor`, we achieve transparent read/write scaling without polluting our application logic with connection string management.
</details>
