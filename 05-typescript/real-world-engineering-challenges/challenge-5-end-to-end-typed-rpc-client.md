# Challenge 5: End-to-End Typed RPC Client

## Scenario
You are building an API client for a Next.js application. You have defined your API endpoints and their expected payloads using Zod schemas on the server. You want the frontend client to automatically infer these types, so if the backend changes an API requirement, the frontend compiler immediately throws an error.

## Challenge Requirements
1. Define a `Router` object mapping endpoint paths (e.g., `"/api/users"`) to a Zod schema representing the expected POST payload.
2. Create a generic `rpcClient(endpoint, payload)` function.
3. The `endpoint` must be a valid key of the `Router`.
4. The `payload` must perfectly match the inferred TypeScript type of the Zod schema for that specific endpoint.

<details>
<summary>Solution Walkthrough</summary>

```typescript
import { z } from "zod";

// 1. Define the Backend Schemas
const CreateUserSchema = z.object({
  username: z.string().min(3),
  email: z.string().email()
});

const UpdateConfigSchema = z.object({
  theme: z.enum(["light", "dark"]),
  retries: z.number().min(0)
});

// 2. The Router definition (Usually shared between frontend/backend via a monorepo)
const AppRouter = {
  "/api/users/create": CreateUserSchema,
  "/api/config/update": UpdateConfigSchema
};

// We extract the type of the Router object itself
type RouterType = typeof AppRouter;

// 3. The Generic RPC Client
// K is constrained to the valid paths: "/api/users/create" | "/api/config/update"
async function rpcClient<K extends keyof RouterType>(
  endpoint: K,
  // We use z.infer to dynamically extract the TypeScript type from the Zod schema
  // associated with this specific endpoint!
  payload: z.infer<RouterType[K]>
) {

  // Simulate network request
  console.log(`Sending payload to ${endpoint}:`, payload);
  return { success: true };
}

// --- Usage & Testing ---

// OK: Endpoint is valid, payload perfectly matches CreateUserSchema
rpcClient("/api/users/create", {
  username: "alice",
  email: "alice@example.com"
});

// ERROR: Missing username
// rpcClient("/api/users/create", { email: "alice@example.com" });

// ERROR: Invalid endpoint
// rpcClient("/api/unknown", { ... });

// OK: Valid endpoint, payload matches UpdateConfigSchema
rpcClient("/api/config/update", {
  theme: "dark",
  retries: 3
});

// ERROR: Theme must be light or dark, retries must be a number
// rpcClient("/api/config/update", { theme: "neon", retries: "three" });
```

**Walkthrough:**
This is the holy grail of modern web development (similar to tRPC). By defining Zod schemas in a shared file, we create a single source of truth for runtime validation. By utilizing `z.infer<RouterType[K]>`, we bridge the gap, forcing the frontend compiler to strictly adhere to the backend's runtime requirements. If the backend adds a `password` field to the Zod schema, the frontend build instantly fails until the payload is updated.
</details>
