# Standard React Challenges

This file contains the overarching, multi-topic challenges designed to test comprehensive React knowledge before moving to the Principal-level Engineering Challenges.

## Challenge 1: Auto-Saving Form Hook
**Goal:** Create a custom hook `useAutoSave` that takes form data and an API function. It should debounce the save action (wait 1 second after the user stops typing) and handle 'saving', 'saved', and 'error' states.

<details>
<summary>✅ Solution Walkthrough</summary>

```jsx
import { useState, useEffect } from 'react';

function useAutoSave(data, saveFunction) {
  const [status, setStatus] = useState('idle'); // idle, saving, saved, error

  useEffect(() => {
    // Don't save on initial mount if data is empty
    if (!data) return;

    setStatus('saving');

    const handler = setTimeout(async () => {
      try {
        await saveFunction(data);
        setStatus('saved');
      } catch (err) {
        setStatus('error');
      }
    }, 1000);

    return () => {
      clearTimeout(handler);
    };
  }, [data, saveFunction]);

  return status;
}

// Usage Example
export function AutoSaveProfile() {
  const [bio, setBio] = useState('');

  const fakeApi = async (data) => {
    return new Promise(res => setTimeout(res, 500));
  };

  const status = useAutoSave(bio, fakeApi);

  return (
    <div>
      <textarea value={bio} onChange={e => setBio(e.target.value)} />
      <p>Status: {status}</p>
    </div>
  );
}
```
*Why this works:* We combine `useEffect` for the side effect, a dependency array to track `data`, and a cleanup function to clear the timeout if the user types again within 1 second. This perfectly encapsulates complex logic into a reusable custom hook.
</details>

## Challenge 2: Infinite Virtualized Social Feed
**Goal:** Render a list of 10,000 posts. Standard rendering would crash the browser. Use a concept called "Virtualization" (only rendering the items currently visible on screen). You don't need a third-party library; build a naive implementation that calculates which items to show based on scroll position.

<details>
<summary>✅ Solution Walkthrough</summary>

```jsx
import { useState, useRef, useMemo } from 'react';

const ITEM_HEIGHT = 50;
const CONTAINER_HEIGHT = 500;
const ITEMS_COUNT = 10000;

export function VirtualizedFeed() {
  const [scrollTop, setScrollTop] = useState(0);

  // Calculate which items are visible
  const startIndex = Math.floor(scrollTop / ITEM_HEIGHT);
  const endIndex = Math.min(
    ITEMS_COUNT - 1,
    Math.ceil((scrollTop + CONTAINER_HEIGHT) / ITEM_HEIGHT)
  );

  const visibleItems = [];
  for (let i = startIndex; i <= endIndex; i++) {
    visibleItems.push(i);
  }

  return (
    <div
      style={{ height: CONTAINER_HEIGHT, overflowY: 'auto', border: '1px solid black' }}
      onScroll={e => setScrollTop(e.currentTarget.scrollTop)}
    >
      {/* The fake "tall" container to enable scrolling */}
      <div style={{ height: ITEMS_COUNT * ITEM_HEIGHT, position: 'relative' }}>

        {/* Only render the visible items, absolutely positioned */}
        {visibleItems.map(index => (
          <div
            key={index}
            style={{
              position: 'absolute',
              top: index * ITEM_HEIGHT,
              height: ITEM_HEIGHT,
              width: '100%',
              borderBottom: '1px solid #ccc',
              padding: '0 10px'
            }}
          >
            Post #{index}
          </div>
        ))}

      </div>
    </div>
  );
}
```
*Why this works:* Instead of creating 10,000 DOM nodes, we create a container that *pretends* to be 500,000px tall. We track the scroll position and calculate exactly which indices should be visible on screen. We only render those 10-15 DOM nodes, positioning them absolutely at the correct Y-offset.
</details>

## Challenge 3: Kanban Task Board with Optimistic UI
**Goal:** Build a Kanban board where moving a task to a new column immediately updates the UI (optimistic), then fires the API call. If the API fails, it rolls the UI back to the previous state.

<details>
<summary>✅ Solution Walkthrough</summary>

```jsx
import { useState } from 'react';

const initialTasks = [
  { id: 1, title: 'Fix bug', status: 'todo' },
  { id: 2, title: 'Write tests', status: 'done' }
];

export function OptimisticKanban() {
  const [tasks, setTasks] = useState(initialTasks);
  const [error, setError] = useState(null);

  const moveTask = async (taskId, newStatus) => {
    // 1. Snapshot previous state for rollback
    const previousTasks = [...tasks];

    // 2. Optimistic Update (Immediate UI response)
    setTasks(prev => prev.map(t => t.id === taskId ? { ...t, status: newStatus } : t));
    setError(null);

    try {
      // 3. Fake API Call (50% chance to fail)
      await new Promise((res, rej) => {
        setTimeout(() => {
          Math.random() > 0.5 ? res() : rej(new Error("API Failed"));
        }, 1000);
      });
    } catch (err) {
      // 4. Rollback on failure
      setTasks(previousTasks);
      setError("Failed to move task. Reverted.");
    }
  };

  return (
    <div>
      {error && <div style={{ color: 'red', marginBottom: 10 }}>{error}</div>}
      <div style={{ display: 'flex', gap: 20 }}>

        {['todo', 'done'].map(status => (
          <div key={status} style={{ border: '1px solid black', padding: 10, width: 200 }}>
            <h3>{status.toUpperCase()}</h3>

            {tasks.filter(t => t.status === status).map(task => (
              <div key={task.id} style={{ padding: 10, border: '1px solid gray', margin: '5px 0' }}>
                {task.title}
                {status === 'todo' && (
                  <button onClick={() => moveTask(task.id, 'done')}>Complete</button>
                )}
                {status === 'done' && (
                  <button onClick={() => moveTask(task.id, 'todo')}>Revert</button>
                )}
              </div>
            ))}

          </div>
        ))}

      </div>
    </div>
  );
}
```
*Why this works:* Modern users expect instantaneous feedback. By updating React state *before* the API call finishes, the app feels incredibly fast. Saving the `previousTasks` array gives us a safety net. If the `try/catch` catches an error from the API, we simply restore the old state, ensuring the UI and Server remain perfectly in sync.
</details>
