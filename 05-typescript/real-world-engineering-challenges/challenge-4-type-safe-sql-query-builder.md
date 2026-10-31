# Challenge 4: Type-Safe SQL Query Builder

## Scenario
You are writing a lightweight wrapper around a SQL database. You want a function `select(fields).from(table)`.
The problem: if a developer asks for `select(["name", "email"]).from("users")`, how do you guarantee that `"name"` and `"email"` actually exist on the `users` table?
You need to build a query engine that uses Generics and `keyof` to enforce column name correctness.

## Challenge Requirements
1. Create a `DatabaseSchema` mapping table names to their data types.
    - `users`: `{ id: number, name: string, email: string }`
    - `posts`: `{ id: number, title: string, authorId: number }`
2. Create a generic function `createQuery<TableName>`.
3. It should accept the `TableName` (which must be a valid key of `DatabaseSchema`).
4. It should return an object with a `select` method.
5. The `select` method must accept an array of strings. These strings *must* be valid keys (columns) for the chosen table.

<details>
<summary>Solution Walkthrough</summary>

```typescript
// 1. The Database Schema (Single Source of Truth)
interface DatabaseSchema {
  users: {
    id: number;
    name: string;
    email: string;
  };
  posts: {
    id: number;
    title: string;
    authorId: number;
  };
}

// 2. The Query Engine
// TName is constrained to only be "users" | "posts"
function createQuery<TName extends keyof DatabaseSchema>(tableName: TName) {

  // We determine the shape of the row based on the table name
  type RowType = DatabaseSchema[TName];

  return {
    // 3. The Select Method
    // K is constrained to the keys of the specific RowType
    select: <K extends keyof RowType>(columns: K[]) => {

      // We simulate executing the query
      console.log(`SELECT ${columns.join(", ")} FROM ${tableName}`);

      // Advanced: We could even strongly type the return array using Pick!
      // This represents the data coming back from the DB
      return [] as Pick<RowType, K>[];
    }
  };
}

// --- Usage & Testing ---

const userQuery = createQuery("users");

// OK: "id" and "name" exist on users
userQuery.select(["id", "name"]);

// ERROR: "title" does not exist on the users table!
// userQuery.select(["id", "title"]);

const postQuery = createQuery("posts");

// OK: "title" exists on posts
postQuery.select(["title", "authorId"]);

// ERROR: "email" does not exist on posts
// postQuery.select(["title", "email"]);
```

**Walkthrough:**
This simulates exactly how ORMs like Prisma or Kysely work under the hood.
- `TName extends keyof DatabaseSchema` locks down the table name.
- `DatabaseSchema[TName]` looks up the exact interface for that table.
- `<K extends keyof RowType>` ensures that the columns requested inside `select()` strictly match the interface for that specific table.
It creates an end-to-end type-safe SQL experience.
</details>
