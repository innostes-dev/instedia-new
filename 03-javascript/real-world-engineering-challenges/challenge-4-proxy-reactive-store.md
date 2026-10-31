# Challenge 4: Reactive State Store with Proxy-Based Mutation Tracking

## Problem Statement
In frameworks like Vue 3 or MobX, when you change a variable (`state.user = "Bob"`), the UI updates automatically. How do they know the variable changed?
You need to build a mini "Reactive Store". It holds state, and it allows components to "subscribe". If any property in the state is modified, it must automatically notify all subscribers with the updated state.

Build a `createStore` function that:
1. Takes an `initialState` object.
2. Returns a `Proxy` that intercepts all `set` operations.
3. Provides a `subscribe` method to listen for changes.

---

## The Solution Walkthrough

### 1. The Proxy API
A `Proxy` wraps an object and allows you to "trap" fundamental operations, like reading a property (`get`) or writing to a property (`set`).

```javascript
function createStore(initialState) {
  // Private array of subscriber functions
  const subscribers = new Set();

  // The actual data object
  const rawState = { ...initialState };

  // The Proxy Interceptor
  const proxy = new Proxy(rawState, {

    // The 'set' trap runs EVERY time someone does state.prop = value
    set(target, property, value) {

      // 1. Only trigger an update if the value actually changed!
      if (target[property] !== value) {

        // 2. Perform the actual mutation
        target[property] = value;

        // 3. Notify everyone!
        console.log(`[Store] Mutable detected: ${property} changed to ${value}`);
        for (const callback of subscribers) {
          // Pass a read-only copy of the state
          callback({ ...target });
        }
      }

      // Proxies require the set trap to return true to indicate success
      return true;
    }

  });

  // We attach a hidden subscribe method directly to the proxy!
  // We use Object.defineProperty so it doesn't show up if someone loops over the state keys.
  Object.defineProperty(proxy, "subscribe", {
    value: function(callback) {
      subscribers.add(callback);
      // Run it once immediately with initial state
      callback({ ...rawState });

      // Return an unsubscribe function
      return () => subscribers.delete(callback);
    },
    enumerable: false
  });

  return proxy;
}
```

### 2. Usage & Simulation
```javascript
// 1. Initialize
const store = createStore({ theme: "light", clicks: 0 });

// 2. Subscribe (Simulating a React/Vue Component)
const unsubscribe = store.subscribe((currentState) => {
  console.log(`[UI Render] Theme: ${currentState.theme}, Clicks: ${currentState.clicks}`);
});

// 3. Mutate the state directly! The proxy traps this!
store.clicks = 1;
// Output: [Store] Mutable detected... -> [UI Render] Theme: light, Clicks: 1

store.theme = "dark";
// Output: [Store] Mutable detected... -> [UI Render] Theme: dark, Clicks: 1

// 4. Try mutating with the exact same value
store.theme = "dark";
// Output: (Nothing happens! The proxy optimization caught it).
```

### Senior Engineer Takeaways
- **The Magic of Proxies:** Proxies are the engine of modern frontend reactivity. They eliminate the need for verbose methods like `store.setState({ clicks: 1 })`.
- **Set Trap Optimization:** The `target[property] !== value` check is critical. Without it, setting the same value twice would trigger an unnecessary, expensive UI render.
