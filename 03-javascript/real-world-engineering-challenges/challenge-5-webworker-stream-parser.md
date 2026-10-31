# Challenge 5: Web Worker Streaming SSE Token Parser

## Problem Statement
You are building an AI chat interface. The AI server streams the response back token-by-token using Server-Sent Events (SSE).
Parsing thousands of tokens and updating a massive markdown string synchronously on the main thread causes the UI to stutter (the typing effect looks laggy).
You need to move the heavy parsing and formatting off the main thread into a **Web Worker**.

Build a conceptual pipeline where:
1. The Main Thread instantiates a Worker.
2. The Main Thread fetches the SSE stream.
3. As chunks arrive, the Main Thread passes raw bytes to the Worker.
4. The Worker parses the JSON, formats the markdown, and sends the finished HTML string back to the Main Thread.
5. The Main Thread purely updates the DOM.

---

## The Solution Walkthrough

### 1. The Web Worker File (`worker.js`)
Workers live in a completely separate CPU thread. They cannot touch the DOM (`document` doesn't exist here). They communicate via `postMessage`.

```javascript
// worker.js
let fullText = "";

// Listen for messages from the Main Thread
self.addEventListener("message", (event) => {
  const { type, payload } = event.data;

  if (type === "NEW_CHUNK") {
    // 1. Heavy Parsing (e.g., decoding Uint8Array, parsing JSON strings from the stream)
    // Assume payload is a parsed string token like "Hello"
    const token = payload;

    // 2. Heavy Formatting
    fullText += token;

    // Simulate an expensive markdown-to-HTML parser
    const expensiveHTML = fullText
                            .replace(/\*\*(.*?)\*\*/g, '<b>$1</b>')
                            .replace(/\n/g, '<br/>');

    // 3. Send the finished product back to Main Thread
    self.postMessage({ type: "RENDER_READY", html: expensiveHTML });
  }
});
```

### 2. The Main Thread (`app.js`)
The main thread focuses entirely on Network fetching and DOM updating.

```javascript
// app.js (Main Thread)
const chatBox = document.getElementById("chat-box");

// 1. Boot up the background thread
// const aiWorker = new Worker("worker.js");

// 2. Listen for finished HTML from the Worker
/*
aiWorker.addEventListener("message", (event) => {
  if (event.data.type === "RENDER_READY") {
    // Main thread does ZERO calculation, just paints the screen!
    chatBox.innerHTML = event.data.html;
  }
});
*/

// 3. The Fetch Stream (Simulated)
async function startAIStream() {
  console.log("Starting stream...");

  // Simulating receiving tokens every 50ms
  const tokens = ["**Hello**, ", "I ", "am ", "an ", "**AI**.\n", "How ", "can ", "I ", "help?"];

  for (const token of tokens) {
    // Send raw data to the worker immediately
    // aiWorker.postMessage({ type: "NEW_CHUNK", payload: token });
    console.log(`Passed '${token}' to worker...`);

    // Wait 50ms to simulate network stream speed
    await new Promise(r => setTimeout(r, 50));
  }
}

// startAIStream();
```

### Senior Engineer Takeaways
- **Thread Segregation:** The golden rule of performance. Main Thread = Layout/Painting/Input. Worker Thread = Data Parsing/Math/Formatting.
- **Streaming Streams:** By passing chunks as they arrive (instead of waiting for the full response), the AI starts "typing" instantly, creating a premium UX.
- **Message Passing:** Data sent via `postMessage` is serialized and copied (unless using `Transferable` objects). Keep the payloads small and efficient.
