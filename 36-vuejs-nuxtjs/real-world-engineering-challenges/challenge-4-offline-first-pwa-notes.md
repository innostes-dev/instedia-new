# Real-World Engineering Challenge: Offline-First PWA Note-Taking System

## Context & Architecture
You are building an enterprise field-worker application for inspectors who often work in remote areas with zero cell service. The application must load instantly without an internet connection, allow the user to create, edit, and delete notes, and seamlessly sync those changes to a central server once the internet connection is restored.
To achieve this in Nuxt 3, you need to implement a **Progressive Web App (PWA)** architecture combining **IndexedDB** for robust client-side storage (Local Storage is synchronous and blocks the main thread, limited to 5MB, making it unsuitable for large text/images) and the **Navigator onLine API** to manage sync state.

## Specifications
1. Create a `useNotesDatabase` composable that wraps IndexedDB using promises (or use a library like `idb` for simplicity, but we will write a minimal wrapper here).
2. Create a Vue page that binds note creation to this IndexedDB instance.
3. Implement a `useNetworkStatus` composable to reactively track `navigator.onLine`.
4. Implement a "Sync Engine" that pushes local IndexedDB notes to a simulated Nuxt backend (`/api/sync`) when the network reconnects.

## Starter Template

```javascript
// composables/useNetworkStatus.js
import { ref, onMounted, onUnmounted } from 'vue';

export function useNetworkStatus() {
  const isOnline = ref(true); // TODO: Initialize safely for SSR

  // TODO: Add window event listeners for 'online' and 'offline'

  return { isOnline };
}
```

```vue
<!-- pages/notes.vue -->
<template>
  <div class="app-container">
    <header class="header" :class="{ offline: !isOnline }">
      <h2>Field Inspector Notes</h2>
      <span class="badge">{{ isOnline ? '🟢 Online' : '🔴 Offline' }}</span>
      <button v-if="isOnline && pendingSyncCount > 0" @click="syncData">
        Sync {{ pendingSyncCount }} items
      </button>
    </header>

    <!-- UI for adding notes -->
    <!-- List of notes -->
  </div>
</template>

<script setup>
// TODO: Implement IndexedDB integration and Sync Logic
</script>
```

---

## Production Solution Walkthrough

### 1. The Network Status Composable
We must be careful with SSR. `window` and `navigator` do not exist on the Nuxt server.

```javascript
// composables/useNetworkStatus.js
import { ref, onMounted, onUnmounted } from 'vue';

export function useNetworkStatus() {
  // Safe initialization for SSR
  const isOnline = ref(typeof navigator !== 'undefined' ? navigator.onLine : true);

  const updateOnlineStatus = () => {
    isOnline.value = navigator.onLine;
  };

  onMounted(() => {
    window.addEventListener('online', updateOnlineStatus);
    window.addEventListener('offline', updateOnlineStatus);
  });

  onUnmounted(() => {
    window.removeEventListener('online', updateOnlineStatus);
    window.removeEventListener('offline', updateOnlineStatus);
  });

  return { isOnline };
}
```

### 2. The IndexedDB Wrapper
IndexedDB is asynchronous and heavily event-driven. We wrap the core operations in Promises.

```javascript
// utils/db.js
const DB_NAME = 'FieldNotesDB';
const DB_VERSION = 1;
const STORE_NAME = 'notes';

export const initDB = () => {
  return new Promise((resolve, reject) => {
    if (typeof window === 'undefined') return resolve(null); // Ignore during SSR

    const request = indexedDB.open(DB_NAME, DB_VERSION);

    request.onerror = () => reject(request.error);

    request.onsuccess = () => resolve(request.result);

    request.onupgradeneeded = (event) => {
      const db = event.target.result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        // Create store with auto-incrementing key path
        db.createObjectStore(STORE_NAME, { keyPath: 'id', autoIncrement: true });
      }
    };
  });
};

export const addNoteToDB = async (note) => {
  const db = await initDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readwrite');
    const store = tx.objectStore(STORE_NAME);
    // Add sync status metadata
    const request = store.add({ ...note, synced: false, timestamp: Date.now() });

    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
};

export const getUnsyncedNotes = async () => {
  const db = await initDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readonly');
    const store = tx.objectStore(STORE_NAME);
    const request = store.getAll();

    request.onsuccess = () => {
      // Filter manually (indexes are better for production, but this works for demo)
      const unsynced = request.result.filter(n => !n.synced);
      resolve(unsynced);
    };
    request.onerror = () => reject(request.error);
  });
};

export const markAsSynced = async (id) => {
  const db = await initDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readwrite');
    const store = tx.objectStore(STORE_NAME);

    // First get the record, update it, then put it back
    store.get(id).onsuccess = (e) => {
      const record = e.target.result;
      record.synced = true;
      store.put(record).onsuccess = () => resolve();
    };
  });
};
```

### 3. The Vue Application Logic (Sync Engine)

```vue
<!-- pages/notes.vue -->
<template>
  <div class="max-w-xl mx-auto p-4">
    <header class="flex justify-between items-center mb-6 p-4 rounded text-white" :class="isOnline ? 'bg-green-600' : 'bg-red-600'">
      <h2 class="text-xl font-bold">Field Notes</h2>
      <div>
        <span class="mr-4">{{ isOnline ? 'Online' : 'Offline Mode' }}</span>
        <button v-if="isOnline && pendingNotes.length > 0" @click="syncToCloud" class="bg-white text-black px-2 py-1 rounded">
          Sync ({{ pendingNotes.length }})
        </button>
      </div>
    </header>

    <div class="mb-6">
      <textarea v-model="newNoteText" class="w-full border p-2 rounded" rows="3" placeholder="Enter inspection details..."></textarea>
      <button @click="saveNote" class="mt-2 bg-blue-500 text-white px-4 py-2 rounded w-full">Save Locally</button>
    </div>

    <div>
      <h3 class="font-bold mb-2">Local Notes</h3>
      <ul>
        <li v-for="note in allNotes" :key="note.id" class="border-b py-2 flex justify-between">
          <span>{{ note.text }}</span>
          <span class="text-xs" :class="note.synced ? 'text-green-500' : 'text-orange-500'">
            {{ note.synced ? 'Synced' : 'Pending' }}
          </span>
        </li>
      </ul>
    </div>
  </div>
</template>

<script setup>
import { ref, onMounted, watch } from 'vue';
import { useNetworkStatus } from '../composables/useNetworkStatus';
import { initDB, addNoteToDB, getUnsyncedNotes, markAsSynced } from '../utils/db';

const { isOnline } = useNetworkStatus();

const newNoteText = ref('');
const allNotes = ref([]);
const pendingNotes = ref([]);

// Setup and Initial Load
onMounted(async () => {
  await loadNotes();
});

const loadNotes = async () => {
  const db = await initDB();
  // Quick fetch all for UI
  db.transaction('notes', 'readonly').objectStore('notes').getAll().onsuccess = (e) => {
    allNotes.value = e.target.result.sort((a,b) => b.timestamp - a.timestamp);
    pendingNotes.value = allNotes.value.filter(n => !n.synced);
  };
};

// 1. Save Locally ONLY
const saveNote = async () => {
  if (!newNoteText.value.trim()) return;

  // Instantly save to IndexedDB regardless of network
  await addNoteToDB({ text: newNoteText.value });
  newNoteText.value = '';
  await loadNotes(); // Refresh UI
};

// 2. Sync Engine
const syncToCloud = async () => {
  if (!isOnline.value || pendingNotes.value.length === 0) return;

  for (const note of pendingNotes.value) {
    try {
      // Send to Nuxt Nitro Backend (mocked here)
      /*
      await $fetch('/api/sync', {
        method: 'POST',
        body: note
      });
      */

      // If success, update local DB
      await markAsSynced(note.id);
    } catch (e) {
      console.error('Failed to sync note', note.id);
    }
  }

  await loadNotes(); // Refresh UI to show green 'Synced' tags
};

// 3. Auto-Sync when connection restores
watch(isOnline, (onlineNow) => {
  if (onlineNow) {
    syncToCloud();
  }
});
</script>
```

### Key Takeaways
* **No Blocking Storage**: Unlike `localStorage`, IndexedDB runs asynchronously, meaning saving massive strings (or Base64 image blobs from field cameras) will not freeze the Vue UI thread.
* **Optimistic UI with Fallback**: The user creates a note, it hits the local DB instantly, and the UI updates. The sync process is completely decoupled. If it fails, the note remains marked as "Pending" in IndexedDB to be retried later.
