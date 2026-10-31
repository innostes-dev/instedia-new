# Challenge 5: Multi-Region Redis Cluster with Sentinel Failover & LRU Eviction

## Business Scenario
You are the Infrastructure Architect for a global social media platform. You have a Redis server acting as the primary cache for user feeds.

However, you face three massive production issues:
1. **Single Point of Failure:** If the Redis server crashes, your database is flooded, and the app goes offline.
2. **Read Bottlenecks:** Your single Redis server is maxing out its CPU serving 150,000 read requests per second.
3. **Out of Memory (OOM):** You are caching so much data that Redis is hitting its 16GB RAM limit, causing the server to crash.

You must design a highly available architecture utilizing **Redis Master-Replica**, **Redis Sentinel** for automatic failover, and configure an appropriate **Eviction Policy** to prevent OOM errors.

## The Architecture Diagram

```text
                  [ Node.js API Cluster ]
                             | (Uses Sentinel Client)
                             v
           +-----------------------------------+
           |         Redis Sentinel 1          |
           |         Redis Sentinel 2          | (Quorum = 2)
           |         Redis Sentinel 3          |
           +-----------------------------------+
                  /          |           \
           Monitors       Monitors      Monitors
                /            |             \
               v             v              v
    +--------------+  +--------------+  +--------------+
    | Redis MASTER |  | Redis SLAVE 1|  | Redis SLAVE 2|
    |  (Reads &    |  | (Read-Only)  |  | (Read-Only)  |
    |   Writes)    |  |              |  |              |
    +--------------+  +--------------+  +--------------+
            \                ^                  ^
             \---(Async Replication)------------/
```

## Infrastructure Challenge (No Starter Code)

Because this is a DevOps and Infrastructure challenge, there is no Node.js starter code. Instead, your task is to answer the following architectural questions and provide the required `redis.conf` configurations.

### Task 1: Replication and Read Scaling
How do you configure a Redis instance to act as a read-only replica of another Redis instance? Provide the command/config. How does this solve the read bottleneck?

### Task 2: High Availability (Sentinel)
If the Master node loses power, the Slaves will just sit there waiting for it to come back.
Explain how Redis Sentinel solves this. Why do you need at least *three* Sentinel nodes? What happens mathematically during a failover event?

### Task 3: Memory Management (Eviction)
Your Redis server has `maxmemory 16gb`. It is currently at 15.9GB. A user tries to `SET` a new 50MB video metadata object.
If your eviction policy is `noeviction`, Redis will throw an OOM error and reject the write.
For a standard cache layer, what is the best eviction policy to use, and how does it determine which keys to delete?

---

## Full Production Solution Walkthrough

### Solution 1: Replication (Scaling Reads)

**The Configuration:**
To make a Redis node a replica, you add this to its `redis.conf`:
`replicaof <master-ip> <master-port>`
*(In older versions of Redis, this was `slaveof`)*.

**How it works:**
The replica connects to the Master and requests a sync. The Master creates a background snapshot (RDB file) and sends it to the replica. From then on, every time the Master receives a `SET` or `DEL` command, it asynchronously streams that exact command to all replicas.

**Solving the bottleneck:**
You configure your Node.js application to send all `WRITE` commands (`SET`, `DEL`, `HSET`) to the Master node, but round-robin all `READ` commands (`GET`, `ZRANGE`) across the Replicas. If you have 1 Master and 2 Replicas, you have effectively tripled your read capacity.

### Solution 2: High Availability (Redis Sentinel)

**How Sentinel Works:**
Redis Sentinel is a separate daemon process running alongside Redis. Its job is purely monitoring. It constantly pings the Master and the Replicas.

**Why 3 Nodes? (The Split-Brain Problem):**
You must have an odd number of Sentinels (minimum 3) to establish a **Quorum** (majority vote).
Imagine you have only 2 Data Centers (DC-A and DC-B). DC-A has Master + Sentinel 1. DC-B has Replica + Sentinel 2.
If the network cable between the two data centers is cut, Sentinel 2 cannot reach the Master. It thinks the Master is dead. If Sentinel 2 could act alone, it would promote the Replica to Master. Now you have TWO Masters accepting writes (Split-Brain). When the network reconnects, data is hopelessly corrupted.

With 3 Sentinels, if the Master dies, Sentinels must vote. If a Sentinel detects a failure, it asks the others: "Is the Master dead for you too?" If $N/2 + 1$ (2 out of 3) Sentinels agree, a failover is initiated. The Sentinels automatically reconfigure one Replica to become the new Master, and update the Node.js clients with the new IP address.

### Solution 3: Memory Management (LRU Eviction)

**The Configuration:**
In `redis.conf`:
```text
maxmemory 16gb
maxmemory-policy allkeys-lru
```

**How it works:**
`allkeys-lru` stands for "Least Recently Used".
When Redis hits 16GB and a new `SET` command arrives, Redis will scan memory to find keys that have not been read or written to for the longest amount of time. It assumes that if a key hasn't been requested in a week, it is safe to delete.
It will delete enough "stale" keys to make room for the new 50MB object, and then execute the write.

**Pro-Tip (allkeys vs volatile):**
* `allkeys-lru`: Evicts *any* key based on LRU. Best for pure caching layers.
* `volatile-lru`: Only evicts keys that have a TTL (Expire) set on them. If a key doesn't have an expiration, it will never be evicted. Best if Redis is acting as both a Cache AND a primary database (though mixing these workloads on one server is generally a bad idea).

### Node.js Sentinel Client Implementation

For completeness, here is how you connect Node.js to a Sentinel cluster so the app automatically routes traffic when a failover occurs.

```javascript
const { createClient } = require('redis');

// Instead of providing a host/port, you provide the Sentinels and the Master Group Name
const client = createClient({
    url: 'redis://...', // Not used for Sentinel
    sentinels: [
        { host: '10.0.0.1', port: 26379 },
        { host: '10.0.0.2', port: 26379 },
        { host: '10.0.0.3', port: 26379 }
    ],
    name: 'mymaster', // The name of the master group configured in sentinel.conf
    role: 'master' // Connect to the master for writes
});

// To scale reads, create a separate client:
const readClient = createClient({
    sentinels: [...],
    name: 'mymaster',
    role: 'slave' // The client will automatically discover replicas and route GETs to them
});
```
