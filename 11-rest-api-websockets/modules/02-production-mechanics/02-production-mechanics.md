# Module 02: Production Mechanics

## Topic 1: Cursor vs Offset Pagination

### Phase A: Problem-First Exploration

#### 1. Real-World Pain Point (The Why)
Imagine a massive social media feed. You request page 1 (items 1-10) using `?page=1&limit=10`. While you are reading, 5 new posts are added to the top of the feed. When you click "Next Page" (`?page=2&limit=10`), the database calculates items 11-20. Because 5 new items were pushed to the top, items 6-10 shifted down to become items 11-15. You end up seeing items 6-10 again! This is the classic "Offset Pagination drift." Furthermore, `OFFSET 1000000` is incredibly slow because the database has to scan and discard a million rows before returning the next 10.

#### 2. Plain English Metaphor (The What)
- **Offset Pagination:** Saying "Give me 10 books, skipping the first 100 on the shelf." If someone inserts a book at the start of the shelf while you aren't looking, your counting gets messed up, and counting past thousands of books takes a long time.
- **Cursor Pagination:** Saying "Give me 10 books that come directly *after* the book titled 'Harry Potter'." No matter how many books are added before it, you always know exactly where to resume, and looking up the starting point is instantaneous.

#### 3. Complete Runnable Code
```javascript
const express = require('express');
const app = express();
app.use(express.json());

// Mock DB sorted by ID descending (newest first)
const posts = Array.from({ length: 100 }, (_, i) => ({ id: 100 - i, title: `Post ${100 - i}` }));

// OFFSET PAGINATION (Flawed for real-time data)
app.get('/api/posts-offset', (req, res) => {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 10;
    const offset = (page - 1) * limit;

    const results = posts.slice(offset, offset + limit);
    res.json({ data: results, nextPage: page + 1 });
});

// CURSOR PAGINATION (Production ready)
app.get('/api/posts-cursor', (req, res) => {
    const limit = parseInt(req.query.limit) || 10;
    const cursor = parseInt(req.query.cursor); // ID of the last item seen

    let startIndex = 0;
    if (cursor) {
        // Find the index of the cursor, start fetching AFTER it
        const cursorIndex = posts.findIndex(p => p.id === cursor);
        startIndex = cursorIndex >= 0 ? cursorIndex + 1 : 0;
    }

    const results = posts.slice(startIndex, startIndex + limit);

    // The new cursor is the ID of the last item in the results
    const nextCursor = results.length > 0 ? results[results.length - 1].id : null;

    res.json({ data: results, nextCursor });
});

app.listen(3000, () => console.log('Server running'));
```

#### 4. Progressive Step-by-Step Breakdown
**Step 1: Identifying the Flaw in Offset**
Offset relies on absolute mathematical positions. If the absolute size of the data changes (inserts/deletes), the positions shift.
**Step 2: Defining the Cursor**
A cursor must be a unique, sequential identifier (like an auto-incrementing ID or a highly precise timestamp combined with a UUID).
**Step 3: Executing the Cursor Query**
Instead of `OFFSET X`, the database query becomes `WHERE id < :cursor ORDER BY id DESC LIMIT 10`. This hits the database index directly, making it extremely fast, even for millions of records.

#### 5. ASCII Data Flow
```text
[Feed State: IDs 10, 9, 8, 7, 6, 5, 4, 3...]
Client: GET /posts?limit=3
Server: Returns [10, 9, 8]. nextCursor=8.

*New post ID 11 added* -> [11, 10, 9, 8, 7, 6...]

Client: GET /posts?limit=3&cursor=8
Server: Looks for items < 8. Returns [7, 6, 5]. nextCursor=5.
(No duplicates shown, despite new data!)
```

#### 6. Noob Trap vs Pro Tip
**Noob Trap:** Using offset pagination for high-velocity feeds (like chat apps, Twitter, logs) because it's easier to implement `skip()` in Mongoose or `OFFSET` in SQL.
**Pro Tip:** Use cursor pagination encoded in base64. Instead of sending `?cursor=123`, send `?cursor=eyJpZCI6MTIzfQ==` (which is `{"id":123}`). This hides the internal ID structure from the user and allows you to add secondary sort fields to the cursor later without breaking client code.

---

### Phase B: Engineering Challenges

#### Level 1: Warm-Up
**Challenge:** Write the SQL query equivalent for cursor pagination fetching 10 items older than cursor ID `452`, ordered newest first.
<details>
<summary>Hint</summary>
Use `WHERE`, `ORDER BY`, and `LIMIT`.
</details>
<details>
<summary>Solution Walkthrough</summary>
```sql
SELECT * FROM posts
WHERE id < 452
ORDER BY id DESC
LIMIT 10;
```
</details>

#### Level 2: Real-World
**Challenge:** Implement a function that generates a Base64 encoded cursor from a database row object, and a function that decodes it back to an object.
<details>
<summary>Hint</summary>
Use `Buffer.from(string).toString('base64')` and `Buffer.from(base64, 'base64').toString('utf-8')`.
</details>
<details>
<summary>Solution Walkthrough</summary>
```javascript
function encodeCursor(obj) {
    const str = JSON.stringify(obj);
    return Buffer.from(str).toString('base64');
}

function decodeCursor(base64Str) {
    if (!base64Str) return null;
    const str = Buffer.from(base64Str, 'base64').toString('utf-8');
    return JSON.parse(str);
}

// Usage:
// const nextCursor = encodeCursor({ id: 10, createdAt: '2023-10-01' });
```
</details>

#### Level 3: Boss Level (Cumulative)
**Challenge:** Build an Express endpoint that uses Base64 encoded cursor pagination. It must validate that if a cursor is passed, it is valid Base64 and contains an `id` field. If valid, return the next 2 items. Use the mock `posts` array from Phase A.
<details>
<summary>Hint</summary>
Combine the decoding logic from Level 2 with the cursor logic from Phase A. Return a 400 Bad Request if the cursor is malformed.
</details>
<details>
<summary>Solution Walkthrough</summary>
```javascript
app.get('/api/v2/posts', (req, res) => {
    const limit = 2;
    let cursorId = null;

    if (req.query.cursor) {
        try {
            const decoded = decodeCursor(req.query.cursor);
            if (!decoded || !decoded.id) throw new Error('Invalid cursor schema');
            cursorId = decoded.id;
        } catch (err) {
            return res.status(400).json({ error: 'Malformed cursor parameter' });
        }
    }

    let startIndex = 0;
    if (cursorId) {
        const cursorIndex = posts.findIndex(p => p.id === cursorId);
        startIndex = cursorIndex >= 0 ? cursorIndex + 1 : 0;
    }

    const results = posts.slice(startIndex, startIndex + limit);

    let nextCursor = null;
    if (results.length > 0) {
        nextCursor = encodeCursor({ id: results[results.length - 1].id });
    }

    res.json({ data: results, nextCursor });
});
```
</details>

<br><br>

## Topic 2: URL Query Parameters

### Phase A: Problem-First Exploration

#### 1. Real-World Pain Point (The Why)
You have an endpoint `/api/products`. The business wants to filter by category, sort by price, search by keyword, and paginate. If you use URL paths for this (e.g., `/api/products/electronics/price_asc/page/2`), your routing becomes an absolute nightmare, and combinations are impossible (What if they want to sort without filtering?).

#### 2. Plain English Metaphor (The What)
The URL Path (`/api/products`) is the noun—it's the filing cabinet drawer you are opening.
Query Parameters (`?category=shoes&sort=price`) are the adjectives and verbs—they are the filters and instructions you give to the person searching through that drawer.

#### 3. Complete Runnable Code
```javascript
const express = require('express');
const app = express();

const products = [
    { id: 1, name: 'Laptop', category: 'electronics', price: 1000 },
    { id: 2, name: 'Phone', category: 'electronics', price: 500 },
    { id: 3, name: 'Shoes', category: 'apparel', price: 100 }
];

app.get('/api/products', (req, res) => {
    // 1. Extract query params (Express parses them automatically)
    const { category, minPrice, sort } = req.query;

    let results = [...products];

    // 2. Apply Filters
    if (category) {
        results = results.filter(p => p.category === category);
    }
    if (minPrice) {
        // Warning: Query params are ALWAYS strings, must parse!
        results = results.filter(p => p.price >= parseFloat(minPrice));
    }

    // 3. Apply Sorting
    if (sort === 'price_asc') {
        results.sort((a, b) => a.price - b.price);
    } else if (sort === 'price_desc') {
        results.sort((a, b) => b.price - a.price);
    }

    res.json(results);
});
```

#### 4. Progressive Step-by-Step Breakdown
**Step 1: The Question Mark**
The `?` marks the end of the routing path and the beginning of the query string. `&` separates key-value pairs.
**Step 2: String parsing**
Everything in a query string is a string. `?isActive=true` results in `req.query.isActive === "true"`, not a boolean. You must cast types on the server.
**Step 3: Array handling**
Standard conventions allow arrays via repeated keys: `?color=red&color=blue`. Express parses this as `req.query.color = ['red', 'blue']`.

#### 5. ASCII Data Flow
```text
Client Request: GET /api/products?category=electronics&minPrice=600

Express Router: Matches path '/api/products'
Express Parser: req.query = { category: "electronics", minPrice: "600" }

Logic:
1. Filter electronics -> [Laptop, Phone]
2. Filter price >= 600 -> [Laptop]

Response: [ { id: 1, name: 'Laptop'... } ]
```

#### 6. Noob Trap vs Pro Tip
**Noob Trap:** Using a POST request with a JSON body just because you have a lot of complex filters. POST requests cannot be easily cached by CDNs or linked/shared by users.
**Pro Tip:** If you have highly complex filters (like a nested JSON query), URL-encode a JSON string in a GET parameter: `?query=%7B%22price%22%3A%7B%22gt%22%3A500%7D%7D`. For extremely massive queries that exceed URL length limits (2048 chars), *then* fall back to POST (often utilizing a `/search` endpoint, e.g., `POST /api/products/search`).

---

### Phase B: Engineering Challenges

#### Level 1: Warm-Up
**Challenge:** How do you safely parse a boolean query parameter `?inStock=true` in Node.js?
<details>
<summary>Hint</summary>
Don't use `Boolean(req.query.inStock)` because `Boolean("false")` is true!
</details>
<details>
<summary>Solution Walkthrough</summary>
```javascript
const inStockStr = req.query.inStock;
const isInStock = inStockStr === 'true'; // strictly compare against string 'true'
```
</details>

#### Level 2: Real-World
**Challenge:** Write a utility function that takes a query object like `req.query` and ensures the `limit` parameter is an integer between 1 and 100, defaulting to 20 if missing or invalid.
<details>
<summary>Hint</summary>
Use `parseInt`, `isNaN`, `Math.min`, and `Math.max`.
</details>
<details>
<summary>Solution Walkthrough</summary>
```javascript
function parseLimit(queryLimit) {
    let limit = parseInt(queryLimit, 10);
    if (isNaN(limit)) {
        return 20; // Default
    }
    return Math.max(1, Math.min(100, limit)); // Clamp between 1 and 100
}
```
</details>

#### Level 3: Boss Level (Cumulative)
**Challenge:** Combine REST Methods, Status Codes, and Query Parameters. Create an endpoint `DELETE /api/logs` that deletes logs based on a `?beforeDate=` query parameter. If `beforeDate` is missing, return a 400 Client Error (don't delete everything!). If valid, return 204 No Content.
<details>
<summary>Hint</summary>
Validate the existence of the query param first.
</details>
<details>
<summary>Solution Walkthrough</summary>
```javascript
app.delete('/api/logs', (req, res) => {
    const beforeDate = req.query.beforeDate;

    if (!beforeDate) {
        // Status 400 ensures we don't accidentally wipe the DB
        return res.status(400).json({
            error: "Safety check failed: 'beforeDate' query parameter is required for bulk deletion."
        });
    }

    const dateLimit = new Date(beforeDate);
    if (isNaN(dateLimit.getTime())) {
        return res.status(400).json({ error: "Invalid date format." });
    }

    // (Mock deletion logic here: db.logs.deleteMany({ date: { $lt: dateLimit } }))

    // Status 204 indicating success with no body needed
    res.status(204).send();
});
```
</details>

<br><br>

## Topic 3: OpenAPI / Swagger

### Phase A: Problem-First Exploration

#### 1. Real-World Pain Point (The Why)
You build a beautiful REST API. You tell the frontend team, "Just hit `/users`." The frontend team asks: "Is it GET or POST? What does the JSON body look like? What headers do I need? What errors can it return?" If you write documentation in a Wiki or Notion, it is guaranteed to be out of date the minute you deploy code.

#### 2. Plain English Metaphor (The What)
OpenAPI (formerly Swagger) is a legally binding contract between the backend and the frontend. Instead of writing documentation in English, you write a blueprint in YAML or JSON. This blueprint can automatically generate beautiful web UI documentation, and even automatically generate client SDK code (like Axios functions) for the frontend team.

#### 3. Complete Runnable Code
Here is how you serve Swagger documentation in Express using `swagger-ui-express`.

```javascript
const express = require('express');
const swaggerUi = require('swagger-ui-express');
const app = express();

// The OpenAPI Document (Blueprint)
const openApiDoc = {
  openapi: "3.0.0",
  info: {
    title: "Simple User API",
    version: "1.0.0"
  },
  paths: {
    "/users": {
      get: {
        summary: "Returns a list of users",
        responses: {
          "200": {
            description: "Successful response",
            content: {
              "application/json": {
                schema: {
                  type: "array",
                  items: {
                    type: "object",
                    properties: {
                      id: { type: "integer", example: 1 },
                      name: { type: "string", example: "Alice" }
                    }
                  }
                }
              }
            }
          }
        }
      }
    }
  }
};

// Mount the UI
app.use('/api-docs', swaggerUi.serve, swaggerUi.setup(openApiDoc));

// Actual endpoint
app.get('/users', (req, res) => res.json([{ id: 1, name: 'Alice' }]));

app.listen(3000, () => console.log('Swagger running on http://localhost:3000/api-docs'));
```

#### 4. Progressive Step-by-Step Breakdown
**Step 1: Info and Metadata**
The root of the OpenAPI spec defines the version of the spec (`3.0.0`) and the API details (Title, Version).
**Step 2: Paths and Methods**
Under `paths`, you define the endpoints (`/users`), and inside those, the HTTP methods (`get`, `post`).
**Step 3: Schemas**
For every request body and response, you define a JSON Schema. This tells the consumer exactly what fields to expect, their data types (`integer`, `string`), and provides examples.

#### 5. ASCII Data Flow
```text
Developer writes Code + OpenAPI Spec (YAML/JSON)
       |
       v
Swagger UI generates Interactive Web Page
       |
       v
Frontend Dev visits /api-docs
       |
       v
Frontend Dev clicks "Try it out" -> Sends GET /users -> Sees actual response
```

#### 6. Noob Trap vs Pro Tip
**Noob Trap:** Maintaining a massive thousands-of-lines `swagger.json` file manually by hand. It becomes a nightmare to edit.
**Pro Tip:** Use tools like `swagger-jsdoc` to write OpenAPI specs as JSDoc comments directly above your Express route controllers. This keeps the documentation right next to the code, so developers remember to update it when they change the code.

---

### Phase B: Engineering Challenges

#### Level 1: Warm-Up
**Challenge:** In the `openApiDoc` JSON above, add a 401 response to the `/users` endpoint indicating "Unauthorized".
<details>
<summary>Hint</summary>
Add a `"401"` key under the `responses` object.
</details>
<details>
<summary>Solution Walkthrough</summary>
```json
"responses": {
  "200": { ... },
  "401": {
    "description": "Missing or invalid token"
  }
}
```
</details>

#### Level 2: Real-World
**Challenge:** You have an endpoint `GET /products/{id}`. Write the OpenAPI `parameters` configuration to define the `id` path parameter.
<details>
<summary>Hint</summary>
It should be an array of parameter objects. The `in` property must be `"path"`, and `required` must be `true`.
</details>
<details>
<summary>Solution Walkthrough</summary>
```json
{
  "paths": {
    "/products/{id}": {
      "get": {
        "parameters": [
          {
            "name": "id",
            "in": "path",
            "required": true,
            "schema": { "type": "integer" },
            "description": "The product ID"
          }
        ]
      }
    }
  }
}
```
</details>

#### Level 3: Boss Level (Cumulative)
**Challenge:** Integrate pagination query parameters (`limit` and `cursor`), proper REST methods, and OpenAPI schema definition. Write the OpenAPI spec for `GET /api/posts` that accepts `limit` and `cursor` query parameters, and returns a 200 JSON response containing a `data` array and a `nextCursor` string.
<details>
<summary>Hint</summary>
You need two parameters where `in: "query"`. The response needs an object schema with `data` (type: array) and `nextCursor` (type: string).
</details>
<details>
<summary>Solution Walkthrough</summary>
```javascript
const spec = {
  paths: {
    "/api/posts": {
      get: {
        summary: "Get paginated posts via cursor",
        parameters: [
          {
            name: "limit",
            in: "query",
            schema: { type: "integer", default: 10 },
            description: "Number of posts to fetch"
          },
          {
            name: "cursor",
            in: "query",
            schema: { type: "string" },
            description: "Base64 encoded cursor for pagination"
          }
        ],
        responses: {
          "200": {
            description: "A page of posts",
            content: {
              "application/json": {
                schema: {
                  type: "object",
                  properties: {
                    data: {
                      type: "array",
                      items: { type: "object" } // Simplified for brevity
                    },
                    nextCursor: {
                      type: "string",
                      nullable: true
                    }
                  }
                }
              }
            }
          }
        }
      }
    }
  }
}
```
</details>
