# Level 1: Resilient Client

## Scenario
You are building the core foundation for a robust Next.js application. Your first task is to create a resilient UI that can handle slow network conditions and provide immediate feedback to the user, even if they have disabled JavaScript.

## Architecture Diagram
```text
[ Browser ]                  [ Next.js Server ]
    |                               |
    |-- 1. GET / ------------------>| (Server renders Page & Cart)
    |<-- 2. HTML -------------------|
    |                               |
    |-- 3. POST (Add to Cart) ----->| (Server Action handles DB Update)
    |<-- 4. revalidatePath -------- | (New HTML state returned instantly)
```

## Production Solution Code

### Starter Template Setup
```bash
npx create-next-app@latest resilient-client --typescript --eslint --tailwind --app --src-dir --no-src-dir
cd resilient-client
```

### 1. `app/actions.ts`
```ts
'use server';

import { revalidatePath } from 'next/cache';

// Mock DB
let cartCount = 0;

export async function getCartCount() {
  return cartCount;
}

export async function addToCart(formData: FormData) {
  const productId = formData.get('productId');
  if (!productId) throw new Error('Invalid product');

  // Simulate slow network to DB
  await new Promise((resolve) => setTimeout(resolve, 1000));

  cartCount += 1;
  revalidatePath('/');
}
```

### 2. `app/components/AddToCart.tsx`
```tsx
'use client';
import { useOptimistic, useRef } from 'react';
import { addToCart } from '../actions';

export default function AddToCart({ initialCount }: { initialCount: number }) {
  const formRef = useRef<HTMLFormElement>(null);
  const [optimisticCount, setOptimisticCount] = useOptimistic(
    initialCount,
    (state) => state + 1
  );

  const action = async (formData: FormData) => {
    // 1. Optimistically update UI
    setOptimisticCount(1); // the payload value is ignored, just triggering the reducer

    // 2. Perform real server mutation
    await addToCart(formData);
  };

  return (
    <div className="p-4 border rounded shadow">
      <div className="flex justify-between items-center mb-4">
        <h2 className="text-xl font-bold">Awesome T-Shirt</h2>
        <span className="bg-blue-500 text-white px-2 py-1 rounded">
          Cart: {optimisticCount}
        </span>
      </div>
      <form action={action} ref={formRef}>
        <input type="hidden" name="productId" value="123" />
        <button
          type="submit"
          className="bg-green-500 hover:bg-green-600 text-white px-4 py-2 rounded"
        >
          Add to Cart
        </button>
      </form>
    </div>
  );
}
```

### 3. `app/page.tsx`
```tsx
import AddToCart from './components/AddToCart';
import { getCartCount } from './actions';

export default async function Page() {
  const count = await getCartCount();

  return (
    <main className="p-8 max-w-xl mx-auto mt-10">
      <h1 className="text-3xl mb-8">E-Commerce Store</h1>
      <AddToCart initialCount={count} />
    </main>
  );
}
```

## Test Suite (Playwright)
```ts
// tests/cart.spec.ts
import { test, expect } from '@playwright/test';

test.describe('Resilient Cart', () => {
  test('adds to cart and optimistically updates', async ({ page }) => {
    await page.goto('http://localhost:3000');

    // Initial State
    await expect(page.locator('text=Cart: 0')).toBeVisible();

    // Click Add
    await page.click('button:has-text("Add to Cart")');

    // Optimistic Update (Immediate)
    await expect(page.locator('text=Cart: 1')).toBeVisible();
  });

  test('works with JS disabled', async ({ browser }) => {
    const context = await browser.newContext({ javaScriptEnabled: false });
    const page = await context.newPage();

    await page.goto('http://localhost:3000');
    await expect(page.locator('text=Cart: 0')).toBeVisible();

    await page.click('button:has-text("Add to Cart")');

    // Waits for full page reload since JS is off
    await page.waitForLoadState('networkidle');
    await expect(page.locator('text=Cart: 1')).toBeVisible();
  });
});
```
