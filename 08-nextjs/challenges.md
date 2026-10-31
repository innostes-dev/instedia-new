# Real-World Engineering Challenges: Next.js App Router

Welcome to the Principal Engineer certification for the Next.js App Router. These challenges are designed to test your ability to architect, implement, and optimize real-world applications using Server Components, Server Actions, and Streaming.

## Challenge 1: E-Commerce Server Actions Cart
**Theme:** Data Fetching & Mutations

### The Goal
Build a fully functional shopping cart that works even if JavaScript is disabled in the browser (Progressive Enhancement), but provides a seamless optimistic UI when JavaScript is enabled.

### Requirements
1. **Product Listing (Server Component):** Fetch a list of products from a mock API.
2. **Add to Cart (Server Action):** Create a Server Action that receives a `productId` via a form submission and updates the user's cart in a mock database.
3. **Cart Badge (Optimistic UI):** The header should display the current number of items in the cart. When a user clicks "Add to Cart", the badge should instantly increment using `useOptimistic` before the Server Action completes.
4. **Resilience:** Ensure the form submission works completely natively (via `<form action={addToCart}>`) so that if the React JS bundle hasn't loaded yet (or fails to load), the user can still buy products.

### Success Criteria
- The network tab shows zero client-side `fetch()` requests when adding to the cart. It relies entirely on Server Actions and `revalidatePath`.
- The cart badge updates immediately without waiting for the server response.

---

## Challenge 2: Multi-Tenant Documentation Portal
**Theme:** App Router File Conventions & Metadata

### The Goal
Architect a routing structure for a SaaS platform that hosts documentation for multiple tenants (e.g., `acme.docsite.com` and `globex.docsite.com`), where each tenant has their own layout and branding.

### Requirements
1. **Dynamic Routing:** Use Next.js dynamic routing to handle tenant IDs in the URL (e.g., `/[tenant]/docs/[slug]`).
2. **Tenant-Specific Layouts:** Create a persistent layout that fetches the tenant's brand colors and logo based on the `tenant` parameter in the URL.
3. **Dynamic Metadata:** Implement `generateMetadata` on the `[slug]/page.tsx` to dynamically set the page title to `{Doc Title} - {Tenant Name} Docs`.
4. **Static Generation (Optional Bonus):** Use `generateStaticParams` to pre-render the documentation for the top 5 largest tenants at build time.

### Success Criteria
- Navigating between different docs (`/acme/docs/intro` -> `/acme/docs/api`) does NOT cause the Acme branding layout to re-render.
- The browser tab correctly displays dynamically generated titles based on both the tenant and the document.

---

## Challenge 3: Streaming Dashboard
**Theme:** UX, Suspense, and Parallel Fetching

### The Goal
Build an analytics dashboard that aggregates data from 4 different slow, unreliable microservices. The user must never see a blank screen, and fast data should never be blocked by slow data.

### Requirements
1. **The Services:** Simulate 4 API calls:
   - `fetchUser()`: 500ms
   - `fetchDailyStats()`: 2000ms
   - `fetchRevenueGraph()`: 4000ms
   - `fetchRecentLogs()`: Randomly fails 30% of the time, takes 1500ms.
2. **Component Architecture:** Break the dashboard into granular Async Server Components for each data source.
3. **Streaming:** Use React `<Suspense>` boundaries with appropriate skeleton loaders for the slow components.
4. **Error Boundaries:** Implement an `error.tsx` boundary specifically for the `fetchRecentLogs()` component, so when it fails, the rest of the dashboard remains perfectly intact, and the user gets a "Retry" button just for the logs.

### Success Criteria
- The initial HTML (Layout + Skeletons) is delivered in under 100ms.
- Components pop into existence on the screen precisely as their respective API calls resolve.
- If the logs service fails, a localized error boundary handles it without crashing the page.