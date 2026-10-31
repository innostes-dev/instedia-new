# Module 03: Real-Time Sockets

## Topic 1: Killing Short Polling

### Phase A: Problem-First Exploration

#### 1. Real-World Pain Point (The Why)
You are building a live chat app using a standard REST API. Because the server cannot initiate contact with the client (REST is client-driven), the client's only option is to ask the server: "Any new messages?" every 1 second. This is called **Short Polling**.
If you have 10,000 users, your server is hit with 10,000 HTTP requests *every single second*. 99% of those requests return empty data, wasting massive CPU, bandwidth, and database resources checking for data that doesn't exist.

#### 2. Plain English Metaphor (The What)
Short Polling is like being a kid in the back seat of a car yelling, "Are we there yet?" every 5 seconds. The parent (server) has to respond "No" constantly, which is exhausting.
WebSockets (and Long Polling/SSE) change the dynamic to the parent saying: "Go to sleep. I will wake you up the moment we arrive."

#### 3. Complete Runnable Code
Let's see why short polling is bad, and implement a rudimentary "Long Polling" mechanism as a bridge concept before WebSockets.

```javascript
const express = require('express');
const app = express();
app.use(express.json());

let messages = [];
let pendingClients = [];

// ❌ THE BAD WAY: Short Polling
app.get('/api/chat/short-poll', (req, res) => {
    // Client has to call this every 1s. Massive waste of HTTP overhead.
    res.json(messages);
});

// ✅ THE BETTER WAY (Legacy): Long Polling
app.get('/api/chat/long-poll', (req, res) => {
    // We don't respond immediately! We hold the connection open.
    pendingClients.push(res);

    // Safety timeout: If no message in 30s, close to free up network ports
    setTimeout(() => {
        const index = pendingClients.indexOf(res);
        if (index !== -1) {
            pendingClients.splice(index, 1);
            res.status(204).send(); // Tell client to reconnect
        }
    }, 30000);
});

app.post('/api/chat', (req, res) => {
    const msg = req.body.text;
    messages.push(msg);

    // Someone sent a message! Wake up all sleeping clients immediately.
    while(pendingClients.length > 0) {
        const clientRes = pendingClients.pop();
        clientRes.json({ new_message: msg });
    }

    res.status(201).send();
});

app.listen(3000, () => console.log('Polling server running'));
```

#### 4. Progressive Step-by-Step Breakdown
**Step 1: The Short Poll Problem**
In short polling, the HTTP connection is opened, headers are parsed, auth is checked, DB is queried, and the connection is closed. Doing this every second creates immense HTTP overhead.
**Step 2: The Long Poll Solution**
In long polling, the client makes a request, but the server *intentionally hangs* the request (doesn't call `res.send()`). It stores the `res` object in memory.
**Step 3: The Trigger**
When actual data arrives via another route (a POST request), the server iterates through the held `res` objects and fulfills them. The client gets the data instantly, then immediately opens a new long-poll request.

#### 5. ASCII Data Flow
```text
[Short Polling]
Client: Any data? -> Server: No.
Client: Any data? -> Server: No.
Client: Any data? -> Server: Yes, "Hello".

[Long Polling]
Client: Any data? ----------------------------> Server: (Waits...)
                                                Server: (Wait...)
*Data arrives at Server*                        Server: Yes, "Hello".
Client: Any data? ----------------------------> Server: (Waits...)
```

#### 6. Noob Trap vs Pro Tip
**Noob Trap:** Using `setInterval` on the frontend to poll a REST API every 500ms. Your backend will crash under load, and users on mobile will see their batteries drain rapidly.
**Pro Tip:** Long Polling is essentially dead for real-time bidirectional apps (replaced by WebSockets), but it is a crucial concept to understand event loops and memory leaks. The modern version of one-way server-to-client streaming is SSE (Server-Sent Events), which we cover in Module 4.

---

### Phase B: Engineering Challenges

#### Level 1: Warm-Up
**Challenge:** In the Long Polling code above, why do we need the `setTimeout` to close the connection with a `204`?
<details>
<summary>Hint</summary>
Think about load balancers and firewalls between the client and server.
</details>
<details>
<summary>Solution Walkthrough</summary>
Network infrastructure (like Nginx, AWS ALBs, or ISPs) usually kill HTTP connections that are idle for too long (often 60 seconds). If we don't cleanly close the connection and tell the client to reconnect, the connection might drop silently, leaving the client waiting forever.
</details>

#### Level 2: Real-World
**Challenge:** Write the Client-Side JavaScript fetch logic for Long Polling. It needs to call `/api/chat/long-poll`, log the message, and then immediately call the endpoint again (recursive).
<details>
<summary>Hint</summary>
Use `async/await`. Call the polling function recursively in a `finally` block or after the await.
</details>
<details>
<summary>Solution Walkthrough</summary>
```javascript
async function startLongPolling() {
    try {
        const response = await fetch('/api/chat/long-poll');
        if (response.status === 200) {
            const data = await response.json();
            console.log("New message:", data.new_message);
        }
        // If 204, do nothing, just reconnect
    } catch (error) {
        console.error("Poll error, waiting 5s before retry", error);
        await new Promise(r => setTimeout(r, 5000));
    } finally {
        // Immediately reconnect
        startLongPolling();
    }
}
```
</details>

#### Level 3: Boss Level (Cumulative)
**Challenge:** You have an endpoint `GET /api/jobs/:id/status`. Using REST mechanics and Long Polling, implement the backend logic to hold the connection until the job status changes to 'completed' or 'failed'.
<details>
<summary>Hint</summary>
Use an Event Emitter or simple array mapping job IDs to arrays of Response objects.
</details>
<details>
<summary>Solution Walkthrough</summary>
```javascript
const EventEmitter = require('events');
const jobEvents = new EventEmitter();

app.get('/api/jobs/:id/status', (req, res) => {
    const jobId = req.params.id;
    // Check current status first (omitted for brevity)

    // Create listener specific to this job
    const onComplete = (status) => {
        res.json({ status });
    };

    jobEvents.once(`job_done_${jobId}`, onComplete);

    // Cleanup if client disconnects early
    req.on('close', () => {
        jobEvents.removeListener(`job_done_${jobId}`, onComplete);
    });
});

// Somewhere else in code:
// jobEvents.emit(`job_done_123`, 'completed');
```
</details>

<br><br>

## Topic 2: Full-Duplex WebSockets

### Phase A: Problem-First Exploration

#### 1. Real-World Pain Point (The Why)
Long Polling fixes the "empty request" problem, but it requires opening a new HTTP connection every time a message is received. Establishing an HTTP connection requires a TCP 3-way handshake and SSL/TLS negotiation, which takes time and bandwidth. Furthermore, Long Polling is still half-duplex: the client requests, the server answers. If you want a fast-paced multiplayer game or high-frequency trading dashboard, HTTP overhead is too slow.

#### 2. Plain English Metaphor (The What)
HTTP is like sending letters via the postal service. WebSockets is like making a phone call.
You dial the number (the Handshake). Once connected, the line stays open. You can talk to the server, and the server can talk to you at the exact same time (Full-Duplex), instantly, without hanging up and redialing.

#### 3. Complete Runnable Code
Using the native `ws` library in Node.js.

```javascript
// Server (server.js)
const WebSocket = require('ws');

// Attach WS server to port 8080
const wss = new WebSocket.Server({ port: 8080 });

wss.on('connection', (ws) => {
    console.log('New client connected!');

    // Listen for messages FROM this specific client
    ws.on('message', (message) => {
        console.log(`Received: ${message}`);

        // Full-Duplex: Server can send back immediately
        ws.send(`Server confirms receipt of: ${message}`);

        // Broadcast to ALL connected clients
        wss.clients.forEach(client => {
            if (client !== ws && client.readyState === WebSocket.OPEN) {
                client.send(`Someone said: ${message}`);
            }
        });
    });

    ws.on('close', () => console.log('Client disconnected'));
});

// Client (can be run in browser console)
/*
const socket = new WebSocket('ws://localhost:8080');
socket.onopen = () => socket.send('Hello Server!');
socket.onmessage = (event) => console.log('Message from server:', event.data);
*/
```

#### 4. Progressive Step-by-Step Breakdown
**Step 1: The Protocol Upgrade**
A WebSocket connection starts as a standard HTTP GET request with an `Upgrade: websocket` header. If the server supports it, it replies with HTTP 101 Switching Protocols, and the TCP connection is kept alive indefinitely.
**Step 2: Event-Driven Architecture**
Because the connection stays open, you don't write routes like `app.get()`. You listen to events: `on('connection')`, `on('message')`, and `on('close')`.
**Step 3: Broadcasting**
In HTTP, a server only replies to the person who asked. In WebSockets, the server has a list of all open connections (`wss.clients`) and can iterate through them to push data to everyone (Broadcasting).

#### 5. ASCII Data Flow
```text
Client                         Server
  | -- HTTP GET (Upgrade) ----> |
  | <- HTTP 101 Switch Proto -- |
  |                             | (Connection is now a persistent Pipe)
  | --- ws.send("Hello") -----> |
  | <---- ws.send("Hi!") ------ |
  |                             |
  | <---- ws.send("Alert!") --- | (Server pushes unprompted!)
```

#### 6. Noob Trap vs Pro Tip
**Noob Trap:** Assuming WebSockets automatically reconnect if the WiFi drops. Native WebSockets (`ws`) have zero built-in reconnection logic. If a connection drops, it's gone forever unless you write manual retry logic.
**Pro Tip:** Add a "ping/pong" heartbeat mechanism. Firewalls will silently kill idle TCP connections. Sending a small 'ping' packet every 30 seconds keeps the connection alive and allows the server to detect dead clients and clear memory.

---

### Phase B: Engineering Challenges

#### Level 1: Warm-Up
**Challenge:** Write a client-side snippet to handle a lost WebSocket connection and attempt to reconnect after 3 seconds.
<details>
<summary>Hint</summary>
Attach a listener to `socket.onclose` and use `setTimeout` to instantiate a new `WebSocket`.
</details>
<details>
<summary>Solution Walkthrough</summary>
```javascript
function connect() {
    const ws = new WebSocket('ws://localhost:8080');

    ws.onopen = () => console.log('Connected');

    ws.onclose = () => {
        console.log('Disconnected. Reconnecting in 3s...');
        setTimeout(connect, 3000);
    };

    ws.onerror = (err) => {
        console.error('Socket error:', err);
        ws.close(); // Force close to trigger reconnect logic
    };
}
connect();
```
</details>

#### Level 2: Real-World
**Challenge:** Implement a Heartbeat (ping/pong) on the server using the `ws` library to detect broken connections.
<details>
<summary>Hint</summary>
Add an `isAlive` flag to the `ws` object. Use `ws.on('pong')` to set it to true. Run an interval that checks all clients, terminates them if false, and sends a `ping()` otherwise.
</details>
<details>
<summary>Solution Walkthrough</summary>
```javascript
wss.on('connection', (ws) => {
    ws.isAlive = true;
    ws.on('pong', () => { ws.isAlive = true; });
});

const interval = setInterval(() => {
    wss.clients.forEach((ws) => {
        if (ws.isAlive === false) return ws.terminate(); // Kill dead socket

        ws.isAlive = false;
        ws.ping(); // Client will automatically reply with pong
    });
}, 30000);
```
</details>

#### Level 3: Boss Level (Cumulative)
**Challenge:** Combine REST logic and WebSockets. A user POSTs to a REST endpoint `/api/alerts` to create an alert. If successful (201 Created), broadcast the new alert to all connected WebSocket clients.
<details>
<summary>Hint</summary>
The Express app and the WebSocket server can run alongside each other. You can reference the `wss` instance inside the Express route.
</details>
<details>
<summary>Solution Walkthrough</summary>
```javascript
const express = require('express');
const http = require('http');
const WebSocket = require('ws');

const app = express();
app.use(express.json());
const server = http.createServer(app); // Share HTTP server

// Attach WS to the same server
const wss = new WebSocket.Server({ server });

app.post('/api/alerts', (req, res) => {
    const alertMsg = req.body.message;
    if (!alertMsg) return res.status(400).send('Missing message');

    // Broadcast via WS
    wss.clients.forEach(client => {
        if (client.readyState === WebSocket.OPEN) {
            client.send(JSON.stringify({ type: 'ALERT', data: alertMsg }));
        }
    });

    res.status(201).json({ success: true });
});

// Starts both Express and WS on port 3000
server.listen(3000);
```
</details>

<br><br>

## Topic 3: Socket.io Multi-Room Chat

### Phase A: Problem-First Exploration

#### 1. Real-World Pain Point (The Why)
Native WebSockets are raw TCP pipes. If you want to build a chat app with "Channels" (like Discord or Slack), using native WebSockets requires you to manually manage massive arrays of clients for every single room, handle disconnections, implement JSON stringification on every message, and manage broadcast logic. It becomes a routing nightmare.

#### 2. Plain English Metaphor (The What)
Native WebSockets (`ws`) is like owning the copper wires for a phone network. You have to physically connect the wires yourself to route calls.
Socket.io is a fully-featured Switchboard Operator. You can say "Connect me to the 'Sports' room," and when you broadcast to 'Sports', Socket.io handles all the internal wire routing instantly.

#### 3. Complete Runnable Code
```javascript
const express = require('express');
const http = require('http');
const { Server } = require('socket.io');

const app = express();
const server = http.createServer(app);
const io = new Server(server); // Initialize Socket.io

io.on('connection', (socket) => {
    console.log(`User connected: ${socket.id}`);

    // 1. Joining a Room
    socket.on('join_room', (roomName) => {
        socket.join(roomName);
        console.log(`User ${socket.id} joined ${roomName}`);

        // Notify others in the room
        socket.to(roomName).emit('notification', `A new user joined ${roomName}`);
    });

    // 2. Sending a message to a specific room
    socket.on('send_message', (data) => {
        // data looks like { room: "sports", text: "Go team!" }

        // io.to() sends to EVERYONE in the room
        io.to(data.room).emit('receive_message', {
            sender: socket.id,
            text: data.text
        });
    });

    socket.on('disconnect', () => {
        console.log(`User disconnected: ${socket.id}`);
    });
});

server.listen(3000, () => console.log('Socket.io running on :3000'));
```

#### 4. Progressive Step-by-Step Breakdown
**Step 1: Automatic Serialization & Event Naming**
Unlike native `ws` which only sends strings, Socket.io lets you emit named events (`emit('send_message', object)`). It automatically stringifies and parses JSON for you.
**Step 2: Room Management (`join` and `leave`)**
`socket.join('roomName')` subscribes a socket to a channel. Socket.io manages the internal sets/arrays. You can join multiple rooms.
**Step 3: Targeted Broadcasting**
- `io.to('room').emit(...)`: Sends to everyone in the room.
- `socket.to('room').emit(...)`: Sends to everyone in the room *except* the sender.

#### 5. ASCII Data Flow
```text
[Client A (in "Sports")]      [Server]      [Client B (in "Sports")]     [Client C (in "News")]
          |                      |                     |                           |
          |--emit('send_message',|                     |                           |
          |  {room:"Sports"}) -->|                     |                           |
          |                      |--emit('receive')--> |                           |
          |                      |                     |                           |
          |                      | (Does NOT send to C, because C is in "News")    |
```

#### 6. Noob Trap vs Pro Tip
**Noob Trap:** Using Socket.io as an API replacement. Don't use WebSockets to send data like "Update User Profile". That should remain a standard REST PUT request. Sockets are for ephemeral, real-time data.
**Pro Tip:** When you scale your server to multiple instances (e.g., using a load balancer), Socket.io rooms break because Server 1 doesn't know about users connected to Server 2. You **must** implement a Redis Adapter (`@socket.io/redis-adapter`) to allow the servers to publish/subscribe socket events across the cluster.

---

### Phase B: Engineering Challenges

#### Level 1: Warm-Up
**Challenge:** How do you make a user leave a room called `"gaming"` using Socket.io?
<details>
<summary>Hint</summary>
It's the exact opposite of `join`.
</details>
<details>
<summary>Solution Walkthrough</summary>
```javascript
socket.leave("gaming");
```
</details>

#### Level 2: Real-World
**Challenge:** Implement typing indicators. When Client A is typing, only the users in their specific room should receive a `typing` event. When they stop, send a `stop_typing` event.
<details>
<summary>Hint</summary>
Use `socket.to(room).emit()`. Remember, the sender shouldn't see their own typing indicator!
</details>
<details>
<summary>Solution Walkthrough</summary>
```javascript
// Server side
socket.on('typing', (room) => {
    socket.to(room).emit('user_typing', socket.id);
});

socket.on('stop_typing', (room) => {
    socket.to(room).emit('user_stopped_typing', socket.id);
});
```
</details>

#### Level 3: Boss Level (Cumulative)
**Challenge:** Combine REST Authentication with Socket.io Rooms. You have a JWT token. Socket.io supports middleware using `io.use()`. Write a middleware that extracts a token from `socket.handshake.auth.token`, verifies it (mock the verification), and assigns the `userId` to the socket object so it can be used in rooms.
<details>
<summary>Hint</summary>
Socket middleware looks like `(socket, next) => {}`. Call `next()` on success, and `next(new Error())` on failure.
</details>
<details>
<summary>Solution Walkthrough</summary>
```javascript
io.use((socket, next) => {
    const token = socket.handshake.auth.token;

    if (!token) {
        return next(new Error('Authentication error: Token missing'));
    }

    // Mock JWT verification
    if (token === 'valid-secret-token') {
        socket.userId = 'user_123'; // Attach to socket for future use
        next();
    } else {
        next(new Error('Authentication error: Invalid token'));
    }
});

io.on('connection', (socket) => {
    console.log(`Authenticated user connected: ${socket.userId}`);
    // Auto-join a personal room for private notifications
    socket.join(`private_${socket.userId}`);
});
```
</details>
