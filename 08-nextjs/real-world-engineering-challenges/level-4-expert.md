# Level 4: Complex Composition & Boundaries

## Scenario
You are building a complex interactive application where you need to carefully manage the boundaries between Server Components (for performance/security) and Client Components (for interactivity).

## Architecture Diagram
```text
[ Server Context ]
       |
  <FinancialsPage> (Reads URL searchParams: ?sort=amount)
       |
       |--- passes searchParams ---> <TableRows> (Server Component - Fetches Data Securely)
       |                                   | (Outputs <tr>...</tr> HTML)
       |
       |--- passes <TableRows> as children ---
       V
[ Client Context ]
  <InteractiveTable> ('use client')
       | (Renders Sorting Buttons)
       | (Changes URL searchParams via next/navigation router.push)
       |
       |--- Renders `children` (The pre-rendered Server <tr> HTML)
```

## Production Solution Code

### 1. `app/financials/InteractiveTable.tsx` (Client Shell)
```tsx
'use client';

import { useRouter, useSearchParams } from 'next/navigation';
import { ReactNode } from 'react';

export default function InteractiveTable({ children }: { children: ReactNode }) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const currentSort = searchParams.get('sort') || 'date';

  const handleSort = (column: string) => {
    // Pushing a new searchParam triggers the Server Component to re-run
    router.push(`?sort=${column}`);
  };

  return (
    <div className="border rounded shadow bg-white overflow-hidden">
      <div className="p-4 bg-gray-50 flex gap-4 border-b">
        <span className="font-bold mr-4">Sort By:</span>
        <button
          onClick={() => handleSort('date')}
          className={`px-3 py-1 rounded ${currentSort === 'date' ? 'bg-blue-500 text-white' : 'bg-gray-200'}`}
        >
          Date
        </button>
        <button
          onClick={() => handleSort('amount')}
          className={`px-3 py-1 rounded ${currentSort === 'amount' ? 'bg-blue-500 text-white' : 'bg-gray-200'}`}
        >
          Amount
        </button>
      </div>

      <table className="w-full text-left">
        <thead>
          <tr className="bg-gray-100">
            <th className="p-4">Transaction ID</th>
            <th className="p-4">Date</th>
            <th className="p-4">Amount</th>
          </tr>
        </thead>
        <tbody>
          {/* This is the pre-rendered server HTML injected perfectly into the client shell */}
          {children}
        </tbody>
      </table>
    </div>
  );
}
```

### 2. `app/financials/TableRows.tsx` (Server Content)
```tsx
// NO 'use client' here. This runs entirely on the server.
import { format } from 'currency-formatter';

async function fetchFinancials(sortBy: string) {
  // Simulate secure DB fetch based on sort param
  await new Promise(r => setTimeout(r, 500));

  const data = [
    { id: 'TX-1', date: '2023-10-01', amount: 500 },
    { id: 'TX-2', date: '2023-10-05', amount: 2500 },
    { id: 'TX-3', date: '2023-10-02', amount: 120 },
  ];

  if (sortBy === 'amount') {
    return data.sort((a, b) => b.amount - a.amount);
  }
  return data.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
}

export default async function TableRows({ sortBy }: { sortBy: string }) {
  const rows = await fetchFinancials(sortBy);

  return (
    <>
      {rows.map(row => (
        <tr key={row.id} className="border-b hover:bg-gray-50">
          <td className="p-4 font-mono">{row.id}</td>
          <td className="p-4">{row.date}</td>
          <td className="p-4 font-semibold text-green-700">
            {format(row.amount, { code: 'USD' })}
          </td>
        </tr>
      ))}
    </>
  );
}
```

### 3. `app/financials/page.tsx` (The Composer)
```tsx
import { Suspense } from 'react';
import InteractiveTable from './InteractiveTable';
import TableRows from './TableRows';

export default function FinancialsPage({
  searchParams,
}: {
  searchParams: { [key: string]: string | string[] | undefined };
}) {
  const sort = typeof searchParams.sort === 'string' ? searchParams.sort : 'date';

  return (
    <main className="p-8 max-w-4xl mx-auto">
      <h1 className="text-3xl font-bold mb-8">Financial Records</h1>

      {/* Composition: Server Component is passed as children to Client Component */}
      <InteractiveTable>
        <Suspense fallback={<tr><td colSpan={3} className="p-4 text-center">Loading records...</td></tr>}>
          <TableRows sortBy={sort} />
        </Suspense>
      </InteractiveTable>
    </main>
  );
}
```

## Test Suite (Playwright)
```ts
// tests/composition.spec.ts
import { test, expect } from '@playwright/test';

test.describe('Server/Client Composition', () => {
  test('updates server component when client changes search params', async ({ page }) => {
    await page.goto('/financials');

    // Initial sort is by date (TX-2 should be first in mock data based on latest date)
    const firstRowId = page.locator('tbody tr:first-child td:first-child');
    await expect(firstRowId).toHaveText('TX-2');

    // Click "Amount" Sort Button (Client Component)
    await page.click('button:has-text("Amount")');

    // URL should update
    await expect(page).toHaveURL(/.*sort=amount/);

    // Wait for the Suspense boundary to resolve the new Server Component payload
    // TX-2 has the highest amount ($2500)
    await expect(firstRowId).toHaveText('TX-2');
  });
});
```