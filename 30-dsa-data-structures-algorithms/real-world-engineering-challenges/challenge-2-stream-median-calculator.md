# Challenge 2: Stream Median Calculator

## 1. The Real-World Engineering Problem
You are architecting a real-time financial monitoring system. A stream of stock prices (integers) arrives every millisecond. You must provide an API endpoint that instantly returns the **median** price of all numbers seen so far.
Because the data volume is massive, sorting the dataset upon every request (`O(N log N)`) is unacceptable. Your insertion operation must run in `O(log N)` time, and finding the median must run in `O(1)` time.

## 2. Architecture Diagram (Dual-Heap)
```text
Stream: [41, 35, 62, 5, 97, 108]

Max-Heap (Lowers)      Min-Heap (Uppers)
      41                     62
     /  \                   /  \
   35    5                97   108

Rules:
1. Max(Lowers) MUST be <= Min(Uppers)
2. Size(Lowers) === Size(Uppers) OR Size(Lowers) === Size(Uppers) + 1

Median: (41 + 62) / 2 = 51.5 (if sizes equal)
Median: 41 (if Lowers is larger)
```

## 3. Starter Template
```javascript
// starter-template.js

// Assuming a generic PriorityQueue class exists for the environment
class PriorityQueue {
  constructor(comparator) { /* ... */ }
  push(val) { /* ... */ }
  pop() { /* ... */ }
  peek() { /* ... */ }
  size() { /* ... */ }
}

class MedianFinder {
  constructor() {
    // TODO: Initialize your two heaps
  }

  /**
   * @param {number} num
   * @return {void}
   */
  addNum(num) {
    // TODO: Add to heap, balance values, balance sizes
  }

  /**
   * @return {number}
   */
  findMedian() {
    // TODO: Return O(1) median based on sizes
    return 0;
  }
}
```

## 4. Production Walkthrough (Full Solution)

<details>
<summary>✅ View Full Production Solution & Tests</summary>

### The Dual-Heap Solution
We use a Max-Heap to guard the lower half, and a Min-Heap to guard the upper half. The median is always trapped exactly between the roots of the two heaps.

```javascript
// Since JS doesn't have a native heap, we mock the required behavior.
// In a real Node.js production environment, you would use a package like 'datastructures-js/priority-queue'
const { MaxPriorityQueue, MinPriorityQueue } = require('@datastructures-js/priority-queue');

class MedianFinder {
  constructor() {
    this.lowers = new MaxPriorityQueue();
    this.uppers = new MinPriorityQueue();
  }

  addNum(num) {
    // 1. Always push to lowers first
    this.lowers.enqueue(num);

    // 2. Validate Values: Is the biggest lower actually an upper?
    if (!this.uppers.isEmpty() && this.lowers.front().element > this.uppers.front().element) {
      this.uppers.enqueue(this.lowers.dequeue().element);
    }

    // 3. Balance Sizes
    if (this.lowers.size() > this.uppers.size() + 1) {
      this.uppers.enqueue(this.lowers.dequeue().element);
    } else if (this.uppers.size() > this.lowers.size()) {
      this.lowers.enqueue(this.uppers.dequeue().element);
    }
  }

  findMedian() {
    if (this.lowers.size() > this.uppers.size()) {
      return this.lowers.front().element;
    }
    return (this.lowers.front().element + this.uppers.front().element) / 2.0;
  }
}
```

### Test Suite (Jest)
```javascript
describe('MedianFinder', () => {
  it('should calculate rolling median correctly', () => {
    const stream = new MedianFinder();

    stream.addNum(1);
    expect(stream.findMedian()).toBe(1);

    stream.addNum(2);
    expect(stream.findMedian()).toBe(1.5);

    stream.addNum(3);
    expect(stream.findMedian()).toBe(2);

    stream.addNum(100);
    expect(stream.findMedian()).toBe(2.5); // [1,2] [3,100] -> (2+3)/2
  });
});
```
</details>
