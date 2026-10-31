# Level 5: Principal Boss Architecture - Micro-Frontend State Bridge

## 🏗️ Architecture & Scenario
You are migrating a legacy monolithic React app into a Micro-Frontend architecture. You have a Host App and a Cart App (rendered in an iframe or a separate Web Component).
**The Problem:** React Context and `useState` cannot cross iframe/window boundaries.
**The Challenge:** Design an Event Bus architecture that synchronizes a `CartState` across entirely disconnected React trees using the browser's native `CustomEvent` API, completely bypassing React's internal tree.

### 📊 Architecture Diagram
```text
[ React Root 1: Micro-Frontend A (Product Page) ]
       | (Calls cartBridge.addItem())
       v
[ Vanilla JS Event Bus (CartStateBridge) ]
       | (Dispatches 'CART_UPDATED' native CustomEvent)
       v
[ React Root 2: Micro-Frontend B (Header/Nav) ]
       | (Subscribes via useSyncExternalStore)
       v
[ Updates Header UI seamlessly ]
```

## 📦 Starter Template
```javascript
// vanilla-bus.js
class CartStateBridge {
  // YOUR CODE HERE
}
export const cartBridge = new CartStateBridge();

// useSharedCart.jsx
import { useSyncExternalStore } from 'react';
import { cartBridge } from './vanilla-bus';

export function useSharedCart() {
  // YOUR CODE HERE
  // Hint: useSyncExternalStore(subscribe, getSnapshot)
  return { cart: [], addItem: () => {} };
}
```

## 🧪 Test Suite Requirements
1. **Vanilla Store:** The `CartStateBridge` must maintain its own state array and expose `getCart()`.
2. **Event Emission:** Adding an item to the bridge must trigger a native `CustomEvent` on the `window`.
3. **React Integration:** `useSharedCart` must correctly utilize `useSyncExternalStore` to listen to the `CustomEvent` and force a React re-render when the external state updates.
4. **Disconnected Trees:** It must successfully sync state across components that do not share a common React Provider.

### 🧪 Executable Test Suite (Jest / React Testing Library)
```javascript
import { render, screen, act } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { CartStateBridge } from './vanilla-bus';
import { useSharedCart } from './useSharedCart';

describe('Micro-Frontend State Bridge', () => {
  let cartBridge;

  beforeEach(() => {
    cartBridge = new CartStateBridge();
    // In a real scenario, you'd mock window events or isolate the instance
  });

  it('updates state across completely disconnected components', async () => {
    const ComponentA = () => {
      const { addItem } = useSharedCart(cartBridge);
      return <button onClick={() => addItem('Apple')}>Add Apple</button>;
    };

    const ComponentB = () => {
      const { cart } = useSharedCart(cartBridge);
      return <div data-testid="cart-count">{cart.length}</div>;
    };

    // Rendered completely separately, no shared provider
    render(
      <>
        <ComponentA />
        <ComponentB />
      </>
    );

    expect(screen.getByTestId('cart-count')).toHaveTextContent('0');

    await userEvent.click(screen.getByText('Add Apple'));

    expect(screen.getByTestId('cart-count')).toHaveTextContent('1');
  });
});
```

## 🏆 Principal Engineer Solution

### 1. The Global Event Bus (Vanilla JS)
```javascript
// This file lives outside React entirely.
export class CartStateBridge {
  constructor() {
    this.cart = [];
  }

  getCart() {
    return this.cart;
  }

  addItem(item) {
    // CRITICAL: Must be immutable for useSyncExternalStore to detect changes!
    this.cart = [...this.cart, item];
    this.emitChange();
  }

  emitChange() {
    // Cross-boundary event using native DOM
    const event = new CustomEvent('CART_UPDATED', { detail: this.cart });
    window.dispatchEvent(event);
  }
}

export const cartBridge = new CartStateBridge();
```

### 2. The Bridge Hook (React Layer)
We use `useSyncExternalStore` (introduced in React 18 specifically for this purpose) to connect React to an external state source without tearing.

```jsx
import { useSyncExternalStore, useCallback } from 'react';
import { cartBridge } from './CartStateBridge';

export function useSharedCart(bridge = cartBridge) {
  const subscribeToCart = useCallback((callback) => {
    window.addEventListener('CART_UPDATED', callback);
    return () => window.removeEventListener('CART_UPDATED', callback);
  }, []);

  const cart = useSyncExternalStore(
    subscribeToCart,
    () => bridge.getCart() // Get Snapshot
  );

  return {
    cart,
    addItem: (item) => bridge.addItem(item)
  };
}
```

### 3. Usage in Disconnected Trees
```jsx
// APP 1: The Product Page (Micro-Frontend A)
export function ProductPage() {
  const { addItem } = useSharedCart();
  return (
    <button onClick={() => addItem({ id: 1, name: 'Laptop' })}>
      Add Laptop
    </button>
  );
}

// APP 2: The Header/Nav (Micro-Frontend B - Completely separate React Root)
export function Header() {
  const { cart } = useSharedCart();
  return (
    <header>
      <h1>My Store</h1>
      <span>Cart Items: {cart.length}</span>
    </header>
  );
}
```
*Architecture Note:* This architecture proves a deep understanding of the boundaries between React and the Browser. By using Vanilla JS custom events and `useSyncExternalStore`, we achieve perfectly synchronous state updates across multiple disconnected React roots (or even between a React app and a Vue app on the same page). This is the hallmark of Principal-level systems design.
