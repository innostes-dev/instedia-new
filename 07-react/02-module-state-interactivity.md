# Module 02: State & Interactivity (useState, Immutability Zomato Cart, Unique Keys, Slack Status)

## Phase A: Core Concept

### 1. Real-World Pain Point (The Why)
Imagine a food delivery app cart (like Zomato or UberEats). A user clicks "+1" on a burger. If we mutate data directly (`cart.total = cart.total + 15`), React doesn't know the data changed! The UI stays stale. Even worse, if you try to render a list of 50 restaurants and they don't have unique identifiers, when you re-order them, React gets confused, tearing down DOM nodes unnecessarily, causing massive lag and lost input focus.

### 2. Plain English Metaphor (The What)
**State** is the "memory" of a component. It's the data that changes over time (like a Slack user's status).
**Immutability** is like taking a photograph. You can't change the people in a printed photo. If you want a new photo with someone wearing a hat, you have to take a *completely new* photograph. In React, you don't modify existing state objects/arrays; you create *new* ones with the updated data.

### 3. Complete Runnable Code
```jsx
import React, { useState } from 'react';

export default function ZomatoCart() {
  const [items, setItems] = useState([
    { id: 1, name: 'Truffle Burger', price: 15, qty: 1 },
    { id: 2, name: 'Fries', price: 5, qty: 1 }
  ]);

  const updateQuantity = (id, delta) => {
    // IMMUTABILITY: Create a new array, and new objects inside
    setItems(prevItems =>
      prevItems.map(item =>
        item.id === id
          ? { ...item, qty: Math.max(0, item.qty + delta) }
          : item
      )
    );
  };

  return (
    <div className="cart">
      <h2>Your Order</h2>
      <ul>
        {items.map(item => (
          <li key={item.id}>  {/* UNIQUE KEY! */}
            {item.name} - ${item.price} x {item.qty}
            <button onClick={() => updateQuantity(item.id, 1)}>+</button>
            <button onClick={() => updateQuantity(item.id, -1)}>-</button>
          </li>
        ))}
      </ul>
      <h3>Total: ${items.reduce((sum, item) => sum + (item.price * item.qty), 0)}</h3>
    </div>
  );
}
```

### 4. Progressive Step-by-Step Breakdown

**Step 1: useState Hook**
`const [items, setItems] = useState(initialData)`. The hook returns an array with two elements: the current state value (`items`), and a function to update it (`setItems`). When you call `setItems`, you trigger a re-render of the component.

**Step 2: Immutability in Updates**
Notice inside `updateQuantity`, we do NOT do `item.qty += delta`. We map over the array. If the ID matches, we use the spread operator (`...item`) to create a *brand new object* with the updated `qty`. React compares the old array reference with the new array reference, sees they are different, and triggers the re-render.

**Step 3: Unique Keys (`key={item.id}`)**
When mapping arrays to JSX, React needs a stable, unique `key` prop on the top-level element. This helps React's "Reconciliation" algorithm efficiently identify which items have changed, been added, or been removed, rather than destroying and recreating the entire list.

### 5. ASCII Data Flow
```text
User Clicks '+'  -> Calls updateQuantity(1, 1)
                        |
                        v
                 setItems(newArray)
                        |
                        v
                React Detects State Change
                        |
                        v
                Component Re-renders with New State
```

### 6. Noob Trap vs Pro Tip
**Noob Trap:** Using array index as a `key` (`key={index}`). If the list order changes (e.g., sorting, deleting), React matches the wrong state to the wrong UI element, causing catastrophic bugs.
**Pro Tip:** Always use unique database IDs for keys. For state updates based on previous state (like counters), always use the updater function syntax: `setCount(prev => prev + 1)` instead of `setCount(count + 1)` to avoid race conditions.

---

## Phase B: Engineering Challenges

### Level 1: Warm-Up
**Task:** Build a `SlackStatus` component. It should have a `status` state (default "Active"). Provide three buttons: "Active", "Away", "Do Not Disturb". Clicking a button updates the state and displays the current status.
<details>
<summary>💡 Hint</summary>
Use `useState('Active')`. Create an inline `onClick` handler for each button that calls the setter function.
</details>

<details>
<summary>✅ Solution</summary>

```jsx
import { useState } from 'react';

function SlackStatus() {
  const [status, setStatus] = useState('Active');

  return (
    <div>
      <h3>Current Status: {status}</h3>
      <button onClick={() => setStatus('Active')}>🟢 Active</button>
      <button onClick={() => setStatus('Away')}>🟡 Away</button>
      <button onClick={() => setStatus('Do Not Disturb')}>🔴 DND</button>
    </div>
  );
}
```
</details>

### Level 2: Real-World
**Task:** Build a `TagEditor`. Start with an array of tags: `['react', 'javascript']`. Provide an input and an "Add" button. Typing in the input updates a separate local state. Clicking "Add" adds the tag to the array IMMUTABLY, and clears the input.
<details>
<summary>💡 Hint</summary>
You need two states: `tags` (array) and `inputValue` (string). To add immutably: `setTags([...tags, inputValue])`.
</details>

<details>
<summary>✅ Solution</summary>

```jsx
import { useState } from 'react';

function TagEditor() {
  const [tags, setTags] = useState(['react', 'javascript']);
  const [input, setInput] = useState('');

  const addTag = () => {
    if (input.trim() === '') return;
    setTags([...tags, input]);
    setInput('');
  };

  return (
    <div>
      <div>
        {tags.map((tag, i) => <span key={i} style={{marginRight: 8}}>#{tag}</span>)}
      </div>
      <input value={input} onChange={e => setInput(e.target.value)} />
      <button onClick={addTag}>Add Tag</button>
    </div>
  );
}
```
*(Note: Using index as key here is okay ONLY if we never delete or reorder tags. Otherwise, generate a unique ID).*
</details>

### Level 3: Boss Level (Cumulative)
**Task:** Build a `TodoKanban` board. Start with an array of tasks with `{ id, title, column: 'todo' | 'done' }`. Render two columns. In each task, add a button to move it to the other column. Update the state immutably based on ID.
<details>
<summary>💡 Hint</summary>
Use `map` to render the lists. When moving, `map` over the main array, find the task by ID, and return a new object with the toggled `column` value.
</details>

<details>
<summary>✅ Solution Walkthrough</summary>

```jsx
import { useState } from 'react';

function TodoKanban() {
  const [tasks, setTasks] = useState([
    { id: 1, title: 'Learn State', column: 'done' },
    { id: 2, title: 'Master Immutability', column: 'todo' }
  ]);

  const toggleColumn = (id) => {
    setTasks(prevTasks => prevTasks.map(task => {
      if (task.id === id) {
        return { ...task, column: task.column === 'todo' ? 'done' : 'todo' };
      }
      return task;
    }));
  };

  const renderColumn = (colName) => (
    <div style={{ flex: 1, border: '1px solid #ccc', padding: 16 }}>
      <h2>{colName.toUpperCase()}</h2>
      {tasks.filter(t => t.column === colName).map(task => (
        <div key={task.id} style={{ padding: 8, border: '1px solid black', margin: '4px 0' }}>
          {task.title}
          <button onClick={() => toggleColumn(task.id)}>Move</button>
        </div>
      ))}
    </div>
  );

  return (
    <div style={{ display: 'flex', gap: 16 }}>
      {renderColumn('todo')}
      {renderColumn('done')}
    </div>
  );
}
```
*Walkthrough:* We manage a single source of truth (`tasks` array). We derive the UI for the two columns by filtering that main array. When we click "Move", we trigger `toggleColumn`, which immutably updates the specific task's `column` property. React recalculates the filters automatically on the next render, and the task seamlessly "moves" from one UI column to the other.
</details>
