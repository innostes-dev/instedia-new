# Challenge 1: Background Multi-Isolate Image Processing & Compression Engine

## The Challenge Scenario
You are building an offline-first field inspection app. Users take high-resolution 4K photos of construction sites, which are often 15MB+ each. The app must resize, compress (to < 1MB), and apply a subtle watermark to these images before saving them locally.

If you do this on the main thread, the app will freeze for 2-3 seconds per image, ruining the UX. You must build a scalable Isolate engine that can handle multiple images concurrently without *any* UI jitter.

## Core Requirements
1. **Zero UI Jitter:** Use an ongoing animation (like a spinning loader or a smooth scrolling list) to visually prove the main thread is unblocked.
2. **Worker Pool / Isolate Pipeline:** Don't just use `Isolate.run` sequentially. Spawn a persistent Isolate (or a pool) using `Isolate.spawn` that stays alive and listens for compression jobs via a `SendPort`.
3. **Mock Image Processing:** Since we are focusing on architecture, you don't need real Image I/O. Simulate the "compression" of an image by writing a function that heavily consumes CPU (e.g., generating a massive array, doing matrix multiplication, or hashing).
4. **Job Queue:** If 5 images are selected at once, they should be queued and processed one by one (or in parallel if using a pool) by the Isolate, emitting progress updates back to the UI.

## Starter Template

```dart
import 'package:flutter/material.dart';

void main() => runApp(const ImageProcessorApp());

class ImageProcessorApp extends StatelessWidget {
  const ImageProcessorApp({super.key});

  @override
  Widget build(BuildContext context) {
    return const MaterialApp(home: CompressionScreen());
  }
}

class CompressionScreen extends StatefulWidget {
  const CompressionScreen({super.key});

  @override
  State<CompressionScreen> createState() => _CompressionScreenState();
}

class _CompressionScreenState extends State<CompressionScreen> {
  // TODO: Implement your Isolate logic here

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(title: const Text('Isolate Compression Engine')),
      body: Column(
        children: [
          // UI Jitter test
          const Padding(
            padding: EdgeInsets.all(20.0),
            child: CircularProgressIndicator(),
          ),
          ElevatedButton(
            onPressed: () {
              // TODO: Send 3 "Image" processing jobs to the isolate
            },
            child: const Text('Compress 3 Images'),
          ),
          Expanded(
            child: ListView.builder(
              itemCount: 0, // TODO: Update based on completed jobs
              itemBuilder: (context, index) {
                return const ListTile(title: Text("Processed Image X"));
              },
            ),
          )
        ],
      ),
    );
  }
}

// TODO: Define your heavy CPU function to run inside the isolate
```

## Production Solution Walkthrough

### 1. The Isolate Worker (The "Kitchen")
First, we define the code that runs *inside* the background thread. We simulate heavy image processing by generating and iterating over a massive list of numbers.

```dart
import 'dart:isolate';

// The message format sent FROM main TO isolate
class JobRequest {
  final int jobId;
  final String imagePath;
  JobRequest(this.jobId, this.imagePath);
}

// The message format sent FROM isolate TO main
class JobResult {
  final int jobId;
  final String status;
  JobResult(this.jobId, this.status);
}

// The entry point for the Isolate
void compressionWorker(SendPort mainSendPort) {
  final isolateReceivePort = ReceivePort();

  // 1. Handshake: Send our receiver's port back to the main thread
  mainSendPort.send(isolateReceivePort.sendPort);

  // 2. Listen for incoming jobs
  isolateReceivePort.listen((message) {
    if (message is JobRequest) {
      // Simulate heavy CPU-bound image compression (will take ~1-2 seconds)
      int dummyHash = 0;
      for (int i = 0; i < 50000000; i++) {
        dummyHash += i % 255;
      }

      // 3. Send the result back
      mainSendPort.send(JobResult(message.jobId, "Compressed (Hash: $dummyHash)"));
    }
  });
}
```

### 2. The Main Thread Manager (The "Host")
Next, we manage the state in the UI. We spawn the isolate once in `initState` and keep it alive to process multiple jobs.

```dart
class _CompressionScreenState extends State<CompressionScreen> {
  SendPort? _isolateSendPort;
  final List<String> _results = [];
  int _jobCounter = 0;

  @override
  void initState() {
    super.initState();
    _initIsolate();
  }

  Future<void> _initIsolate() async {
    final mainReceivePort = ReceivePort();

    // Spawn the permanent worker
    await Isolate.spawn(compressionWorker, mainReceivePort.sendPort);

    // Listen for messages from the worker
    mainReceivePort.listen((message) {
      if (message is SendPort) {
        // Initial handshake completed
        _isolateSendPort = message;
      } else if (message is JobResult) {
        // A job finished
        setState(() {
          _results.add("Job ${message.jobId}: ${message.status}");
        });
      }
    });
  }

  void _dispatchJobs() {
    if (_isolateSendPort == null) return;

    // Dispatch 3 heavy jobs concurrently to the queue
    for (int i = 0; i < 3; i++) {
      _jobCounter++;
      _isolateSendPort!.send(JobRequest(_jobCounter, "image_$_jobCounter.png"));
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(title: const Text('Isolate Compression Engine')),
      body: Column(
        children: [
          // If the spinner stutters, we failed.
          const Padding(
            padding: EdgeInsets.all(20.0),
            child: CircularProgressIndicator(),
          ),
          ElevatedButton(
            onPressed: _dispatchJobs,
            child: const Text('Compress 3 Images'),
          ),
          Expanded(
            child: ListView.builder(
              itemCount: _results.length,
              itemBuilder: (context, index) {
                return ListTile(
                  leading: const Icon(Icons.image, color: Colors.green),
                  title: Text(_results[index]),
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

### 3. Architecture Diagram
```text
[ MAIN THREAD (UI) ]                           [ BACKGROUND ISOLATE ]
        |                                                |
        |--- Spawns ---> [ compressionWorker() ] --------|
        |                                                |
        |<-- Handshake (SendPort) -----------------------|
        |                                                |
[ UI EVENT LOOP ]                                        |
  - Spin Loader                                          |
  - Click "Compress"                                     |
  - send(Job 1) ---------------------------------------->|
  - send(Job 2) ---------------------------------------->|
  - send(Job 3) ---------------------------------------->|
  - Spin Loader (Smooth)                                 | [ QUEUE ]
  - Spin Loader (Smooth)                                 | - Processing Job 1 (Heavy CPU)
  - Spin Loader (Smooth)                                 | - Waiting Job 2
  |<------------------------ Result(Job 1) --------------| - Waiting Job 3
  - setState (Update UI)                                 |
  - Spin Loader (Smooth)                                 | - Processing Job 2 (Heavy CPU)
```

## Pro Tips for Production
- **Isolate Pools:** For truly massive workloads on multi-core devices, use a package like `isolate_pool` or `worker_manager` to spawn multiple isolates (one per CPU core) rather than queuing them all on a single background isolate.
- **Memory Limits:** Sending huge byte arrays (like uncompressed 4K images) between Isolates requires copying memory. To avoid Out-of-Memory (OOM) crashes, process the file via its File Path rather than passing `List<int>` bytes through the SendPort. Let the Isolate read the file from disk directly.