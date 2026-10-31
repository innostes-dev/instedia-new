# Level 2: Complex State - The Data Grid Engine

## 🏗️ Architecture & Scenario
You are building an internal admin tool data grid (like AG-Grid). It supports sorting, filtering, and pagination.
**The Problem:** If you handle pagination, sorting, and filtering as separate `useState` calls, race conditions occur. If you are on Page 5 and apply a filter that only results in 1 page of data, the UI breaks because it's still trying to show Page 5.
**The Challenge:** Implement a robust `useDataGrid` hook using `useReducer` that perfectly orchestrates filtering, sorting, and pagination logic, ensuring impossible states never occur.

### 📊 Architecture Diagram
```text
[ DataGrid UI ] -> Dispatches Actions (SET_FILTER, SET_PAGE, SET_SORT)
       |
       v
[ useDataGrid Hook (useReducer) ]
       |-- Action: SET_FILTER -> Resets page to 1, updates filterText
       |-- Action: SET_SORT   -> Toggles asc/desc or sets new sort key
       |-- Action: SET_PAGE   -> Updates currentPage
       |
       v
[ useMemo Derived State ] -> Filters Data -> Sorts Data -> Paginates Data
       |
       v
[ Renders Visible Rows & Pagination UI ]
```

## 📦 Starter Template
```jsx
import { useReducer, useMemo } from 'react';

const rawData = [
  { id: 1, name: 'Alice', role: 'Admin', active: true },
  { id: 2, name: 'Bob', role: 'User', active: false },
  // ... assume 100 rows
];

const initialState = {
  filterText: '',
  sortConfig: { key: 'id', direction: 'asc' },
  pagination: { currentPage: 1, pageSize: 10 }
};

// YOUR REDUCER HERE
function gridReducer(state, action) {
  return state;
}

export function useDataGrid(initialData) {
  // YOUR HOOK IMPLEMENTATION HERE
  return { rows: [], totalPages: 0 };
}
```

## 🧪 Test Suite Requirements
1. **Filtering:** Setting a filter correctly reduces the `rows` returned.
2. **Filter Pagination Reset:** Setting a filter when `currentPage > 1` must reset `currentPage` to 1.
3. **Sorting:** Clicking sort on a column orders it ascending; clicking again orders it descending.
4. **Pagination:** Ensure only `pageSize` number of items are returned for the current page.

## 🏆 Principal Engineer Solution

```jsx
import { useReducer, useMemo } from 'react';

const ACTION_TYPES = {
  SET_FILTER: 'SET_FILTER',
  SET_SORT: 'SET_SORT',
  SET_PAGE: 'SET_PAGE'
};

function gridReducer(state, action) {
  switch (action.type) {
    case ACTION_TYPES.SET_FILTER:
      return {
        ...state,
        filterText: action.payload,
        // CRITICAL FIX: Reset to page 1 when filtering!
        pagination: { ...state.pagination, currentPage: 1 }
      };

    case ACTION_TYPES.SET_SORT: {
      const isAsc = state.sortConfig.key === action.payload && state.sortConfig.direction === 'asc';
      return {
        ...state,
        sortConfig: { key: action.payload, direction: isAsc ? 'desc' : 'asc' }
      };
    }

    case ACTION_TYPES.SET_PAGE:
      return {
        ...state,
        pagination: { ...state.pagination, currentPage: action.payload }
      };

    default:
      return state;
  }
}

export function useDataGrid(initialData) {
  const [state, dispatch] = useReducer(gridReducer, {
    filterText: '',
    sortConfig: { key: null, direction: 'asc' },
    pagination: { currentPage: 1, pageSize: 10 }
  });

  // Derived State (Performance Optimized)
  const processedData = useMemo(() => {
    let result = [...initialData];

    // 1. Filter
    if (state.filterText) {
      result = result.filter(row =>
        Object.values(row).some(val =>
          String(val).toLowerCase().includes(state.filterText.toLowerCase())
        )
      );
    }

    // 2. Sort
    if (state.sortConfig.key) {
      result.sort((a, b) => {
        const valA = a[state.sortConfig.key];
        const valB = b[state.sortConfig.key];
        if (valA < valB) return state.sortConfig.direction === 'asc' ? -1 : 1;
        if (valA > valB) return state.sortConfig.direction === 'asc' ? 1 : -1;
        return 0;
      });
    }

    // 3. Paginate
    const startIndex = (state.pagination.currentPage - 1) * state.pagination.pageSize;
    const paginatedResult = result.slice(startIndex, startIndex + state.pagination.pageSize);

    return {
      rows: paginatedResult,
      totalRows: result.length,
      totalPages: Math.ceil(result.length / state.pagination.pageSize)
    };
  }, [initialData, state.filterText, state.sortConfig, state.pagination]);

  return {
    state,
    dispatch,
    rows: processedData.rows,
    totalPages: processedData.totalPages
  };
}
```
*Architecture Note:* By decoupling the raw data from the UI state, we calculate the `processedData` dynamically. The Reducer ensures that changing the filter *automatically* resets the page to 1, completely preventing the "out of bounds" pagination bug that plagues junior codebases.

### 🧪 Executable Test Suite (Jest / React Testing Library)
```javascript
import { renderHook, act } from '@testing-library/react-hooks';
import { useDataGrid } from './useDataGrid';

const mockData = [
  { id: 1, name: 'Alice', role: 'Admin' },
  { id: 2, name: 'Bob', role: 'User' },
];

describe('useDataGrid', () => {
  it('filters data and resets pagination', () => {
    const { result } = renderHook(() => useDataGrid(mockData));

    act(() => {
      result.current.dispatch({ type: 'SET_PAGE', payload: 2 });
    });
    expect(result.current.state.pagination.currentPage).toBe(2);

    act(() => {
      result.current.dispatch({ type: 'SET_FILTER', payload: 'Alice' });
    });

    expect(result.current.rows).toHaveLength(1);
    expect(result.current.rows[0].name).toBe('Alice');
    expect(result.current.state.pagination.currentPage).toBe(1); // Page reset
  });
});
```
