# Module 01: The SPA Dilemma

## Topic 1: Empty HTML SEO Death

### Phase A: The Core Concept

#### 1. Real-World Pain Point (The Why)
Imagine spending months building a beautiful Single Page Application (SPA) with React. You launch it, wait for the traffic, and... nothing. When you check Google Search Console, your pages aren't indexed. You curl your website and see `<div id="root"></div>` and a `<script>` tag. Search engine crawlers (and social media link preview bots) see an empty white page because they don't always execute Javascript. Your SEO is dead on arrival.

#### 2. Plain English Metaphor (The What)
A traditional SPA is like a restaurant that gives you an empty plate and a recipe book (JavaScript), expecting you to cook the meal yourself at the table. Server-Side Rendering (SSR) and Next.js are like a traditional restaurant: the chef cooks the meal in the kitchen (Server) and brings you a fully prepared, ready-to-eat dish (HTML).

#### 3. Complete Runnable Code
```tsx
// app/page.tsx - Next.js App Router
// This is automatically Server-Side Rendered (SSR)
export default async function HomePage() {
  // Fetching happens on the server before HTML is sent to the client
  const res = await fetch('https://api.example.com/products');
  const products = await res.json();

  return (
    <main>
      <h1>Our Products</h1>
      <ul>
        {products.map((product: any) => (
          <li key={product.id}>{product.name}</li>
        ))}
      </ul>
    </main>
  );
}
```

#### 4. Progressive Step-by-Step Breakdown
**Step 1: Server-Side Component Declaration**
By default, components in the Next.js `app/` directory are React Server Components. The `async` keyword indicates that this component will perform asynchronous work on the server.

**Step 2: Server-Side Fetching**
The `fetch` call runs on the Node.js server, not the user's browser. The client never sees this network request in their DevTools.

**Step 3: HTML Generation**
Next.js takes the React tree, fully resolves it with the fetched data, and serializes it into raw HTML. When a crawler hits the page, it immediately sees `<h1>Our Products</h1>` and the `<ul>` of products.

#### 5. ASCII Data Flow
```text
[ Browser / Crawler ]                  [ Next.js Server ]
        |                                      |
        | --- 1. GET / ----------------------> |
        |                                      | --- 2. fetch() API
        |                                      | <--- Data returned
        |                                      |
        | <--- 3. Fully populated HTML ------- |
        |      (<h1>Our Products...</h1>)      |
```

#### 6. Noob Trap vs Pro Tip
**Noob Trap:** Using `useEffect` to fetch critical SEO data in a client component. The page will load empty, show a spinner, and crawlers might index the spinner instead of the content.
**Pro Tip:** Always fetch initial, critical data in a Server Component using `await fetch()`. Only use client-side fetching for highly interactive, user-specific data that doesn't matter for SEO (like notifications).

---

## Topic 2: App Router File Conventions

### Phase A: The Core Concept

#### 1. Real-World Pain Point (The Why)
In older React apps, routing meant configuring massive `<Route>` switch statements. When the app grew to 100+ routes, the central router file became a merge-conflict nightmare. You had to manually map URLs to file paths and components.

#### 2. Plain English Metaphor (The What)
File-based routing is like a physical filing cabinet. If you want the "Q3 Reports" document, you open the drawer labeled "Reports", then the folder labeled "Q3". The URL structure exactly matches your folder structure. Next.js enforces specific filenames (`page.tsx`, `layout.tsx`) so it knows exactly what each file does without you having to write a mapping.

#### 3. Complete Runnable Code
```text
app/
├── layout.tsx         <-- Root layout (wraps everything)
├── page.tsx           <-- Maps to "/"
├── about/
│   └── page.tsx       <-- Maps to "/about"
└── blog/
    ├── layout.tsx     <-- Blog-specific layout
    └── [slug]/
        └── page.tsx   <-- Maps to "/blog/my-post"
```

#### 4. Progressive Step-by-Step Breakdown
**Step 1: Folders Define Routes**
Creating a folder named `about` inside `app/` automatically creates a route for `/about`.

**Step 2: The `page.tsx` File**
A folder is not publicly accessible unless it contains a `page.tsx` file. This prevents accidental exposure of utility files or components.

**Step 3: Dynamic Segments `[slug]`**
Square brackets define dynamic parameters. `/blog/[slug]/page.tsx` will match `/blog/hello-world`. The `slug` value is passed as a prop to the page component.

#### 5. ASCII Data Flow
```text
URL Request: /blog/nextjs-routing

Next.js File System Check:
app/
 └─ blog/
     └─ [slug]/
         └─ page.tsx  ==> MATCH! (slug = "nextjs-routing")
```

#### 6. Noob Trap vs Pro Tip
**Noob Trap:** Putting all components (buttons, cards, utilities) in the `app/` directory alongside route folders, creating a messy structure.
**Pro Tip:** Use Next.js "Private Folders" (prefix with `_`, e.g., `_components`) or keep your UI components in a separate `src/components/` directory. Next.js ignores `_` prefixed folders for routing.

---

## Topic 3: Persistent Layouts

### Phase A: The Core Concept

#### 1. Real-World Pain Point (The Why)
In classic React router setups, transitioning between pages often caused the navigation bar and sidebar to unmount and remount. This meant losing UI state (like an expanded accordion menu) and causing unnecessary flickers and re-renders of heavy components.

#### 2. Plain English Metaphor (The What)
A Persistent Layout is like the frame of a house. When you remodel the kitchen (a nested page), you don't tear down the outer walls and roof (the layout). The layout stays intact, preserving its state, while only the specific room inside gets swapped out.

#### 3. Complete Runnable Code
```tsx
// app/dashboard/layout.tsx
import Sidebar from '@/components/Sidebar';

export default function DashboardLayout({
  children, // will be a page or nested layout
}: {
  children: React.ReactNode
}) {
  return (
    <div className="flex h-screen">
      <Sidebar />
      <div className="flex-1 p-8 overflow-y-auto">
        {/* The active page content goes here */}
        {children}
      </div>
    </div>
  );
}

// app/dashboard/page.tsx
export default function DashboardHome() {
  return <h1>Welcome to the Dashboard</h1>;
}
```

#### 4. Progressive Step-by-Step Breakdown
**Step 1: The Layout File**
Creating a `layout.tsx` file in a folder makes it apply to that route and all its children.

**Step 2: The `children` Prop**
Layouts MUST accept and render a `children` prop. Next.js automatically injects the active nested page or layout into this prop.

**Step 3: Persistence on Navigation**
When navigating from `/dashboard` to `/dashboard/settings`, the `DashboardLayout` does not re-render. The `Sidebar` retains any local state (like open dropdowns), and no extra network requests are made for layout data.

#### 5. ASCII Data Flow
```text
Navigating: /dashboard -> /dashboard/settings

[ DashboardLayout (Stays Mounted) ]
  |-- [ Sidebar (State Preserved) ]
  |-- [ Children Prop ]
         |
         |-- OUT: <DashboardHome /> (Unmounts)
         |-- IN:  <DashboardSettings /> (Mounts)
```

#### 6. Noob Trap vs Pro Tip
**Noob Trap:** Fetching highly dynamic data inside a layout and expecting it to refresh on every page navigation. Layouts do not re-render on navigation, so their data fetches are cached.
**Pro Tip:** If you need data to refresh on every navigation, fetch it in the `page.tsx` instead, or use Next.js navigation events to trigger a router refresh.

---

## Phase B: Engineering Challenges

### Level 1: Warm-Up
**Task:** Create a basic file structure for a portfolio site with a Home page, an About page, and a dynamic Project page (`/projects/[id]`). Add a persistent global navigation bar.

<details>
<summary>Hint</summary>
You need a `layout.tsx` in the root `app/` folder for the navbar. Then create `about/page.tsx` and `projects/[id]/page.tsx`.
</details>

<details>
<summary>Solution Walkthrough</summary>

1. Create `app/layout.tsx`:
```tsx
export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>
        <nav>
          <a href="/">Home</a> | <a href="/about">About</a> | <a href="/projects">Projects</a>
        </nav>
        {children}
      </body>
    </html>
  );
}
```
2. Create `app/page.tsx` (Home), `app/about/page.tsx`.
3. Create `app/projects/[id]/page.tsx`:
```tsx
export default function ProjectPage({ params }: { params: { id: string } }) {
  return <h1>Project ID: {params.id}</h1>;
}
```
</details>

### Level 2: Real-World
**Task:** You are migrating a legacy SPA blog to Next.js. The `/blog` route must have its own sidebar layout containing a list of categories. The actual blog posts will live under `/blog/[slug]`. Both the layout and the post must fetch data from a mock API.

<details>
<summary>Hint</summary>
Create `app/blog/layout.tsx` and fetch categories. Create `app/blog/[slug]/page.tsx` and fetch the specific post using `params.slug`.
</details>

<details>
<summary>Solution Walkthrough</summary>

1. `app/blog/layout.tsx`:
```tsx
export default async function BlogLayout({ children }: { children: React.ReactNode }) {
  // Simulating fetch
  const categories = ['Tech', 'Lifestyle', 'Code'];
  return (
    <div style={{ display: 'flex' }}>
      <aside>
        <h3>Categories</h3>
        <ul>{categories.map(c => <li key={c}>{c}</li>)}</ul>
      </aside>
      <main>{children}</main>
    </div>
  );
}
```
2. `app/blog/[slug]/page.tsx`:
```tsx
export default async function BlogPost({ params }: { params: { slug: string } }) {
  const { slug } = params;
  // Simulate fetch
  return <h1>Read all about: {slug}</h1>;
}
```
</details>

### Level 3: Boss Level
**Task:** Build an Admin Dashboard with nested layouts.
- Root Layout: Global Navbar.
- `/admin` Layout: Persistent Sidebar for admin links.
- `/admin/users/[userId]` Page: Fetches user details securely on the server.
Ensure that navigating between different users (`/admin/users/1` -> `/admin/users/2`) does not cause the admin sidebar to re-render, but does fetch the new user's data.

<details>
<summary>Hint</summary>
The hierarchy should be: `app/layout.tsx` -> `app/admin/layout.tsx` -> `app/admin/users/[userId]/page.tsx`. Use Next.js `<Link>` for navigation to ensure client-side routing with server-rendered payloads.
</details>

<details>
<summary>Solution Walkthrough</summary>

1. Root Layout handles HTML/Body and global nav.
2. `app/admin/layout.tsx`:
```tsx
import Link from 'next/link';

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex">
      <nav className="sidebar">
        <Link href="/admin/users/1">User 1</Link>
        <Link href="/admin/users/2">User 2</Link>
      </nav>
      <div className="content">
        {children}
      </div>
    </div>
  );
}
```
3. `app/admin/users/[userId]/page.tsx`:
```tsx
export default async function UserPage({ params }: { params: { userId: string } }) {
  // This runs on the server every time a new user is navigated to
  const user = await fetch(`https://jsonplaceholder.typicode.com/users/${params.userId}`).then(r => r.json());

  return (
    <div>
      <h1>{user.name}</h1>
      <p>{user.email}</p>
    </div>
  );
}
```
Because we use `<Link>`, Next.js only fetches the React Server Component payload for the new page and injects it into the persistent `AdminLayout`.
</details>
