# Challenge 5: Pure Java Raft Distributed Consensus Protocol Node

## Architecture Overview
In a single-server architecture, memory is the source of truth. In a distributed system (like Kafka, Kubernetes etcd, or MongoDB), multiple servers must agree on the "source of truth" even if network cables are unplugged or servers crash.

The **Raft Consensus Algorithm** is the industry standard for distributed consensus. It operates on a Leader-Follower model:
1. **Leader Election:** Nodes start as Followers. If they don't hear a "Heartbeat" from a Leader within a random timeout window, they become a Candidate and request votes. The first to get a majority becomes the Leader.
2. **Log Replication:** The Leader accepts client requests, writes them to a Write-Ahead Log (WAL), and forces the Followers to replicate the log.

## The Challenge
Build the core State Machine and Timer logic of a pure Java Raft Node. You do not need to implement the actual network sockets (you can mock them). You must implement the thread-safe State Transitions (Follower -> Candidate -> Leader) and the randomized Election Timeout mechanism using Java Concurrency.

### Requirements
1. **Thread-Safe State:** The Node's state (`FOLLOWER`, `CANDIDATE`, `LEADER`) and `currentTerm` must be thread-safe, as they will be read by Heartbeat threads and modified by Election threads simultaneously.
2. **Randomized Timers:** Use a `ScheduledExecutorService`. A Follower must schedule an election timeout between 150ms and 300ms.
3. **Heartbeat Resets:** If a Follower receives an `AppendEntries` (Heartbeat) RPC from the current Leader, it must cancel its pending election timer and schedule a new one.
4. **Leader Duties:** If a node becomes a Leader, it must immediately stop its election timer and start sending `AppendEntries` heartbeats every 50ms to all other nodes.

---

## Starter Template

```java
import java.util.Random;
import java.util.concurrent.Executors;
import java.util.concurrent.ScheduledExecutorService;
import java.util.concurrent.ScheduledFuture;
import java.util.concurrent.TimeUnit;
import java.util.concurrent.atomic.AtomicInteger;
import java.util.concurrent.atomic.AtomicReference;

public class RaftNode {

    public enum State { FOLLOWER, CANDIDATE, LEADER }

    private final String nodeId;

    // Thread-safe state tracking
    private final AtomicReference<State> state = new AtomicReference<>(State.FOLLOWER);
    private final AtomicInteger currentTerm = new AtomicInteger(0);

    // Concurrency components
    private final ScheduledExecutorService scheduler = Executors.newScheduledThreadPool(2);
    private ScheduledFuture<?> electionTimer;
    private ScheduledFuture<?> heartbeatTimer;
    private final Random random = new Random();

    public RaftNode(String nodeId) {
        this.nodeId = nodeId;
    }

    public void start() {
        System.out.println(nodeId + " starting as FOLLOWER.");
        // TODO: Start the randomized election timer.
    }

    // Called periodically by the election timer
    private void triggerElection() {
        // TODO: Transition state to CANDIDATE.
        // TODO: Increment currentTerm.
        // TODO: Request votes (mock this). If majority won, call becomeLeader().
        // TODO: Reset the election timer.
    }

    // Called if this node wins the election
    private void becomeLeader() {
        // TODO: Transition state to LEADER.
        // TODO: Cancel the election timer.
        // TODO: Start the heartbeatTimer to execute sendHeartbeats() every 50ms.
    }

    // Called periodically by the Leader
    private void sendHeartbeats() {
        System.out.println(nodeId + " (Leader Term " + currentTerm.get() + ") sending heartbeats.");
        // Mock sending to peers
    }

    // Network RPC received from another node (The Leader)
    public void receiveAppendEntries(int leaderTerm) {
        // TODO: If leaderTerm >= currentTerm, update currentTerm.
        // TODO: If we are a CANDIDATE or LEADER, step down back to FOLLOWER.
        // TODO: Reset the election timer because we heard from a valid leader!
    }

    private void resetElectionTimer() {
        // TODO: Cancel existing electionTimer if it exists.
        // TODO: Schedule a new triggerElection() execution with a delay between 150ms and 300ms.
    }
}
```

---

## Boss Level Solution Walkthrough

<details>
<summary><b>Click to reveal the production-grade implementation</b></summary>

```java
import java.util.Random;
import java.util.concurrent.Executors;
import java.util.concurrent.ScheduledExecutorService;
import java.util.concurrent.ScheduledFuture;
import java.util.concurrent.TimeUnit;
import java.util.concurrent.atomic.AtomicInteger;
import java.util.concurrent.atomic.AtomicReference;

public class RaftNode {

    public enum State { FOLLOWER, CANDIDATE, LEADER }

    private final String nodeId;

    // Atomic references ensure that state changes are instantly visible across all threads
    private final AtomicReference<State> state = new AtomicReference<>(State.FOLLOWER);
    private final AtomicInteger currentTerm = new AtomicInteger(0);

    private final ScheduledExecutorService scheduler = Executors.newScheduledThreadPool(2);

    // Futures allow us to cancel pending tasks dynamically
    private ScheduledFuture<?> electionTimer;
    private ScheduledFuture<?> heartbeatTimer;
    private final Random random = new Random();

    public RaftNode(String nodeId) {
        this.nodeId = nodeId;
    }

    public void start() {
        System.out.println(nodeId + " starting up...");
        resetElectionTimer();
    }

    /**
     * Resets the countdown to the next election.
     * Must be synchronized to prevent race conditions if multiple threads
     * try to reset the timer simultaneously.
     */
    private synchronized void resetElectionTimer() {
        if (electionTimer != null && !electionTimer.isDone()) {
            // Cancel the currently running countdown
            electionTimer.cancel(false);
        }

        // Raft requires a randomized timeout (e.g., 150ms to 300ms) to prevent split votes
        int timeoutMs = 150 + random.nextInt(151);

        electionTimer = scheduler.schedule(
            this::triggerElection,
            timeoutMs,
            TimeUnit.MILLISECONDS
        );
    }

    /**
     * Called when the election timer expires without receiving a heartbeat.
     */
    private synchronized void triggerElection() {
        // 1. Transition to Candidate
        state.set(State.CANDIDATE);

        // 2. Increment term
        int newTerm = currentTerm.incrementAndGet();
        System.out.println(nodeId + " timed out! Becoming CANDIDATE for Term " + newTerm);

        // 3. Request votes (Mocked: Assume we win the election immediately for the simulation)
        boolean wonElection = true;

        if (wonElection) {
            becomeLeader();
        } else {
            // If we lost (or split vote), reset timer and try again
            resetElectionTimer();
        }
    }

    private synchronized void becomeLeader() {
        System.out.println(">>> " + nodeId + " WON ELECTION. Becoming LEADER for Term " + currentTerm.get() + " <<<");
        state.set(State.LEADER);

        // 1. A Leader does not need an election timer
        if (electionTimer != null) electionTimer.cancel(false);

        // 2. A Leader must immediately start asserting dominance by sending heartbeats
        heartbeatTimer = scheduler.scheduleAtFixedRate(
            this::sendHeartbeats,
            0,
            50, // Send every 50ms
            TimeUnit.MILLISECONDS
        );
    }

    private void sendHeartbeats() {
        System.out.println(nodeId + " [Term " + currentTerm.get() + "] broadcasting AppendEntries (Heartbeat).");
        // In a real system, this loops through all peers and sends a network RPC.
    }

    /**
     * SIMULATED NETWORK LAYER: Another node (the Leader) sends us a heartbeat.
     */
    public synchronized void receiveAppendEntries(int leaderTerm) {
        if (leaderTerm >= currentTerm.get()) {
            currentTerm.set(leaderTerm);

            // If we were a Candidate (or a partitioned older Leader), step down!
            if (state.get() != State.FOLLOWER) {
                System.out.println(nodeId + " stepping down to FOLLOWER. Recognized newer Term " + leaderTerm);
                state.set(State.FOLLOWER);

                // Stop sending heartbeats if we were a leader
                if (heartbeatTimer != null) heartbeatTimer.cancel(false);
            }

            // Critical Raft logic: Receiving a valid heartbeat resets the election clock!
            resetElectionTimer();
        }
    }

    // --- Simulation Test ---
    public static void main(String[] args) throws InterruptedException {
        RaftNode nodeA = new RaftNode("Node-A");
        nodeA.start();

        // Let Node A sit alone for 500ms. It should timeout, become Candidate, and become Leader.
        Thread.sleep(500);

        System.out.println("\n--- Simulating Network Recovery ---");
        // Suddenly, Node A receives a heartbeat from a different node (Node B) with a HIGHER term!
        nodeA.receiveAppendEntries(5);

        // Let it run for a bit to show that Node A is now peacefully waiting as a Follower
        Thread.sleep(300);

        System.exit(0);
    }
}
```

### Why this is Production-Grade
1. **Targeted Synchronization:** The `AtomicReference` handles safe state reading across threads. `synchronized` is strategically applied only to the timer mutation methods (`resetElectionTimer`, `becomeLeader`) to ensure the cancellation and rescheduling of `ScheduledFuture` objects is atomic and free of race conditions.
2. **Deterministic Randomness:** Split votes (where two nodes become candidates at the exact same millisecond) destroy Raft clusters. The randomized `150 + random.nextInt(151)` logic guarantees one node will almost always time out slightly faster than the others, securing the leadership cleanly.
3. **Graceful Degradation:** The `receiveAppendEntries` logic guarantees that if a Leader gets cut off from the network ("network partition"), continues thinking it is leader, and then the network heals, it will instantly recognize a higher `leaderTerm` from the new valid leader, cancel its own heartbeat timer, and gracefully step down to a Follower.

</details>
