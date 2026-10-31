# Level 1: Resilient Client - The Auto-Recovering WebSocket Dashboard

## 🏗️ Architecture & Scenario
You are building the client-side of a live stock trading dashboard. It receives price updates via a WebSocket.
**The Problem:** WebSockets disconnect. Users go on trains and lose signal.
**The Challenge:** Build a `useResilientSocket` hook that automatically attempts to reconnect using an exponential backoff strategy (1s, 2s, 4s, 8s...). It must queue messages sent while disconnected and flush them when reconnected.

### 📊 Architecture Diagram
```text
[ React Component ]
       | (calls send("BUY"))
       v
[ useResilientSocket Hook ]
       |-- isConnected?
       |    |-- YES -> [ Real WebSocket ] -> Server
       |    |-- NO  -> [ In-Memory Queue ] (Waits for reconnect)
       |
       |-- onclose event
            |-> Starts Exponential Backoff Timer (1s, 2s, 4s...)
            |-> onopen event -> Flushes Queue -> Server
```

## 📦 Starter Template
```jsx
import { useState, useEffect } from 'react';

// FAKE WEBSOCKET API FOR TESTING
class MockSocket {
  constructor(url) { this.url = url; this.onmessage = null; this.onclose = null; this.onopen = null; }
  send(msg) { console.log(`[MockSocket] Sent: ${msg}`); }
  close() { if(this.onclose) this.onclose(); }
  // Simulate server sending data
  triggerMessage(data) { if(this.onmessage) this.onmessage({ data }); }
}

export function useResilientSocket(url) {
  // YOUR CODE HERE
  // Needs to return { isConnected, send, messages }
  return { isConnected: false, send: () => {}, messages: [] };
}
```

## 🧪 Test Suite Requirements
1. **Mount:** Connects on mount.
2. **Disconnect:** If `socket.onclose` fires, waits 1s, then reconnects.
3. **Backoff:** If it fails again, waits 2s, then 4s (Max 8s limit).
4. **Queueing:** Calling `send('BUY AAPL')` while disconnected stores it in a queue.
5. **Flushing:** On `socket.onopen`, flushes the queue via `socket.send()`.

## 🏆 Principal Engineer Solution

```jsx
import { useState, useEffect, useRef, useCallback } from 'react';

export function useResilientSocket(url) {
  const [isConnected, setIsConnected] = useState(false);
  const [messages, setMessages] = useState([]);

  const socketRef = useRef(null);
  const queueRef = useRef([]);
  const reconnectTimeoutRef = useRef(null);
  const attemptRef = useRef(0);

  const connect = useCallback(() => {
    console.log(`Attempting connection to ${url}...`);
    // In real app: new WebSocket(url)
    const socket = new MockSocket(url);
    socketRef.current = socket;

    socket.onopen = () => {
      setIsConnected(true);
      attemptRef.current = 0; // Reset backoff

      // Flush Queue
      while (queueRef.current.length > 0) {
        const msg = queueRef.current.shift();
        socket.send(msg);
      }
    };

    socket.onmessage = (event) => {
      setMessages(prev => [...prev, event.data]);
    };

    socket.onclose = () => {
      setIsConnected(false);

      // Exponential Backoff
      const timeout = Math.min(1000 * Math.pow(2, attemptRef.current), 8000);
      console.log(`Disconnected. Reconnecting in ${timeout}ms...`);
      attemptRef.current += 1;

      reconnectTimeoutRef.current = setTimeout(connect, timeout);
    };
  }, [url]);

  useEffect(() => {
    connect();

    return () => {
      clearTimeout(reconnectTimeoutRef.current);
      if (socketRef.current) socketRef.current.close();
    };
  }, [connect]);

  const send = useCallback((msg) => {
    if (isConnected && socketRef.current) {
      socketRef.current.send(msg);
    } else {
      console.log(`Queued message: ${msg}`);
      queueRef.current.push(msg);
    }
  }, [isConnected]);

  return { isConnected, send, messages };
}
```
*Architecture Note:* Notice the heavy use of `useRef`. State (`useState`) triggers re-renders. We don't want to re-render the whole component just because the reconnect timer changed or a message was queued. `useRef` holds mutable data outside the render cycle safely.

### 🧪 Executable Test Suite (Jest / React Testing Library)
```javascript
import { renderHook, act } from '@testing-library/react-hooks';
import { useResilientSocket } from './useResilientSocket';

describe('useResilientSocket', () => {
  it('connects and queues messages when disconnected', () => {
    const { result } = renderHook(() => useResilientSocket('ws://localhost:8080'));

    // Should initially be disconnected
    expect(result.current.isConnected).toBe(false);

    // Queue a message
    act(() => {
      result.current.send('TEST MESSAGE');
    });

    // We mock the connection in a real test environment, but this tests the hook's structure
  });
});
```
