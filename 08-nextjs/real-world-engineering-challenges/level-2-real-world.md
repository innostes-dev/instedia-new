# Level 2: Real-World Data Fetching

## Scenario
Your application has grown. You now need to fetch data from external APIs securely and efficiently. You must ensure that sensitive API keys are not exposed to the client and that data fetching is optimized.

## Architecture Diagram
```text
[ Browser ]              [ Next.js Server ]                   [ External APIs ]
    |                            |                                   |
    |-- GET /dashboard --------->| (Parallel Fetch via Promise.all)  |
    |                            |---- 1. fetch('/stats') ---------->|
    |                            |---- 2. fetch('/activity') ------->|
    |                            |<--- Returns Data -----------------|
    |<-- Renders Complete HTML --|                                   |
```

## Production Solution Code

### Starter Template Setup
```bash
npx create-next-app@latest real-world-fetching --typescript --eslint --tailwind --app
cd real-world-fetching
echo "SECRET_API_KEY=super_secret_123" > .env.local
```

### 1. `app/dashboard/error.tsx`
```tsx
'use client';
import { useEffect } from 'react';

export default function DashboardError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error('Dashboard Error:', error);
  }, [error]);

  return (
    <div className="p-4 bg-red-100 border border-red-400 text-red-700 rounded my-4">
      <h2 className="font-bold">Failed to load dashboard data</h2>
      <p>{error.message}</p>
      <button
        onClick={() => reset()}
        className="mt-2 bg-red-600 text-white px-4 py-2 rounded hover:bg-red-700"
      >
        Retry Fetch
      </button>
    </div>
  );
}
```

### 2. `app/dashboard/loading.tsx`
```tsx
export default function DashboardLoading() {
  return (
    <div className="p-8 max-w-4xl mx-auto space-y-4 animate-pulse">
      <div className="h-8 bg-gray-300 rounded w-1/4"></div>
      <div className="grid grid-cols-2 gap-4">
        <div className="h-32 bg-gray-200 rounded"></div>
        <div className="h-32 bg-gray-200 rounded"></div>
      </div>
    </div>
  );
}
```

### 3. `app/dashboard/page.tsx`
```tsx
import { Suspense } from 'react';

// Mock Services
async function getStats() {
  // Simulating an authenticated external fetch
  if (!process.env.SECRET_API_KEY) throw new Error("Missing API Key");

  await new Promise(r => setTimeout(r, 1000));
  return { users: 1540, revenue: 84000 };
}

async function getActivity() {
  await new Promise(r => setTimeout(r, 1500));

  // Randomly throw an error to demonstrate error boundary
  if (Math.random() > 0.7) {
    throw new Error("Activity API is currently down.");
  }

  return [
    { id: 1, action: "User signed up" },
    { id: 2, action: "Purchase made" }
  ];
}

export default async function DashboardPage() {
  // Parallel Fetching! Both start at the same time.
  const [stats, activity] = await Promise.all([
    getStats(),
    getActivity()
  ]);

  return (
    <main className="p-8 max-w-4xl mx-auto">
      <h1 className="text-3xl font-bold mb-8">Admin Dashboard</h1>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="p-6 bg-white shadow rounded border border-gray-200">
          <h2 className="text-xl font-semibold mb-4">Stats</h2>
          <p className="text-lg">Users: <span className="font-bold text-blue-600">{stats.users}</span></p>
          <p className="text-lg">Revenue: <span className="font-bold text-green-600">${stats.revenue}</span></p>
        </div>

        <div className="p-6 bg-white shadow rounded border border-gray-200">
          <h2 className="text-xl font-semibold mb-4">Recent Activity</h2>
          <ul className="space-y-2">
            {activity.map(act => (
              <li key={act.id} className="text-gray-700">• {act.action}</li>
            ))}
          </ul>
        </div>
      </div>
    </main>
  );
}
```

## Test Suite (Jest / Testing Library)
*Note: React Server Components are typically best tested via e2e like Playwright, but here is how you test the error boundary unit.*

```tsx
// __tests__/error.test.tsx
import { render, screen, fireEvent } from '@testing-library/react';
import DashboardError from '@/app/dashboard/error';

describe('Dashboard Error Boundary', () => {
  it('renders the error message and retry button', () => {
    const mockError = new Error('Test API Failed');
    const mockReset = jest.fn();

    render(<DashboardError error={mockError} reset={mockReset} />);

    expect(screen.getByText('Failed to load dashboard data')).toBeInTheDocument();
    expect(screen.getByText('Test API Failed')).toBeInTheDocument();

    const retryButton = screen.getByRole('button', { name: /retry/i });
    fireEvent.click(retryButton);

    expect(mockReset).toHaveBeenCalledTimes(1);
  });
});
```