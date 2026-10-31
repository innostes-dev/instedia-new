# Real-World Engineering Challenge: Full-Stack Nuxt 3 Real-Time Crypto Dashboard

## Context & Architecture
You are building a high-frequency cryptocurrency trading dashboard using Nuxt 3. The prices change every few milliseconds. Traditional polling (sending an HTTP request every second) will overload the server and create unacceptable lag. WebSockets are powerful but overkill if the client only needs to *receive* data (not send it).
You must implement **Server-Sent Events (SSE)** using the Nuxt Nitro backend engine, and stream that data natively into a Vue 3 component. Furthermore, because this is an SSR application, you must handle the hydration boundary carefully: the initial page load must show a static price, and the live stream must only attach on the client side without throwing hydration mismatch errors.

## Specifications
1. **Backend (Nitro):** Create a server API route (`server/api/stream.ts`) that keeps the connection open and sends a new random price for Bitcoin every 1 second using the `event-stream` content type.
2. **Frontend (Vue/Nuxt):** Connect to this stream using the native browser `EventSource` API inside an `onMounted` hook.
3. **Hydration:** Fetch an initial static price using `useAsyncData` during SSR so the HTML isn't blank, then override it with the live stream once the browser boots up.

## Starter Template

```typescript
// server/api/stream.ts
import { defineEventHandler } from 'h3';

export default defineEventHandler((event) => {
  // TODO: Set headers for Server-Sent Events
  // TODO: Create a setInterval that pushes data
  // TODO: Handle client disconnect
});
```

```vue
<!-- pages/dashboard.vue -->
<template>
  <div class="dashboard">
    <h1>BTC/USD Live Stream</h1>

    <!-- Render the price here -->
    <div class="price-display" :class="{ up: isUp, down: !isUp }">
      ${{ currentPrice }}
    </div>

    <p class="status">Connection: {{ status }}</p>
  </div>
</template>

<script setup>
import { ref, onMounted, onUnmounted } from 'vue';

// TODO: Fetch initial static price for SSR
const currentPrice = ref(0);
const isUp = ref(true);
const status = ref('Disconnected');

// TODO: Connect to EventSource in onMounted
</script>
```

---

## Production Solution Walkthrough

### 1. Nitro Server-Sent Events Endpoint (Backend)

SSE requires specific HTTP headers to tell the browser "Keep this connection open, I will send chunks of text over time."

```typescript
// server/api/stream.ts
import { defineEventHandler, setResponseHeaders } from 'h3';

export default defineEventHandler(async (event) => {
  // 1. Configure SSE Headers
  setResponseHeaders(event, {
    'Content-Type': 'text/event-stream',
    'Cache-Control': 'no-cache',
    'Connection': 'keep-alive',
  });

  let currentPrice = 50000;

  // 2. Create the stream
  const encoder = new TextEncoder();

  // H3 allows us to return a ReadableStream directly
  const stream = new ReadableStream({
    start(controller) {
      // 3. Send data every 1 second
      const interval = setInterval(() => {
        // Fluctuate price by -50 to +50
        const change = (Math.random() * 100) - 50;
        currentPrice += change;

        // SSE Format requires "data: {json}\n\n"
        const payload = JSON.stringify({
          price: currentPrice.toFixed(2),
          timestamp: Date.now()
        });

        controller.enqueue(encoder.encode(`data: ${payload}\n\n`));
      }, 1000);

      // 4. Cleanup when client disconnects
      event.node.req.on('close', () => {
        clearInterval(interval);
        controller.close();
      });
    }
  });

  return stream;
});
```

### 2. The Nuxt Frontend (Hydration + EventSource)

We must merge SSR static data with Client dynamic streaming seamlessly.

```vue
<!-- pages/dashboard.vue -->
<template>
  <div class="dashboard">
    <h1>BTC/USD Live Stream</h1>

    <!-- We use the reactive refs which start as SSR data, then become Live data -->
    <div class="price-display" :class="{ 'text-green-500': isUp, 'text-red-500': !isUp }">
      ${{ currentPrice }}
    </div>

    <p class="status text-sm text-gray-500">Connection: {{ status }}</p>
  </div>
</template>

<script setup>
import { ref, onMounted, onUnmounted, watch } from 'vue';
import { useAsyncData } from '#imports';

// 1. SSR: Fetch a static "initial" price so search engines and slow connections see data immediately.
// We use a separate mocked endpoint or initial state logic here.
const { data: initialData } = await useAsyncData('btc-init', () =>
  Promise.resolve({ price: "50000.00" }) // Simulated DB fetch
);

// 2. Reactive state
const currentPrice = ref(initialData.value.price);
const previousPrice = ref(initialData.value.price);
const isUp = ref(true);
const status = ref('SSR Static');

let eventSource = null;

// Determine color (green/red) based on change
watch(currentPrice, (newVal) => {
  isUp.value = parseFloat(newVal) >= parseFloat(previousPrice.value);
  previousPrice.value = newVal;
});

// 3. Mount Live Stream ONLY on the Client
onMounted(() => {
  status.value = 'Connecting...';

  // Connect to our Nitro backend API
  eventSource = new EventSource('/api/stream');

  eventSource.onopen = () => {
    status.value = 'Live (SSE)';
  };

  eventSource.onmessage = (event) => {
    const data = JSON.parse(event.data);
    // Overwrite the SSR data with live stream data!
    currentPrice.value = data.price;
  };

  eventSource.onerror = () => {
    status.value = 'Connection Lost';
    eventSource.close();
  };
});

// 4. Prevent Memory Leaks
onUnmounted(() => {
  if (eventSource) {
    eventSource.close();
  }
});
</script>

<style scoped>
.price-display { font-size: 3rem; font-family: monospace; font-weight: bold; transition: color 0.3s; }
.text-green-500 { color: #10b981; }
.text-red-500 { color: #ef4444; }
</style>
```

### Key Takeaways
* **ReadableStream in Nitro**: The H3 engine powering Nuxt 3 supports modern Web Standard Streams. We return a `ReadableStream` instead of hanging a Node.js `res` object, making this backend fully compatible with serverless Edge environments (Cloudflare Workers).
* **Hydration Hand-off**: We start with `useAsyncData` to satisfy SSR requirements. Once `onMounted` fires (which only happens in the browser), we open the `EventSource`. When the first live message arrives, we mutate `currentPrice.value`, and Vue's reactivity updates the DOM seamlessly without causing a mismatch error.
