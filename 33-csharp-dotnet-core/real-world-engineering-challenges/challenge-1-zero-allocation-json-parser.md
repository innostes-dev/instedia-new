# Challenge 1: Zero-Allocation High-Speed JSON Protocol Parser

## Scenario
You are building an edge-node telemetry ingestion service. It receives over 50,000 JSON payloads per second over raw TCP sockets. The payload looks like this:
`{"DeviceId":"EDGE-01","Temp":45.2,"Status":"WARN"}`

Currently, the junior developers are reading the socket into a `string` and using `JsonSerializer.Deserialize<TelemetryClass>(jsonString)`. Profiling shows massive Gen 0 and Gen 2 garbage collection spikes due to string allocations and heap-allocated classes.

## The Challenge
Write a **zero-allocation** pipeline that reads raw UTF-8 bytes directly into a `readonly struct` without ever allocating a `string` or a `class`.

### Requirements:
1. Use `ArrayPool<byte>` to buffer the incoming socket data (prevent LOH fragmentation).
2. Parse the JSON directly from the `ReadOnlySpan<byte>` using `System.Text.Json.Utf8JsonReader`.
3. Map the data into a `readonly struct`.
4. Ensure the method signature handles async streams gracefully.

---

## Starter Template

```csharp
using System;
using System.Buffers;
using System.IO;
using System.Text.Json;
using System.Threading.Tasks;

namespace Challenges
{
    public class TelemetryClass
    {
        public string DeviceId { get; set; }
        public double Temp { get; set; }
        public string Status { get; set; }
    }

    public class IngestionService
    {
        // TODO: Refactor this entire method to be zero-allocation
        public async Task<TelemetryClass> ProcessBadAsync(Stream networkStream, int payloadLength)
        {
            byte[] buffer = new byte[payloadLength]; // BAD: Allocates new array every time
            await networkStream.ReadAsync(buffer, 0, payloadLength);

            string jsonString = System.Text.Encoding.UTF8.GetString(buffer); // BAD: Allocates string

            return JsonSerializer.Deserialize<TelemetryClass>(jsonString); // BAD: Allocates class
        }
    }
}
```

---

<details>
<summary>View Complete Production Solution Walkthrough</summary>

## Production Solution Walkthrough

### 1. Define the Zero-Allocation Model
First, we replace the `class` with a `readonly struct`. Because we can't store `string` (heap allocation) if we want true zero-allocation parsing in the hottest path, we can either store the raw slice of bytes, or if we *must* have strings, we accept that strings allocate, but we eliminate the *buffer* and *parsing* allocations. For this solution, we will parse the strings, but eliminate the array and JSON string allocations.

```csharp
public readonly struct TelemetryStruct
{
    public string DeviceId { get; } // String allocation is often unavoidable at the very end if Domain requires it
    public double Temp { get; }
    public string Status { get; }

    public TelemetryStruct(string deviceId, double temp, string status)
    {
        DeviceId = deviceId;
        Temp = temp;
        Status = status;
    }
}
```

### 2. The High-Performance Parser
We will use `ArrayPool<byte>` to borrow memory, `Memory<byte>` to read from the stream asynchronously, and `Utf8JsonReader` (a `ref struct`) to read the bytes directly without converting the whole payload to a string first.

```csharp
using System;
using System.Buffers;
using System.IO;
using System.Text.Json;
using System.Threading.Tasks;

public class OptimizedIngestionService
{
    public async ValueTask<TelemetryStruct> ProcessGoodAsync(Stream networkStream, int payloadLength)
    {
        // 1. Rent buffer from pool (Zero LOH fragmentation / Zero new array allocation)
        byte[] buffer = ArrayPool<byte>.Shared.Rent(payloadLength);

        try
        {
            // 2. Read asynchronously into Memory<T> wrapper
            Memory<byte> memoryBuffer = new Memory<byte>(buffer, 0, payloadLength);
            int bytesRead = await networkStream.ReadAsync(memoryBuffer);

            // 3. Get Span representation for synchronous, zero-allocation parsing
            ReadOnlySpan<byte> spanBuffer = memoryBuffer.Span.Slice(0, bytesRead);

            // 4. Parse using Utf8JsonReader (ref struct, lives entirely on stack)
            var reader = new Utf8JsonReader(spanBuffer);

            string deviceId = null;
            double temp = 0;
            string status = null;

            while (reader.Read())
            {
                if (reader.TokenType == JsonTokenType.PropertyName)
                {
                    // reader.ValueTextEquals is highly optimized and checks the raw bytes
                    // without allocating a string for the property name!
                    if (reader.ValueTextEquals("DeviceId"))
                    {
                        reader.Read();
                        deviceId = reader.GetString(); // The only allocations occur here
                    }
                    else if (reader.ValueTextEquals("Temp"))
                    {
                        reader.Read();
                        temp = reader.GetDouble();
                    }
                    else if (reader.ValueTextEquals("Status"))
                    {
                        reader.Read();
                        status = reader.GetString();
                    }
                }
            }

            // 5. Return struct (Stack allocated)
            return new TelemetryStruct(deviceId, temp, status);
        }
        finally
        {
            // 6. ALWAYS return the rented buffer in a finally block
            ArrayPool<byte>.Shared.Return(buffer);
        }
    }
}
```

### Architecture Review
- **ArrayPool:** Prevents `byte[]` allocations.
- **Memory<T>:** Allows slicing and using spans across `await` boundaries.
- **Utf8JsonReader:** Avoids reading the whole payload into a `string`. Avoids deserialization reflection overhead.
- **ValueTextEquals:** Compares JSON property keys by looking at the UTF-8 bytes directly, skipping string allocation for property names.
- **ValueTask & Struct:** Returns the result purely on the stack.
</details>
