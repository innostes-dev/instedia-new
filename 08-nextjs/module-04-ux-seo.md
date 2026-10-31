# Module 04: UX & SEO

## Topic 1: loading.tsx & Streaming with Suspense

### Phase A: The Core Concept

#### 1. Real-World Pain Point (The Why)
When you use Async Server Components, the server waits for the database query to finish before sending HTML to the browser. If your database takes 3 seconds to respond, the user stares at a blank white screen for 3 seconds. They think the site is broken and close the tab. You need a way to show the layout (navbar, sidebar) immediately, and show a skeleton loader where the data will eventually appear.

#### 2. Plain English Metaphor (The What)
Imagine ordering a complex custom car.
- **Without Streaming:** The dealership makes you wait outside in the rain for a month until the whole car is built, then hands you the keys.
- **With Streaming (Suspense):** The dealership lets you sit in the comfortable waiting room (Layout), gives you a coffee (loading state), and rolls the car parts in one by one as they are finished.

#### 3. Complete Runnable Code
```tsx
// app/dashboard/layout.tsx
// This renders IMMEDIATELY because it doesn't await any data
export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  return (
    <div>
      <nav>My App Navbar</nav>
      <main>{children}</main>
    </div>
  );
}

// app/dashboard/loading.tsx
// Next.js automatically wraps the page in <Suspense fallback={<Loading />}>
export default function Loading() {
  return <div className="skeleton-spinner">Loading dashboard data...</div>;
}

// app/dashboard/page.tsx
// This takes 3 seconds to render
export default async function DashboardPage() {
  await new Promise(resolve => setTimeout(resolve, 3000)); // Simulate slow DB
  return <h1>Here is your heavily calculated data!</h1>;
}
```

#### 4. Progressive Step-by-Step Breakdown
**Step 1: The Layout Renders Instantly**
Because `layout.tsx` is not blocked by heavy async operations, Next.js immediately streams its HTML down to the browser. The user sees the navbar instantly.

**Step 2: `loading.tsx` Fills the Gap**
Next.js sees the `loading.tsx` file and uses it as the fallback for a React `<Suspense>` boundary wrapping the `page.tsx`. The user sees "Loading dashboard data..." inside the main layout area.

**Step 3: Streaming the Result**
On the server, 3 seconds pass. The `DashboardPage` finishes resolving. Next.js takes the resulting HTML (`<h1>...</h1>`) and streams it down the same open network connection, telling React to swap out the loading spinner for the real content.

#### 5. ASCII Data Flow
```text
Browser Request
      |
[Server Response Chunk 1 - T=0s]
      |--> Sends Layout HTML + loading.tsx HTML
      |    (User sees Navbar and Spinner)
      |
[Server Response Chunk 2 - T=3s]
      |--> DB query finishes. Sends page.tsx HTML.
      |    (React automatically replaces Spinner with Content)
```

#### 6. Noob Trap vs Pro Tip
**Noob Trap:** Putting the heavy `await fetch()` inside the `layout.tsx` instead of the `page.tsx`. If you block the layout, `loading.tsx` will not show up until the layout finishes loading, meaning the user still gets a blank white screen.
**Pro Tip:** If you have multiple slow components on one page, don't use a single `loading.tsx`. Instead, wrap each individual slow component in its own `<Suspense fallback={<Skeleton />}>` inside `page.tsx`. This allows the fastest parts of the page to appear first.

---

## Topic 2: error.tsx Boundaries

### Phase A: The Core Concept

#### 1. Real-World Pain Point (The Why)
Your page fetches data from a third-party API. One day, the API goes down and returns a 500 error. Your `fetch` fails, an unhandled exception is thrown on the server, and Next.js renders a massive, ugly application crash screen. The user loses their navigation bar and has no way to recover except refreshing the whole page.

#### 2. Plain English Metaphor (The What)
An Error Boundary is like a fuse box in a house. If you plug a faulty toaster into the kitchen wall, it shouldn't burn down the whole house (crash the app). It should just trip the fuse for the kitchen (show an error message in that specific UI area), leaving the living room lights (the Layout/Navbar) on so you can see what you're doing.

#### 3. Complete Runnable Code
```tsx
// app/dashboard/error.tsx
'use client'; // Error components MUST be Client Components
import { useEffect } from 'react';

export default function ErrorBoundary({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    // Log the error to an error reporting service like Sentry
    console.error("Caught in error.tsx:", error);
  }, [error]);

  return (
    <div className="error-box">
      <h2>Something went wrong in the dashboard!</h2>
      <button onClick={() => reset()}>
        Try again
      </button>
    </div>
  );
}

// app/dashboard/page.tsx
export default async function DashboardPage() {
  const res = await fetch('https://api.example.com/unreliable-endpoint');

  if (!res.ok) {
    // This throw is caught by the error.tsx
    throw new Error('Failed to fetch dashboard data');
  }

  return <div>Dashboard Data</div>;
}
```

#### 4. Progressive Step-by-Step Breakdown
**Step 1: The Client Component Requirement**
`error.tsx` MUST include `'use client'`. Why? Because errors can happen during server rendering OR during client-side hydration/interaction. A Client Component can catch both.

**Step 2: Catching the Throw**
When `DashboardPage` throws an Error, Next.js catches it. Instead of crashing the layout, it swaps out `page.tsx` for `error.tsx`, passing the error object as a prop.

**Step 3: The `reset` Function**
Next.js provides a `reset` function prop. Calling it tells Next.js to re-attempt rendering the segment that failed (e.g., re-running the Server Component). If the API is back up, the user recovers without a full page reload.

#### 5. ASCII Data Flow
```text
[ Page.tsx ] throws Error("API Down")
      |
      V
[ Next.js React Tree ]
   <DashboardLayout> (Stays mounted, Navbar visible!)
      |
      +-- catches error --
      |
   <ErrorBoundary error={error} reset={reset}> (Renders instead of Page)
```

#### 6. Noob Trap vs Pro Tip
**Noob Trap:** Using `error.tsx` to handle expected validation errors (like "User not found"). `error.tsx` is for unexpected exceptions (crashes). For expected missing data, use Next.js's `notFound()` function, which triggers `not-found.tsx`.
**Pro Tip:** `error.tsx` catches errors in all nested children, but it DOES NOT catch errors in the `layout.tsx` of the same folder. To catch layout errors, you must put an `error.tsx` in the parent folder, or use `global-error.tsx` at the root.

---

## Topic 3: Dynamic OpenGraph Image (Metadata)

### Phase A: The Core Concept

#### 1. Real-World Pain Point (The Why)
When someone shares your blog post on Twitter or iMessage, you want a beautiful preview image showing the exact title of the post and the author's face. Creating these images manually in Photoshop for 500+ blog posts is impossible. Standard SPA React can't do it at all because crawlers don't execute JS to take screenshots.

#### 2. Plain English Metaphor (The What)
Dynamic OG Images are like an automated Polaroid camera installed on your server. Right before the server hands the webpage over to a social media bot, it quickly writes the blog title on a chalkboard, snaps a photo, and hands that photo to the bot.

#### 3. Complete Runnable Code
```tsx
// app/blog/[slug]/page.tsx
import { Metadata } from 'next';

type Props = { params: { slug: string } };

// Next.js automatically calls this function before rendering the page
export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const post = await fetch(`https://api.example.com/posts/${params.slug}`).then(r => r.json());

  return {
    title: post.title,
    description: post.excerpt,
    openGraph: {
      images: [
        {
          // We route the image request to our dynamic image generator route
          url: `/api/og?title=${encodeURIComponent(post.title)}`,
          width: 1200,
          height: 630,
        },
      ],
    },
  };
}

export default function BlogPost({ params }: Props) {
  return <h1>Blog Post: {params.slug}</h1>;
}
```

#### 4. Progressive Step-by-Step Breakdown
**Step 1: The `generateMetadata` Function**
Exporting this specially-named async function allows you to fetch data and dynamically construct the `<head>` tags (Title, Meta Description, OG tags) for that specific route.

**Step 2: Deduplication**
You might notice we fetch the post in `generateMetadata` AND we will likely fetch it again in the `BlogPost` component. Next.js automatically memoizes (deduplicates) `fetch` requests with the same URL, so the database is only hit once!

**Step 3: Pointing to the Image API**
We set the `openGraph.images.url` to point to a Next.js Image Response route (usually built with `@vercel/og` to generate images using React/JSX on the edge), passing the title as a URL parameter.

#### 5. ASCII Data Flow
```text
Twitter Bot requests -> https://mysite.com/blog/my-cool-post
      |
Next.js Server:
  1. Runs generateMetadata()
  2. Fetches post data.
  3. Injects <meta property="og:image" content="/api/og?title=My%20Cool%20Post" />
      |
Twitter Bot parses HTML, sees image URL, requests Image
      |
Next.js Server (/api/og):
  1. Reads ?title=My Cool Post
  2. Generates PNG image on the fly using JSX.
  3. Returns Image to Twitter Bot.
```

#### 6. Noob Trap vs Pro Tip
**Noob Trap:** Using hardcoded string URLs for `openGraph.images`. When you change your domain (e.g., local to staging to production), the images will break.
**Pro Tip:** Always define a `metadataBase` in your root `layout.tsx` (e.g., `metadataBase: new URL('https://mysite.com')`). Then you can use relative paths like `/api/og` and Next.js will automatically resolve them correctly in all environments.

---

## Phase B: Engineering Challenges

### Level 1: Warm-Up
**Task:** Create a `/products` page that intentionally waits 2 seconds before rendering a list of products. Implement a `loading.tsx` that shows "Fetching catalog..." while the user waits. Ensure the root layout navbar remains visible during the wait.

<details>
<summary>Hint</summary>
Create `app/products/page.tsx` with a `setTimeout` promise. Create `app/products/loading.tsx`.
</details>

<details>
<summary>Solution Walkthrough</summary>

1. `app/products/loading.tsx`:
```tsx
export default function ProductsLoading() {
  return <div>Fetching catalog...</div>;
}
```
2. `app/products/page.tsx`:
```tsx
export default async function ProductsPage() {
  await new Promise(r => setTimeout(r, 2000));
  return <ul><li>Product 1</li><li>Product 2</li></ul>;
}
```
When you navigate to `/products`, the navbar (from root layout) stays visible, the loading text appears, and 2 seconds later, the products list replaces it.
</details>

### Level 2: Real-World
**Task:** Create a `/profile/[id]` route.
- Implement `generateMetadata` to set the page title to the User's name fetched from an API.
- If the fetch fails (e.g., network error), the page should throw an error.
- Catch this error using an `error.tsx` boundary that displays a custom error message and a "Retry" button.

<details>
<summary>Hint</summary>
Export `generateMetadata` in `page.tsx`. In the component body, throw an error if `!res.ok`. Create `error.tsx` with `'use client'`.
</details>

<details>
<summary>Solution Walkthrough</summary>

1. `app/profile/[id]/page.tsx`:
```tsx
import { Metadata } from 'next';

export async function generateMetadata({ params }: { params: { id: string } }): Promise<Metadata> {
  const user = await fetch(`https://jsonplaceholder.typicode.com/users/${params.id}`).then(r => r.json());
  return { title: `${user.name}'s Profile` };
}

export default async function ProfilePage({ params }: { params: { id: string } }) {
  const res = await fetch(`https://jsonplaceholder.typicode.com/users/${params.id}`);
  if (!res.ok) throw new Error('Failed to load profile');
  const user = await res.json();
  return <h1>{user.name}</h1>;
}
```
2. `app/profile/[id]/error.tsx`:
```tsx
'use client';
export default function ProfileError({ error, reset }: { error: Error, reset: () => void }) {
  return (
    <div>
      <h2>Cannot load profile data!</h2>
      <button onClick={() => reset()}>Retry</button>
    </div>
  );
}
```
</details>

### Level 3: Boss Level
**Task:** Build a granularly streamed Dashboard.
The `/dashboard` route needs to display:
1. User Profile Data (Takes 1 second to fetch)
2. Recent Transactions (Takes 4 seconds to fetch)
You must NOT use `loading.tsx`, because that blocks the *entire* page until the 4-second fetch finishes. Instead, use React `<Suspense>` to stream the Profile Data first, while the Transactions continue loading in their own skeleton state.

<details>
<summary>Hint</summary>
Remove async from `page.tsx`. Create two separate async Server Components: `<UserProfile />` and `<RecentTransactions />`. Render them inside `page.tsx`, wrapping each in `<Suspense fallback={...}>`.
</details>

<details>
<summary>Solution Walkthrough</summary>

1. `components/UserProfile.tsx`:
```tsx
export default async function UserProfile() {
  await new Promise(r => setTimeout(r, 1000));
  return <div className="card">User Name: Alice (Loaded fast)</div>;
}
```

2. `components/RecentTransactions.tsx`:
```tsx
export default async function RecentTransactions() {
  await new Promise(r => setTimeout(r, 4000));
  return <div className="card">Transactions: $50, $20 (Loaded slow)</div>;
}
```

3. `app/dashboard/page.tsx`:
```tsx
import { Suspense } from 'react';
import UserProfile from './components/UserProfile';
import RecentTransactions from './components/RecentTransactions';

// NOT async! It renders immediately and streams the children
export default function DashboardPage() {
  return (
    <div>
      <h1>Dashboard Overview</h1>

      <div className="grid">
        <Suspense fallback={<div>Loading Profile...</div>}>
          <UserProfile />
        </Suspense>

        <Suspense fallback={<div>Loading Transactions (Takes 4s)...</div>}>
          <RecentTransactions />
        </Suspense>
      </div>
    </div>
  );
}
```
Result: The user instantly sees "Dashboard Overview". At 1 second, the profile pops in. At 4 seconds, the transactions pop in. Perfect UX.
</details>
