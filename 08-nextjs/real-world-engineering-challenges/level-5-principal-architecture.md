# Level 5: Principal Architecture

## Scenario
You are the Principal Engineer for a large-scale SaaS platform. The platform supports multiple tenants (e.g., different companies), each requiring their own custom branding, dynamic routing, and high-performance streaming dashboard.

## Architecture Diagram
```text
URL: /acme/dashboard

[ Next.js Router ] -> Matches `[tenantId]` = "acme"
       |
       |--> 1. Layout `[tenantId]/layout.tsx` (Fetches Brand Colors: Red)
       |
       |--> 2. Page Metadata `[tenantId]/dashboard/page.tsx`
       |       |--> Points og:image to `/api/og?tenant=acme`
       |
       |--> 3. Page Content `[tenantId]/dashboard/page.tsx` (Streams)
               |--> <Suspense>
               |       |--> <UserFeed> (Takes 1s, streams first)
               |
               |--> <Suspense>
                       |--> <RevenueGraph> (Takes 4s, streams last)
```

## Production Solution Code

### 1. `app/api/og/route.tsx` (Dynamic Image Generator)
```tsx
import { ImageResponse } from 'next/og';
import { NextRequest } from 'next/server';

export const runtime = 'edge';

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const tenant = searchParams.get('tenant') || 'Tenant';

  // Basic mock color mapping
  const bgColors: Record<string, string> = { acme: 'red', globex: 'blue' };
  const bgColor = bgColors[tenant.toLowerCase()] || 'gray';

  return new ImageResponse(
    (
      <div
        style={{
          fontSize: 60,
          color: 'white',
          background: bgColor,
          width: '100%',
          height: '100%',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        <h1 style={{ margin: 0 }}>{tenant.toUpperCase()}</h1>
        <p style={{ fontSize: 30, marginTop: 20 }}>Partner Dashboard</p>
      </div>
    ),
    { width: 1200, height: 630 }
  );
}
```

### 2. `app/[tenantId]/layout.tsx` (Tenant Persistent Layout)
```tsx
import { ReactNode } from 'react';
import Link from 'next/link';

async function getTenantConfig(tenantId: string) {
  // Simulate DB lookup for tenant config
  await new Promise(r => setTimeout(r, 500));
  const themes: Record<string, string> = {
    acme: 'border-red-500 text-red-700',
    globex: 'border-blue-500 text-blue-700'
  };
  return {
    name: tenantId.toUpperCase(),
    theme: themes[tenantId.toLowerCase()] || 'border-gray-500 text-gray-700'
  };
}

export default async function TenantLayout({
  children,
  params,
}: {
  children: ReactNode;
  params: { tenantId: string };
}) {
  const config = await getTenantConfig(params.tenantId);

  return (
    <div className={`min-h-screen border-t-8 ${config.theme}`}>
      <nav className="p-4 bg-gray-50 flex gap-4 border-b">
        <span className="font-bold">{config.name} Portal</span>
        <Link href={`/${params.tenantId}/dashboard`} className="hover:underline">Dashboard</Link>
        <Link href={`/${params.tenantId}/settings`} className="hover:underline">Settings</Link>
      </nav>
      {children}
    </div>
  );
}
```

### 3. `app/[tenantId]/dashboard/components.tsx` (Slow Data Fetchers)
```tsx
export async function UserFeed() {
  await new Promise(r => setTimeout(r, 1000));
  return (
    <div className="p-4 bg-white shadow rounded border border-gray-200">
      <h3 className="font-bold border-b pb-2 mb-2">Live Feed</h3>
      <ul>
        <li>User Alice logged in</li>
        <li>User Bob updated profile</li>
      </ul>
    </div>
  );
}

export async function RevenueGraph() {
  await new Promise(r => setTimeout(r, 4000));
  return (
    <div className="p-4 bg-white shadow rounded border border-gray-200">
      <h3 className="font-bold border-b pb-2 mb-2">Q3 Revenue</h3>
      <div className="h-48 bg-green-100 flex items-end justify-around p-4">
         <div className="w-8 bg-green-500 h-24"></div>
         <div className="w-8 bg-green-500 h-32"></div>
         <div className="w-8 bg-green-500 h-48"></div>
      </div>
    </div>
  );
}
```

### 4. `app/[tenantId]/dashboard/page.tsx` (Streaming Aggregator)
```tsx
import { Suspense } from 'react';
import { Metadata } from 'next';
import { UserFeed, RevenueGraph } from './components';

export async function generateMetadata({ params }: { params: { tenantId: string } }): Promise<Metadata> {
  return {
    title: `${params.tenantId.toUpperCase()} Dashboard`,
    openGraph: {
      images: [
        {
          url: `/api/og?tenant=${params.tenantId}`,
          width: 1200,
          height: 630,
        },
      ],
    },
  };
}

export default function DashboardPage({ params }: { params: { tenantId: string } }) {
  // Renders instantly!
  return (
    <main className="p-8 max-w-6xl mx-auto">
      <h1 className="text-3xl font-bold mb-8">Dashboard Overview</h1>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
        {/* Streams in at 1 second */}
        <Suspense fallback={<div className="h-32 bg-gray-200 animate-pulse rounded"></div>}>
          <UserFeed />
        </Suspense>

        {/* Streams in at 4 seconds */}
        <Suspense fallback={<div className="h-64 bg-gray-200 animate-pulse rounded"></div>}>
          <RevenueGraph />
        </Suspense>
      </div>
    </main>
  );
}
```

## Test Suite (Playwright)
```ts
// tests/principal-architecture.spec.ts
import { test, expect } from '@playwright/test';

test.describe('Principal Architecture', () => {
  test('dynamic metadata points to OG route', async ({ page }) => {
    await page.goto('/acme/dashboard');

    // Check Title
    await expect(page).toHaveTitle('ACME Dashboard');

    // Check OG Image URL in meta tags
    const ogImage = await page.getAttribute('meta[property="og:image"]', 'content');
    expect(ogImage).toContain('/api/og?tenant=acme');
  });

  test('layout persists and streaming works', async ({ page }) => {
    await page.goto('/acme/dashboard');

    // Layout and Skeleton should be instantly visible
    await expect(page.locator('text=ACME Portal')).toBeVisible();
    await expect(page.locator('text=Dashboard Overview')).toBeVisible();

    // UserFeed pops in first (1s)
    await expect(page.locator('text=Live Feed')).toBeVisible();

    // RevenueGraph pops in last (4s)
    await expect(page.locator('text=Q3 Revenue')).toBeVisible();

    // Client-side navigation to Settings
    await page.click('text=Settings');

    // URL changes but Layout 'ACME Portal' should not have unmounted/re-fetched
    await expect(page).toHaveURL('/acme/settings');
    await expect(page.locator('text=ACME Portal')).toBeVisible();
  });
});
```