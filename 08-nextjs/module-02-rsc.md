# Module 02: React Server Components

## Topic 1: Zero Client Bundle Weight

### Phase A: The Core Concept

#### 1. Real-World Pain Point (The Why)
In traditional React, importing a heavy library like `moment.js` or `marked` to format dates or render markdown means sending that entire library to the user's browser. If you have 500KB of dependencies, the user has to download, parse, and execute 500KB of JavaScript before your page becomes interactive, leading to terrible Lighthouse scores and slow mobile experiences.

#### 2. Plain English Metaphor (The What)
Imagine you need a heavy wooden table built (the UI). In a standard React app, you ship an entire lumber mill, a sawmill, and blueprints to the customer's house, making them build it. With React Server Components, you build the table in your own factory (the Server) and just ship the finished wooden table (HTML/UI) to the customer. Zero heavy tools (bundle weight) are sent to the customer.

#### 3. Complete Runnable Code
```tsx
// app/blog/page.tsx
import { marked } from 'marked'; // Heavy markdown parser
import sanitizeHtml from 'sanitize-html'; // Heavy sanitizer

// This is a Server Component.
// Neither 'marked' nor 'sanitize-html' will be sent to the browser!
export default async function BlogPost() {
  const rawMarkdown = "# Hello Server Components\nThis is **awesome**.";

  // Processing happens entirely on the server
  const html = sanitizeHtml(marked.parse(rawMarkdown));

  return (
    <article>
      <div dangerouslySetInnerHTML={{ __html: html }} />
    </article>
  );
}
```

#### 4. Progressive Step-by-Step Breakdown
**Step 1: Heavy Imports**
We import `marked` and `sanitize-html`. In a traditional SPA, this adds significant kilobytes to the final JavaScript bundle.

**Step 2: Server-Side Execution**
Because this file doesn't have `'use client'`, it is a Server Component. Next.js executes the component function on the Node.js server. The `marked.parse` runs on the server.

**Step 3: Sending only the Result**
The browser receives the final generated HTML string: `<div><h1>Hello Server Components</h1><p>This is <strong>awesome</strong>.</p></div>`. The JavaScript for `marked` is completely absent from the network payload.

#### 5. ASCII Data Flow
```text
[ Server (Has Node Modules) ]                [ Browser (Lightweight) ]
             |                                          |
 1. Execute <BlogPost />                                |
 2. Run marked.parse()                                  |
 3. Output standard HTML                                |
             | --- Sends ONLY HTML: <article>... --->   |
             |                                          | Render immediately
```

#### 6. Noob Trap vs Pro Tip
**Noob Trap:** Adding `'use client'` at the top of the root layout or a high-level page component just because one button needs `onClick`. This accidentally opts the entire tree back into the client bundle, downloading all dependencies to the browser.
**Pro Tip:** Only add `'use client'` to the specific leaf components (like a `LikeButton`) that need interactivity. Keep heavy processing in the Server Components above it.

---

## Topic 2: The 'use client' Boundary

### Phase A: The Core Concept

#### 1. Real-World Pain Point (The Why)
Server Components are great, but they cannot use `useState`, `useEffect`, or `onClick`. If you need a carousel, a form with instant validation, or a button that toggles a modal, Server Components will fail. You need a way to tell Next.js, "Hey, this specific part of the UI needs to run in the browser."

#### 2. Plain English Metaphor (The What)
Think of Server Components as a printed magazine (static, fast, pre-rendered). Think of Client Components as a smartphone embedded in that magazine page. The `'use client'` directive is the border of that smartphone screen. Everything outside is static print; everything inside is interactive software.

#### 3. Complete Runnable Code
```tsx
// app/components/LikeButton.tsx
'use client'; // This directive creates the boundary

import { useState } from 'react';

export default function LikeButton({ initialLikes }: { initialLikes: number }) {
  const [likes, setLikes] = useState(initialLikes);

  return (
    <button
      onClick={() => setLikes(l => l + 1)}
      className="bg-blue-500 text-white p-2 rounded"
    >
      ❤️ {likes} Likes
    </button>
  );
}

// app/page.tsx
import LikeButton from './components/LikeButton';

export default async function Page() {
  const post = await fetch('https://api.example.com/post/1').then(r => r.json());

  return (
    <main>
      <h1>{post.title}</h1>
      <p>{post.content}</p>
      {/* Crossing the boundary: Passing data from Server to Client */}
      <LikeButton initialLikes={post.likes} />
    </main>
  );
}
```

#### 4. Progressive Step-by-Step Breakdown
**Step 1: The Directive**
`'use client'` must be the very first line of code in the file. It tells Next.js bundler: "Bundle this file and all its imports to be sent to the browser."

**Step 2: Client Capabilities**
Because we crossed the boundary, we can now use React hooks (`useState`) and event listeners (`onClick`).

**Step 3: Server to Client Data Passing**
The Server Component (`Page`) fetches the data securely. It passes `post.likes` as a prop across the boundary to the Client Component (`LikeButton`). Note: Props passed across this boundary must be serializable (no functions, no classes).

#### 5. ASCII Data Flow
```text
[ Server Environment ]
    <Page> (Server Component)
      ├─ <h1>...</h1> (Static HTML)
      ├─ <p>...</p> (Static HTML)
      │
====== 'use client' BOUNDARY ======
      │
[ Browser Environment ]
      └─ <LikeButton> (Client Component)
           ├─ useState()
           └─ onClick()
```

#### 6. Noob Trap vs Pro Tip
**Noob Trap:** Thinking `'use client'` means the component is *only* rendered on the client. False! Client components are still pre-rendered (SSR) on the server for the initial HTML load to improve SEO, then they are hydrated on the client.
**Pro Tip:** Push the `'use client'` boundary as far down the component tree as possible (to the "leaves"). Don't make a whole `Card` a client component if only the `SaveButton` inside it needs state.

---

## Topic 3: Composition (Interleaving Server and Client)

### Phase A: The Core Concept

#### 1. Real-World Pain Point (The Why)
You have a Client Component (like a collapsible Sidebar or an interactive Layout) that needs to wrap Server Components (like a list of articles fetched securely from a database). If you import a Server Component directly into a Client Component file, it becomes a Client Component! How do you wrap static server content inside interactive client shells without ruining the server-side benefits?

#### 2. Plain English Metaphor (The What)
Think of a Client Component as a picture frame, and the Server Component as the painting. You can't ask the frame-maker (Client) to paint the picture (Server). But, the frame-maker can build a frame with an empty hole in the middle (`children`), and you can place the pre-painted picture into that hole later.

#### 3. Complete Runnable Code
```tsx
// app/components/InteractiveLayout.tsx
'use client';
import { useState } from 'react';

// Notice it accepts `children`
export default function InteractiveLayout({ children }: { children: React.ReactNode }) {
  const [isOpen, setIsOpen] = useState(true);

  return (
    <div>
      <button onClick={() => setIsOpen(!isOpen)}>Toggle Content</button>
      {/* The client component doesn't know what children is, it just renders it */}
      {isOpen && <div className="content">{children}</div>}
    </div>
  );
}

// app/components/ServerArticleList.tsx
// (No 'use client' - This is a Server Component)
export default async function ServerArticleList() {
  const articles = await fetch('...').then(r => r.json());
  return <ul>{articles.map(a => <li key={a.id}>{a.title}</li>)}</ul>;
}

// app/page.tsx
import InteractiveLayout from './components/InteractiveLayout';
import ServerArticleList from './components/ServerArticleList';

export default function Page() {
  return (
    <main>
      {/* Composition: We pass the Server Component AS A PROP to the Client Component */}
      <InteractiveLayout>
        <ServerArticleList />
      </InteractiveLayout>
    </main>
  );
}
```

#### 4. Progressive Step-by-Step Breakdown
**Step 1: The Client Shell**
`InteractiveLayout` has `'use client'` because it needs `useState`. Crucially, it accepts a `children` prop.

**Step 2: The Server Content**
`ServerArticleList` fetches data and remains a pure Server Component.

**Step 3: The Composition Point**
In `page.tsx` (a Server Component), we bring them together. By passing `<ServerArticleList />` as `children` into `<InteractiveLayout>`, Next.js knows to evaluate `ServerArticleList` on the server, create the HTML payload, and pass that payload into the "hole" of the Client Component.

#### 5. ASCII Data Flow
```text
[ Server ]
 1. Render <Page>
 2. Render <ServerArticleList> -> Output: <ul><li>...</li></ul> (HTML)
 3. Recognize <InteractiveLayout> is a Client Component.

[ Browser ]
 4. Load <InteractiveLayout> JS (React hydration).
 5. Inject the pre-rendered <ul> HTML into the `children` slot.
```

#### 6. Noob Trap vs Pro Tip
**Noob Trap:** Importing `<ServerArticleList />` at the top of `InteractiveLayout.tsx` and rendering it directly. This forces `ServerArticleList` to become a Client Component, breaking server fetching and bloating the bundle.
**Pro Tip:** Always use the `children` prop (or custom ReactNode props) to pass Server Components down into Client Components. This pattern is essential for Layouts and Context Providers.

---

## Phase B: Engineering Challenges

### Level 1: Warm-Up
**Task:** Create a page that fetches user data from an API (Server Component). It should display a button that alerts the user's name when clicked. Keep the client bundle as small as possible.

<details>
<summary>Hint</summary>
Create a Server Component for the page and fetching. Create a separate small Client Component just for the button. Pass the user's name from the Server Component to the Client Component.
</details>

<details>
<summary>Solution Walkthrough</summary>

1. `AlertButton.tsx`:
```tsx
'use client';
export default function AlertButton({ name }: { name: string }) {
  return <button onClick={() => alert(`Hello ${name}`)}>Say Hi</button>;
}
```
2. `page.tsx`:
```tsx
import AlertButton from './AlertButton';

export default async function Page() {
  const user = await fetch('https://jsonplaceholder.typicode.com/users/1').then(r => r.json());

  return (
    <div>
      <h1>User Profile</h1>
      <p>{user.name}</p>
      <AlertButton name={user.name} />
    </div>
  );
}
```
</details>

### Level 2: Real-World
**Task:** Build a Context Provider for a light/dark theme. Wrap your entire application in this provider. Ensure that wrapping the root layout in this Client Component Provider does not turn your pages into Client Components.

<details>
<summary>Hint</summary>
Create a `ThemeProvider.tsx` with `'use client'`. It must accept and render `children`. Import and use it in `app/layout.tsx`.
</details>

<details>
<summary>Solution Walkthrough</summary>

1. `ThemeProvider.tsx`:
```tsx
'use client';
import { createContext, useState } from 'react';

export const ThemeContext = createContext('light');

export default function ThemeProvider({ children }: { children: React.ReactNode }) {
  const [theme, setTheme] = useState('light');
  return (
    <ThemeContext.Provider value={theme}>
      <div className={`theme-${theme}`}>
        <button onClick={() => setTheme(t => t === 'light' ? 'dark' : 'light')}>Toggle</button>
        {children}
      </div>
    </ThemeContext.Provider>
  );
}
```
2. `app/layout.tsx`:
```tsx
import ThemeProvider from './ThemeProvider';

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html>
      <body>
        <ThemeProvider>
          {/* All nested pages remain Server Components! */}
          {children}
        </ThemeProvider>
      </body>
    </html>
  );
}
```
</details>

### Level 3: Boss Level
**Task:** Build a Markdown Blog Post viewer.
Requirements:
1. Fetch the raw markdown from an API (Server Component).
2. Parse the markdown to HTML on the server using a heavy library (Zero client bundle).
3. The blog post contains an interactive "Table of Contents" (TOC) sidebar that highlights the active heading as the user scrolls. The TOC must be a Client Component.
4. Compose them correctly so the heavy markdown parser is never sent to the client.

<details>
<summary>Hint</summary>
`page.tsx` fetches and parses the markdown. It renders a Client Component `<TOCLayout>`. Inside `<TOCLayout>`, pass the parsed markdown HTML as `children`.
</details>

<details>
<summary>Solution Walkthrough</summary>

1. `TOCLayout.tsx` (Client Component):
```tsx
'use client';
import { useEffect, useState } from 'react';

export default function TOCLayout({ children, headings }: { children: React.ReactNode, headings: string[] }) {
  const [active, setActive] = useState('');

  // Implementation of scroll spy goes here...

  return (
    <div style={{ display: 'flex' }}>
      <aside>
        <ul>{headings.map(h => <li key={h} className={active === h ? 'bold' : ''}>{h}</li>)}</ul>
      </aside>
      <main>{children}</main>
    </div>
  );
}
```
2. `page.tsx` (Server Component):
```tsx
import { marked } from 'marked'; // Heavy, stays on server
import TOCLayout from './TOCLayout';

export default async function BlogPost() {
  const rawMarkdown = await fetch('...').then(r => r.text());

  // Parse on server
  const html = marked.parse(rawMarkdown);

  // Extract headings for the TOC (simplified)
  const headings = ['Introduction', 'Body', 'Conclusion'];

  return (
    <TOCLayout headings={headings}>
      {/* Passed as children, preserving Server Component status */}
      <div dangerouslySetInnerHTML={{ __html: html }} />
    </TOCLayout>
  );
}
```
</details>
