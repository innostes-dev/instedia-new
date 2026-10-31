# Module 03: Data Fetching & Mutations

## Topic 1: Async Server Components

### Phase A: The Core Concept

#### 1. Real-World Pain Point (The Why)
In traditional React (SPAs), fetching data meant rendering a spinner, waiting for the component to mount (`useEffect`), making a network request from the user's browser, waiting for the response, setting state, and finally rendering the data. This caused "waterfall" fetching, layout shift, and poor performance on slow mobile networks.

#### 2. Plain English Metaphor (The What)
Traditional React fetching is like arriving at an empty hotel room, calling room service, and waiting for them to bring the furniture. Async Server Components are like booking a fully furnished room; when you open the door (load the page), everything is already there. The server did the waiting and assembling before giving you the keys.

#### 3. Complete Runnable Code
```tsx
// app/dashboard/page.tsx
// Notice the `async` keyword. This is only possible in Server Components.
export default async function DashboardPage() {
  // The server pauses here and waits for the database/API
  // The client sees NOTHING until this is resolved (or a loading.tsx is shown)
  const userStats = await fetch('https://api.example.com/stats', {
    // Next.js specific caching option
    cache: 'no-store'
  }).then(res => res.json());

  return (
    <main>
      <h1>Your Dashboard</h1>
      <div className="stats-grid">
        <p>Views: {userStats.views}</p>
        <p>Likes: {userStats.likes}</p>
      </div>
    </main>
  );
}
```

#### 4. Progressive Step-by-Step Breakdown
**Step 1: The `async` Keyword**
By adding `async` to the component declaration, we can use `await` directly inside the component body. No `useState`, no `useEffect`.

**Step 2: Server-Side Fetch**
The `fetch` request originates from the Next.js server, not the user's browser. It is much faster because the server is usually physically closer to the database/API than the user's mobile phone.

**Step 3: Rendering Block**
The server halts rendering of this component until the `await` resolves. Once it resolves, it generates the HTML with the real data and sends it to the browser.

#### 5. ASCII Data Flow
```text
Browser Request --> Next.js Server
                         |
                         |-- (async DashboardPage starts)
                         |-- fetch() to DB/API
                         |-- (Server waits...)
                         |<-- Data Returns
                         |-- HTML Generated
                         V
Browser <---------- Complete HTML with Data
```

#### 6. Noob Trap vs Pro Tip
**Noob Trap:** Using `async` on a Client Component (`'use client'`). React will throw a massive error. Client Components cannot be async.
**Pro Tip:** If you have multiple independent fetches, don't `await` them sequentially. Use `Promise.all` to fetch them in parallel to drastically reduce server response time.

---

## Topic 2: Server Actions & Forms

### Phase A: The Core Concept

#### 1. Real-World Pain Point (The Why)
Building forms in React used to require creating an API route (e.g., `pages/api/submit`), writing a `handleSubmit` function on the client, managing loading state (`isSubmitting`), calling `fetch('/api/submit')`, handling CORS, and manually re-fetching data to update the UI. It was exhausting boilerplate.

#### 2. Plain English Metaphor (The What)
Server Actions are like having a direct pneumatic tube from your web form straight to the server's database. You don't need to hire a delivery driver (API route) or fill out shipping manifests (fetch setup). You just put the data in the tube (the Server Action), and it arrives safely on the server.

#### 3. Complete Runnable Code
```tsx
// app/actions.ts (Create a separate file for actions)
'use server'; // This directive makes everything in this file a Server Action

import { revalidatePath } from 'next/cache';

export async function createPost(formData: FormData) {
  // This code runs securely on the server
  const title = formData.get('title');
  const content = formData.get('content');

  // Simulate database insert
  await db.post.create({ data: { title, content } });

  // Tell Next.js to purge the cache for the home page and fetch fresh data
  revalidatePath('/');
}

// app/page.tsx
import { createPost } from './actions';

export default function Page() {
  return (
    // We pass the Server Action directly to the form's `action` prop
    <form action={createPost}>
      <input type="text" name="title" required placeholder="Title" />
      <textarea name="content" required placeholder="Content" />
      <button type="submit">Submit Post</button>
    </form>
  );
}
```

#### 4. Progressive Step-by-Step Breakdown
**Step 1: `'use server'` Directive**
Placing `'use server'` at the top of a file or inside an async function tells Next.js: "Create a hidden, secure POST endpoint for this function."

**Step 2: The `action` Prop**
React 18 extends the native HTML `<form action="...">` to accept JavaScript functions. When the form submits, React intercepts it and securely sends the `FormData` to the Server Action.

**Step 3: `revalidatePath`**
After mutating data on the server, you must tell Next.js to invalidate its cache. `revalidatePath('/')` forces the server to re-render the `/` route with the new data, instantly updating the UI for the user.

#### 5. ASCII Data Flow
```text
[ Browser Form ]
      |
      | User clicks Submit
      | Next.js creates hidden POST request
      V
[ Next.js Server ]
      |
      | Executes createPost(formData)
      | Saves to DB
      | Runs revalidatePath('/') -> Server re-fetches data
      V
[ Browser ] <--- Receives updated UI payload automatically
```

#### 6. Noob Trap vs Pro Tip
**Noob Trap:** Forgetting to validate the `FormData` on the server. Just because it's a Server Action doesn't mean it's safe. Anyone can curl the hidden endpoint.
**Pro Tip:** Always use a library like `zod` inside your Server Action to parse and validate the `FormData` before touching your database.

---

## Topic 3: ISR Revalidation & useOptimistic

### Phase A: The Core Concept

#### 1. Real-World Pain Point (The Why)
- **Pain 1 (ISR):** Fetching data on every single request (`no-store`) is slow and expensive. But fetching it once (`force-cache`) means the data is stale forever.
- **Pain 2 (Optimistic UI):** When a user clicks "Like" on a post, waiting 500ms for the Server Action to complete before turning the heart red feels sluggish and broken.

#### 2. Plain English Metaphor (The What)
- **ISR (Time-based Revalidation):** It's like a stock ticker that updates every 60 seconds. It's fast because it's reading a cached value, but it ensures the value is never more than a minute old.
- **useOptimistic:** It's like paying with a credit card. The merchant hands you the coffee immediately (optimistic UI) assuming the transaction will clear in the background. If the card declines (Server Action fails), they take the coffee back.

#### 3. Complete Runnable Code
```tsx
// 1. Time-based Revalidation (ISR) in a Server Component
// app/post/[id]/page.tsx
export default async function PostPage({ params }: { params: { id: string } }) {
  // Cache this fetch, but re-fetch in the background if it's older than 60 seconds
  const post = await fetch(`https://api.example.com/posts/${params.id}`, {
    next: { revalidate: 60 }
  }).then(r => r.json());

  return <PostDetail post={post} />;
}

// 2. useOptimistic in a Client Component
// app/components/PostDetail.tsx
'use client';
import { useOptimistic } from 'react';
import { likePost } from '@/app/actions';

export default function PostDetail({ post }: { post: any }) {
  // [optimisticState, functionToUpdateOptimisticState]
  const [optimisticLikes, addOptimisticLike] = useOptimistic(
    post.likes, // Initial state from server
    (state, amount: number) => state + amount // How to update it optimistically
  );

  const handleLike = async () => {
    // 1. Update UI instantly
    addOptimisticLike(1);
    // 2. Fire Server Action in background
    await likePost(post.id);
    // 3. Next.js automatically reconciles the true state via revalidatePath inside likePost
  };

  return (
    <div>
      <h1>{post.title}</h1>
      <button onClick={handleLike}>❤️ {optimisticLikes}</button>
    </div>
  );
}
```

#### 4. Progressive Step-by-Step Breakdown
**Step 1: `next: { revalidate: 60 }`**
This tells the Next.js cache to serve a static, fast response. If a request comes in and the cache is older than 60 seconds, Next.js serves the stale data immediately, but fires off a background fetch to update the cache for the *next* user.

**Step 2: `useOptimistic` Hook**
This React hook takes the true server state (`post.likes`) and provides a temporary optimistic state (`optimisticLikes`).

**Step 3: Instant Feedback & Reconciliation**
When `handleLike` is called, the UI updates instantly. The Server Action `likePost` runs. Inside `likePost`, you call `revalidatePath`. When the action finishes, React automatically discards the optimistic state and replaces it with the fresh, true state from the server.

#### 5. ASCII Data Flow (useOptimistic)
```text
User Clicks "Like"
      |
      |--> 1. useOptimistic adds +1. UI updates INSTANTLY.
      |
      |--> 2. Server Action fired (background network request).
             |
             |--> Server updates DB.
             |--> Server calls revalidatePath().
             |
      |<-- 3. Server returns fresh true state.
      |
      |--> 4. React replaces optimistic state with true server state.
```

#### 6. Noob Trap vs Pro Tip
**Noob Trap:** Using `useOptimistic` for destructive actions like "Delete Account". If the server action fails, the account reappears, confusing and angering the user.
**Pro Tip:** Only use `useOptimistic` for low-stakes, easily reversible UI interactions (likes, upvotes, adding to a cart, checking a todo item).

---

## Phase B: Engineering Challenges

### Level 1: Warm-Up
**Task:** Create an async Server Component that fetches a list of 5 users from `https://jsonplaceholder.typicode.com/users` and renders them. Use `Promise.all` to artificially delay the rendering by 2 seconds using `setTimeout`.

<details>
<summary>Hint</summary>
Create a helper function `const delay = (ms) => new Promise(res => setTimeout(res, ms));`. Await both the fetch and the delay in the Server Component.
</details>

<details>
<summary>Solution Walkthrough</summary>

```tsx
// app/users/page.tsx
const delay = (ms: number) => new Promise(res => setTimeout(res, ms));

export default async function UsersPage() {
  // Parallel execution
  const [res] = await Promise.all([
    fetch('https://jsonplaceholder.typicode.com/users'),
    delay(2000)
  ]);

  const users = await res.json();

  return (
    <ul>
      {users.slice(0, 5).map((u: any) => (
        <li key={u.id}>{u.name}</li>
      ))}
    </ul>
  );
}
```
</details>

### Level 2: Real-World
**Task:** Build a Newsletter Signup Form using Server Actions.
- The form takes an email.
- The Server Action should validate that the email includes an "@".
- If valid, return a success message. If invalid, return an error message.
- Use the `useFormState` hook (or `useActionState` in React 19) in a Client Component to display the success/error message without full page reloads.

<details>
<summary>Hint</summary>
Your Server Action must return an object like `{ message: string }`. In your Client Component, import `useActionState` (or `useFormState`), pass it the action, and use the returned state to show the message.
</details>

<details>
<summary>Solution Walkthrough</summary>

1. `actions.ts`:
```ts
'use server';
export async function subscribe(prevState: any, formData: FormData) {
  const email = formData.get('email') as string;
  if (!email || !email.includes('@')) {
    return { message: 'Invalid email address.' };
  }
  // Simulate DB save
  return { message: 'Success! You are subscribed.' };
}
```
2. `NewsletterForm.tsx`:
```tsx
'use client';
import { useActionState } from 'react';
import { subscribe } from './actions';

export default function NewsletterForm() {
  const [state, formAction] = useActionState(subscribe, { message: '' });

  return (
    <form action={formAction}>
      <input type="email" name="email" required />
      <button type="submit">Subscribe</button>
      {state?.message && <p>{state.message}</p>}
    </form>
  );
}
```
</details>

### Level 3: Boss Level
**Task:** Build a Todo List with Optimistic UI and Server Actions.
1. `page.tsx` (Server Component) fetches todos and renders `<TodoList />`.
2. `<TodoList />` (Client Component) uses `useOptimistic` to handle adding a new todo.
3. When the user types a todo and hits enter, it should optimistically appear in the list instantly, while calling the `addTodo` Server Action in the background.

<details>
<summary>Hint</summary>
Pass the initial todos from the server to the Client Component. Initialize `useOptimistic` with them. In the form action wrapper, first call `addOptimisticTodo`, then `await addTodo(formData)`.
</details>

<details>
<summary>Solution Walkthrough</summary>

1. `actions.ts`:
```ts
'use server';
import { revalidatePath } from 'next/cache';

// Mock DB
let todos = [{ id: '1', text: 'Learn RSC' }];

export async function getTodos() { return todos; }

export async function addTodo(formData: FormData) {
  const text = formData.get('text') as string;
  await new Promise(r => setTimeout(r, 1000)); // Simulate slow network
  todos.push({ id: Math.random().toString(), text });
  revalidatePath('/'); // Triggers UI update
}
```

2. `TodoList.tsx` (Client):
```tsx
'use client';
import { useOptimistic, useRef } from 'react';
import { addTodo } from './actions';

export default function TodoList({ initialTodos }: { initialTodos: any[] }) {
  const formRef = useRef<HTMLFormElement>(null);
  const [optimisticTodos, addOptimisticTodo] = useOptimistic(
    initialTodos,
    (state, newTodo: any) => [...state, newTodo]
  );

  const action = async (formData: FormData) => {
    const text = formData.get('text') as string;
    formRef.current?.reset();

    // 1. Optimistic Update (Instant)
    addOptimisticTodo({ id: 'temp', text: `${text} (saving...)` });

    // 2. Server Mutation
    await addTodo(formData);
  };

  return (
    <div>
      <ul>
        {optimisticTodos.map(t => <li key={t.id}>{t.text}</li>)}
      </ul>
      <form action={action} ref={formRef}>
        <input type="text" name="text" required />
        <button type="submit">Add</button>
      </form>
    </div>
  );
}
```

3. `page.tsx` (Server):
```tsx
import TodoList from './TodoList';
import { getTodos } from './actions';

export default async function Page() {
  const todos = await getTodos();
  return <TodoList initialTodos={todos} />;
}
```
</details>
