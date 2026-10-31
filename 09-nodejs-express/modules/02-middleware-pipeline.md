# Module 02: Middleware Pipeline

## Topic 1: Parsing Inbound JSON

### Phase A: The Core Concept

#### 1. Real-World Pain Point (The Why)
When a frontend sends data (like a signup form) to your backend, it sends it as a raw stream of text (bytes) over the network. If your Express server doesn't know how to translate those bytes back into a JavaScript object, `req.body` will simply be `undefined`. You cannot process a registration if you cannot read the email and password.

#### 2. Plain English Metaphor (The What)
Think of a post office receiving a letter written in French. The sorting clerk (Express) doesn't speak French, so they can't process the request. A translator (Middleware) sits between the mailbox and the clerk. The translator intercepts the letter, translates it into English (JSON), and hands it to the clerk. Now the clerk can read the instructions.

#### 3. Complete Runnable Code
```javascript
const express = require('express');
const app = express();

// The Translator Middleware
app.use(express.json());

app.post('/api/register', (req, res) => {
  // Without express.json(), req.body would be undefined
  const { email, password } = req.body;

  if (!email || !password) {
    return res.status(400).json({ error: 'Missing credentials' });
  }

  res.json({ message: `User ${email} registered successfully!` });
});

app.listen(3000, () => console.log('Server running'));
```

#### 4. Progressive Step-by-Step Breakdown

**Step 1: The Request Arrives**
A POST request arrives at your server with a header `Content-Type: application/json` and a raw body payload.

**Step 2: The Middleware Intercepts**
`app.use(express.json())` acts as a global interceptor. It sees the `Content-Type` header, reads the raw data stream, and calls `JSON.parse()` on it.
```javascript
app.use(express.json());
```

**Step 3: Proceeding to the Route**
Once the parsing is done, the middleware automatically attaches the resulting JavaScript object to `req.body` and calls the `next()` function, allowing the request to proceed to your route handler.
```javascript
app.post('/api/register', (req, res) => {
  console.log(req.body); // Now it's a usable object!
});
```

#### 5. ASCII Data Flow
```text
[Frontend Payload] --> {"email":"x@x.com"} (Raw String)
      |
      V
[ express.json() Middleware ] --> Reads string, runs JSON.parse()
      |
      V
[ req.body ] --> { email: 'x@x.com' } (JS Object)
      |
      V
[ Route Handler ] --> Reads req.body.email
```

#### 6. Noob Trap vs Pro Tip
**Noob Trap:** Forgetting `app.use(express.json())` and spending hours debugging why `req.body` is `undefined`. Or placing it *after* your route handlers (middleware runs in the exact order it is defined).
**Pro Tip:** If your frontend sends data using standard HTML forms (not Fetch/Axios), you need a different translator: `app.use(express.urlencoded({ extended: true }))`. Often, production apps include both.

---

### Phase B: Challenges

#### Level 1: Warm-Up
**Task:** Create a POST endpoint that accepts an array of numbers in the body and returns their sum.
<details>
<summary>Hint</summary>
Ensure `express.json()` is enabled. Access `req.body.numbers` and use `.reduce()` to sum them.
</details>

**Solution Walkthrough:**
```javascript
app.use(express.json());

app.post('/api/sum', (req, res) => {
  const numbers = req.body.numbers || [];
  const sum = numbers.reduce((acc, curr) => acc + curr, 0);
  res.json({ sum });
});
```

#### Level 2: Real-World
**Task:** Create a webhook endpoint for a payment processor (like Stripe). The processor sends raw JSON, but you must verify its cryptographic signature before parsing it into an object.
<details>
<summary>Hint</summary>
You can use `express.raw({ type: 'application/json' })` for a specific route to get the raw buffer, verify it, and then parse it manually.
</details>

**Solution Walkthrough:**
```javascript
// Do NOT put express.json() globally before this route if it alters the payload needed for signature verification
app.post('/api/webhook', express.raw({ type: 'application/json' }), (req, res) => {
  const sig = req.headers['stripe-signature'];
  const rawBody = req.body; // This is a Buffer now

  try {
    // verifySignature(rawBody, sig, secret);
    const event = JSON.parse(rawBody.toString());
    res.json({ received: true });
  } catch (err) {
    res.status(400).send(`Webhook Error: ${err.message}`);
  }
});
```
This is critical for webhooks where altering even one space in the JSON payload breaks the cryptographic signature.

#### Level 3: Boss Level
**Task:** Write a custom JSON parsing middleware from scratch (using core Node `req.on('data')`) to understand exactly what `express.json()` does under the hood.
<details>
<summary>Hint</summary>
`req` is a readable stream. Listen for 'data' events to collect chunks, then 'end' to parse them, attach to `req.body`, and call `next()`.
</details>

**Solution Walkthrough:**
```javascript
const customJsonParser = (req, res, next) => {
  if (req.headers['content-type'] !== 'application/json') {
    return next();
  }

  let bodyData = '';
  req.on('data', chunk => {
    bodyData += chunk.toString();
  });

  req.on('end', () => {
    try {
      if (bodyData) {
        req.body = JSON.parse(bodyData);
      }
      next(); // Pass control to the next middleware/route
    } catch (error) {
      res.status(400).json({ error: 'Invalid JSON payload' });
    }
  });
};

app.post('/api/test', customJsonParser, (req, res) => {
  res.json({ received: req.body });
});
```
This demonstrates exactly how Express streams data off the network and processes it before hitting your controllers.

---

## Topic 2: Auth Guards (Custom Middleware)

### Phase A: The Core Concept

#### 1. Real-World Pain Point (The Why)
Imagine having an API with 50 different endpoints that require a user to be logged in (e.g., viewing profile, changing password, deleting account). If you write the logic to check the user's token inside every single route, you violate the DRY (Don't Repeat Yourself) principle. If the authentication logic changes, you have to update 50 files.

#### 2. Plain English Metaphor (The What)
Think of an exclusive nightclub. The VIP lounge is the API route. Instead of the bartender stopping making drinks every 5 minutes to check people's IDs, there is a Bouncer at the door. The Bouncer (Middleware Guard) checks IDs. If the ID is valid, they let the person in (`next()`). If not, they kick them out immediately (`res.status(401)`). The bartender (Controller) assumes anyone in the room is already verified.

#### 3. Complete Runnable Code
```javascript
const express = require('express');
const app = express();

// The Bouncer (Auth Guard Middleware)
const requireAuth = (req, res, next) => {
  const authHeader = req.headers.authorization;

  if (!authHeader || authHeader !== 'Bearer secret-token') {
    // Kick them out!
    return res.status(401).json({ error: 'Unauthorized: Invalid or missing token' });
  }

  // Attach info to the request for the bartender to use
  req.user = { id: 1, role: 'admin' };

  // Let them in!
  next();
};

// Apply the Bouncer to specific routes
app.get('/api/vip/dashboard', requireAuth, (req, res) => {
  // Controller logic: We only get here if next() was called
  res.json({ message: `Welcome Admin ${req.user.id}, here is the secret data.` });
});

app.listen(3000, () => console.log('Server running'));
```

#### 4. Progressive Step-by-Step Breakdown

**Step 1: Defining the Guard Function**
Middleware is just a function with three arguments: `req`, `res`, and `next`.
```javascript
const requireAuth = (req, res, next) => { ... }
```

**Step 2: The Rejection Path**
If the condition fails, we send a response immediately and DO NOT call `next()`. This short-circuits the request pipeline.
```javascript
if (invalid) return res.status(401).send('No');
```

**Step 3: The Success Path and Context Passing**
If the check passes, we often attach the verified user data directly to the `req` object so downstream routes know exactly who made the request, then we call `next()`.
```javascript
req.user = userData;
next();
```

#### 5. ASCII Data Flow
```text
HTTP Request --> [ Express App ]
                      |
                      V
           [ requireAuth Middleware ]
             /                   \
        (Fails Check)        (Passes Check)
            |                     |
            V                     V
    [ Returns 401 Error ]   [ Calls next() ]
                                  |
                                  V
                       [ Route Controller Runs ]
```

#### 6. Noob Trap vs Pro Tip
**Noob Trap:** Forgetting to return when sending an error (`res.status(401).send(...)` instead of `return res.status(401)...`). Express will throw a "Cannot set headers after they are sent to the client" error because it tries to continue processing.
**Pro Tip:** Middleware is chainable. You can have an auth guard, followed by a role guard. `app.post('/admin', requireAuth, requireAdminRole, controller)`.

---

### Phase B: Challenges

#### Level 1: Warm-Up
**Task:** Create an API Key guard middleware. It should check if the `x-api-key` header equals `12345`. Apply it to a `/data` route.
<details>
<summary>Hint</summary>
Check `req.headers['x-api-key']`. If valid, call `next()`.
</details>

**Solution Walkthrough:**
```javascript
const apiKeyGuard = (req, res, next) => {
  const apiKey = req.headers['x-api-key'];
  if (apiKey !== '12345') {
    return res.status(403).json({ error: 'Forbidden' });
  }
  next();
};

app.get('/api/data', apiKeyGuard, (req, res) => {
  res.json({ data: 'Protected data' });
});
```

#### Level 2: Real-World
**Task:** Create a Role-Based Access Control (RBAC) middleware factory. It should accept an array of allowed roles and check if `req.user.role` is in that array.
<details>
<summary>Hint</summary>
A middleware factory is a function that returns a middleware function. `const requireRoles = (roles) => (req, res, next) => { ... }`.
</details>

**Solution Walkthrough:**
```javascript
// Assume requireAuth runs first and sets req.user

const requireRoles = (allowedRoles) => {
  return (req, res, next) => {
    if (!req.user || !allowedRoles.includes(req.user.role)) {
      return res.status(403).json({ error: 'Insufficient permissions' });
    }
    next();
  };
};

app.delete('/api/users/:id', requireAuth, requireRoles(['admin', 'superadmin']), (req, res) => {
  res.json({ message: 'User deleted' });
});
```
This powerful pattern allows you to reuse the same logic for different permission levels across your entire app.

#### Level 3: Boss Level
**Task:** Implement a conditional middleware. Create a route `/api/profile` that returns a public profile if not logged in, but returns extra private data (like email) if the user provides a valid token.
<details>
<summary>Hint</summary>
The middleware should check the token. If valid, set `req.user` and call `next()`. If invalid or missing, DO NOT return a 401 error, just set `req.user = null` and call `next()`. Let the controller decide what to do.
</details>

**Solution Walkthrough:**
```javascript
const optionalAuth = (req, res, next) => {
  const token = req.headers.authorization;
  if (token === 'Bearer valid') {
    req.user = { id: 1, email: 'x@x.com' };
  } else {
    req.user = null; // Mark as guest
  }
  next(); // Always proceed!
};

app.get('/api/profile/:id', optionalAuth, (req, res) => {
  const profile = { name: 'Alice', publicBio: 'Hello' };

  if (req.user) {
    // Include private data
    profile.email = req.user.email;
    profile.privateNotes = 'Secret notes';
  }

  res.json(profile);
});
```
This is essential for apps like Reddit or Twitter where logged-out users see one view, and logged-in users see a personalized view on the same URL.

---

## Topic 3: Centralized Global Error Handler

### Phase A: The Core Concept

#### 1. Real-World Pain Point (The Why)
In Node.js, if a synchronous error is thrown (e.g., trying to read a property of `undefined`) and not caught in a try/catch block, the entire server process crashes. Even if you use try/catch in every route, writing `res.status(500).json({ error: err.message })` in 100 different catch blocks is repetitive and prone to inconsistency.

#### 2. Plain English Metaphor (The What)
Think of a factory assembly line. Sometimes, a machine breaks, or a worker drops a part. Instead of every individual worker having to shut down the line and write an incident report, they just toss the broken part down a special "Reject Chute". At the end of the chute is a dedicated Quality Assurance Manager (Global Error Handler) whose only job is to log the incident and safely dispose of the part.

#### 3. Complete Runnable Code
```javascript
const express = require('express');
const app = express();

// A route that simulates an error
app.get('/api/broken', (req, res, next) => {
  try {
    // Simulating a crash
    throw new Error('Database connection failed!');
  } catch (err) {
    // Throwing it down the "Reject Chute"
    next(err);
  }
});

// The Quality Assurance Manager (Must be defined LAST)
const errorHandler = (err, req, res, next) => {
  console.error('[ERROR LOG]:', err.message);

  const statusCode = err.statusCode || 500;
  res.status(statusCode).json({
    success: false,
    message: err.message,
    // Only show stack trace in development, never in production!
    stack: process.env.NODE_ENV === 'production' ? null : err.stack
  });
};

app.use(errorHandler);

app.listen(3000, () => console.log('Server running'));
```

#### 4. Progressive Step-by-Step Breakdown

**Step 1: Passing the Error**
When an error occurs in your controller, you catch it and pass it to `next(err)`. Express sees that `next` has an argument, and immediately skips all normal routes/middleware, jumping straight to the error handler.
```javascript
catch(err) { next(err); }
```

**Step 2: Defining the Error Middleware**
An error handler middleware is special: it MUST have exactly 4 arguments `(err, req, res, next)`. This is how Express identifies it as an error handler.
```javascript
const errorHandler = (err, req, res, next) => { ... }
```

**Step 3: Mounting Last**
The global error handler must be the very last `app.use()` in your file, after all routes and normal middleware.
```javascript
app.use(errorHandler);
```

#### 5. ASCII Data Flow
```text
[ Route Controller ] --> Error occurs!
        |
    catch(err)
        |
    next(err)
        |
        V
(Skips all normal routes)
        |
        V
[ Global Error Handler (err, req, res, next) ]
        |
        V
[ Formats consistent JSON error response to client ]
```

#### 6. Noob Trap vs Pro Tip
**Noob Trap:** Forgetting the `next` argument in the error handler signature `(err, req, res)`. Express will treat it as normal middleware `(req, res, next)` causing it to silently fail and timeout the request.
**Pro Tip:** In modern Node (v15+) and Express 5, async errors in routes are handled automatically without needing `next(err)`. For Express 4 (the current standard), use a wrapper package like `express-async-errors` to avoid wrapping every single route in try/catch blocks.

---

### Phase B: Challenges

#### Level 1: Warm-Up
**Task:** Create a custom `AppError` class that extends the built-in `Error` class. It should accept a message and a statusCode.
<details>
<summary>Hint</summary>
Use `class AppError extends Error { constructor(msg, status) { super(msg); this.statusCode = status; } }`
</details>

**Solution Walkthrough:**
```javascript
class AppError extends Error {
  constructor(message, statusCode) {
    super(message);
    this.statusCode = statusCode;
    // Capture stack trace, excluding the constructor call from it
    Error.captureStackTrace(this, this.constructor);
  }
}

// Usage in a route:
// next(new AppError('Item not found', 404));
```

#### Level 2: Real-World
**Task:** Write an `asyncHandler` wrapper function to eliminate `try/catch` blocks in your Express 4 routes.
<details>
<summary>Hint</summary>
It takes a function `fn`, returns a new middleware function `(req, res, next)`, inside which it runs `Promise.resolve(fn(req, res, next)).catch(next)`.
</details>

**Solution Walkthrough:**
```javascript
// The magical wrapper
const asyncHandler = (fn) => (req, res, next) => {
  Promise.resolve(fn(req, res, next)).catch(next);
};

// Look how clean this is! No try/catch needed.
app.get('/api/users', asyncHandler(async (req, res) => {
  const users = await db.getUsers(); // If this throws, asyncHandler catches it and calls next(err)
  res.json(users);
}));
```
This is an absolute must-have utility in any production Express 4 codebase.

#### Level 3: Boss Level
**Task:** Expand the global error handler to handle specific database errors (like a MongoDB Duplicate Key Error `code: 11000`) and translate them into user-friendly HTTP 400 responses instead of 500 crashes.
<details>
<summary>Hint</summary>
Inside the error handler, check `err.name` or `err.code`. If it matches the DB error, re-assign `err.statusCode = 400` and `err.message = 'Duplicate field value entered'`.
</details>

**Solution Walkthrough:**
```javascript
const errorHandler = (err, req, res, next) => {
  let error = { ...err };
  error.message = err.message; // Message isn't copied by spread operator

  // Handle Mongoose Bad ObjectId
  if (err.name === 'CastError') {
    error = new AppError(`Resource not found. Invalid ID: ${err.value}`, 404);
  }

  // Handle Mongoose Duplicate Key
  if (err.code === 11000) {
    const field = Object.keys(err.keyValue)[0];
    error = new AppError(`Duplicate field value entered for ${field}. Please use another value.`, 400);
  }

  // Final Response
  res.status(error.statusCode || 500).json({
    success: false,
    error: error.message || 'Server Error'
  });
};
```
This prevents obscure database error messages from leaking to the frontend, replacing them with professional, actionable feedback.
