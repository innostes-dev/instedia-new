# Module 04: Forms & Architecture (Controlled Inputs, Context API Prop Drilling, useReducer State Machine)

## Phase A: Core Concept

### 1. Real-World Pain Point (The Why)
Forms in standard HTML manage their own internal state. But React wants to be the "Single Source of Truth." If the DOM and React disagree on what is typed in an input, you get bugs.
Furthermore, as apps grow, passing user settings (like dark mode) from the `App` component down through 6 layers of nested components is tedious ("Prop Drilling").
Finally, when a component has multiple related states (e.g., `loading`, `error`, `data`), managing them with multiple `useState` calls leads to impossible states (e.g., `loading: true` AND `error: true` at the same time).

### 2. Plain English Metaphor (The What)
**Controlled Inputs:** Think of a ventriloquist and a dummy. The React State is the ventriloquist, the input field is the dummy. The dummy only says exactly what the ventriloquist makes it say.
**Context API:** Instead of handing a bucket of water (props) down a line of 10 people to reach a fire, Context is like installing a sprinkler system. Anyone in the building can tap into the water directly.
**useReducer (State Machine):** Instead of keeping track of every individual car part (useState), you have a dashboard with a steering wheel and pedals. You send "actions" (press brake), and the engine (reducer) calculates exactly how to update all the parts at once to achieve the new state.

### 3. Complete Runnable Code
```jsx
import React, { useReducer, createContext, useContext } from 'react';

// 1. Context Setup
const ThemeContext = createContext('light');

// 2. Reducer Setup
const initialState = { status: 'idle', user: null, error: null };
function authReducer(state, action) {
  switch (action.type) {
    case 'LOGIN_START':
      return { status: 'loading', user: null, error: null };
    case 'LOGIN_SUCCESS':
      return { status: 'success', user: action.payload, error: null };
    case 'LOGIN_FAIL':
      return { status: 'error', user: null, error: action.payload };
    default:
      return state;
  }
}

function LoginForm() {
  const theme = useContext(ThemeContext); // Tap into Context
  const [state, dispatch] = useReducer(authReducer, initialState);
  const [username, setUsername] = React.useState(''); // Controlled Input

  const handleSubmit = (e) => {
    e.preventDefault();
    dispatch({ type: 'LOGIN_START' });

    setTimeout(() => {
      if (username === 'admin') dispatch({ type: 'LOGIN_SUCCESS', payload: 'Admin User' });
      else dispatch({ type: 'LOGIN_FAIL', payload: 'Invalid user' });
    }, 1000);
  };

  return (
    <div style={{ background: theme === 'dark' ? '#333' : '#fff', padding: 20 }}>
      <form onSubmit={handleSubmit}>
        <input
          value={username}
          onChange={(e) => setUsername(e.target.value)}
          placeholder="Username (try 'admin')"
        />
        <button type="submit" disabled={state.status === 'loading'}>
          {state.status === 'loading' ? 'Loading...' : 'Login'}
        </button>
      </form>
      {state.status === 'error' && <p style={{color: 'red'}}>{state.error}</p>}
      {state.status === 'success' && <p style={{color: 'green'}}>Welcome, {state.user}</p>}
    </div>
  );
}

export default function App() {
  return (
    <ThemeContext.Provider value="dark">
      <LoginForm />
    </ThemeContext.Provider>
  );
}
```

### 4. Progressive Step-by-Step Breakdown

**Step 1: Controlled Inputs**
We bind the input `value` to React state (`value={username}`) and update that state on change (`onChange={e => setUsername(e.target.value)}`). React is now the sole dictator of what appears in the input.

**Step 2: Context API**
`createContext()` creates the Context. `ThemeContext.Provider` wraps the app and provides the `value`. Any deeply nested component can use `useContext(ThemeContext)` to read the value instantly without prop drilling.

**Step 3: useReducer**
We define an `initialState` and a `reducer` function. The reducer takes current state and an `action` object, and returns the *next* state. We call `dispatch({ type: '...' })` to trigger state transitions. This guarantees predictable state (e.g., when loading starts, error and user are strictly cleared).

### 5. ASCII Data Flow
```text
[ Theme Provider ] ------------> (Context Tunnel) ----> [ LoginForm ]
                                                              |
User Types -> onChange -> setUsername(state) -> Controlled Input Updates
User Clicks Submit -> dispatch(LOGIN_START)
                           |
                           v
                     authReducer calculates new state
                           |
                           v
                   Component Re-renders as 'loading'
```

### 6. Noob Trap vs Pro Tip
**Noob Trap:** Using Context for high-frequency state changes (like mouse position or typing). Changing Context forces a re-render of *every* component consuming that context, destroying performance.
**Pro Tip:** Use `useReducer` for complex forms or state machines. It isolates business logic from UI logic, making your components cleaner and completely testable in isolation (a reducer is just a pure JS function!).

---

## Phase B: Engineering Challenges

### Level 1: Warm-Up
**Task:** Create a controlled checkbox component. It should display "Checked!" when checked, and "Unchecked!" when not.
<details>
<summary>💡 Hint</summary>
Use `useState(false)`. Bind `checked={state}` and `onChange={e => setState(e.target.checked)}`.
</details>

<details>
<summary>✅ Solution</summary>

```jsx
import { useState } from 'react';

function ControlledCheckbox() {
  const [isChecked, setIsChecked] = useState(false);

  return (
    <div>
      <label>
        <input
          type="checkbox"
          checked={isChecked}
          onChange={(e) => setIsChecked(e.target.checked)}
        />
        {isChecked ? 'Checked!' : 'Unchecked!'}
      </label>
    </div>
  );
}
```
</details>

### Level 2: Real-World
**Task:** Build a user authentication Context. Create an `AuthProvider` that holds `user` state (default null) and a `login` function. Build a `Navbar` component that consumes the context and displays "Hello, [User]" or a Login button.
<details>
<summary>💡 Hint</summary>
Create `AuthContext`. The Provider value should be `{ user, login }`. In Navbar, `const { user, login } = useContext(AuthContext)`.
</details>

<details>
<summary>✅ Solution</summary>

```jsx
import { useState, createContext, useContext } from 'react';

const AuthContext = createContext();

function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const login = () => setUser({ name: 'Jules' });

  return (
    <AuthContext.Provider value={{ user, login }}>
      {children}
    </AuthContext.Provider>
  );
}

function Navbar() {
  const { user, login } = useContext(AuthContext);
  return (
    <nav>
      {user ? <span>Hello, {user.name}</span> : <button onClick={login}>Login</button>}
    </nav>
  );
}

// Usage: <AuthProvider><Navbar /></AuthProvider>
```
</details>

### Level 3: Boss Level (Cumulative)
**Task:** Build a multi-step wizard form using `useReducer`.
Steps: 1 (Name), 2 (Email), 3 (Review).
Actions: `NEXT_STEP`, `PREV_STEP`, `UPDATE_FIELD`.
The Next button should be disabled if the current field is empty.
<details>
<summary>💡 Hint</summary>
State should be `{ step: 1, name: '', email: '' }`. `UPDATE_FIELD` should take `payload: { field: 'name', value: 'foo' }`.
</details>

<details>
<summary>✅ Solution Walkthrough</summary>

```jsx
import { useReducer } from 'react';

const initialState = { step: 1, name: '', email: '' };

function formReducer(state, action) {
  switch (action.type) {
    case 'NEXT_STEP':
      return { ...state, step: state.step + 1 };
    case 'PREV_STEP':
      return { ...state, step: state.step - 1 };
    case 'UPDATE_FIELD':
      return { ...state, [action.payload.field]: action.payload.value };
    default:
      return state;
  }
}

function Wizard() {
  const [state, dispatch] = useReducer(formReducer, initialState);

  const handleUpdate = (field, value) => {
    dispatch({ type: 'UPDATE_FIELD', payload: { field, value } });
  };

  const isNextDisabled = () => {
    if (state.step === 1) return !state.name;
    if (state.step === 2) return !state.email;
    return false;
  };

  return (
    <div style={{ border: '1px solid black', padding: 20 }}>
      <h3>Step {state.step} of 3</h3>

      {state.step === 1 && (
        <input
          value={state.name}
          onChange={e => handleUpdate('name', e.target.value)}
          placeholder="Name"
        />
      )}

      {state.step === 2 && (
        <input
          value={state.email}
          onChange={e => handleUpdate('email', e.target.value)}
          placeholder="Email"
        />
      )}

      {state.step === 3 && (
        <div>
          <p>Name: {state.name}</p>
          <p>Email: {state.email}</p>
          <p>All looks good?</p>
        </div>
      )}

      <div style={{ marginTop: 20 }}>
        {state.step > 1 && (
          <button onClick={() => dispatch({ type: 'PREV_STEP' })}>Back</button>
        )}
        {state.step < 3 ? (
          <button disabled={isNextDisabled()} onClick={() => dispatch({ type: 'NEXT_STEP' })}>Next</button>
        ) : (
          <button onClick={() => alert('Submitted!')}>Submit</button>
        )}
      </div>
    </div>
  );
}
```
*Walkthrough:* We consolidated a complex UI state (step tracker + multiple form fields) into a single reducer. The component UI just maps the current `state.step` to display logic. When a user types, it dispatches a generic `UPDATE_FIELD` action. The logic for moving forward/backward is completely managed by the pure reducer function.
</details>
