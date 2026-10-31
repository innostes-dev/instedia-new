# Module 04: AI Streaming

## Topic 1: Why ChatGPT Uses SSE (Server-Sent Events)

### Phase A: Problem-First Exploration

#### 1. Real-World Pain Point (The Why)
LLMs (Large Language Models) like GPT-4 do not generate text instantly. They predict the next word (token) one by one. If an AI takes 10 seconds to write a 500-word essay, waiting for a standard REST `req/res` cycle means the user stares at a loading spinner for 10 solid seconds before seeing a massive wall of text appear all at once. This is terrible UX.
Why not use WebSockets? Because AI text generation is inherently one-way (unidirectional): The client sends one prompt, and the server sends a stream of tokens back. Establishing a full-duplex WebSocket connection just for a one-way text stream is architectural overkill and harder to scale through corporate firewalls.

#### 2. Plain English Metaphor (The What)
- **Standard REST:** Ordering a pizza. You wait 30 minutes, and the whole pizza arrives at once.
- **WebSockets:** A phone call. Both people can talk over each other instantly.
- **SSE (Server-Sent Events):** A radio broadcast. You tune in (make a GET request), and the DJ just keeps talking at you. You can't talk back on the same frequency, but you hear every word the second they say it.

#### 3. Complete Runnable Code
Let's build a server that simulates an AI typing a response.

```javascript
const express = require('express');
const app = express();

app.get('/api/ai/stream', (req, res) => {
    // 1. Set specific headers for SSE
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');

    const fakeAiResponse = "Hello! I am a simulated AI. I write one word at a time.";
    const words = fakeAiResponse.split(' ');
    let currentIndex = 0;

    // 2. Stream tokens via an interval
    const interval = setInterval(() => {
        if (currentIndex < words.length) {
            // Write to the open connection
            res.write(`data: ${words[currentIndex]} \n\n`);
            currentIndex++;
        } else {
            // Finish the stream
            res.write(`data: [DONE]\n\n`);
            res.end(); // Closes the HTTP connection
            clearInterval(interval);
        }
    }, 300); // Emits a word every 300ms

    // 3. Handle client disconnect
    req.on('close', () => {
        console.log('Client closed connection early');
        clearInterval(interval);
    });
});

app.listen(3000, () => console.log('SSE Server running on :3000'));
```

#### 4. Progressive Step-by-Step Breakdown
**Step 1: The Headers**
SSE operates over standard HTTP. By setting `Content-Type: text/event-stream` and `Connection: keep-alive`, you tell the browser, "Don't close this request, data will arrive in chunks."
**Step 2: `res.write()` vs `res.send()`**
`res.send()` sends the payload and automatically closes the connection. `res.write()` pushes a chunk of data down the TCP pipe while keeping it open.
**Step 3: Event Formatting**
SSE requires a very specific string format. Every payload must start with `data: ` and end with two newline characters `\n\n`.

#### 5. ASCII Data Flow
```text
[Client]                                  [Server]
   | --- GET /api/stream (Prompt) --------> |
   | <- HTTP 200 (text/event-stream) ------ | (Connection stays open)
   |                                        |
   | <----- data: Hello \n\n -------------- | (300ms later)
   | <----- data: I \n\n ------------------ | (300ms later)
   | <----- data: am \n\n ----------------- | (300ms later)
   | <----- data: [DONE] \n\n ------------- |
   |                                        | (Connection Closes)
```

#### 6. Noob Trap vs Pro Tip
**Noob Trap:** Using WebSockets for AI chat. WebSockets require specialized load balancing (sticky sessions) and constant ping/pong heartbeat management. SSE works perfectly over standard HTTP/1.1 and HTTP/2 infrastructure.
**Pro Tip:** Most modern AI APIs (OpenAI, Anthropic) use POST requests for SSE (so you can pass a large JSON payload containing the chat history). While the official SSE spec technically favors GET, Express and modern fetch APIs handle POST streams perfectly fine using the same `text/event-stream` headers.

---

### Phase B: Engineering Challenges

#### Level 1: Warm-Up
**Challenge:** Modify the SSE `res.write()` to include an Event name. This allows the client to listen to specific events rather than just generic data.
<details>
<summary>Hint</summary>
Before the `data:` line, add an `event:` line.
</details>
<details>
<summary>Solution Walkthrough</summary>
```javascript
res.write(`event: token\n`);
res.write(`data: ${word}\n\n`);
```
</details>

#### Level 2: Real-World
**Challenge:** Imagine the AI backend crashed mid-generation. How do you communicate this error to the frontend using SSE before calling `res.end()`?
<details>
<summary>Hint</summary>
Send a specific JSON object or a specific `event` type indicating an error.
</details>
<details>
<summary>Solution Walkthrough</summary>
```javascript
try {
    // Generate AI stuff
} catch (err) {
    // Standard format for errors in SSE streams
    res.write(`event: error\n`);
    res.write(`data: {"message": "Internal AI Failure"}\n\n`);
    res.end();
}
```
</details>

#### Level 3: Boss Level (Cumulative)
**Challenge:** Build an Express POST route `/api/chat` that accepts a JSON body `{ "prompt": "..." }`. It must validate the prompt exists (REST constraint, 400 status if fail). If valid, it establishes an SSE connection and streams back the reversed string of the prompt, character by character, every 100ms.
<details>
<summary>Hint</summary>
You can mix standard Express body parsing (`app.use(express.json())`) with SSE headers.
</details>
<details>
<summary>Solution Walkthrough</summary>
```javascript
app.post('/api/chat', (req, res) => {
    const prompt = req.body.prompt;

    // REST Validation
    if (!prompt) {
        return res.status(400).json({ error: 'Prompt is required' });
    }

    // Upgrade to SSE
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');

    const chars = prompt.split('').reverse();
    let i = 0;

    const interval = setInterval(() => {
        if (i < chars.length) {
            res.write(`data: {"char": "${chars[i]}"}\n\n`);
            i++;
        } else {
            res.write(`data: [DONE]\n\n`);
            res.end();
            clearInterval(interval);
        }
    }, 100);

    req.on('close', () => clearInterval(interval));
});
```
</details>

<br><br>

## Topic 2: text/event-stream Framing

### Phase A: Problem-First Exploration

#### 1. Real-World Pain Point (The Why)
When streaming data over a raw TCP socket, data doesn't always arrive neatly packaged. Network latency means a JSON string might get chopped in half across two network packets. If you try to parse half a JSON string, your app crashes. How does the browser know exactly where one AI token ends and the next begins?

#### 2. Plain English Metaphor (The What)
Imagine receiving a telegram with no spaces or punctuation. "HELLOHOWAREYOU". It's hard to read.
Framing is adding a predefined separator. In SSE, that separator is `\n\n` (two carriage returns/newlines). It tells the parser: "Stop waiting for more data, this specific packet is complete, go ahead and process it."

#### 3. Complete Runnable Code
Let's see how framing allows sending complex JSON objects.

```javascript
const express = require('express');
const app = express();

app.get('/api/complex-stream', (req, res) => {
    res.setHeader('Content-Type', 'text/event-stream');

    // Sending a complex JSON object requires careful framing.
    // The data payload must be a SINGLE line string.
    const payload1 = { token: "Hello", meta: { probabilities: 0.99 } };

    // Note: JSON.stringify ensures the object is on a single line.
    res.write(`data: ${JSON.stringify(payload1)}\n\n`);

    setTimeout(() => {
        const payload2 = { token: "World", meta: { probabilities: 0.85 } };
        res.write(`data: ${JSON.stringify(payload2)}\n\n`);
        res.end();
    }, 1000);
});
```

#### 4. Progressive Step-by-Step Breakdown
**Step 1: The `data:` prefix**
Every line of data must start with `data: `.
**Step 2: Single-line limitation**
If you have multi-line data, you must prefix *every* line with `data: `. E.g.:
```text
data: line 1
data: line 2\n\n
```
Because this is annoying, standard practice is to `JSON.stringify()` your data into a single string.
**Step 3: The `\n\n` Terminator**
The double newline is the frame boundary. The client's EventSource API will buffer all incoming bytes until it sees `\n\n`, and only then will it fire the `onmessage` event.

#### 5. ASCII Data Flow
```text
Network Packets arrive fragmented:
Packet 1: "data: {"tok"
Packet 2: "en": "He"
Packet 3: "llo"}\n\n"

Browser SSE Parser:
- Buffers Packet 1... waits.
- Buffers Packet 2... waits.
- Buffers Packet 3... SEES \n\n!
- Triggers onmessage({ data: '{"token": "Hello"}' })
```

#### 6. Noob Trap vs Pro Tip
**Noob Trap:** Using `\n` instead of `\n\n`. If you only use one newline, the browser will wait indefinitely for the second one, and your stream will appear completely frozen.
**Pro Tip:** You can send an `id: ` field before the `data:` field. If the connection drops, the browser will automatically reconnect and send a `Last-Event-ID` HTTP header, allowing your backend to resume exactly where it left off!

---

### Phase B: Engineering Challenges

#### Level 1: Warm-Up
**Challenge:** You want to send a multi-line string in SSE without using JSON.stringify. How do you format it?
String: `Hello\nWorld`
<details>
<summary>Hint</summary>
Every line needs `data: `, and the whole block needs `\n\n` at the end.
</details>
<details>
<summary>Solution Walkthrough</summary>
```text
data: Hello\n
data: World\n\n
```
</details>

#### Level 2: Real-World
**Challenge:** Implement the `id` framing to support automatic resumption. Write the server code to send an event with ID `101`.
<details>
<summary>Hint</summary>
The format is `id: [id]\ndata: [data]\n\n`.
</details>
<details>
<summary>Solution Walkthrough</summary>
```javascript
res.write(`id: 101\n`);
res.write(`data: {"message": "Important update"}\n\n`);
```
</details>

#### Level 3: Boss Level (Cumulative)
**Challenge:** Write an Express endpoint that uses REST parameters and SSE framing. `GET /api/stream/:resumeId`. If `resumeId` is provided (e.g., connection dropped and client reconnects), start streaming data from that ID onwards.
Array of data: `[{id:1, txt:'A'}, {id:2, txt:'B'}, {id:3, txt:'C'}]`
<details>
<summary>Hint</summary>
Check `req.params.resumeId`. Find the index in the array, and slice the array from that point.
</details>
<details>
<summary>Solution Walkthrough</summary>
```javascript
const dataStore = [
    {id:1, txt:'A'}, {id:2, txt:'B'}, {id:3, txt:'C'}
];

app.get('/api/stream/:resumeId?', (req, res) => {
    res.setHeader('Content-Type', 'text/event-stream');

    let startIndex = 0;
    if (req.params.resumeId) {
        const lastId = parseInt(req.params.resumeId);
        startIndex = dataStore.findIndex(d => d.id === lastId) + 1;
    }

    const itemsToSend = dataStore.slice(startIndex);

    itemsToSend.forEach(item => {
        // Proper framing with ID
        res.write(`id: ${item.id}\n`);
        res.write(`data: {"text": "${item.txt}"}\n\n`);
    });

    res.write(`data: [DONE]\n\n`);
    res.end();
});
```
</details>

<br><br>

## Topic 3: Token-by-Token Live Reader

### Phase A: Problem-First Exploration

#### 1. Real-World Pain Point (The Why)
The backend is successfully streaming tokens via SSE. But how does the frontend read it? The native `EventSource` API in the browser only supports GET requests. Because AI applications often require sending large conversation histories to the server, we usually need to make a POST request. Standard `fetch()` doesn't inherently parse SSE `\n\n` framing; it just gives you a raw byte `ReadableStream`.

#### 2. Plain English Metaphor (The What)
The server is spraying water out of a firehose (a raw byte stream). If you just try to catch it with your hands, it's a mess.
We need a funnel (a TextDecoder) to turn the water into readable words, and a bucket (a buffer/parser) to separate the words every time we see the `\n\n` separator.

#### 3. Complete Runnable Code
Here is the production-grade frontend JavaScript required to read an SSE stream from a POST request.

```html
<!-- index.html -->
<button id="askBtn">Ask AI</button>
<div id="chatBox"></div>

<script>
document.getElementById('askBtn').addEventListener('click', async () => {
    const chatBox = document.getElementById('chatBox');
    chatBox.innerText = ''; // clear

    // 1. Standard POST Fetch request
    const response = await fetch('/api/ai/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ prompt: "Tell me a story" })
    });

    // 2. Access the raw byte stream
    const reader = response.body.getReader();
    const decoder = new TextDecoder('utf-8');
    let buffer = '';

    while (true) {
        // 3. Read chunks as they arrive
        const { done, value } = await reader.read();
        if (done) break;

        // Decode bytes to string and add to our buffer
        buffer += decoder.decode(value, { stream: true });

        // 4. Manually parse the SSE framing (\n\n)
        let boundary = buffer.indexOf('\n\n');
        while (boundary !== -1) {
            const chunk = buffer.slice(0, boundary);
            buffer = buffer.slice(boundary + 2); // remove processed chunk

            if (chunk.startsWith('data: ')) {
                const dataStr = chunk.replace('data: ', '');
                if (dataStr === '[DONE]') {
                    console.log('Stream finished');
                    return;
                }

                // Parse the JSON and append to UI
                const dataObj = JSON.parse(dataStr);
                chatBox.innerText += dataObj.token;
            }

            // Check if there is another complete frame in the buffer
            boundary = buffer.indexOf('\n\n');
        }
    }
});
</script>
```

#### 4. Progressive Step-by-Step Breakdown
**Step 1: The Reader API**
`response.body.getReader()` gives you a lock on the stream. `reader.read()` returns an object with `done` (boolean) and `value` (a Uint8Array of bytes).
**Step 2: The Decoder**
`TextDecoder` translates the binary `Uint8Array` into a human-readable string.
**Step 3: The Buffer & Boundary**
Because a chunk might stop exactly in the middle of a token (e.g., `data: {"to`), we add the string to a `buffer`. We only process it when we find the `\n\n` boundary. Once processed, we slice it out of the buffer.

#### 5. ASCII Data Flow
```text
Network receives byte chunk: [100, 97, 116, 97, 58, 32...]
TextDecoder -> String: "data: {\"t"
Buffer = "data: {\"t"
Boundary \n\n found? -> NO. Wait.

Network receives byte chunk: [...111, 107, 101, 110... 10, 10]
TextDecoder -> String: "oken\":\"Hi\"}\n\n"
Buffer = "data: {\"token\":\"Hi\"}\n\n"
Boundary \n\n found? -> YES.
Process string, slice buffer.
Append "Hi" to DOM.
```

#### 6. Noob Trap vs Pro Tip
**Noob Trap:** Using `EventSource` for AI apps. `EventSource` only does GET. If your prompt history exceeds URL length limits (~2000 chars), your app will crash.
**Pro Tip:** Never trust that a single `reader.read()` will contain exactly one full SSE event. It might contain half an event, or it might contain 5 events combined. The `while (boundary !== -1)` loop is absolutely critical for production stability.

---

### Phase B: Engineering Challenges

#### Level 1: Warm-Up
**Challenge:** If a stream ends unexpectedly, you might have leftover text in your `buffer` that lacks a `\n\n`. How would you flush the remaining buffer to the console after the `while(true)` loop finishes?
<details>
<summary>Hint</summary>
Just check if the buffer is empty after the loop breaks.
</details>
<details>
<summary>Solution Walkthrough</summary>
```javascript
if (buffer.trim() !== '') {
    console.warn('Incomplete stream ended early:', buffer);
}
```
</details>

#### Level 2: Real-World
**Challenge:** Modify the parsing logic. Suppose the backend sends an `event: error\n` frame followed by `data: {"msg": "Rate limited"}\n\n`. How do you detect and handle this in the `while (boundary !== -1)` loop?
<details>
<summary>Hint</summary>
Check if the `chunk` contains `event: error` or `startsWith('event: error')`.
</details>
<details>
<summary>Solution Walkthrough</summary>
```javascript
if (chunk.includes('event: error')) {
    // Extract the data payload
    const dataLine = chunk.split('\n').find(line => line.startsWith('data: '));
    const errObj = JSON.parse(dataLine.replace('data: ', ''));
    alert('AI Error: ' + errObj.msg);
    return;
}
```
</details>

#### Level 3: Boss Level (Cumulative)
**Challenge:** Refactor the entire client-side SSE reader into a reusable async generator function `async function* streamAI(url, body)`. It should `yield` the parsed JSON tokens one by one so the UI component can just use a `for await...of` loop.
<details>
<summary>Hint</summary>
Generators use `yield` to return values over time. Replace the DOM update (`chatBox.innerText += ...`) with `yield dataObj`.
</details>
<details>
<summary>Solution Walkthrough</summary>
```javascript
async function* streamAI(url, body) {
    const response = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body)
    });

    const reader = response.body.getReader();
    const decoder = new TextDecoder('utf-8');
    let buffer = '';

    while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        let boundary = buffer.indexOf('\n\n');

        while (boundary !== -1) {
            const chunk = buffer.slice(0, boundary);
            buffer = buffer.slice(boundary + 2);

            if (chunk.startsWith('data: ')) {
                const dataStr = chunk.replace('data: ', '');
                if (dataStr === '[DONE]') return;

                // YIELD the parsed object back to the caller
                yield JSON.parse(dataStr);
            }
            boundary = buffer.indexOf('\n\n');
        }
    }
}

// Usage in UI:
/*
async function run() {
    for await (const data of streamAI('/api/ai', { prompt: 'hi' })) {
        chatBox.innerText += data.token;
    }
}
*/
```
</details>
