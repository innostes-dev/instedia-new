# Level 3: Render Optimization - The Profiler Nightmare

## 🏗️ Architecture & Scenario
You have a dashboard with a `GlobalContext` that stores `userProfile`, `theme`, and `activeTab`.
Whenever `activeTab` changes, the ENTIRE dashboard re-renders, including a massive `Chart` component that takes 500ms to render.
**The Challenge:** Refactor the architecture so that changing `activeTab` does not re-render the `Chart` component, while keeping `theme` and `userProfile` accessible globally.

### 📊 Architecture Diagram
```text
(BEFORE)
[ GlobalContext (theme, user, tab) ]
       |
       |-- [ TabControls ] (updates tab, triggers re-render of ALL consumers)
       |-- [ ExpensiveChart ] (consumes context, re-renders unnecessarily)

(AFTER: Context Splitting)
[ ThemeUserContext ]          [ TabContext ]
       |                             |
       |-- [ ExpensiveChart ]        |-- [ TabControls ] (updates TabContext)
           (Memoized, ignores        (Only triggers TabContext consumers)
            TabContext changes)
```

## 📦 Starter Template
```jsx
import React, { createContext, useContext, useState, memo } from 'react';

// BAD ARCHITECTURE: All state in one context
const GlobalContext = createContext();

export function BadAppProviders({ children }) {
  const [theme, setTheme] = useState('light');
  const [user, setUser] = useState({ name: 'Admin' });
  const [activeTab, setActiveTab] = useState('dashboard');

  return (
    <GlobalContext.Provider value={{ theme, user, setTheme, activeTab, setActiveTab }}>
      {children}
    </GlobalContext.Provider>
  );
}

// YOUR TASK: Refactor into separate contexts and optimize the Chart
export function RefactoredAppProviders({ children }) {
  return <>{children}</>;
}
```

## 🧪 Test Suite Requirements
1. **Separation of Concerns:** `TabContext` and `ThemeUserContext` should be distinct.
2. **Chart Memoization:** The `ExpensiveChart` component must use `React.memo` and only consume `ThemeUserContext`.
3. **Re-render Prevention:** Changing the active tab in `TabControls` MUST NOT trigger a re-render of `ExpensiveChart`.

## 🏆 Principal Engineer Solution

**The Root Cause:** When context value changes, EVERY component that calls `useContext(GlobalContext)` re-renders.

**Solution:** Context Splitting and Memoization.

```jsx
import React, { createContext, useContext, useState, memo } from 'react';

// 1. SPLIT CONTEXTS
const ThemeUserContext = createContext();
const TabContext = createContext();

// 2. PROVIDERS
export function AppProviders({ children }) {
  const [theme, setTheme] = useState('light');
  const [user, setUser] = useState({ name: 'Admin' });
  const [activeTab, setActiveTab] = useState('dashboard');

  return (
    <ThemeUserContext.Provider value={{ theme, user, setTheme }}>
      <TabContext.Provider value={{ activeTab, setActiveTab }}>
        {children}
      </TabContext.Provider>
    </ThemeUserContext.Provider>
  );
}

// 3. MEMOIZED EXPENSIVE COMPONENT
const ExpensiveChart = memo(() => {
  // It only consumes ThemeUser, NOT Tab.
  const { theme } = useContext(ThemeUserContext);

  console.log("ExpensiveChart rendering...");
  let x = 0; for(let i=0; i<1e8; i++) x++; // Fake heavy compute

  return <div style={{ background: theme === 'dark' ? '#333' : '#fff' }}>Chart Data {x}</div>;
});

// 4. TAB CONTROLS (Only consumes TabContext)
function TabControls() {
  const { activeTab, setActiveTab } = useContext(TabContext);

  return (
    <div>
      <button onClick={() => setActiveTab('dash')}>Dash</button>
      <button onClick={() => setActiveTab('settings')}>Settings</button>
      <p>Current: {activeTab}</p>
    </div>
  );
}

// 5. MAIN DASHBOARD
export function Dashboard() {
  return (
    <AppProviders>
      <TabControls />
      <ExpensiveChart />
    </AppProviders>
  );
}
```
*Architecture Note:* By splitting the state into logically distinct contexts (`ThemeUserContext` vs `TabContext`), we isolate re-renders. `ExpensiveChart` never subscribes to `TabContext`. Thus, when `activeTab` changes, `TabControls` re-renders, but `ExpensiveChart` skips the render cycle entirely.

### 🧪 Executable Test Suite (Jest / React Testing Library)
```javascript
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Dashboard } from './Dashboard';
import React from 'react';

// Mock console.log to track renders
const originalLog = console.log;

describe('Render Optimization', () => {
  let logSpy;

  beforeEach(() => {
    logSpy = jest.spyOn(console, 'log').mockImplementation(() => {});
  });

  afterEach(() => {
    logSpy.mockRestore();
  });

  it('does not re-render ExpensiveChart on tab change', async () => {
    render(<Dashboard />);

    // Initial render
    expect(logSpy).toHaveBeenCalledWith('ExpensiveChart rendering...');
    logSpy.mockClear();

    // Change Tab
    await userEvent.click(screen.getByText('Settings'));

    // Should NOT re-render
    expect(logSpy).not.toHaveBeenCalled();
    expect(screen.getByText('Current: settings')).toBeInTheDocument();
  });
});
```
