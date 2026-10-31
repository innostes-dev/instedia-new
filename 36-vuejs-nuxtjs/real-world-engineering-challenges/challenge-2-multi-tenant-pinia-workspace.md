# Real-World Engineering Challenge: Multi-Tenant Pinia Workspace Switcher

## Context & Architecture
You are building a B2B SaaS application like Slack or Notion, where a single user belongs to multiple "Workspaces" (Tenants).
The core challenge is State Isolation and Hydration. When a user switches from "Workspace A" to "Workspace B", the active Pinia store must clear out all Workspace A data (channels, members, settings) and fetch/hydrate Workspace B data. If this is not done perfectly, data leaks occur (e.g., seeing Workspace A's private channels while in Workspace B).
Additionally, role guards must dynamically update. A user might be an 'Admin' in Workspace A, but a 'Guest' in Workspace B.

## Specifications
1. Create a `useWorkspaceStore` in Pinia using Setup Syntax.
2. Implement a `$reset` equivalent functionality (since Setup Syntax doesn't have a built-in `$reset` like Options Syntax does).
3. Implement a `switchWorkspace(newId)` action that clears current state, simulates fetching new workspace data, and applies it.
4. Integrate with Vue Router: Use a `beforeEach` navigation guard to check if the user has the required role for the currently active workspace.

## Starter Template

```javascript
// stores/workspace.js
import { defineStore } from 'pinia';
import { ref, computed } from 'vue';

export const useWorkspaceStore = defineStore('workspace', () => {
  // State
  const currentWorkspaceId = ref(null);
  const workspaceName = ref('');
  const userRole = ref(null); // 'admin' | 'member' | 'guest'
  const channels = ref([]);
  const isLoading = ref(false);

  // TODO: Implement switchWorkspace(id)

  // TODO: Implement a way to reset state

  return {
    currentWorkspaceId, workspaceName, userRole, channels, isLoading
  };
});
```

```javascript
// router/index.js
import { createRouter, createWebHistory } from 'vue-router';
// TODO: Import the workspace store

const routes = [
  { path: '/', component: () => import('../views/Home.vue') },
  {
    path: '/settings',
    component: () => import('../views/Settings.vue'),
    meta: { requiredRole: 'admin' }
  }
];

const router = createRouter({ history: createWebHistory(), routes });

// TODO: Implement beforeEach guard based on workspace.userRole

export default router;
```

---

## Production Solution Walkthrough

### 1. The Pinia Store (Handling Setup Store Resets)

When using Pinia Setup Syntax, `$reset()` is not available out of the box because Pinia doesn't know the initial state of your closures. We must implement a factory function to return the initial state.

```javascript
// stores/workspace.js
import { defineStore } from 'pinia';
import { ref, computed } from 'vue';

// 1. Define initial state factory outside the store
const getDefaultState = () => ({
  currentWorkspaceId: null,
  workspaceName: '',
  userRole: null,
  channels: [],
  isLoading: false
});

export const useWorkspaceStore = defineStore('workspace', () => {
  // 2. Initialize refs with the factory
  const state = ref(getDefaultState());

  // 3. Computed proxies for easy access in components
  const currentWorkspaceId = computed(() => state.value.currentWorkspaceId);
  const workspaceName = computed(() => state.value.workspaceName);
  const userRole = computed(() => state.value.userRole);
  const channels = computed(() => state.value.channels);
  const isLoading = computed(() => state.value.isLoading);

  // 4. Custom Reset Method
  function $reset() {
    state.value = getDefaultState();
  }

  // 5. Switch Action
  async function switchWorkspace(newId) {
    // A. Wipe existing state to prevent data leaks during network wait
    $reset();
    state.value.isLoading = true;

    try {
      // B. Fetch new data (Simulated)
      console.log(`Fetching data for workspace ${newId}...`);
      await new Promise(r => setTimeout(r, 1000));

      // Simulated DB response
      const mockDb = {
        'ws_1': { name: 'Acme Corp', role: 'admin', channels: ['general', 'sales'] },
        'ws_2': { name: 'Startup Inc', role: 'guest', channels: ['announcements'] }
      };

      const data = mockDb[newId];
      if (!data) throw new Error('Workspace not found');

      // C. Hydrate State
      state.value.currentWorkspaceId = newId;
      state.value.workspaceName = data.name;
      state.value.userRole = data.role;
      state.value.channels = data.channels;

    } catch (error) {
      console.error(error);
    } finally {
      state.value.isLoading = false;
    }
  }

  return {
    currentWorkspaceId, workspaceName, userRole, channels, isLoading,
    switchWorkspace, $reset
  };
});
```

### 2. The Vue Router Guard

We must tap into the Pinia store *inside* the navigation guard.

```javascript
// router/index.js
import { createRouter, createWebHistory } from 'vue-router';
import { useWorkspaceStore } from '../stores/workspace';

// ... routes configuration ...

router.beforeEach((to, from, next) => {
  // MUST instantiate store INSIDE the guard to avoid early-instantiation errors
  const workspaceStore = useWorkspaceStore();

  // 1. Does the route have role requirements?
  const requiredRole = to.meta.requiredRole;

  if (requiredRole) {
    // 2. Simple Hierarchy Check (Admin > Member > Guest)
    const roleHierarchy = { 'admin': 3, 'member': 2, 'guest': 1 };

    const userRoleValue = roleHierarchy[workspaceStore.userRole] || 0;
    const requiredRoleValue = roleHierarchy[requiredRole];

    if (userRoleValue < requiredRoleValue) {
      console.warn(`Access denied. Requires ${requiredRole} in current workspace.`);
      return next('/unauthorized');
    }
  }

  next();
});
```

### 3. The Vue Component (Workspace Switcher UI)

```vue
<!-- App.vue -->
<template>
  <div>
    <header>
      <h2>Active: {{ wsStore.workspaceName || 'Select a Workspace' }}</h2>
      <p v-if="wsStore.userRole">Your Role: {{ wsStore.userRole }}</p>

      <select @change="handleSwitch($event.target.value)">
        <option disabled selected>Select Workspace...</option>
        <option value="ws_1">Acme Corp (Admin)</option>
        <option value="ws_2">Startup Inc (Guest)</option>
      </select>
    </header>

    <main v-if="wsStore.isLoading">Loading Workspace Data...</main>
    <main v-else-if="wsStore.currentWorkspaceId">
      <ul>
        <li v-for="channel in wsStore.channels" :key="channel">
          # {{ channel }}
        </li>
      </ul>

      <!-- Testing Router Guard -->
      <router-link to="/settings">Go to Workspace Settings (Admin Only)</router-link>
      <router-view></router-view>
    </main>
  </div>
</template>

<script setup>
import { useWorkspaceStore } from './stores/workspace';
import { useRouter } from 'vue-router';

const wsStore = useWorkspaceStore();
const router = useRouter();

const handleSwitch = async (id) => {
  await wsStore.switchWorkspace(id);
  // Optional: Redirect to home to avoid being trapped in a protected route
  // you no longer have access to after switching.
  router.push('/');
};
</script>
```
