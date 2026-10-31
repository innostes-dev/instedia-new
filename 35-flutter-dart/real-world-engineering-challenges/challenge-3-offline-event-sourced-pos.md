# Challenge 3: Offline-First Point-of-Sale (POS) System

## The Challenge Scenario
You are building an iPad Point-of-Sale (POS) system for food trucks. Food trucks often operate at festivals with zero cell reception. The application must be "Offline-First".

If a user rings up an order, it must save locally to an SQLite database instantly. When the device regains internet connection, the system must detect this and silently sync all pending offline orders to the cloud API without locking the UI.

To achieve this, you will use `drift` (a robust, type-safe SQLite library for Dart) to store the data and a background Isolate/Stream to handle the synchronization.

## Core Requirements
1. **Drift SQLite Setup:** Define a `drift` Table for `Orders` containing an `id` (int, auto-increment), `total_amount` (real), and a `sync_status` (boolean).
2. **Offline-First Save:** The UI should only ever write to and read from the local Drift database. It should never wait for an API call.
3. **Background Sync Mechanism:** Implement a function that queries all orders where `sync_status == false`, simulates an API upload (`Future.delayed`), and updates the local row to `sync_status == true`.
4. **Reactive UI:** Use Drift's `watch()` capabilities so that when the background sync marks an order as synced, the UI updates automatically without a manual `setState`.

## Starter Template

```dart
import 'package:flutter/material.dart';

void main() => runApp(const PosApp());

class PosApp extends StatelessWidget {
  const PosApp({super.key});

  @override
  Widget build(BuildContext context) {
    return const MaterialApp(home: PosScreen());
  }
}

class PosScreen extends StatefulWidget {
  const PosScreen({super.key});

  @override
  State<PosScreen> createState() => _PosScreenState();
}

class _PosScreenState extends State<PosScreen> {
  // TODO: Initialize Drift Database

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(
        title: const Text('Offline POS'),
        actions: [
          IconButton(
            icon: const Icon(Icons.sync),
            // TODO: Trigger Sync
            onPressed: () {},
          )
        ],
      ),
      body: Column(
        children: [
          ElevatedButton(
            // TODO: Save to Drift locally
            onPressed: () {},
            child: const Text('Ring up \$10 Order'),
          ),
          Expanded(
            // TODO: Use StreamBuilder to watch Drift DB
            child: ListView.builder(
              itemCount: 0,
              itemBuilder: (context, index) => const ListTile(title: Text("Order")),
            ),
          )
        ],
      ),
    );
  }
}
```

## Production Solution Walkthrough

### 1. The Drift Database Definition
We define our schema using Dart classes. In a real project, you would run `dart run build_runner build` to generate the underlying SQLite code.

```dart
import 'package:drift/drift.dart';
import 'package:drift/native.dart';
import 'package:path_provider/path_provider.dart';
import 'package:path/path.dart' as p;
import 'dart:io';

// Note: Requires running code generation in a real project
// part 'database.g.dart';

// 1. Table Definition
class Orders extends Table {
  IntColumn get id => integer().autoIncrement()();
  RealColumn get totalAmount => real()();
  BoolColumn get isSynced => boolean().withDefault(const Constant(false))();
}

// 2. Database Class
@DriftDatabase(tables: [Orders])
class AppDatabase extends _$AppDatabase {
  AppDatabase() : super(_openConnection());

  @override
  int get schemaVersion => 1;

  // Watch all orders (Reactive Stream)
  Stream<List<Order>> watchAllOrders() => select(orders).watch();

  // Insert a new order locally
  Future<int> addOrder(double amount) {
    return into(orders).insert(OrdersCompanion.insert(totalAmount: amount));
  }

  // Get unsynced orders
  Future<List<Order>> getUnsyncedOrders() {
    return (select(orders)..where((tbl) => tbl.isSynced.equals(false))).get();
  }

  // Mark an order as synced
  Future<void> markAsSynced(int id) {
    return (update(orders)..where((tbl) => tbl.id.equals(id)))
        .write(const OrdersCompanion(isSynced: Value(true)));
  }
}

// OS-specific setup for SQLite file
LazyDatabase _openConnection() {
  return LazyDatabase(() async {
    final dbFolder = await getApplicationDocumentsDirectory();
    final file = File(p.join(dbFolder.path, 'db.sqlite'));
    return NativeDatabase.createInBackground(file);
  });
}
```

### 2. The Background Sync Logic
We isolate the sync logic from the UI. It pulls from the DB, pretends to hit the internet, and updates the DB.

```dart
class SyncService {
  final AppDatabase db;
  bool isSyncing = false;

  SyncService(this.db);

  Future<void> syncPendingOrders() async {
    if (isSyncing) return;
    isSyncing = true;

    try {
      final unsynced = await db.getUnsyncedOrders();
      print("Found ${unsynced.length} orders to sync.");

      for (final order in unsynced) {
        // Simulate Network API Call
        await Future.delayed(const Duration(milliseconds: 500));
        print("Uploaded Order ${order.id} to Cloud API.");

        // Update local DB
        await db.markAsSynced(order.id);
      }
    } finally {
      isSyncing = false;
    }
  }
}
```

### 3. The Reactive UI
Because we use Drift's `.watch()` method, the UI does not need to know when the SyncService finishes. It just listens to the database stream. When a row changes to `isSynced = true`, the stream emits a new list and the UI rebuilds.

```dart
class _PosScreenState extends State<PosScreen> {
  late AppDatabase database;
  late SyncService syncService;

  @override
  void initState() {
    super.initState();
    database = AppDatabase();
    syncService = SyncService(database);
  }

  @override
  void dispose() {
    database.close();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(
        title: const Text('Offline POS'),
        actions: [
          IconButton(
            icon: const Icon(Icons.cloud_upload),
            onPressed: () {
              ScaffoldMessenger.of(context).showSnackBar(const SnackBar(content: Text("Syncing in background...")));
              syncService.syncPendingOrders(); // Non-blocking
            },
          )
        ],
      ),
      body: Column(
        children: [
          Padding(
            padding: const EdgeInsets.all(16.0),
            child: ElevatedButton(
              style: ElevatedButton.styleFrom(minimumSize: const Size.fromHeight(60)),
              onPressed: () {
                // Instant local save
                database.addOrder(15.50);
              },
              child: const Text('Ring up \$15.50', style: TextStyle(fontSize: 20)),
            ),
          ),
          const Divider(),
          Expanded(
            // Reactive DB Watcher
            child: StreamBuilder<List<Order>>(
              stream: database.watchAllOrders(),
              builder: (context, snapshot) {
                if (!snapshot.hasData) return const Center(child: CircularProgressIndicator());

                final orders = snapshot.data!;
                if (orders.isEmpty) return const Center(child: Text("No orders yet."));

                return ListView.builder(
                  itemCount: orders.length,
                  itemBuilder: (context, index) {
                    final order = orders[index];
                    return ListTile(
                      leading: CircleAvatar(
                        backgroundColor: order.isSynced ? Colors.green : Colors.orange,
                        child: Icon(order.isSynced ? Icons.check : Icons.wifi_off, color: Colors.white),
                      ),
                      title: Text('Order #${order.id}'),
                      subtitle: Text('\$${order.totalAmount.toStringAsFixed(2)}'),
                      trailing: Text(order.isSynced ? "Synced" : "Pending Sync"),
                    );
                  },
                );
              },
            ),
          )
        ],
      ),
    );
  }
}
```

### 4. Architecture Diagram
```text
[ USER UI ]
  |-- Click "Ring Up"
  v
[ Drift DB (Local SQLite) ] <------- (Reactive .watch() Stream updates UI instantly)
  |-- INSERT order (isSynced: false)

(Later... User clicks Sync or Connectivity changes)

[ SyncService ]
  |-- SELECT * WHERE isSynced = false
  v
[ Cloud API (Internet) ]
  |-- HTTP POST Order
  v
[ SyncService ]
  |-- UPDATE Drift DB SET isSynced = true
  v
[ Drift DB ] --> Stream emits new data --> [ UI updates row to Green Checkmark ]
```

## Pro Tips for Production
- **Conflict Resolution:** If a user edits an order locally, but a manager edited it on the cloud dashboard while the device was offline, who wins? Add an `updated_at` timestamp column to your local DB. When syncing, send the timestamp. If the server's version is newer, the server rejects the sync and returns the newer data to overwrite the local DB.
- **Connectivity Listening:** Don't rely on a manual sync button. Use the `connectivity_plus` package to listen to network state changes. Whenever the app goes from `none` to `wifi`/`mobile`, automatically trigger `syncService.syncPendingOrders()`.