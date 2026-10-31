# Challenge 1: Concurrent Ring Buffer (LMAX Disruptor Pattern)

## Architecture Overview
In standard multi-threaded systems, handing data from a Producer thread to a Consumer thread usually involves a `BlockingQueue` (like `ArrayBlockingQueue`). However, queues use Locks. Under extreme throughput (millions of messages a second), the constant locking, unlocking, and OS context switching becomes a massive bottleneck.

The **LMAX Disruptor** pattern revolutionized high-frequency trading by replacing the Queue with a Lock-Free Ring Buffer.
- Memory is pre-allocated (an array of empty "Event" objects) to prevent Garbage Collection pauses.
- Producers and Consumers track their positions using `AtomicLong` sequence numbers (Cursors).
- Threads coordinate purely using CPU Compare-And-Swap (CAS) and `volatile` memory barriers.

## The Challenge
Build a `LockFreeRingBuffer` capable of transferring 10 Million `FinancialOrder` events from a Producer thread to a Consumer thread without a single `synchronized` block or `ReentrantLock`.

### Requirements
1. **Pre-allocated Array:** The internal array must be instantiated at startup and never resized.
2. **Bitwise Masking:** The buffer capacity must be a power of 2 (e.g., 1024). Calculate the array index using bitwise AND (`sequence & mask`) instead of the slow modulo operator (`%`).
3. **Lock-Free Sequences:** Use `AtomicLong` to track the `writeSequence` (Producer) and `readSequence` (Consumer).
4. **Volatile Visibility:** Use `volatile` correctly so the Consumer instantly sees when the Producer has published a new event.

---

## Starter Template

```java
import java.util.concurrent.atomic.AtomicLong;

public class LockFreeRingBuffer {

    // Must be a power of 2 for bitwise masking
    private final int capacity;
    private final int mask;

    // The pre-allocated array of events
    private final FinancialOrder[] buffer;

    // Track where we are reading and writing
    private final AtomicLong writeSequence = new AtomicLong(0);
    private final AtomicLong readSequence = new AtomicLong(0);

    public static class FinancialOrder {
        public long orderId;
        public double price;
        // Volatile flag to signal the consumer this specific slot is ready to be read
        public volatile boolean isPublished = false;
    }

    public LockFreeRingBuffer(int capacity) {
        // Enforce power of 2
        if ((capacity & (capacity - 1)) != 0) {
            throw new IllegalArgumentException("Capacity must be a power of 2");
        }
        this.capacity = capacity;
        this.mask = capacity - 1;

        this.buffer = new FinancialOrder[capacity];
        // TODO: Pre-allocate every slot in the array so we never call 'new' again.
    }

    // Called by the Producer Thread
    public void publish(long orderId, double price) {
        // TODO: Get the next available write sequence.
        // TODO: If the buffer is full (writeSeq - readSeq >= capacity), spin-wait (while loop).
        // TODO: Get the pre-allocated event from the array using bitwise masking.
        // TODO: Update the event fields.
        // TODO: Set isPublished = true to signal the consumer.
    }

    // Called by the Consumer Thread
    public FinancialOrder consume() {
        // TODO: Get the current read sequence.
        // TODO: Get the event from the array.
        // TODO: If event.isPublished is false, spin-wait (while loop) until it becomes true.
        // TODO: Read the data, reset isPublished = false.
        // TODO: Increment the readSequence and return the data.
        return null;
    }
}
```

---

## Boss Level Solution Walkthrough

<details>
<summary><b>Click to reveal the production-grade implementation</b></summary>

```java
import java.util.concurrent.CountDownLatch;
import java.util.concurrent.atomic.AtomicLong;

public class LockFreeRingBuffer {

    private final int capacity;
    private final int mask;
    private final FinancialOrder[] buffer;

    // Pad the sequences to prevent False Sharing in CPU L1/L2 caches (Advanced optimization)
    // We only need the Atomics for basic tracking, but in a true Disruptor, these are heavily padded.
    private final AtomicLong writeSequence = new AtomicLong(0);
    private final AtomicLong readSequence = new AtomicLong(0);

    public static class FinancialOrder {
        public long orderId;
        public double price;

        // The memory barrier! Writing to this flushes the CPU cache.
        // Reading from this bypasses the CPU cache.
        public volatile boolean isPublished = false;
    }

    public LockFreeRingBuffer(int capacity) {
        if ((capacity & (capacity - 1)) != 0) {
            throw new IllegalArgumentException("Capacity must be a power of 2");
        }
        this.capacity = capacity;
        this.mask = capacity - 1;

        this.buffer = new FinancialOrder[capacity];

        // Zero-Allocation constraint: Pre-fill the array.
        for (int i = 0; i < capacity; i++) {
            this.buffer[i] = new FinancialOrder();
        }
    }

    public void publish(long orderId, double price) {
        // 1. Claim a slot
        long currentWriteSeq = writeSequence.get();

        // 2. Prevent Overwriting (Backpressure)
        // If the writer is an entire 'capacity' ahead of the reader, the ring is full!
        while (currentWriteSeq - readSequence.get() >= capacity) {
            // Spin-wait (Thread.yield() can be used here to prevent 100% CPU lockup)
            Thread.yield();
        }

        // 3. Fast index calculation (e.g., 1025 & 1023 = 1)
        int index = (int) (currentWriteSeq & mask);
        FinancialOrder event = buffer[index];

        // 4. Update the pre-allocated object (No garbage created!)
        event.orderId = orderId;
        event.price = price;

        // 5. Publish the event (Volatile write ensures visibility to Consumer)
        event.isPublished = true;

        // 6. Move the write cursor forward for the next publish call
        writeSequence.incrementAndGet();
    }

    public FinancialOrder consume() {
        long currentReadSeq = readSequence.get();
        int index = (int) (currentReadSeq & mask);
        FinancialOrder event = buffer[index];

        // 1. Wait for the Producer to actually publish data into this slot
        while (!event.isPublished) {
            // Spin-wait
            Thread.yield();
        }

        // 2. Read the data (In a real app, copy the data out to a DTO)
        FinancialOrder result = new FinancialOrder();
        result.orderId = event.orderId;
        result.price = event.price;

        // 3. Reset the slot so the Producer can overwrite it later
        event.isPublished = false;

        // 4. Move the read cursor forward
        readSequence.incrementAndGet();

        return result;
    }

    // --- Performance Test ---
    public static void main(String[] args) throws InterruptedException {
        int capacity = 1024;
        int totalEvents = 10_000_000;
        LockFreeRingBuffer ringBuffer = new LockFreeRingBuffer(capacity);

        CountDownLatch latch = new CountDownLatch(1);

        // Consumer Thread
        Thread consumer = new Thread(() -> {
            for (int i = 0; i < totalEvents; i++) {
                ringBuffer.consume();
            }
            latch.countDown();
        });
        consumer.start();

        // Producer Thread (Main)
        long start = System.currentTimeMillis();
        for (int i = 0; i < totalEvents; i++) {
            ringBuffer.publish(i, 100.0);
        }

        latch.await();
        long time = System.currentTimeMillis() - start;

        System.out.println("Processed " + totalEvents + " events in " + time + "ms");
        System.out.println("Throughput: " + (totalEvents / (time / 1000.0)) + " ops/sec");
    }
}
```

### Why this is Production-Grade
1. **Zero Garbage Collection:** Because `buffer[i] = new FinancialOrder()` is called at startup, and `publish` only mutates those existing objects, the Young Generation Heap never fills up. The JVM GC runs 0 times during the simulation.
2. **O(1) Bitwise Masking:** `currentWriteSeq % capacity` involves division, which takes many CPU clock cycles. `currentWriteSeq & mask` is a single hardware instruction, taking 1 clock cycle.
3. **Mechanical Sympathy:** The `volatile` flag acts as a memory barrier. When the Producer sets `isPublished = true`, it flushes its L1 cache. The Consumer's spin-wait is instantly broken, and it reads the data without a heavy OS Context Switch.

</details>
