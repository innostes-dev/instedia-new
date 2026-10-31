# Level 4: Headless Architecture - The Ultimate Dropdown

## 🏗️ Architecture & Scenario
Designers love custom dropdowns, but they are incredibly hard to build with full keyboard accessibility (Arrow keys, Escape, Enter), ARIA attributes, and outside-click detection.
**The Problem:** If you hardcode the UI into the dropdown logic, you have to rewrite the logic every time the designer changes the look.
**The Challenge:** Build a "Headless Component" (or Custom Hook) called `useDropdown`. It should provide all state, event handlers, and accessibility logic, returning zero JSX, allowing the consumer to render it however they want.

### 📊 Architecture Diagram
```text
[ useDropdown Hook (Headless) ]
       | (Returns Prop Getters)
       |-- getContainerProps()
       |-- getToggleButtonProps()
       |-- getItemProps(index)
       v
[ Consumer UI Component ] (Provides ONLY JSX and Styling)
       |-- Applies getContainerProps() to wrapping div
       |-- Applies getToggleButtonProps() to button
       |-- Maps items applying getItemProps(index) to each li
```

## 📦 Starter Template
```jsx
import { useState, useRef, useEffect, useCallback } from 'react';

export function useDropdown(items, onSelect) {
  // YOUR CODE HERE
  // Handle isOpen state, highlightedIndex, keyboard nav, and outside clicks
  return {
    isOpen: false,
    getContainerProps: () => ({}),
    getToggleButtonProps: () => ({}),
    getItemProps: (index) => ({})
  };
}
```

## 🧪 Test Suite Requirements
1. **Click Outside:** Should close the dropdown if a click occurs outside the container ref.
2. **Keyboard Navigation:**
   - `Enter`/`Space` on the button opens the dropdown.
   - `ArrowDown` highlights the next item.
   - `ArrowUp` highlights the previous item.
   - `Enter` on an item selects it and closes the dropdown.
   - `Escape` closes the dropdown.
3. **Accessibility:** Must return appropriate ARIA roles (`listbox`, `option`, `aria-selected`, `aria-expanded`).

## 🏆 Principal Engineer Solution

```jsx
import { useState, useRef, useEffect, useCallback } from 'react';

export function useDropdown(items, onSelect) {
  const [isOpen, setIsOpen] = useState(false);
  const [highlightedIndex, setHighlightedIndex] = useState(-1);

  const containerRef = useRef(null);

  // Handle Outside Click
  useEffect(() => {
    const handleOutsideClick = (e) => {
      if (containerRef.current && !containerRef.current.contains(e.target)) {
        setIsOpen(false);
      }
    };
    if (isOpen) document.addEventListener('mousedown', handleOutsideClick);
    return () => document.removeEventListener('mousedown', handleOutsideClick);
  }, [isOpen]);

  // Handle Keyboard Navigation
  const handleKeyDown = useCallback((e) => {
    if (!isOpen) {
      if (e.key === 'Enter' || e.key === ' ') {
        setIsOpen(true);
        e.preventDefault();
      }
      return;
    }

    switch (e.key) {
      case 'ArrowDown':
        e.preventDefault();
        setHighlightedIndex(prev => (prev < items.length - 1 ? prev + 1 : prev));
        break;
      case 'ArrowUp':
        e.preventDefault();
        setHighlightedIndex(prev => (prev > 0 ? prev - 1 : prev));
        break;
      case 'Enter':
        e.preventDefault();
        if (highlightedIndex >= 0) {
          onSelect(items[highlightedIndex]);
          setIsOpen(false);
        }
        break;
      case 'Escape':
        setIsOpen(false);
        break;
      default:
        break;
    }
  }, [isOpen, items, highlightedIndex, onSelect]);

  // Prop Getters Pattern
  const getContainerProps = () => ({
    ref: containerRef,
    onKeyDown: handleKeyDown,
    'aria-haspopup': 'listbox',
    'aria-expanded': isOpen
  });

  const getToggleButtonProps = () => ({
    onClick: () => setIsOpen(prev => !prev),
    'aria-haspopup': 'listbox',
    'aria-expanded': isOpen
  });

  const getItemProps = (index) => ({
    onClick: () => {
      onSelect(items[index]);
      setIsOpen(false);
    },
    onMouseEnter: () => setHighlightedIndex(index),
    style: {
      background: highlightedIndex === index ? '#eee' : 'transparent',
      cursor: 'pointer'
    },
    role: 'option',
    'aria-selected': highlightedIndex === index
  });

  return {
    isOpen,
    getContainerProps,
    getToggleButtonProps,
    getItemProps
  };
}

// === USAGE (The UI Layer) ===
export function CustomSelect() {
  const items = ['Apple', 'Banana', 'Cherry'];
  const { isOpen, getContainerProps, getToggleButtonProps, getItemProps } = useDropdown(items, (val) => alert(val));

  return (
    <div {...getContainerProps()} style={{ position: 'relative', width: 200 }}>
      <button {...getToggleButtonProps()} style={{ width: '100%' }}>
        Select Fruit...
      </button>

      {isOpen && (
        <ul style={{ position: 'absolute', top: '100%', left: 0, right: 0, background: 'white', border: '1px solid black', padding: 0, margin: 0, listStyle: 'none' }}>
          {items.map((item, i) => (
            <li key={item} {...getItemProps(i)}>
              {item}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
```
*Architecture Note:* This is the exact pattern used by libraries like Downshift and Radix UI. The `useDropdown` hook encapsulates 100% of the complex behavior (keyboard nav, a11y, focus management) but dictates 0% of the styling.

### 🧪 Executable Test Suite (Jest / React Testing Library)
```javascript
import { render, screen, fireEvent } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { CustomSelect } from './CustomSelect';

describe('useDropdown (Headless Component)', () => {
  it('handles keyboard navigation and outside clicks', async () => {
    render(<CustomSelect />);

    const button = screen.getByRole('button', { name: /Select Fruit/i });
    expect(screen.queryByRole('listbox')).not.toBeInTheDocument();

    // Open via Keyboard
    button.focus();
    fireEvent.keyDown(button, { key: 'Enter', code: 'Enter' });

    expect(screen.getByRole('option', { name: 'Apple' })).toBeInTheDocument();

    // Navigate Down
    fireEvent.keyDown(button, { key: 'ArrowDown', code: 'ArrowDown' });
    expect(screen.getByRole('option', { name: 'Apple' })).toHaveAttribute('aria-selected', 'true');

    // Close via outside click
    await userEvent.click(document.body);
    expect(screen.queryByRole('option', { name: 'Apple' })).not.toBeInTheDocument();
  });
});
```
