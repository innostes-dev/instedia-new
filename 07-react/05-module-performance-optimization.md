# Module 05: Performance Optimization (React.memo, useMemo/useCallback Data Tables, Custom Hooks)

## Phase A: Core Concept

### 1. Real-World Pain Point (The Why)
Imagine a dashboard with a text input at the top and a massive data table (5,000 rows) below it. Every time the user types a letter in the search bar, the state updates, which causes the entire App to re-render. React re-creates all 5,000 table rows on every keystroke. The app feels incredibly sluggish and the input lags. Additionally, complex calculations (like sorting those 5,000 rows) are being re-run on every render, locking up the main thread.

### 2. Plain English Metaphor (The What)
**`React.memo`** is like a bouncer at a club. It checks the VIP list (props). If your props haven't changed since the last time you visited, the bouncer says, "You don't need to go in and get re-rendered, you look the same as before."
**`useMemo`** is like a chef pre-calculating a complex recipe. Instead of chopping 100 onions every time an order comes in, they chop them once, store them in the fridge, and only re-chop if the recipe changes.
**`useCallback`** is a specialized fridge just for functions. In JS, a new function is created on every render. `useCallback` saves the function so it doesn't trigger the `React.memo` bouncer to unnecessarily reject you.

### 3. Complete Runnable Code
```jsx
import React, { useState, useMemo, useCallback, memo } from 'react';

// 1. React.memo: Bouncer for Components
const HeavyTableRow = memo(({ row, onClick }) => {
  console.log(`Rendering Row ${row.id}`);
  return (
    <div onClick={() => onClick(row.id)} style={{ padding: 10, border: '1px solid gray' }}>
      {row.name} - ${row.value}
    </div>
  );
});

export default function PerformanceApp() {
  const [text, setText] = useState('');
  const [sortAsc, setSortAsc] = useState(true);

  // Fake heavy data
  const rawData = useMemo(() => Array.from({ length: 50 }, (_, i) => ({
    id: i, name: `Item ${i}`, value: Math.random() * 100
  })), []);

  // 2. useMemo: Cache heavy calculations
  const sortedData = useMemo(() => {
    console.log("Sorting Data..."); // Only runs when sortAsc changes!
    return [...rawData].sort((a, b) => sortAsc ? a.value - b.value : b.value - a.value);
  }, [rawData, sortAsc]);

  // 3. useCallback: Cache function references
  const handleRowClick = useCallback((id) => {
    console.log(`Clicked ${id}`);
  }, []); // Empty deps because it doesn't depend on any state/props

  return (
    <div>
      <input
        value={text}
        onChange={e => setText(e.target.value)}
        placeholder="Type here without lag!"
      />
      <button onClick={() => setSortAsc(!sortAsc)}>Toggle Sort</button>

      <div>
        {sortedData.map(row => (
          <HeavyTableRow key={row.id} row={row} onClick={handleRowClick} />
        ))}
      </div>
    </div>
  );
}
```

### 4. Progressive Step-by-Step Breakdown

**Step 1: The Bouncer (`React.memo`)**
We wrap `HeavyTableRow` in `memo()`. When `PerformanceApp` re-renders (because user typed in the input), React checks `HeavyTableRow`'s props. If `row` and `onClick` are identical to the last render, React skips rendering the row.

**Step 2: The Data Fridge (`useMemo`)**
Sorting is expensive. We wrap the sort logic in `useMemo`, with `[rawData, sortAsc]` as dependencies. If the user types in the input, `text` changes, the component re-renders, but `sortAsc` hasn't changed. React skips the sorting logic entirely and returns the cached array.

**Step 3: The Function Fridge (`useCallback`)**
Without `useCallback`, `const handleRowClick = () => {}` creates a *brand new function reference* on every keystroke. This new reference gets passed as the `onClick` prop to `HeavyTableRow`. The `React.memo` bouncer sees a new `onClick` prop, assumes things changed, and re-renders the row, defeating the optimization! `useCallback` keeps the function reference stable.

### 5. ASCII Data Flow
```text
State (text) changes -> App Renders -> Checks sortedData (useMemo) -> Cached!
                                  -> Checks handleRowClick (useCallback) -> Cached!
                                  -> Maps Rows -> Checks Row Props (memo) -> Identical!
                                  -> Skips rendering all Rows! (Performance saved)
```

### 6. Noob Trap vs Pro Tip
**Noob Trap:** Wrapping *every* component in `memo` and *every* function in `useCallback`. Caching has a cost! The memory overhead of storing previous values and comparing them often takes longer than just letting React do a simple re-render.
**Pro Tip:** Only optimize when you have a proven performance problem (using React Profiler). If a component renders often with the *exact same props* and is expensive to render, then use `memo` + `useCallback`.

---

## Phase B: Engineering Challenges

### Level 1: Warm-Up
**Task:** Create a `CustomHook` called `useToggle`. It should return a boolean state and a function to toggle it. Use it in a component.
<details>
<summary>💡 Hint</summary>
A custom hook is just a JS function that starts with `use`. It can call standard hooks inside it. Return `[value, toggleFunction]`.
</details>

<details>
<summary>✅ Solution</summary>

```jsx
import { useState } from 'react';

// Custom Hook
function useToggle(initialValue = false) {
  const [value, setValue] = useState(initialValue);
  const toggle = () => setValue(prev => !prev);
  return [value, toggle];
}

function App() {
  const [isOn, toggleIsOn] = useToggle(false);
  return <button onClick={toggleIsOn}>{isOn ? 'ON' : 'OFF'}</button>;
}
```
</details>

### Level 2: Real-World
**Task:** Given a list of users (`{ id, name, age }`), create an input to filter users by name. Use `useMemo` so the filtering logic ONLY runs when the filter text or the user list changes.
<details>
<summary>💡 Hint</summary>
`const filteredUsers = useMemo(() => users.filter(...), [users, filterText])`
</details>

<details>
<summary>✅ Solution</summary>

```jsx
import { useState, useMemo } from 'react';

function UserList({ users }) {
  const [filter, setFilter] = useState('');

  const filteredUsers = useMemo(() => {
    console.log('Calculating filter...');
    return users.filter(u => u.name.toLowerCase().includes(filter.toLowerCase()));
  }, [users, filter]);

  return (
    <div>
      <input value={filter} onChange={e => setFilter(e.target.value)} />
      {filteredUsers.map(u => <div key={u.id}>{u.name}</div>)}
    </div>
  );
}
```
</details>

### Level 3: Boss Level (Cumulative)
**Task:** Build a high-performance `TodoList`. It has a text input for new tasks. It renders a list of `TaskItem` components. Ensure that typing in the input does NOT cause the existing `TaskItem` components to re-render. You will need `memo`, `useCallback`, and careful state management.
<details>
<summary>💡 Hint</summary>
Wrap `TaskItem` in `memo`. The `onDelete` function passed to it must be wrapped in `useCallback`.
</details>

<details>
<summary>✅ Solution Walkthrough</summary>

```jsx
import { useState, useCallback, memo } from 'react';

// 1. Memoize the child component
const TaskItem = memo(({ task, onDelete }) => {
  console.log(`Rendering task: ${task.text}`); // Proof it doesn't re-render on typing
  return (
    <li>
      {task.text}
      <button onClick={() => onDelete(task.id)}>X</button>
    </li>
  );
});

function TodoList() {
  const [tasks, setTasks] = useState([{ id: 1, text: 'Learn useMemo' }]);
  const [input, setInput] = useState('');

  // 2. Stable function reference for the child
  const handleDelete = useCallback((id) => {
    setTasks(prev => prev.filter(t => t.id !== id));
  }, []);

  const handleAdd = () => {
    setTasks(prev => [...prev, { id: Date.now(), text: input }]);
    setInput('');
  };

  return (
    <div>
      <input value={input} onChange={e => setInput(e.target.value)} />
      <button onClick={handleAdd}>Add</button>
      <ul>
        {tasks.map(task => (
          <TaskItem key={task.id} task={task} onDelete={handleDelete} />
        ))}
      </ul>
    </div>
  );
}
```
*Walkthrough:* When you type in the input, `TodoList`'s state changes, causing a re-render. However, because `TaskItem` is wrapped in `memo`, React checks its props. `task` hasn't changed. What about `onDelete`? Because we used `useCallback`, the function reference is identical to the last render. Therefore, React skips rendering the existing `TaskItem`s completely, resulting in perfectly smooth typing performance!
</details>
