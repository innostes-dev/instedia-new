# Challenge 1: LRU & LFU Cache Engine

## 1. The Real-World Engineering Problem
You are building the primary data cache for a high-traffic microservice. The service receives thousands of requests per second, and memory is highly constrained.
You need to implement a Cache that guarantees **O(1) time complexity** for both `get` and `put` operations.

You must implement two eviction policies:
1. **LRU (Least Recently Used):** When capacity is reached, evict the item that hasn't been accessed for the longest time.
2. **LFU (Least Frequently Used):** When capacity is reached, evict the item that has the lowest total access count. If there is a tie (two items accessed 5 times), use LRU as the tie-breaker.

## 2. Architecture Diagram (LRU)
```text
State: Capacity = 3.

Map: { "user1": NodeA, "user2": NodeB, "user3": NodeC }

Doubly Linked List (Tracks Recency):
[HEAD (Most Recent)] <-> [NodeC] <-> [NodeA] <-> [NodeB] <-> [TAIL (Least Recent)]

Action: get("user2")
1. Map lookup returns NodeB in O(1).
2. Detach NodeB: NodeA.next = TAIL, TAIL.prev = NodeA
3. Move NodeB to Head: NodeB.next = NodeC, HEAD.next = NodeB
```

## 3. Starter Template
```javascript
// starter-template.js

class LRUCache {
  /**
   * @param {number} capacity
   */
  constructor(capacity) {
    this.capacity = capacity;
    // TODO: Initialize Map and Doubly Linked List sentinels
  }

  /**
   * @param {number} key
   * @return {number} value if exists, otherwise -1
   */
  get(key) {
    // TODO: Implement O(1) lookup and move to head
    return -1;
  }

  /**
   * @param {number} key
   * @param {number} value
   * @return {void}
   */
  put(key, value) {
    // TODO: Implement O(1) insert, update, and LRU eviction
  }
}

// TODO: Challenge 2 - Implement LFUCache
```

## 4. Production Walkthrough (Full Solution)

<details>
<summary>✅ View Full Production Solution & Tests</summary>

### The LRU Solution
We combine a `Map` for O(1) lookups with a `Doubly Linked List` for O(1) reordering.

```javascript
class Node {
  constructor(key, value) {
    this.key = key;
    this.value = value;
    this.prev = null;
    this.next = null;
  }
}

class LRUCache {
  constructor(capacity) {
    this.capacity = capacity;
    this.cacheMap = new Map();

    // Sentinels guarantee we never have to write "if (head === null)" logic
    this.head = new Node(-1, -1);
    this.tail = new Node(-1, -1);
    this.head.next = this.tail;
    this.tail.prev = this.head;
  }

  _removeNode(node) {
    node.prev.next = node.next;
    node.next.prev = node.prev;
  }

  _addNodeToHead(node) {
    node.prev = this.head;
    node.next = this.head.next;
    this.head.next.prev = node;
    this.head.next = node;
  }

  get(key) {
    if (!this.cacheMap.has(key)) return -1;

    const node = this.cacheMap.get(key);
    this._removeNode(node);
    this._addNodeToHead(node); // Touched! Make it most recent

    return node.value;
  }

  put(key, value) {
    if (this.cacheMap.has(key)) {
      const node = this.cacheMap.get(key);
      node.value = value;
      this._removeNode(node);
      this._addNodeToHead(node);
      return;
    }

    if (this.cacheMap.size >= this.capacity) {
      // The LRU node is the one right before the tail sentinel
      const lruNode = this.tail.prev;
      this._removeNode(lruNode);
      this.cacheMap.delete(lruNode.key);
    }

    const newNode = new Node(key, value);
    this.cacheMap.set(key, newNode);
    this._addNodeToHead(newNode);
  }
}
```

### Test Suite (Jest)
```javascript
describe('LRUCache', () => {
  it('should handle capacity and evictions correctly', () => {
    const cache = new LRUCache(2);
    cache.put(1, 1); // cache is {1=1}
    cache.put(2, 2); // cache is {1=1, 2=2}
    expect(cache.get(1)).toBe(1); // return 1, cache is {2=2, 1=1}

    cache.put(3, 3); // evicts key 2, cache is {1=1, 3=3}
    expect(cache.get(2)).toBe(-1); // returns -1 (not found)

    cache.put(4, 4); // evicts key 1, cache is {4=4, 3=3}
    expect(cache.get(1)).toBe(-1); // returns -1 (not found)
    expect(cache.get(3)).toBe(3); // returns 3
    expect(cache.get(4)).toBe(4); // returns 4
  });
});
```
</details>
