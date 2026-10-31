# Level 3: Advanced Caching & Revalidation

## Scenario
Your application is getting significant traffic. Fetching fresh data on every request is killing your database. You need to implement an intelligent caching strategy that keeps data fresh but reduces load.

## Architecture Diagram
```text
[ CMS ] --> (Publishes Post) --> POST /api/revalidate?secret=xxx&tag=blog-1
                                        |
[ Next.js Cache ] <--- Invalidates tag 'blog-1'
                                        |
[ User 1 ] ---> GET /blog/1 ---> (Cache Miss) ---> Fetches DB ---> Serves & Caches
[ User 2 ] ---> GET /blog/1 ---> (Cache Hit!) ---> Serves Instant HTML
```

## Production Solution Code

### 1. `app/api/revalidate/route.ts`
```ts
import { NextRequest, NextResponse } from 'next/server';
import { revalidateTag } from 'next/cache';

export async function POST(request: NextRequest) {
  const secret = request.nextUrl.searchParams.get('secret');
  const tag = request.nextUrl.searchParams.get('tag');

  if (secret !== process.env.REVALIDATION_TOKEN) {
    return NextResponse.json({ message: 'Invalid token' }, { status: 401 });
  }

  if (!tag) {
    return NextResponse.json({ message: 'Missing tag param' }, { status: 400 });
  }

  revalidateTag(tag);

  return NextResponse.json({ revalidated: true, now: Date.now() });
}
```

### 2. `app/blog/[slug]/page.tsx`
```tsx
export default async function BlogPost({ params }: { params: { slug: string } }) {
  // 1. Fetch with a Cache Tag
  // 2. Also set a fallback Time-based Revalidation of 1 hour (ISR)
  const res = await fetch(`https://jsonplaceholder.typicode.com/posts/${params.slug}`, {
    next: {
      tags: [`post-${params.slug}`],
      revalidate: 3600 // 1 hour
    }
  });

  if (!res.ok) throw new Error("Failed to fetch post");
  const post = await res.json();

  return (
    <article className="max-w-2xl mx-auto p-8">
      <h1 className="text-4xl font-bold mb-4">{post.title}</h1>
      <p className="text-gray-600 leading-relaxed">{post.body}</p>

      <div className="mt-8 p-4 bg-gray-100 rounded text-sm text-gray-500">
        Generated at: {new Date().toISOString()}
      </div>
    </article>
  );
}
```

## Test Suite (cURL / Playwright)
Since caching behavior involves the Next.js production server, unit tests aren't sufficient. We test via integration tests.

```ts
// tests/caching.spec.ts
import { test, expect } from '@playwright/test';

test.describe('Caching & Revalidation', () => {
  test('serves cached page and revalidates via API', async ({ request }) => {
    // 1. Initial Request (Cache Miss -> Hits DB -> Caches)
    const res1 = await request.get('/blog/1');
    const html1 = await res1.text();
    const timestamp1 = html1.match(/Generated at: (.*?)<\/div>/)?.[1];

    // 2. Second Request (Cache Hit -> Returns immediately)
    const res2 = await request.get('/blog/1');
    const html2 = await res2.text();
    const timestamp2 = html2.match(/Generated at: (.*?)<\/div>/)?.[1];

    // Timestamps MUST be exactly the same, proving it was cached
    expect(timestamp1).toEqual(timestamp2);

    // 3. Trigger Webhook to Purge Cache
    const webhookRes = await request.post('/api/revalidate?secret=TEST_SECRET&tag=post-1');
    expect(webhookRes.status()).toBe(200);

    // 4. Third Request (Cache Purged -> Cache Miss -> Hits DB -> Caches)
    const res3 = await request.get('/blog/1');
    const html3 = await res3.text();
    const timestamp3 = html3.match(/Generated at: (.*?)<\/div>/)?.[1];

    // Timestamp MUST be different, proving cache was purged and rebuilt
    expect(timestamp3).not.toEqual(timestamp1);
  });
});
```