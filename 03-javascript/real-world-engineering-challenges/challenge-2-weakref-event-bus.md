# Challenge 2: High-Performance Event Bus with WeakRef Garbage Collection

## Problem Statement
In massive Single Page Applications (like Figma or Spotify), components need to talk to each other without being directly connected. You decide to build a central `EventBus`.
However, if an Event Bus holds a hard reference to a callback function inside a UI Component, and that UI Component is destroyed (removed from the DOM), the JavaScript Garbage Collector CANNOT delete it because the Event Bus is still holding onto it! This is the #1 cause of Memory Leaks in JS.

Build a `class EventBus` that:
1. Allows components to `.on(eventName, callback)`.
2. Allows components to `.emit(eventName, data)`.
3. Uses `WeakRef` to store the callbacks, so if the component dies, the Garbage Collector can clean up the callback, and the EventBus will safely ignore it.

---

## The Solution Walkthrough

### 1. The Class Blueprint & Storage
We use a `Map` where the key is the event name (String), and the value is a `Set` of `WeakRef` objects.

```javascript
class EventBus {
  constructor() {
    this.events = new Map();
  }

  // 1. Subscribe
  on(eventName, callback) {
    if (!this.events.has(eventName)) {
      this.events.set(eventName, new Set());
    }

    // Wrap the callback in a WeakRef.
    // This tells JS: "Don't keep this function alive just for me."
    const weakRef = new WeakRef(callback);
    this.events.get(eventName).add(weakRef);
  }

  // 2. Publish
  emit(eventName, data) {
    const subscribers = this.events.get(eventName);
    if (!subscribers) return;

    for (const weakRef of subscribers) {
      // We must 'deref()' to attempt to get the actual function back
      const callback = weakRef.deref();

      if (callback) {
        // The function still exists in memory! Execute it.
        callback(data);
      } else {
        // The function was Garbage Collected.
        // Clean up our Set to prevent the Set itself from growing infinitely.
        subscribers.delete(weakRef);
      }
    }
  }
}
```

### 2. Usage & Simulation
Simulating Garbage Collection is tricky in JS because it's non-deterministic, but we can structure the code to allow it.

```javascript
const bus = new EventBus();

// Create an isolated scope for our "UI Component"
{
  // This object represents a component that will soon be deleted
  let temporaryComponent = {
    id: "ChatWidget",
    handleMessage: function(msg) {
      console.log(`[${this.id}] Received: ${msg}`);
    }
  };

  // We bind the function to the component so 'this' works correctly,
  // and attach it to the bus.
  bus.on("NEW_MESSAGE", temporaryComponent.handleMessage.bind(temporaryComponent));

  bus.emit("NEW_MESSAGE", "Hello World!"); // Works!

  // User navigates away. The component is destroyed.
  temporaryComponent = null;
}

// In a real browser, after a few seconds, the Garbage Collector will run.
// When we emit now, the bus will do weakRef.deref(), see it's undefined,
// and silently clean up the dead reference without crashing!
bus.emit("NEW_MESSAGE", "Are you still there?");
```

### Senior Engineer Takeaways
- **WeakRef (ES2021):** A powerful tool for caches and Event Buses. It observes an object without preventing its deletion.
- **Self-Healing Data Structures:** When `deref()` returns undefined, the `emit` function actively cleans its own `Set`, preventing the Event Bus from growing to a 1GB memory footprint over a 10-hour user session.
