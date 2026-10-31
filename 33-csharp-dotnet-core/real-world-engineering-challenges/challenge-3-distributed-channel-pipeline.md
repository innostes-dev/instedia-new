# Challenge 3: Multi-Producer Multi-Consumer Channel Pipeline

## Scenario
You are building an image processing pipeline for a social media app.
1. The API receives HTTP POST requests with image metadata (Producer).
2. You need to download the image, resize it, and upload it to S3 (Consumer).
3. If you do this synchronously, the API times out.
4. If you fire-and-forget Tasks, a burst of 1,000 images will exhaust the ThreadPool and memory.

## The Challenge
Design an In-Memory Background Processing pipeline using `System.Threading.Channels.Channel<T>` and `BackgroundService` (IHostedService).
- Setup a Bounded Channel (Max 500 items).
- Provide a method for the API to write to the channel (Producers).
- Create a `BackgroundService` that spins up exactly **3 concurrent consumers** reading from the same channel to process the images in parallel without overloading the system.

---

## Starter Template

```csharp
using System;
using System.Threading;
using System.Threading.Channels;
using System.Threading.Tasks;
using Microsoft.Extensions.Hosting;

namespace Challenges.Channels
{
    public record ImageJob(string ImageUrl, string UserId);

    // 1. The Queue Wrapper
    public class ImageJobQueue
    {
        // TODO: Initialize a Bounded Channel here

        public async ValueTask QueueJobAsync(ImageJob job)
        {
            // TODO: Write to channel
        }
    }

    // 2. The Background Worker
    public class ImageProcessingWorker : BackgroundService
    {
        // TODO: Read from channel and process using 3 concurrent threads
        protected override async Task ExecuteAsync(CancellationToken stoppingToken)
        {
        }
    }
}
```

---

<details>
<summary>View Complete Production Solution Walkthrough</summary>

## Production Solution Walkthrough

### 1. The Channel Wrapper (Singleton)
We wrap the `Channel<T>` in a strongly-typed class to inject it via DI. We configure it as Bounded to protect against Out-Of-Memory exceptions, and we set `SingleReader = false` because we intend to have 3 consumers reading simultaneously.

```csharp
using System;
using System.Threading;
using System.Threading.Channels;
using System.Threading.Tasks;
using Microsoft.Extensions.Hosting;

public record ImageJob(string ImageUrl, string UserId);

public class ImageJobQueue
{
    private readonly Channel<ImageJob> _channel;

    public ImageJobQueue()
    {
        var options = new BoundedChannelOptions(500)
        {
            FullMode = BoundedChannelFullMode.Wait, // Backpressure: API will wait if full
            SingleReader = false, // 3 background tasks will read from it
            SingleWriter = false  // Multiple API threads will write to it
        };
        _channel = Channel.CreateBounded<ImageJob>(options);
    }

    // API Controller calls this
    public async ValueTask EnqueueAsync(ImageJob job, CancellationToken ct = default)
    {
        await _channel.Writer.WriteAsync(job, ct);
    }

    // Background service calls this
    public ChannelReader<ImageJob> Reader => _channel.Reader;
}
```

### 2. The Multi-Consumer Background Service
To achieve concurrency without thread starvation, we spin up 3 `Task.Run` workers inside the `BackgroundService`. All 3 workers will compete to read from the exact same `ChannelReader`. The Channel handles all the thread-safe locking internally and efficiently.

```csharp
public class ImageProcessingWorker : BackgroundService
{
    private readonly ImageJobQueue _queue;
    private const int ConcurrentConsumers = 3;

    public ImageProcessingWorker(ImageJobQueue queue)
    {
        _queue = queue;
    }

    protected override async Task ExecuteAsync(CancellationToken stoppingToken)
    {
        Console.WriteLine("Image Processing Worker starting...");

        // Create an array to hold our worker tasks
        var tasks = new Task[ConcurrentConsumers];

        for (int i = 0; i < ConcurrentConsumers; i++)
        {
            int workerId = i + 1; // Capture for logging

            // Start a long-running consumer task
            tasks[i] = Task.Run(() => ConsumeAsync(workerId, stoppingToken), stoppingToken);
        }

        // Wait for all workers to finish (which only happens if stoppingToken is triggered)
        await Task.WhenAll(tasks);
    }

    private async Task ConsumeAsync(int workerId, CancellationToken token)
    {
        try
        {
            // ReadAllAsync natively yields when empty, and distributes items safely
            // among the 3 competing consumers.
            await foreach (var job in _queue.Reader.ReadAllAsync(token))
            {
                Console.WriteLine($"[Worker {workerId}] Downloading and resizing {job.ImageUrl} for {job.UserId}");

                // Simulate CPU/IO bound work
                await Task.Delay(1000, token);

                Console.WriteLine($"[Worker {workerId}] Uploaded to S3.");
            }
        }
        catch (OperationCanceledException)
        {
            Console.WriteLine($"[Worker {workerId}] Shutting down gracefully.");
        }
    }
}
```

### Architecture Review
- **Safety:** If 10,000 requests hit the API, the channel accepts 500. The 501st request will suspend (backpressure), preventing the server from crashing due to OOM.
- **Concurrency:** We precisely control system load. We have exactly 3 images processing at any given time.
- **Graceful Shutdown:** The `stoppingToken` ensures that when IIS or Docker shuts down the application, the `ReadAllAsync` loop exits cleanly, allowing current processing to finish.
</details>
