# Challenge 1: Type-Safe Event Emitter

## Scenario
You are building the core event bus for a large micro-frontend application. Different teams will use this event bus to communicate. You need to ensure that when a team emits a `"USER_LOGIN"` event, they absolutely must provide the correct payload (`{ userId: string, timestamp: number }`).
If they just use a standard JS event emitter, they could send wrong payloads, causing other micro-frontends to crash.

## Challenge Requirements
1. Create a `EventMap` type mapping event names (strings) to their payload definitions.
    - `"USER_LOGIN"` -> `{ userId: string; timestamp: number }`
    - `"DATA_SYNC"` -> `{ recordsProcessed: number; success: boolean }`
    - `"UI_THEME_CHANGE"` -> `"light" | "dark"`
2. Create a generic `TypedEventEmitter<T>` class.
3. It must have an `on` method: `on(eventName, callback)`. The `eventName` must be a valid key of the `EventMap`. The `callback` must receive the exact payload type for that specific event.
4. It must have an `emit` method: `emit(eventName, payload)`. The payload must strictly match the event type.

<details>
<summary>Solution Walkthrough</summary>

```typescript
// 1. The Single Source of Truth for all events in the system
type AppEventMap = {
  USER_LOGIN: { userId: string; timestamp: number };
  DATA_SYNC: { recordsProcessed: number; success: boolean };
  UI_THEME_CHANGE: "light" | "dark";
};

// 2. The Generic Class. We constrain `T` to be an object map of strings to anything.
class TypedEventEmitter<T extends Record<string, any>> {
  // Internal storage: A map of event names to an array of callback functions
  // We use `any` internally for the callbacks array because managing perfectly
  // heterogenous arrays in TS classes requires complex tuple manipulations,
  // but our public API (on/emit) will be strictly typed!
  private listeners: Record<keyof T, Function[]> = {} as any;

  // 3. The `on` method.
  // K is constrained to be a key of the map (e.g., "USER_LOGIN").
  // The callback takes exactly the payload defined for that key: T[K]
  on<K extends keyof T>(eventName: K, callback: (payload: T[K]) => void): void {
    if (!this.listeners[eventName]) {
      this.listeners[eventName] = [];
    }
    this.listeners[eventName].push(callback);
  }

  // 4. The `emit` method.
  // Same generic constraint. The payload MUST match T[K].
  emit<K extends keyof T>(eventName: K, payload: T[K]): void {
    const eventListeners = this.listeners[eventName];
    if (eventListeners) {
      eventListeners.forEach(cb => cb(payload));
    }
  }
}

// --- Usage & Testing ---

const bus = new TypedEventEmitter<AppEventMap>();

// OK: TS knows payload is { userId: string, timestamp: number }
bus.on("USER_LOGIN", (payload) => {
  console.log(`User ${payload.userId} logged in at ${payload.timestamp}`);
});

// ERROR: payload should be "light" | "dark"
// bus.emit("UI_THEME_CHANGE", "neon");

// ERROR: missing timestamp in payload
// bus.emit("USER_LOGIN", { userId: "abc" });

// OK
bus.emit("DATA_SYNC", { recordsProcessed: 100, success: true });
```

**Walkthrough:**
This pattern is ubiquitous in advanced TS codebases (Node.js backend, Redux, custom DOM libraries). By linking the `eventName` string directly to the payload type using `<K extends keyof T>` and `T[K]`, we create an unbreakable contract between the sender and receiver of the event.
</details>
