# Module 03: Security & Protection

## Topic 1: CORS Preflights

### Phase A: The Core Concept

#### 1. Real-World Pain Point (The Why)
Imagine you are logged into your bank at `bank.com`. In another tab, you visit a malicious site `evil.com`. `evil.com` executes a hidden JavaScript `fetch()` request to `bank.com/api/transfer`. Because your browser automatically sends your session cookies, the transfer might succeed! To stop this, browsers implemented the Same-Origin Policy, blocking websites from making API calls to domains other than their own... unless the API explicitly allows it.

#### 2. Plain English Metaphor (The What)
Think of an exclusive office building (Your API). An employee (The Browser) wants to bring a guest (A web app from another domain) inside. The security guard at the door (CORS) stops them. The guard calls the office manager (The Server) and asks: "Do you know this guest from `domain.com`?" This call is the **Preflight Request**. If the manager says yes, the guest enters. If no, the guard blocks them at the door.

#### 3. Complete Runnable Code
```javascript
const express = require('express');
const cors = require('cors');
const app = express();

// The Office Manager allowing specific guests
const corsOptions = {
  origin: 'https://my-frontend.com', // Only allow this domain
  methods: ['GET', 'POST'],          // Only allow these actions
  optionsSuccessStatus: 200
};

// Apply CORS middleware globally
app.use(cors(corsOptions));

app.get('/api/data', (req, res) => {
  res.json({ secret: 'This is protected by CORS' });
});

app.listen(3000, () => console.log('Server running'));
```

#### 4. Progressive Step-by-Step Breakdown

**Step 1: The Browser's Preflight (OPTIONS request)**
Before sending a complex request (like a POST with JSON), the browser automatically sends an `OPTIONS` HTTP request to your server. This request includes the header `Origin: https://my-frontend.com`.

**Step 2: The Server's Response (CORS Middleware)**
The `cors` middleware intercepts this `OPTIONS` request. It checks if `https://my-frontend.com` is in your allowed `origin` list. If it is, the server responds with a 200 OK and headers like `Access-Control-Allow-Origin: https://my-frontend.com`.
```javascript
const corsOptions = { origin: 'https://my-frontend.com' };
app.use(cors(corsOptions));
```

**Step 3: The Actual Request**
The browser receives the green light from the preflight. It *now* sends the actual POST request. If the server had denied the preflight, the browser would have thrown a CORS error in the console and the POST request would never have been sent.

#### 5. ASCII Data Flow
```text
[ Browser (evil.com) ]                      [ Server (api.com) ]
          |                                          |
          |--- 1. OPTIONS /api/data (Preflight) ---->|
          |                                          | (Middleware checks Origin)
          |<-- 2. 403 Forbidden (Missing Headers) ---|
          |                                          |
(Browser blocks the actual GET request. console.error("CORS Error"))
```

#### 6. Noob Trap vs Pro Tip
**Noob Trap:** Using `app.use(cors())` with no options. This defaults to `origin: '*'` (allow all domains). This completely defeats the security purpose of CORS and leaves your API open to cross-site request forgery from anywhere on the internet.
**Pro Tip:** If you need to allow multiple specific domains (e.g., a dev and prod frontend), pass an array to `origin`: `origin: ['http://localhost:3000', 'https://prod.com']`.

---

### Phase B: Challenges

#### Level 1: Warm-Up
**Task:** Configure CORS to allow only `GET` requests from `http://localhost:8080`.
<details>
<summary>Hint</summary>
Set `origin` to the localhost URL and `methods` to an array containing only 'GET'.
</details>

**Solution Walkthrough:**
```javascript
const corsOptions = {
  origin: 'http://localhost:8080',
  methods: ['GET']
};
app.use(cors(corsOptions));
```

#### Level 2: Real-World
**Task:** Your API needs to allow requests from any subdomain of your main company site (e.g., `app.company.com`, `admin.company.com`).
<details>
<summary>Hint</summary>
The `origin` property in `corsOptions` can be a function that checks the request origin against a Regular Expression.
</details>

**Solution Walkthrough:**
```javascript
const corsOptions = {
  origin: function (origin, callback) {
    // Note: origin is undefined if the request is from a tool like Postman (not a browser)
    if (!origin || /\.company\.com$/.test(origin)) {
      callback(null, true); // Allow
    } else {
      callback(new Error('Not allowed by CORS')); // Block
    }
  }
};
app.use(cors(corsOptions));
```
This dynamic checking is essential for companies with many sub-products.

#### Level 3: Boss Level
**Task:** You need to allow the frontend to send Authorization headers (cookies or Bearer tokens) cross-origin.
<details>
<summary>Hint</summary>
You must set `credentials: true` in your CORS options. Note: When `credentials: true` is set, `origin` CANNOT be `*`, it must be a specific domain.
</details>

**Solution Walkthrough:**
```javascript
const corsOptions = {
  origin: 'https://my-secure-app.com', // MUST be specific when using credentials
  credentials: true, // Tells the browser it's allowed to send cookies/auth headers
  methods: ['GET', 'POST', 'PUT', 'DELETE'],
  allowedHeaders: ['Content-Type', 'Authorization'] // Explicitly allow these headers
};
app.use(cors(corsOptions));
```
Without `credentials: true`, cross-domain authentication simply will not work; the browser will strip the cookies/tokens before sending the request.

---

## Topic 2: Anti-Brute-Force Rate Limiting

### Phase A: The Core Concept

#### 1. Real-World Pain Point (The Why)
A hacker writes a script to guess a user's password on your `/login` endpoint. The script tries 10,000 different passwords per second. Not only might they guess the password, but the sheer volume of database queries crashes your server, causing a Denial of Service (DoS) for all real users.

#### 2. Plain English Metaphor (The What)
Think of a turnstile at a subway station. A normal person swipes their card and walks through (1 action per 3 seconds). If someone tries to rapidly swipe 100 cards per second, the turnstile locks up and says, "Please wait, you are going too fast." Rate Limiting acts as this turnstile for your API.

#### 3. Complete Runnable Code
```javascript
const express = require('express');
const rateLimit = require('express-rate-limit');
const app = express();

// Define the turnstile rules
const apiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // Limit each IP to 100 requests per windowMs
  message: 'Too many requests from this IP, please try again after 15 minutes',
  standardHeaders: true, // Return rate limit info in the `RateLimit-*` headers
  legacyHeaders: false, // Disable the `X-RateLimit-*` headers
});

// Apply globally to all requests
app.use('/api/', apiLimiter);

app.get('/api/status', (req, res) => {
  res.send('API is healthy');
});

app.listen(3000, () => console.log('Server running'));
```

#### 4. Progressive Step-by-Step Breakdown

**Step 1: The Window**
You define a time window (`windowMs`). Here, it's 15 minutes (calculated in milliseconds).

**Step 2: The Limit**
You define the `max` number of requests allowed within that window. Here, an IP address can make 100 requests.

**Step 3: The Enforcer**
When a request comes in, the middleware checks an internal memory store tracking the user's IP. If `count < max`, it increments the count and calls `next()`. If `count >= max`, it blocks the request and sends HTTP Status 429 (Too Many Requests).
```javascript
app.use('/api/', apiLimiter);
```

#### 5. ASCII Data Flow
```text
[ Hacker IP ] ---> (Sends 101st Request in 1 minute) ---> [ Rate Limiter Middleware ]
                                                                     |
                                                               (Limit Exceeded)
                                                                     |
                                                                     V
                                                         [ Returns 429 Too Many Requests ]
                                                         (Controller is never reached)
```

#### 6. Noob Trap vs Pro Tip
**Noob Trap:** Using default memory-based rate limiting when running multiple instances of your server (e.g., behind a load balancer). If Server A blocks the IP, Server B doesn't know about it, effectively multiplying the allowed limit by the number of servers.
**Pro Tip:** For production, always use a centralized store like Redis for your rate limiter (using `rate-limit-redis`). This ensures limits are enforced globally across all your server instances.

---

### Phase B: Challenges

#### Level 1: Warm-Up
**Task:** Create a stricter rate limiter specifically for a `/api/login` route (allow only 5 attempts per hour).
<details>
<summary>Hint</summary>
Create a new `rateLimit` instance with a 1-hour window and `max: 5`. Apply it only to the login route.
</details>

**Solution Walkthrough:**
```javascript
const loginLimiter = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 hour
  max: 5,
  message: 'Too many login attempts, please try again after an hour'
});

// Apply ONLY to the login route, not globally
app.post('/api/login', loginLimiter, authController.login);
```

#### Level 2: Real-World
**Task:** Your API is behind a reverse proxy/load balancer (like Nginx, AWS ALB, or Heroku). The rate limiter is blocking EVERYONE because it sees all requests coming from the load balancer's IP, not the real users' IPs. Fix this.
<details>
<summary>Hint</summary>
You need to tell Express to trust the proxy so it reads the `X-Forwarded-For` header to get the real client IP.
</details>

**Solution Walkthrough:**
```javascript
// This is critical when deploying to platforms like Heroku, Render, AWS, etc.
app.set('trust proxy', 1);

app.use('/api/', apiLimiter);
```
Without this line, `req.ip` is the proxy's IP. With it, Express parses the headers injected by the proxy to find the true origin IP.

#### Level 3: Boss Level
**Task:** Create a dynamic rate limiter. Standard users get 100 req/hr, but Premium users (identified by a valid JWT token) get 1000 req/hr.
<details>
<summary>Hint</summary>
You need to use a custom key generator. If `req.user` exists, use their User ID as the key. If not, fallback to `req.ip`.
</details>

**Solution Walkthrough:**
```javascript
// Assume an auth middleware runs BEFORE this and sets req.user

const dynamicLimiter = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 hour
  max: (req, res) => {
    if (req.user && req.user.plan === 'premium') return 1000;
    return 100;
  },
  keyGenerator: (req, res) => {
    // Group by User ID if logged in, otherwise by IP
    return req.user ? req.user.id : req.ip;
  }
});

app.use('/api/', dynamicLimiter);
```
This is how SaaS companies enforce API quotas based on billing tiers.

---

## Topic 3: Zod Request Validation

### Phase A: The Core Concept

#### 1. Real-World Pain Point (The Why)
A user signs up for your app but sends their age as a string `"twenty-five"` instead of the number `25`. Your database expects a number, so the query crashes. Worse, a malicious user might send an SQL injection string in the email field. If you don't validate every piece of incoming data, your server will either crash or be compromised.

#### 2. Plain English Metaphor (The What)
Think of an airport security checkpoint. The luggage (Request Body) goes through the X-Ray machine (Zod Validator). The machine checks against a strict list of rules: No liquids over 100ml, no weapons, must match the boarding pass. If a rule is broken, the bag is rejected immediately. The plane (Controller) never has to deal with dangerous items.

#### 3. Complete Runnable Code
```javascript
const express = require('express');
const { z } = require('zod');
const app = express();
app.use(express.json());

// 1. Define the Schema (The Rules)
const userSchema = z.object({
  username: z.string().min(3).max(20),
  email: z.string().email(),
  age: z.number().int().positive()
});

// 2. The Middleware Factory
const validateSchema = (schema) => (req, res, next) => {
  try {
    // parse() throws an error if validation fails
    req.body = schema.parse(req.body);
    next();
  } catch (error) {
    res.status(400).json({ error: error.errors });
  }
};

// 3. Apply the Validator to the Route
app.post('/api/users', validateSchema(userSchema), (req, res) => {
  // If we reach here, we are 100% sure req.body is exactly what we expect
  res.json({ message: 'User valid and created!', data: req.body });
});

app.listen(3000, () => console.log('Server running'));
```

#### 4. Progressive Step-by-Step Breakdown

**Step 1: The Blueprint (Schema)**
We use Zod to declare exactly what shape the data must be.
```javascript
const schema = z.object({ email: z.string().email() });
```

**Step 2: The Interceptor (Middleware)**
We create a reusable middleware function. It attempts to parse `req.body` against the schema. If it fails, Zod throws a `ZodError` containing detailed information about exactly what failed. We catch that and return a 400 Bad Request.
```javascript
req.body = schema.parse(req.body);
```

**Step 3: Peace of Mind in the Controller**
Because the middleware runs first, by the time the code reaches `app.post`, you don't need to write manual `if (!req.body.email) ...` checks. The data is guaranteed safe.

#### 5. ASCII Data Flow
```text
[ Client Request ] --> { username: "a", age: "ten" }
        |
        V
[ Zod Middleware ] --> Checks against schema
        |
        +-- (username < 3 chars) --> THROWS ERROR --> [ Returns 400 JSON Details ]
        +-- (age is not a number)
        |
    (If valid)
        V
[ Route Controller ]
```

#### 6. Noob Trap vs Pro Tip
**Noob Trap:** Using manual `if/else` checks for validation (e.g., `if(typeof age !== 'number')`). This becomes unmaintainable quickly. Also, not stripping unknown fields: a user might send `{ email: "x", isAdmin: true }`. If you blindly save `req.body` to the DB, they just made themselves an admin!
**Pro Tip:** Zod automatically strips out any fields not explicitly defined in the schema when you call `.parse()`. This acts as a powerful shield against Mass Assignment vulnerabilities.

---

### Phase B: Challenges

#### Level 1: Warm-Up
**Task:** Create a Zod schema for a password reset request. It requires a `token` (string) and a `newPassword` (string, minimum 8 characters).
<details>
<summary>Hint</summary>
Use `z.object`, `z.string()`, and `.min(8)`.
</details>

**Solution Walkthrough:**
```javascript
const resetPasswordSchema = z.object({
  token: z.string(),
  newPassword: z.string().min(8, { message: "Password must be at least 8 chars" })
});
```

#### Level 2: Real-World
**Task:** You are receiving a query parameter from the URL, like `/api/search?page=2`. By default, Express parses query params as strings. Use Zod to validate `page` is a number and convert it into an integer.
<details>
<summary>Hint</summary>
Use `z.coerce.number()` to force the string into a number before validation.
</details>

**Solution Walkthrough:**
```javascript
const searchSchema = z.object({
  page: z.coerce.number().int().positive().default(1)
});

const validateQuery = (schema) => (req, res, next) => {
  try {
    req.query = schema.parse(req.query);
    next();
  } catch (error) {
    res.status(400).json(error.errors);
  }
};

app.get('/api/search', validateQuery(searchSchema), (req, res) => {
  // req.query.page is now a guaranteed integer (e.g., 2), not a string ("2")
  res.json({ page: req.query.page });
});
```

#### Level 3: Boss Level
**Task:** You are validating a complex nested object: an Order containing an array of Items. Ensure that the array has at least one item, and each item has a valid `productId` (uuid) and `quantity` (number > 0).
<details>
<summary>Hint</summary>
Use `z.array()` and pass another `z.object()` inside it.
</details>

**Solution Walkthrough:**
```javascript
const itemSchema = z.object({
  productId: z.string().uuid(),
  quantity: z.number().int().min(1)
});

const orderSchema = z.object({
  customerId: z.string().uuid(),
  items: z.array(itemSchema).min(1, { message: "Order must contain at least one item" })
});

app.post('/api/orders', validateSchema(orderSchema), (req, res) => {
  res.json({ status: 'Order accepted' });
});
```
This showcases the immense power of Zod: validating deeply nested JSON structures with a few lines of readable code, something that would take hundreds of lines of manual `if` statements.
