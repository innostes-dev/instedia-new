# Module 03: Side Effects & Async (useEffect Dependencies, Cleanup Leaks, useRef Auto-Focus)

## Phase A: Core Concept

### 1. Real-World Pain Point (The Why)
React’s main job is pure: given state/props, render UI. But what if you need to fetch data from an API, set a `setInterval` for a stopwatch, or manually focus an input element when a modal opens? These actions step *outside* the React rendering cycle. If you put a `fetch` call directly in your component body, it will trigger an infinite loop: Component renders -> fetches data -> sets state -> triggers re-render -> fetches data again. Furthermore, if you set up a WebSocket listener but the user navigates away, the listener keeps running in the background, causing a massive memory leak.

### 2. Plain English Metaphor (The What)
**React rendering is like the chef cooking in the kitchen.** It should be predictable and contained.
**Side Effects (`useEffect`) are like the waiter delivering food or fetching ingredients from outside.** You only want the waiter to act at specific times: when the restaurant opens (mount), when an order changes (update), or when closing up (unmount).
**`useRef` is like having a direct walkie-talkie to a specific table.** It allows you to grab a direct reference to an actual DOM node (or hold a mutable value) without triggering the chef to cook a new meal (no re-renders).

### 3. Complete Runnable Code
```jsx
import React, { useState, useEffect, useRef } from 'react';

export default function SearchWithFocus() {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState([]);
  const inputRef = useRef(null); // Step 1: Create Ref

  // Effect 1: Auto-focus on mount (runs ONCE)
  useEffect(() => {
    inputRef.current.focus(); // Step 2: Use Ref directly on the DOM node
  }, []); // Empty array = mount only

  // Effect 2: Debounced API Simulation (runs when `query` changes)
  useEffect(() => {
    if (query === '') {
      setResults([]);
      return;
    }

    // Step 3: Setup Side Effect
    console.log(`Setting up search for: ${query}`);
    const timer = setTimeout(() => {
      setResults([`${query} - Result 1`, `${query} - Result 2`]);
    }, 500);

    // Step 4: Cleanup function
    return () => {
      console.log(`Cleaning up search for: ${query}`);
      clearTimeout(timer);
    };
  }, [query]); // Dependency Array: Run ONLY when `query` changes

  return (
    <div style={{ padding: '20px' }}>
      <input
        ref={inputRef} // Step 1: Attach Ref
        type="text"
        placeholder="Type to search..."
        value={query}
        onChange={(e) => setQuery(e.target.value)}
      />
      <ul>
        {results.map((r, i) => <li key={i}>{r}</li>)}
      </ul>
    </div>
  );
}
```

### 4. Progressive Step-by-Step Breakdown

**Step 1 & 2: Refs for DOM Access**
We create a ref with `useRef(null)` and attach it to the input via `ref={inputRef}`. Unlike state, changing `inputRef.current` does *not* trigger a re-render. It provides an escape hatch to call raw DOM methods like `.focus()`.

**Step 3: The Dependency Array**
`useEffect` takes a callback and an array of dependencies.
- No array: runs after *every* render.
- `[]`: runs *once* after the initial render (mount).
- `[query]`: runs after the initial render AND whenever `query` changes.

**Step 4: The Cleanup Function**
If `useEffect` returns a function, React runs this function *before* running the effect again, and when the component unmounts. In our example, if the user types "A" then "B" quickly, the cleanup for "A" clears the timeout *before* it can set the state, preventing race conditions (Debouncing).

### 5. ASCII Data Flow
```text
Mount -> Render UI -> Runs useEffect([]) -> inputRef.current.focus()

User types "A" -> setQuery("A") -> Render UI -> Runs useEffect([query])
      -> Sets Timer for "A"

User types "AB" quickly -> setQuery("AB") -> Render UI
      -> Runs Cleanup for "A" (clears Timer A)
      -> Runs useEffect([query])
      -> Sets Timer for "AB"
```

### 6. Noob Trap vs Pro Tip
**Noob Trap:** Lying to React about dependencies. If you use a state variable inside `useEffect` but omit it from the dependency array to "prevent re-runs", you will create stale closures (using old versions of the variable).
**Pro Tip:** If an effect fetches data, always implement a cleanup function with an `AbortController` to cancel the fetch if the user navigates away before the request finishes.

---

## Phase B: Engineering Challenges

### Level 1: Warm-Up
**Task:** Build a `Clock` component. When it mounts, set an interval that updates a `time` state every 1 second. Clean up the interval when unmounting to prevent memory leaks.
<details>
<summary>💡 Hint</summary>
Use `setInterval` inside `useEffect([])`. Return a function that calls `clearInterval`.
</details>

<details>
<summary>✅ Solution</summary>

```jsx
import { useState, useEffect } from 'react';

function Clock() {
  const [time, setTime] = useState(new Date().toLocaleTimeString());

  useEffect(() => {
    const timerId = setInterval(() => {
      setTime(new Date().toLocaleTimeString());
    }, 1000);

    return () => clearInterval(timerId); // Cleanup!
  }, []);

  return <div>Current Time: {time}</div>;
}
```
</details>

### Level 2: Real-World
**Task:** Build a `ClickOutside` detector. Render a dropdown `div`. If the user clicks anywhere *outside* the dropdown, log "Closed!". If they click inside, do nothing.
<details>
<summary>💡 Hint</summary>
Use `useRef` on the dropdown div. Use `useEffect` to attach a `mousedown` listener to `document`. In the listener, check if `dropdownRef.current.contains(event.target)`.
</details>

<details>
<summary>✅ Solution</summary>

```jsx
import { useRef, useEffect, useState } from 'react';

function Dropdown() {
  const [isOpen, setIsOpen] = useState(true);
  const dropdownRef = useRef(null);

  useEffect(() => {
    const handleClickOutside = (e) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target)) {
        setIsOpen(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  if (!isOpen) return <button onClick={() => setIsOpen(true)}>Open</button>;

  return (
    <div ref={dropdownRef} style={{ border: '1px solid black', padding: 20 }}>
      I am a Dropdown! Click outside to close me.
    </div>
  );
}
```
</details>

### Level 3: Boss Level (Cumulative)
**Task:** Build a `UserFetcher` component. It accepts a `userId` prop. When `userId` changes, fetch fake data using `setTimeout`. Handle 3 states: `loading`, `data`, `error`. **Crucially**, implement race-condition prevention: if `userId` changes from 1 to 2 rapidly, ensure the result for 1 is ignored when it resolves.
<details>
<summary>💡 Hint</summary>
Use a local boolean inside `useEffect` (e.g., `let isSubscribed = true`). Return a cleanup function that sets it to `false`. When the async fake fetch resolves, only call `setState` if `isSubscribed` is true.
</details>

<details>
<summary>✅ Solution Walkthrough</summary>

```jsx
import { useState, useEffect } from 'react';

function UserFetcher({ userId }) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    let isSubscribed = true; // Flag to prevent race conditions

    const fetchData = async () => {
      setLoading(true);
      setData(null);

      // Fake API Call taking 1 second
      await new Promise(res => setTimeout(res, 1000));

      if (isSubscribed) {
        setData({ id: userId, name: `User ${userId}` });
        setLoading(false);
      }
    };

    fetchData();

    return () => {
      // Cleanup runs when userId changes or component unmounts
      isSubscribed = false;
    };
  }, [userId]);

  if (loading) return <div>Loading...</div>;
  if (data) return <div>Data: {data.name}</div>;
  return null;
}
```
*Walkthrough:* By using the `isSubscribed` flag, we handle the classic async race condition. If the user rapidly clicks "Fetch User 1" then "Fetch User 2", the first effect is cleaned up (`isSubscribed` becomes false for that closure). When the 1-second timer finishes for User 1, the `if (isSubscribed)` check fails, and `setData` is correctly skipped. Only User 2's data will render.
</details>
