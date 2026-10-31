# Challenge 1: Offline-First Mobile CRM with OP-SQLite and Background Sync

## 1. Challenge Overview
You are tasked with building the core of an Offline-First CRM (Customer Relationship Management) app for traveling sales representatives. These reps often visit clients in remote areas with zero cellular reception. They must be able to view their client list, add new clients, and update existing client notes instantly without any loading spinners.

When their device regains internet connection, the app must synchronize all local changes with the central backend server, resolving any conflicts without losing data.

**Key Technologies:**
- React Native / Expo
- WatermelonDB (with OP-SQLite adapter)
- Synchronization Engine (`@nozbe/watermelondb/sync`)

## 2. Architecture Diagram
```text
+-------------------+       +-----------------------+
|  React Native UI  | <---> |  WatermelonDB Observ. |
+-------------------+       +-----------------------+
                                     | (Local JSI read/write)
                                     v
+-------------------+       +-----------------------+
| Network Listener  |       |   Local SQLite DB     |
| (NetInfo)         |       |   (Clients Table)     |
+-------------------+       +-----------------------+
         | (Triggers Sync)           ^
         v                           | (Push/Pull changes)
+---------------------------------------------------+
|               Sync Engine (JS)                    |
+---------------------------------------------------+
         |                           ^
         v                           | HTTP JSON
+---------------------------------------------------+
|               Remote CRM Backend                  |
+---------------------------------------------------+
```

## 3. Starter Template

**Dependencies to install:**
`npm install @nozbe/watermelondb @nozbe/watermelondb/react react-native-sqlite-storage @react-native-community/netinfo`

```tsx
// App.tsx (Starter)
import React, { useState } from 'react';
import { View, Text, TextInput, Button, FlatList, StyleSheet } from 'react-native';

// TODO: Integrate WatermelonDB database instance
// TODO: Create HOC to make ClientList reactive

export default function App() {
  const [name, setName] = useState('');
  const [notes, setNotes] = useState('');

  const handleAddClient = () => {
    // TODO: Write client to local SQLite database
  };

  const handleSync = () => {
    // TODO: Trigger WatermelonDB sync engine
  };

  return (
    <View style={styles.container}>
      <Text style={styles.header}>Offline CRM</Text>
      <View style={styles.form}>
        <TextInput placeholder="Client Name" value={name} onChangeText={setName} style={styles.input} />
        <TextInput placeholder="Meeting Notes" value={notes} onChangeText={setNotes} style={styles.input} />
        <Button title="Save Client Locally" onPress={handleAddClient} />
      </View>

      <Button title="Force Sync with Server" color="green" onPress={handleSync} />

      {/* TODO: Render EnhancedClientList here */}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: 20, paddingTop: 50 },
  header: { fontSize: 24, fontWeight: 'bold', marginBottom: 20 },
  form: { marginBottom: 20 },
  input: { borderWidth: 1, borderColor: '#ccc', padding: 10, marginBottom: 10, borderRadius: 5 }
});
```

## 4. Production Walkthrough & Full Solution

### Step 1: Define the Database Schema and Model
We must define the shape of our local database. WatermelonDB requires strict schema definitions.

```ts
// schema.ts
import { appSchema, tableSchema } from '@nozbe/watermelondb'

export const mySchema = appSchema({
  version: 1,
  tables: [
    tableSchema({
      name: 'clients',
      columns: [
        { name: 'name', type: 'string' },
        { name: 'notes', type: 'string' },
        { name: 'created_at', type: 'number' },
        { name: 'updated_at', type: 'number' },
      ]
    })
  ]
});

// Client.ts
import { Model } from '@nozbe/watermelondb'
import { field, date, readonly } from '@nozbe/watermelondb/decorators'

export default class Client extends Model {
  static table = 'clients'

  @field('name') name
  @field('notes') notes
  @readonly @date('created_at') createdAt
  @readonly @date('updated_at') updatedAt
}
```

### Step 2: Instantiate the Database
Connect the JS models to the Native SQLite engine using the fast JSI adapter.

```ts
// database.ts
import { Database } from '@nozbe/watermelondb'
import SQLiteAdapter from '@nozbe/watermelondb/adapters/sqlite'
import { mySchema } from './schema'
import Client from './Client'

const adapter = new SQLiteAdapter({
  schema: mySchema,
  jsi: true, // Enables fast synchronous C++ bridge
})

export const database = new Database({
  adapter,
  modelClasses: [Client],
});
```

### Step 3: Implement the Sync Engine
This is the core logic that resolves local offline changes with the remote server.

```ts
// sync.ts
import { synchronize } from '@nozbe/watermelondb/sync'
import { database } from './database'

export async function syncDatabase() {
  await synchronize({
    database,
    pullChanges: async ({ lastPulledAt }) => {
      // 1. Fetch data from backend modified since last sync
      const response = await fetch(`https://api.mycrm.com/sync?last_pulled_at=${lastPulledAt || 0}`);
      if (!response.ok) throw new Error('Failed to pull sync');

      const { changes, timestamp } = await response.json();
      // 'changes' must match WatermelonDB format: { clients: { created: [], updated: [], deleted: [] } }
      return { changes, timestamp };
    },
    pushChanges: async ({ changes, lastPulledAt }) => {
      // 2. Send local offline modifications to backend
      const response = await fetch('https://api.mycrm.com/sync', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ changes, lastPulledAt }),
      });
      if (!response.ok) throw new Error('Failed to push sync');
    },
    migrationsEnabledAtVersion: 1,
  });
}
```

### Step 4: Wire up the Reactive UI
Connect the DB and Sync logic to the React components.

```tsx
// App.tsx (Complete Solution)
import React, { useState, useEffect } from 'react';
import { View, Text, TextInput, Button, FlatList, StyleSheet } from 'react-native';
import { withObservables } from '@nozbe/watermelondb/react';
import NetInfo from '@react-native-community/netinfo';
import { database } from './database';
import Client from './Client';
import { syncDatabase } from './sync';

// Pure component that renders data
const ClientList = ({ clients }: { clients: Client[] }) => (
  <FlatList
    data={clients}
    keyExtractor={item => item.id}
    renderItem={({ item }) => (
      <View style={styles.card}>
        <Text style={styles.clientName}>{item.name}</Text>
        <Text style={styles.clientNotes}>{item.notes}</Text>
      </View>
    )}
  />
);

// HOC that makes the list automatically re-render when SQLite changes
const EnhancedClientList = withObservables([], () => ({
  clients: database.collections.get<Client>('clients').query().observe(),
}))(ClientList);

export default function App() {
  const [name, setName] = useState('');
  const [notes, setNotes] = useState('');

  // Background Sync Listener
  useEffect(() => {
    const unsubscribe = NetInfo.addEventListener(state => {
      // If we just got internet back, silently sync in the background
      if (state.isConnected && state.isInternetReachable) {
        syncDatabase().catch(console.error);
      }
    });
    return () => unsubscribe();
  }, []);

  const handleAddClient = async () => {
    if (!name) return;

    // Write directly to local DB - instantly available, offline capable
    await database.write(async () => {
      await database.collections.get<Client>('clients').create(client => {
        client.name = name;
        client.notes = notes;
      });
    });

    setName('');
    setNotes('');
  };

  const handleManualSync = async () => {
    try {
      await syncDatabase();
      alert('Sync Complete!');
    } catch (e) {
      alert('Sync Failed - Are you offline?');
    }
  };

  return (
    <View style={styles.container}>
      <Text style={styles.header}>Offline CRM</Text>
      <View style={styles.form}>
        <TextInput placeholder="Client Name" value={name} onChangeText={setName} style={styles.input} />
        <TextInput placeholder="Meeting Notes" value={notes} onChangeText={setNotes} style={styles.input} />
        <Button title="Save Client Locally" onPress={handleAddClient} />
      </View>

      <Button title="Force Sync with Server" color="green" onPress={handleManualSync} />

      <View style={{ flex: 1, marginTop: 20 }}>
         <EnhancedClientList />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: 20, paddingTop: 50, backgroundColor: '#F3F4F6' },
  header: { fontSize: 24, fontWeight: 'bold', marginBottom: 20 },
  form: { backgroundColor: 'white', padding: 15, borderRadius: 10, marginBottom: 15 },
  input: { borderWidth: 1, borderColor: '#ccc', padding: 10, marginBottom: 10, borderRadius: 5 },
  card: { backgroundColor: 'white', padding: 15, borderRadius: 8, marginBottom: 10 }
});
```

### Pro Tip for Production
When sending `pushChanges` to your backend, your backend must handle conflict resolution. If User A updates a client offline, and User B updates the same client offline, and both sync at the same time, the server should employ a strategy (like "Last Write Wins" using the `updated_at` timestamp) to determine the source of truth, before responding to the `pullChanges` request.