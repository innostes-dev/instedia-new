# Real-World Engineering Challenge: Micro-Frontend Enterprise Portal

## Context & Architecture
You are architecting an internal Enterprise Portal for a massive corporation. The portal consists of a "Container" app (the shell, navbar, and sidebar), a "HR" app, and an "IT Helpdesk" app.
These apps are developed by three completely different teams and deployed independently. However, to the user, they must look like a single, cohesive Single Page Application (SPA).
You must implement a **Micro-Frontend Architecture** using Webpack 5 Module Federation (via Vite plugin for Vue 3). Crucially, you must establish a **Shared Pinia State Bus** so that if the user logs in via the Container app, the HR app instantly knows the user's ID without having to make its own authentication API call.

## Specifications
1. **Container Setup:** Configure the Vite/Webpack Module Federation plugin in `vite.config.js` to expose a Pinia store and consume remote Vue components.
2. **State Bus:** Create a `useGlobalAuthStore` that acts as the single source of truth across all federated modules.
3. **Dynamic Remote Mounting:** Create a Vue view in the Container that dynamically loads the HR remote component over the network using `defineAsyncComponent`.

## Starter Template

```javascript
// host-app/vite.config.js
import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'
import federation from '@originjs/vite-plugin-federation'

export default defineConfig({
  plugins: [
    vue(),
    // TODO: Configure Module Federation for the Host
  ],
  build: { target: 'esnext' }
})
```

```javascript
// remote-hr-app/vite.config.js
import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'
import federation from '@originjs/vite-plugin-federation'

export default defineConfig({
  plugins: [
    vue(),
    // TODO: Configure Module Federation to expose the HR Dashboard
  ],
  build: { target: 'esnext' }
})
```

```vue
<!-- host-app/src/App.vue -->
<template>
  <div class="layout">
    <Sidebar :user="authStore.user" />
    <main>
      <!-- TODO: Mount Remote HR App Here asynchronously -->
    </main>
  </div>
</template>

<script setup>
// TODO: Load global auth store
</script>
```

---

## Production Solution Walkthrough

### 1. Vite Module Federation Configuration

We use `@originjs/vite-plugin-federation` to compile our apps into independently deployable units that can share code at runtime.

**The Remote (HR App):**
```javascript
// remote-hr-app/vite.config.js
import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'
import federation from '@originjs/vite-plugin-federation'

export default defineConfig({
  plugins: [
    vue(),
    federation({
      name: 'hr_app',
      filename: 'remoteEntry.js', // This is the manifest the host will download
      exposes: {
        // Expose a Vue component for the host to mount
        './HrDashboard': './src/components/Dashboard.vue'
      },
      shared: ['vue', 'pinia'] // Critical: ensure Vue/Pinia are singletons!
    })
  ],
  build: { target: 'esnext' }
})
```

**The Host (Container App):**
```javascript
// host-app/vite.config.js
import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'
import federation from '@originjs/vite-plugin-federation'

export default defineConfig({
  plugins: [
    vue(),
    federation({
      name: 'host_app',
      remotes: {
        // Point to the deployed URL of the HR App's manifest
        // In dev, this might be http://localhost:5001/assets/remoteEntry.js
        hr_app: 'http://hr.enterprise.internal/assets/remoteEntry.js'
      },
      // Expose the global auth store SO REMOTES CAN CONSUME IT
      exposes: {
        './GlobalAuth': './src/stores/authStore.js'
      },
      shared: ['vue', 'pinia'] // Must match remote configuration
    })
  ],
  build: { target: 'esnext' }
})
```

### 2. The Shared Pinia State Bus

The Host app defines the store. Because we put `pinia` in the `shared` array of the federation config, both the host and the remote will use the exact same Pinia instance in memory at runtime.

```javascript
// host-app/src/stores/authStore.js
import { defineStore } from 'pinia';
import { ref } from 'vue';

export const useGlobalAuthStore = defineStore('globalAuth', () => {
  const user = ref(null);

  const login = (userData) => {
    user.value = userData;
  };

  return { user, login };
});
```

### 3. Asynchronous Remote Mounting (Host App)

The host app loads the HR component over the network. If the HR team deploys a bug, the container app handles it gracefully using Vue's `<Suspense>` and error boundaries.

```vue
<!-- host-app/src/App.vue -->
<template>
  <div class="enterprise-layout">
    <aside class="sidebar">
      <h2>Portal</h2>
      <button v-if="!authStore.user" @click="authStore.login({ id: 1, name: 'Alice' })">
        Login
      </button>
      <p v-else>Welcome, {{ authStore.user.name }}</p>
    </aside>

    <main class="content-area">
      <!-- Vue Suspense handles the asynchronous network request for the component -->
      <Suspense>
        <!-- The #fallback template shows while remoteEntry.js is downloading -->
        <template #fallback>
          <div>Loading HR Module over network...</div>
        </template>

        <!-- The default template renders once downloaded -->
        <template #default>
          <RemoteHrDashboard />
        </template>
      </Suspense>
    </main>
  </div>
</template>

<script setup>
import { defineAsyncComponent } from 'vue';
import { useGlobalAuthStore } from './stores/authStore';

const authStore = useGlobalAuthStore();

// Dynamically import the component from the federated remote
// The syntax 'hr_app/...' matches the remotes config in vite.config.js
const RemoteHrDashboard = defineAsyncComponent(() => import('hr_app/HrDashboard'));
</script>
```

### 4. Consuming Host State in the Remote App

The HR App team builds their dashboard. They don't handle login. They just import the exposed store from the Host App and react to it.

```vue
<!-- remote-hr-app/src/components/Dashboard.vue -->
<template>
  <div class="hr-module bg-blue-50 p-6 border border-blue-200">
    <h2 class="text-xl font-bold text-blue-800">HR Department Dashboard</h2>

    <div v-if="globalAuth.user">
      <p>Fetching HR records for Employee ID: {{ globalAuth.user.id }}...</p>
      <!-- HR specific logic here -->
    </div>
    <div v-else class="text-red-500">
      Unauthorized. Please log in via the main portal sidebar.
    </div>
  </div>
</template>

<script setup>
// The HR app imports the HOST's exposed store!
import { useGlobalAuthStore } from 'host_app/GlobalAuth';

// Because 'pinia' is shared in vite.config.js, this call connects
// to the exact same reactive instance running in the Host's App.vue.
const globalAuth = useGlobalAuthStore();
</script>
```

### Key Takeaways
* **Shared Singleton Instances**: The `shared: ['vue', 'pinia']` array in the Vite config is the most important part of Micro-Frontends. If Vue is not shared, the Remote app will boot up its *own* copy of Vue, which cannot talk to the Host's copy of Vue, breaking the Pinia store.
* **Bi-directional Sharing**: Module Federation is not strictly parent-child. The Host exposes a state module (Pinia) *to* the Remote, while the Remote exposes a UI module (Vue Component) *to* the Host. They form a true federated network.
* **Resilience via Suspense**: `defineAsyncComponent` combined with `<Suspense>` ensures that if the HR server goes offline, it doesn't crash the main Enterprise Portal. The fallback UI handles the network latency gracefully.
