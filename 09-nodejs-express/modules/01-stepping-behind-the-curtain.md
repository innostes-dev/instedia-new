# Module 01: Stepping Behind the Curtain

## Topic 1: Why Frontend Cannot Touch DBs

### Phase A: The Core Concept

#### 1. Real-World Pain Point (The Why)
Imagine an online bank where the mobile app (frontend) connects directly to the bank's database to check balances. If a malicious user downloads the app and inspects the code, they will find the database credentials. They could then connect directly to the database and change their balance from $10 to $1,000,000, or delete other users' data entirely. You can never trust the client.

#### 2. Plain English Metaphor (The What)
Think of a restaurant. The frontend is the customer sitting at the table, looking at the menu. The database is the kitchen where all the ingredients are stored. Customers don't walk into the kitchen and cook their own meals. Instead, they talk to the waiter (the backend API). The waiter takes the order, brings it to the kitchen, and delivers the food back to the customer.

#### 3. Complete Runnable Code
```javascript
const express = require('express');
const app = express();

// Fake Database
const users = [{ id: 1, name: 'Alice', balance: 100 }];

// The Waiter (API Endpoint)
app.get('/api/balance/:userId', (req, res) => {
  const userId = parseInt(req.params.userId);
  const user = users.find(u => u.id === userId);

  if (!user) {
    return res.status(404).json({ error: 'User not found' });
  }

  res.json({ balance: user.balance });
});

app.listen(3000, () => console.log('Server running on port 3000'));
```

#### 4. Progressive Step-by-Step Breakdown

**Step 1: Setting up the Waiter**
First, we require Express and create our app. This is our server that will listen for requests.
```javascript
const express = require('express');
const app = express();
```

**Step 2: Defining the Kitchen (Database)**
In a real app, this would be a secure database like PostgreSQL. For now, it's just an array in memory. The frontend never sees this code.
```javascript
const users = [{ id: 1, name: 'Alice', balance: 100 }];
```

**Step 3: Creating the Menu Item (API Route)**
We define an endpoint `/api/balance/:userId`. When the frontend asks for this URL, the backend runs this function, looks up the user securely, and returns only what the frontend is allowed to see (the balance).
```javascript
app.get('/api/balance/:userId', (req, res) => {
  // ... secure logic here ...
  res.json({ balance: user.balance });
});
```

#### 5. ASCII Data Flow
```text
[Frontend / React] -- HTTP GET --> [Backend / Express] -- SQL Query --> [Database]
      (Client)                             (Server)                      (Storage)
      |                                      |                              |
      |<--------- HTTP 200 JSON -------------|<------- Query Result --------|
```

#### 6. Noob Trap vs Pro Tip
**Noob Trap:** Using Firebase or Supabase directly from the frontend without setting up Row Level Security (RLS) properly, essentially exposing the DB to the client.
**Pro Tip:** Always assume the client is compromised. Validate every input, authenticate every request, and authorize every action on the backend.

---

### Phase B: Challenges

#### Level 1: Warm-Up
**Task:** Create a basic Express route that returns a list of products. Do not expose the supplier cost.
<details>
<summary>Hint</summary>
Filter out the `cost` property from the products array before sending the response with `res.json()`.
</details>

**Solution Walkthrough:**
```javascript
const products = [
  { id: 1, name: 'Laptop', price: 1000, cost: 600 },
  { id: 2, name: 'Mouse', price: 50, cost: 20 }
];

app.get('/api/products', (req, res) => {
  const safeProducts = products.map(p => ({
    id: p.id,
    name: p.name,
    price: p.price
  }));
  res.json(safeProducts);
});
```
We iterate through the array and map it to a new object that omits the sensitive `cost` data.

#### Level 2: Real-World
**Task:** Create an endpoint to update a user's email. You must ensure the user can only update their own email, not someone else's. (Assume user ID is provided in a header for now).
<details>
<summary>Hint</summary>
Check if `req.headers['user-id']` matches the ID of the user they are trying to update in the route parameters.
</details>

**Solution Walkthrough:**
```javascript
app.put('/api/users/:id/email', (req, res) => {
  const loggedInUserId = req.headers['user-id'];
  const targetUserId = req.params.id;

  if (loggedInUserId !== targetUserId) {
    return res.status(403).json({ error: 'Unauthorized to modify this user' });
  }

  // Proceed with email update...
  res.json({ message: 'Email updated safely' });
});
```
This is a basic form of authorization. Never trust the URL parameter alone; always verify it against the authenticated user's identity.

#### Level 3: Boss Level
**Task:** Build an API that handles a bank transfer between two accounts. You must ensure the sender has enough balance, deduct it, and add it to the receiver.
<details>
<summary>Hint</summary>
You need a POST route. Check the sender's balance first. If it's less than the amount, return a 400 error. Otherwise, update both balances.
</details>

**Solution Walkthrough:**
```javascript
app.post('/api/transfer', express.json(), (req, res) => {
  const { senderId, receiverId, amount } = req.body;
  const sender = users.find(u => u.id === senderId);
  const receiver = users.find(u => u.id === receiverId);

  if (!sender || !receiver) {
    return res.status(404).json({ error: 'User not found' });
  }

  if (sender.balance < amount) {
    return res.status(400).json({ error: 'Insufficient funds' });
  }

  sender.balance -= amount;
  receiver.balance += amount;

  res.json({ message: 'Transfer successful', newBalance: sender.balance });
});
```
This requires complex business logic entirely on the backend to prevent the frontend from arbitrarily changing balances.

---

## Topic 2: The Event Loop

### Phase A: The Core Concept

#### 1. Real-World Pain Point (The Why)
Imagine a web server that reads a 5GB file from the hard drive for User A. While reading this file, User B requests a tiny 1KB text file. If the server processes tasks synchronously, User B has to wait minutes for User A's huge file to finish reading. Your server feels slow and unresponsive under load.

#### 2. Plain English Metaphor (The What)
Think of a fast-food cashier. If a customer orders a massive meal that takes 10 minutes to cook, the cashier doesn't stand there doing nothing while the cooks prepare it. Instead, they hand the order to the kitchen (asynchronous task), give the customer a receipt (callback/promise), and immediately take the next customer's order. When the kitchen finishes, they alert the cashier, who then hands the food to the first customer. The Event Loop is the cashier.

#### 3. Complete Runnable Code
```javascript
const fs = require('fs');

console.log('1. Server starts');

// Asynchronous File Read (Non-blocking)
fs.readFile('package.json', 'utf8', (err, data) => {
  if (err) throw err;
  console.log('3. File read complete');
});

console.log('2. Server ready for next request');
```

#### 4. Progressive Step-by-Step Breakdown

**Step 1: Synchronous Execution**
Node executes the first line immediately. This happens on the main thread.
```javascript
console.log('1. Server starts');
```

**Step 2: Offloading Async Work**
Node encounters `fs.readFile`. Instead of freezing the thread to read the disk, Node hands this task over to internal worker threads (libuv) and registers the callback function to run later.
```javascript
fs.readFile('package.json', 'utf8', (err, data) => { ... });
```

**Step 3: Continuing Execution**
The main thread instantly moves to the next line without waiting for the file. This is why it prints '2' before '3'. When the file is finally read, the callback is placed in the Event Queue, and the Event Loop eventually picks it up and runs it, printing '3'.
```javascript
console.log('2. Server ready for next request');
```

#### 5. ASCII Data Flow
```text
[Main Thread] -> sync code -> sync code -> [fs.readFile] -> sync code -> (idle)
                                                 |
                                         (Offloaded to OS)
                                                 |
                                            [Disk I/O]
                                                 |
(Event Loop picks up callback) <--- [Callback placed in Event Queue]
      |
[Executes callback: console.log('3')]
```

#### 6. Noob Trap vs Pro Tip
**Noob Trap:** Using synchronous methods like `fs.readFileSync` or doing heavy math calculations (like deep loops) inside an Express route. This blocks the Event Loop, freezing the server for ALL users.
**Pro Tip:** Always use asynchronous methods (`fs.promises`, `async/await`). If you have heavy CPU tasks (like video processing), offload them to Worker Threads or a separate microservice.

---

### Phase B: Challenges

#### Level 1: Warm-Up
**Task:** Write a simple script that prints "Start", uses `setTimeout` to wait 1 second and print "Middle", and then immediately prints "End".
<details>
<summary>Hint</summary>
Remember that `setTimeout` is asynchronous, so the code below it will run before the timer finishes.
</details>

**Solution Walkthrough:**
```javascript
console.log('Start');

setTimeout(() => {
  console.log('Middle');
}, 1000);

console.log('End');
```
Output will be: Start, End, Middle. The event loop offloads the timer and continues.

#### Level 2: Real-World
**Task:** You need to fetch data from two different remote APIs. Do it concurrently so the user doesn't wait for API 1 to finish before API 2 starts.
<details>
<summary>Hint</summary>
Use `Promise.all()` to run multiple promises at the same time.
</details>

**Solution Walkthrough:**
```javascript
async function fetchDashboardData() {
  const usersPromise = fetch('https://api.example.com/users');
  const statsPromise = fetch('https://api.example.com/stats');

  // Both requests are fired simultaneously!
  const [usersRes, statsRes] = await Promise.all([usersPromise, statsPromise]);

  const users = await usersRes.json();
  const stats = await statsRes.json();

  return { users, stats };
}
```
By not using `await` on the first fetch immediately, we start both async operations concurrently, saving significant time.

#### Level 3: Boss Level
**Task:** Write a route that reads a large file and sends it back to the client. Do NOT use `fs.readFile` as it loads the entire file into memory (RAM). Use Streams to pipe the file directly to the response, saving RAM and keeping the event loop healthy.
<details>
<summary>Hint</summary>
Use `fs.createReadStream` and `.pipe(res)`.
</details>

**Solution Walkthrough:**
```javascript
const fs = require('fs');

app.get('/download/large-file', (req, res) => {
  // Good: Streams read the file in small chunks and send them immediately
  const stream = fs.createReadStream('./large-video.mp4');

  stream.on('error', (err) => {
    res.status(500).send('Error reading file');
  });

  // Pipe connects the readable stream (file) to the writable stream (HTTP response)
  stream.pipe(res);
});
```
This is a core Node.js pattern. It prevents your server from crashing with "Out of Memory" errors when many users download large files simultaneously.

---

## Topic 3: Express Routing

### Phase A: The Core Concept

#### 1. Real-World Pain Point (The Why)
As your API grows, you might end up with hundreds of endpoints (`/users`, `/posts`, `/comments`). If you write all these routes in a single `server.js` file, it becomes a 5,000-line unmaintainable monster. Finding the code for a specific route becomes a nightmare, and merge conflicts occur constantly when working with a team.

#### 2. Plain English Metaphor (The What)
Think of a large department store. You don't have one giant pile of items in the middle of the store. You have Departments: the Electronics section, the Clothing section, and the Grocery section. Express Routing (specifically `express.Router`) allows you to split your massive API into smaller, manageable departments (files).

#### 3. Complete Runnable Code
```javascript
// server.js
const express = require('express');
const app = express();
const userRoutes = require('./routes/users');

app.use(express.json());

// Mount the router at the /api/users prefix
app.use('/api/users', userRoutes);

app.listen(3000, () => console.log('Server running'));

// routes/users.js
const express = require('express');
const router = express.Router();

// This is actually /api/users/
router.get('/', (req, res) => {
  res.json({ message: 'List of all users' });
});

// This is actually /api/users/:id
router.get('/:id', (req, res) => {
  res.json({ message: `Details for user ${req.params.id}` });
});

module.exports = router;
```

#### 4. Progressive Step-by-Step Breakdown

**Step 1: Creating a Router Module**
In a separate file (`users.js`), we create a mini-Express app called a Router.
```javascript
const express = require('express');
const router = express.Router();
```

**Step 2: Defining Routes on the Router**
We attach our endpoints to `router` instead of `app`. Notice the paths are relative. We don't write `/api/users/:id`, just `/:id`.
```javascript
router.get('/:id', (req, res) => { ... });
module.exports = router;
```

**Step 3: Mounting the Router in the Main App**
Back in `server.js`, we import the router and `use` it, telling Express: "Any request starting with `/api/users` should be handled by the `userRoutes` module."
```javascript
const userRoutes = require('./routes/users');
app.use('/api/users', userRoutes);
```

#### 5. ASCII Data Flow
```text
HTTP GET /api/users/42
      |
[ server.js ] --> Does path start with /api/users? --> YES
      |
      V
[ routes/users.js ] --> Does remaining path match /:id? --> YES
      |
      V
[ Route Handler Function ] --> Returns JSON response
```

#### 6. Noob Trap vs Pro Tip
**Noob Trap:** Hardcoding the full prefix inside the router file (e.g., `router.get('/api/users/:id')` and then mounting it with `app.use('/', router)`). This defeats the purpose of modularity.
**Pro Tip:** Group your routers by feature or resource (e.g., `users.js`, `products.js`). Keep the controller logic (the actual functions handling req/res) in separate Controller files, keeping your router files purely for mapping URLs to functions.

---

### Phase B: Challenges

#### Level 1: Warm-Up
**Task:** Create a router for `/api/posts` with two endpoints: GET `/` (list posts) and POST `/` (create a post). Mount it in the main app.
<details>
<summary>Hint</summary>
Use `express.Router()`. In the main app, `app.use('/api/posts', postsRouter)`.
</details>

**Solution Walkthrough:**
```javascript
// routes/posts.js
const express = require('express');
const router = express.Router();

router.get('/', (req, res) => res.json({ posts: [] }));
router.post('/', (req, res) => res.json({ message: 'Post created' }));
module.exports = router;

// server.js
const postsRouter = require('./routes/posts');
app.use('/api/posts', postsRouter);
```

#### Level 2: Real-World
**Task:** Extract the logic from your routes into a Controller file. The router file should only contain the mapping, no logic.
<details>
<summary>Hint</summary>
Create `controllers/postController.js` and export functions. Require them in `routes/posts.js`.
</details>

**Solution Walkthrough:**
```javascript
// controllers/postController.js
exports.getPosts = (req, res) => {
  res.json({ posts: [] });
};

// routes/posts.js
const express = require('express');
const router = express.Router();
const postController = require('../controllers/postController');

// Much cleaner!
router.get('/', postController.getPosts);
module.exports = router;
```
This is the beginning of the MVC (Model-View-Controller) architecture, making your code highly testable.

#### Level 3: Boss Level
**Task:** Implement nested routers. Create an API where you can get comments for a specific post: `/api/posts/:postId/comments`. The comments router should be a separate file, but it needs access to `:postId`.
<details>
<summary>Hint</summary>
You need to pass `{ mergeParams: true }` when creating the child router so it inherits params from the parent router.
</details>

**Solution Walkthrough:**
```javascript
// routes/comments.js
const express = require('express');
// CRITICAL: mergeParams allows us to access :postId from the parent router
const router = express.Router({ mergeParams: true });

router.get('/', (req, res) => {
  res.json({ message: `Comments for post ${req.params.postId}` });
});
module.exports = router;

// routes/posts.js
const express = require('express');
const router = express.Router();
const commentsRouter = require('./comments');

// Mount the comments router inside the posts router
router.use('/:postId/comments', commentsRouter);

module.exports = router;
```
This is how massive, complex APIs (like GitHub or Stripe) structure their routing hierarchies cleanly.
