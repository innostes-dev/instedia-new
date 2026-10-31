# Challenge 3: 100,000 Concurrent Virtual Threads Web Crawler

## Architecture Overview
In traditional Java, writing a Web Crawler to scrape 100,000 URLs concurrently was nearly impossible. If you used `new Thread()`, the JVM would request 100,000 OS threads (consuming 100GB of RAM just for thread stacks) and crash your computer. If you used an `ExecutorService` with a fixed pool of 50 threads, it would take hours because 50 threads would spend most of their time asleep waiting for slow web servers to respond.

With **Java 21 Virtual Threads (Project Loom)**, we can spawn 100,000 threads simultaneously. When a Virtual Thread waits for an HTTP response, it instantly "unmounts" from the OS Carrier Thread, consuming almost zero resources.

Furthermore, we must use **Structured Concurrency**. If the Main Thread is cancelled, or if a global timeout is reached, we must guarantee that all 100,000 Virtual Threads are instantly interrupted and killed. We cannot leak threads.

## The Challenge
Build a `MassiveWebCrawler`. It receives a `List<String>` of 10,000 URLs. It must spin up a Virtual Thread for *every single URL* simultaneously. It must collect the HTTP Status Code for each URL and return a `Map<String, Integer>`.

### Requirements
1. **Virtual Threads:** Do not use `newFixedThreadPool`. You must use `Executors.newVirtualThreadPerTaskExecutor()` or `StructuredTaskScope`.
2. **Structured Concurrency:** Use `StructuredTaskScope` so the entire batch is grouped together.
3. **Deadlines:** The entire scrape operation has a strict deadline of 5 seconds. Use `scope.joinUntil()`. Any Virtual Thread still waiting for a slow website after 5 seconds must be automatically cancelled by the scope.
4. **Data Aggregation:** Safely collect the results from the successful subtasks into a `ConcurrentHashMap`.

---

## Starter Template

```java
import java.time.Instant;
import java.util.List;
import java.util.Map;
import java.util.concurrent.ConcurrentHashMap;
import java.util.concurrent.StructuredTaskScope;
import java.util.concurrent.TimeoutException;

public class MassiveWebCrawler {

    // Dummy method simulating an HTTP GET request
    private int fetchStatusCode(String url) throws InterruptedException {
        // Simulating network latency. Some are fast, some are very slow.
        long delay = (long) (Math.random() * 8000);
        Thread.sleep(delay);
        return 200; // Simulating HTTP OK
    }

    public Map<String, Integer> crawlUrls(List<String> urls) throws InterruptedException {
        Map<String, Integer> results = new ConcurrentHashMap<>();

        // 1. Create a standard StructuredTaskScope (we want all results, not just the first one)
        // TODO: Initialize try-with-resources StructuredTaskScope

        // 2. Loop through all URLs. For each one, fork a Subtask.
        // TODO: For each url in urls, scope.fork(() -> fetchStatusCode(url))
        // TODO: You will need to store the references to the Subtasks to read them later.

        // 3. Wait for all to finish, BUT enforce a 5-second deadline!
        // TODO: use scope.joinUntil(Instant.now().plusSeconds(5))
        // TODO: Catch the TimeoutException (it's expected if sites are slow)

        // 4. Iterate through your saved Subtasks. If state == SUCCESS, put it in the results map.
        // TODO: Populate the results map.

        return results;
    }
}
```

---

## Boss Level Solution Walkthrough

<details>
<summary><b>Click to reveal the production-grade implementation</b></summary>

```java
import java.time.Instant;
import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import java.util.concurrent.ConcurrentHashMap;
import java.util.concurrent.StructuredTaskScope;
import java.util.concurrent.StructuredTaskScope.Subtask;
import java.util.concurrent.TimeoutException;

/**
 * Run this with Java 21+ and enable preview features:
 * java --enable-preview --source 21 MassiveWebCrawler.java
 */
public class MassiveWebCrawler {

    private int fetchStatusCode(String url) throws InterruptedException {
        // In a real app, use java.net.http.HttpClient here.
        // For simulation, we randomly sleep between 100ms and 8000ms.
        long delay = (long) (Math.random() * 8000);
        Thread.sleep(delay);

        // Simulating some sites returning 404
        return Math.random() > 0.8 ? 404 : 200;
    }

    // A helper Record to bind the URL to the result so we know which task belongs to which URL
    private record ScrapeResult(String url, int statusCode) {}

    public Map<String, Integer> crawlUrls(List<String> urls) throws InterruptedException {
        // ConcurrentHashMap is required because we are writing to it from multiple threads,
        // OR we can aggregate synchronously after the join. We will aggregate synchronously for maximum safety.
        Map<String, Integer> results = new ConcurrentHashMap<>();

        // Create a custom Task Scope to track all the spawned Virtual Threads
        try (var scope = new StructuredTaskScope<ScrapeResult>()) {

            // We need a list to hold the Subtask references so we can check their status later
            List<Subtask<ScrapeResult>> tasks = new ArrayList<>(urls.size());

            // Fork 10,000 Virtual Threads instantly!
            for (String url : urls) {
                Subtask<ScrapeResult> task = scope.fork(() -> {
                    int status = fetchStatusCode(url);
                    return new ScrapeResult(url, status);
                });
                tasks.add(task);
            }

            // The Barrier: Wait for all 10,000 threads to finish.
            // BUT, if 5 seconds pass, instantly send an InterruptedException to any
            // Virtual Thread still running, killing it to free up resources.
            try {
                scope.joinUntil(Instant.now().plusSeconds(5));
            } catch (TimeoutException e) {
                System.out.println("Global 5-second deadline reached. Cancelling slow URLs...");
            }

            // The scope is now joined (or timed out).
            // We can safely iterate the tasks and collect the successful ones.
            int successCount = 0;
            int timeoutCount = 0;

            for (Subtask<ScrapeResult> task : tasks) {
                if (task.state() == Subtask.State.SUCCESS) {
                    ScrapeResult res = task.get();
                    results.put(res.url(), res.statusCode());
                    successCount++;
                } else if (task.state() == Subtask.State.UNAVAILABLE) {
                    // Task was cancelled by the TimeoutException
                    timeoutCount++;
                }
            }

            System.out.println("Scrape Complete. Success: " + successCount + ", Timed Out: " + timeoutCount);
            return results;
        }
    }

    // --- Performance Test ---
    public static void main(String[] args) throws InterruptedException {
        int totalUrls = 10_000;
        List<String> mockUrls = new ArrayList<>(totalUrls);
        for (int i = 0; i < totalUrls; i++) {
            mockUrls.add("https://website-" + i + ".com");
        }

        MassiveWebCrawler crawler = new MassiveWebCrawler();

        System.out.println("Starting massive crawl of " + totalUrls + " URLs...");
        long start = System.currentTimeMillis();

        Map<String, Integer> data = crawler.crawlUrls(mockUrls);

        long time = System.currentTimeMillis() - start;
        System.out.println("Finished in " + time + "ms");

        // The total time will be exactly ~5000ms (the deadline) because
        // the slow tasks were forcefully short-circuited!
    }
}
```

### Why this is Production-Grade
1. **Thread Leak Prevention:** If you wrote `executor.submit(...)` and didn't use Structured Concurrency, a 5-second timeout in the main thread would leave thousands of background threads permanently running, trying to fetch websites and leaking memory. `scope.joinUntil()` guarantees that the moment the scope closes, every single child Virtual Thread is interrupted and killed.
2. **Subtask State Management:** By utilizing `Subtask.State.SUCCESS` and `Subtask.State.UNAVAILABLE`, we elegantly handle partial failures without throwing sweeping Exceptions that crash the entire batch.
3. **Hardware Efficiency:** It spins up 10,000 tasks instantly, but because they are Virtual Threads, they all map down to a small pool of OS Carrier Threads (typically equal to your CPU cores). The OS doesn't even notice the load.

</details>
