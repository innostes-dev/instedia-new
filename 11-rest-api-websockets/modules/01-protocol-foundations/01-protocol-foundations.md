# Module 01: Protocol Foundations

## Topic 1: REST Constraints

### Phase A: Problem-First Exploration

#### 1. Real-World Pain Point (The Why)
Imagine a world before REST. Developers built APIs using SOAP and XML-RPC, where every service had custom, unpredictable endpoints like `/getUserInfo`, `/updateUserNow`, and `/executeUserDeletion`. Every API felt like learning a completely different language. The pain? Impossible onboarding, tight coupling between client and server, and no standard way to cache data or scale systems horizontally.

#### 2. Plain English Metaphor (The What)
Think of a well-organized library. You don't have to ask the librarian for "the blue book with the dragon on it." The library uses a standardized Dewey Decimal System (like REST URLs) and standard actions: Read a book, Return a book, Check out a book (like HTTP methods). The REST architecture provides these standard "rules of the library" so any client can understand any server.

#### 3. Complete Runnable Code
Let's build a simple non-RESTful vs RESTful Express server comparison.

```javascript
const express = require('express');
const app = express();
app.use(express.json());

let users = [{ id: 1, name: 'Alice' }];

// NON-RESTful API
app.post('/api/get-all-users', (req, res) => res.json(users));
app.post('/api/create-user-now', (req, res) => {
    users.push({ id: 2, name: req.body.name });
    res.send('Done');
});

// RESTful API (Resource-Based)
// State is transferred without needing custom action verbs in the URL
app.get('/api/users', (req, res) => res.json(users));
app.post('/api/users', (req, res) => {
    const newUser = { id: users.length + 1, name: req.body.name };
    users.push(newUser);
    res.status(201).json(newUser);
});

app.listen(3000, () => console.log('Server running'));
```

#### 4. Progressive Step-by-Step Breakdown
**Step 1: Identifying Resources**
REST focuses on "nouns" (Resources) rather than "verbs" (Actions). Instead of `/createUser`, the resource is `/users`.
**Step 2: Statelessness**
Every request from client to server must contain all the information necessary to understand the request. The server shouldn't remember previous requests to process the current one.
**Step 3: Uniform Interface**
By using standard HTTP methods (GET, POST) applied to standard resource URIs (`/users`), the API interface becomes predictable and uniform across the entire application.

#### 5. ASCII Data Flow
```text
[Client]                               [Server]
   |                                      |
   | --- GET /users (Noun + HTTP Verb) -> |
   |                                      |
   | <- 200 OK [{id:1, name:"Alice"}] --- |
   |      (Stateless representation)      |
```

#### 6. Noob Trap vs Pro Tip
**Noob Trap:** Using verbs in URLs (e.g., `/api/users/update/1`).
**Pro Tip:** Always use plural nouns for collections (e.g., `/api/users/1`) and rely on HTTP methods to define the action. Use sub-resources for nested relations (e.g., `/api/users/1/posts`).

---

### Phase B: Engineering Challenges

#### Level 1: Warm-Up
**Challenge:** Convert this non-REST endpoint to a RESTful one: `POST /api/deleteUser?id=5`
<details>
<summary>Hint</summary>
Use the DELETE method and place the ID in the URL path.
</details>
<details>
<summary>Solution Walkthrough</summary>
The correct RESTful endpoint is `DELETE /api/users/5`. The resource is the user collection, identifying the specific user via the path parameter `5`, and using the HTTP DELETE method to indicate the action.
</details>

#### Level 2: Real-World
**Challenge:** Design the RESTful endpoints for an e-commerce cart. You need to view the cart, add an item, remove an item, and clear the cart.
<details>
<summary>Hint</summary>
The cart usually belongs to a user or a session. For a specific user's cart, think about `/users/{id}/cart`.
</details>
<details>
<summary>Solution Walkthrough</summary>
- View Cart: `GET /api/users/{userId}/cart`
- Add Item: `POST /api/users/{userId}/cart/items`
- Remove Item: `DELETE /api/users/{userId}/cart/items/{itemId}`
- Clear Cart: `DELETE /api/users/{userId}/cart/items` (or `DELETE /api/users/{userId}/cart`)
</details>

#### Level 3: Boss Level (Cumulative)
**Challenge:** Implement an Express middleware that enforces a REST constraint: Statelessness. Ensure that an authorization token is passed via headers and not relying on a server-side session variable.
<details>
<summary>Hint</summary>
Check `req.headers.authorization`. If missing, reject the request. Do not use `req.session`.
</details>
<details>
<summary>Solution Walkthrough</summary>
```javascript
function statelessAuthMiddleware(req, res, next) {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
        return res.status(401).json({ error: 'Missing or invalid token. Must be stateless.' });
    }
    // Verify token (mocked)
    const token = authHeader.split(' ')[1];
    if (token !== 'valid-token') {
         return res.status(401).json({ error: 'Invalid token' });
    }
    next();
}
// Usage: app.get('/api/protected', statelessAuthMiddleware, (req, res) => ...)
```
</details>

<br><br>

## Topic 2: GET/POST/PUT/PATCH/DELETE

### Phase A: Problem-First Exploration

#### 1. Real-World Pain Point (The Why)
If everything is just a POST request, caching mechanisms (like CDNs, browsers) have no idea if a request is safe to cache. Furthermore, if a network error occurs, clients don't know if retrying the request will result in creating duplicate data.

#### 2. Plain English Metaphor (The What)
Think of a filing cabinet.
- **GET:** Looking at a file. (Safe, repeatable)
- **POST:** Shoving a brand new file into the cabinet. (If you do it twice, you get two files).
- **PUT:** Replacing an entire folder with a new version of the folder. (Doing it twice just replaces the new folder with the same new folder - no extra duplicates).
- **PATCH:** Opening a folder and updating just one sticky note inside.
- **DELETE:** Throwing the folder in the shredder.

#### 3. Complete Runnable Code
```javascript
const express = require('express');
const app = express();
app.use(express.json());

let db = {
    users: {
        1: { id: 1, name: 'Alice', role: 'admin', age: 30 }
    }
};

// GET: Read
app.get('/users/:id', (req, res) => {
    res.json(db.users[req.params.id]);
});

// POST: Create
app.post('/users', (req, res) => {
    const id = Date.now(); // mock ID
    db.users[id] = { id, ...req.body };
    res.status(201).json(db.users[id]);
});

// PUT: Full Replace (Idempotent)
app.put('/users/:id', (req, res) => {
    // Replaces the entire resource. If role isn't provided, it is lost!
    db.users[req.params.id] = { id: Number(req.params.id), ...req.body };
    res.json(db.users[req.params.id]);
});

// PATCH: Partial Update (Idempotent usually)
app.patch('/users/:id', (req, res) => {
    // Only updates provided fields
    db.users[req.params.id] = { ...db.users[req.params.id], ...req.body };
    res.json(db.users[req.params.id]);
});

// DELETE: Remove
app.delete('/users/:id', (req, res) => {
    delete db.users[req.params.id];
    res.status(204).send();
});
```

#### 4. Progressive Step-by-Step Breakdown
**Step 1: Safe vs Unsafe**
GET is "safe"—it doesn't alter server state. POST/PUT/PATCH/DELETE are unsafe—they change data.
**Step 2: Idempotency**
PUT and DELETE are idempotent. If you DELETE user 5 ten times, the end state is the same: user 5 is gone. POST is not idempotent; POSTing 10 times creates 10 users.
**Step 3: PUT vs PATCH**
PUT means "Here is the entirely new entity, replace the old one." PATCH means "Here is a diff, apply these specific changes."

#### 5. ASCII Data Flow
```text
[Client]                      [Server]
   | --- PUT /users/1 ---------> |
   | {"name": "Bob"}             | (Overwrites completely, age & role lost!)
   | <- 200 OK {"name":"Bob"} -- |
   |                             |
   | --- PATCH /users/1 -------> |
   | {"age": 31}                 | (Merges changes)
   | <- 200 OK {"name":"Bob",    |
   |            "age": 31}       |
```

#### 6. Noob Trap vs Pro Tip
**Noob Trap:** Using POST for updates because "it works." This breaks idempotency semantics, making automatic client retries dangerous.
**Pro Tip:** Always strive to use PUT for full updates and PATCH for partials. This allows API gateways and clients to implement smart retry logic for network timeouts safely.

---

### Phase B: Engineering Challenges

#### Level 1: Warm-Up
**Challenge:** You want to increment a view counter on an article. Should you use PUT or PATCH? Why?
<details>
<summary>Hint</summary>
Are you replacing the whole article or just updating one field?
</details>
<details>
<summary>Solution Walkthrough</summary>
PATCH. You are partially updating the resource (the views count). You don't want to send the entire article body back just to increment a counter.
*Note: In advanced scenarios, an RPC-style POST like `POST /articles/1/view` is also acceptable because incrementing isn't strictly idempotent (calling PATCH `views + 1` twice increments twice, technically violating pure idempotency).*
</details>

#### Level 2: Real-World
**Challenge:** Implement a resilient client-side retry logic for a `PUT` request using JavaScript fetch.
<details>
<summary>Hint</summary>
Wrap `fetch` in a function that catches network errors and retries up to 3 times.
</details>
<details>
<summary>Solution Walkthrough</summary>
```javascript
async function resilientPut(url, data, retries = 3) {
    for (let i = 0; i < retries; i++) {
        try {
            const res = await fetch(url, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(data)
            });
            if (!res.ok) throw new Error('HTTP Error');
            return await res.json();
        } catch (err) {
            if (i === retries - 1) throw err;
            console.log(`Retrying... (${i + 1}/${retries})`);
            await new Promise(r => setTimeout(r, 1000 * Math.pow(2, i))); // Exponential backoff
        }
    }
}
```
</details>

#### Level 3: Boss Level (Cumulative)
**Challenge:** Create an Express endpoint that implements a strict PATCH using a JSON Patch (RFC 6902) format array. Example: `[{ "op": "replace", "path": "/name", "value": "Charlie" }]`
<details>
<summary>Hint</summary>
Iterate over the array of operations and apply them to the target object.
</details>
<details>
<summary>Solution Walkthrough</summary>
```javascript
app.patch('/api/users/:id/json-patch', (req, res) => {
    let user = db.users[req.params.id];
    if (!user) return res.status(404).json({error: 'Not found'});

    const patches = req.body; // Array of operations

    for (const patch of patches) {
        if (patch.op === 'replace') {
            // Remove leading slash from path
            const key = patch.path.substring(1);
            if (user.hasOwnProperty(key)) {
                user[key] = patch.value;
            }
        }
        // (Add support for 'add', 'remove' etc. in a full implementation)
    }

    db.users[req.params.id] = user;
    res.json(user);
});
```
</details>

<br><br>

## Topic 3: HTTP Status Codes

### Phase A: Problem-First Exploration

#### 1. Real-World Pain Point (The Why)
Imagine an API that always returns HTTP 200 OK, but the JSON body says `{ "success": false, "error": "Unauthorized" }`. An API Gateway, a load balancer, or a caching layer doesn't parse JSON bodies; they only look at HTTP headers and status codes. If you return 200 for errors, your CDN might cache the error page, or your monitoring tools will report 100% uptime while users are getting errors.

#### 2. Plain English Metaphor (The What)
Status codes are like the colored lights on a dashboard.
- **2xx (Green):** Everything went perfectly.
- **3xx (Yellow/Blue):** Look over there (Redirects).
- **4xx (Orange):** YOU messed up (Client Error - e.g., bad password, missing data).
- **5xx (Red):** I messed up (Server Error - e.g., database down, unhandled exception).

#### 3. Complete Runnable Code
```javascript
const express = require('express');
const app = express();
app.use(express.json());

// 200 OK (Default for successful GET)
app.get('/success', (req, res) => res.status(200).json({ message: 'All good' }));

// 201 Created (For POST)
app.post('/create', (req, res) => res.status(201).json({ id: 1, created: true }));

// 204 No Content (For DELETE)
app.delete('/remove', (req, res) => res.status(204).send());

// 400 Bad Request
app.post('/bad', (req, res) => res.status(400).json({ error: 'Missing email field' }));

// 401 Unauthorized vs 403 Forbidden
app.get('/admin', (req, res) => {
    const token = req.headers.authorization;
    if (!token) return res.status(401).json({ error: 'Who are you? Log in.' });
    if (token !== 'admin-token') return res.status(403).json({ error: 'I know you, but you lack admin rights.' });
    res.status(200).json({ secret: 'data' });
});

// 404 Not Found
app.get('/missing', (req, res) => res.status(404).json({ error: 'Resource does not exist' }));

// 500 Internal Server Error
app.get('/crash', (req, res) => {
    try {
        throw new Error('Database disconnected!');
    } catch (err) {
        res.status(500).json({ error: 'We are looking into it.' });
    }
});
```

#### 4. Progressive Step-by-Step Breakdown
**Step 1: The 200s (Success)**
Differentiate between 200 (OK), 201 (Created - used mostly on POST), and 204 (No Content - perfect for DELETE where returning the deleted object isn't necessary).
**Step 2: The 400s (Client Error)**
Use 400 for validation errors, 401 when authentication is missing/invalid, 403 when authenticated but lacking authorization, and 404 when the URL or resource ID is wrong.
**Step 3: The 500s (Server Error)**
Never intentionally send a 500. This is the catch-all for "our code broke." Always log the stack trace internally, but hide the details from the client to prevent security leaks.

#### 5. ASCII Data Flow
```text
[Client]                          [Gateway / Server]
   | --- POST /api/login --------> |
   | {"user": "admin"}             |
   | <- 400 Bad Request ---------- | (Gateway knows this isn't a server crash)
   |                               |
   | --- GET /api/data ----------> |
   | <- 500 Server Error --------- | (Gateway triggers alerts/pagerduty)
```

#### 6. Noob Trap vs Pro Tip
**Noob Trap:** Using 404 for everything. If a user is searching for something and the list is empty, return `200 OK` with an empty array `[]`, not 404! 404 means the *endpoint* or the *specific ID* doesn't exist, not that a query returned zero results.
**Pro Tip:** Use `409 Conflict` when a request cannot be completed due to a conflict with the current state of the resource (e.g., trying to register an email that already exists).

---

### Phase B: Engineering Challenges

#### Level 1: Warm-Up
**Challenge:** A user tries to transfer money but their balance is $0. What HTTP status code should you return?
<details>
<summary>Hint</summary>
It's a client error (they requested something impossible), but the syntax of the request was correct, so 400 isn't perfect.
</details>
<details>
<summary>Solution Walkthrough</summary>
**422 Unprocessable Entity** (or **400 Bad Request** depending on team convention). 422 specifically means the syntax is correct, but the semantic instructions cannot be followed (like insufficient funds).
</details>

#### Level 2: Real-World
**Challenge:** Write a global error handling middleware in Express that catches unhandled errors, logs the stack trace to the console, but only returns a generic `500` JSON response to the client.
<details>
<summary>Hint</summary>
Express error-handling middleware has four arguments: `(err, req, res, next)`.
</details>
<details>
<summary>Solution Walkthrough</summary>
```javascript
app.use((err, req, res, next) => {
    // Log for internal debugging
    console.error(`[CRITICAL ERROR] ${err.message}`);
    console.error(err.stack);

    // Send safe generic response
    res.status(500).json({
        error: {
            message: 'An internal server error occurred.',
            referenceId: Date.now() // For tracing logs
        }
    });
});
```
</details>

#### Level 3: Boss Level (Cumulative)
**Challenge:** Design an endpoint `POST /api/documents` that integrates REST constraints, correct Methods, and accurate Status Codes.
Rules:
1. Must accept JSON.
2. If `title` is missing, return the correct status.
3. If successful, return the newly created document and the correct status code.
4. Ensure the response includes a `Location` header pointing to the new resource (a REST best practice for 201).
<details>
<summary>Hint</summary>
Use 400 for validation, 201 for success, and `res.location()` in Express.
</details>
<details>
<summary>Solution Walkthrough</summary>
```javascript
app.post('/api/documents', (req, res) => {
    const { title, content } = req.body;

    // REST Constraint: Stateless validation (Client Error)
    if (!title) {
        return res.status(400).json({ error: "Missing required field: title" });
    }

    // Simulate DB save
    const newDoc = { id: 101, title, content };

    // REST Best Practice: Location header & 201 Created
    res.location(`/api/documents/${newDoc.id}`);
    res.status(201).json(newDoc);
});
```
</details>
