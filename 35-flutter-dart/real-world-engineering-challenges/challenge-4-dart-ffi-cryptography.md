# Challenge 4: Dart FFI Cryptography (Bank-Grade Secure Enclave)

## The Challenge Scenario
You are building a high-security cryptocurrency wallet in Flutter. Standard Dart cryptographic libraries run inside the Dart VM. Your security audit dictates that the core encryption of the private key must be handled by an ultra-secure, memory-safe native C/Rust library that is compiled directly into the binary and executed via the CPU (bypassing the Dart VM overhead and memory garbage collection).

You must use `dart:ffi` (Foreign Function Interface) to call a native C function directly from Dart to "encrypt" a string, demonstrating synchronous, zero-overhead native interop.

## Core Requirements
1. **The Native C Code:** Write a basic C function that takes a string and a key, and performs a basic bitwise XOR cipher (for simulation purposes).
2. **FFI Bindings:** Define the Dart typedefs and C typedefs required to map the C function into Dart.
3. **Memory Management:** In FFI, Dart does not garbage-collect C memory. You must allocate memory using `calloc`, pass it to C, read the result, and explicitly `free()` the memory to avoid a memory leak.
4. **UI Integration:** Build a secure text field that passes the string through the FFI bridge and displays the encrypted hex result.

## Starter Template

```dart
import 'package:flutter/material.dart';

void main() => runApp(const CryptoApp());

class CryptoApp extends StatelessWidget {
  const CryptoApp({super.key});

  @override
  Widget build(BuildContext context) {
    return const MaterialApp(home: VaultScreen());
  }
}

class VaultScreen extends StatefulWidget {
  const VaultScreen({super.key});

  @override
  State<VaultScreen> createState() => _VaultScreenState();
}

class _VaultScreenState extends State<VaultScreen> {
  final TextEditingController _controller = TextEditingController();
  String _encryptedHex = "No data";

  void _encryptData() {
    // TODO: Call the C function via FFI
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(title: const Text('FFI Secure Vault')),
      body: Padding(
        padding: const EdgeInsets.all(16.0),
        child: Column(
          children: [
            TextField(
              controller: _controller,
              decoration: const InputDecoration(labelText: "Enter Private Key"),
            ),
            const SizedBox(height: 20),
            ElevatedButton(
              onPressed: _encryptData,
              child: const Text('Encrypt via Native C'),
            ),
            const SizedBox(height: 20),
            Text("Encrypted: $_encryptedHex", style: const TextStyle(fontFamily: 'monospace')),
          ],
        ),
      ),
    );
  }
}
```

## Production Solution Walkthrough

### 1. The Native C Code (`native_crypto.c`)
In a real project, this file is placed in the `ios/Classes/` or `android/app/src/main/cpp/` folder and compiled using CMake/CocoaPods.
It performs a simple XOR cipher.

```c
#include <stdint.h>
#include <stdlib.h>
#include <string.h>

// For Windows export compatibility
#ifdef _WIN32
#define EXPORT __declspec(dllexport)
#else
#define EXPORT __attribute__((visibility("default"))) __attribute__((used))
#endif

// A simple XOR encryption that modifies the buffer in place.
// In a real app, this would be a call to AES-GCM or Sodium.
EXPORT void encrypt_data(uint8_t* data, int length, uint8_t key) {
    for (int i = 0; i < length; i++) {
        data[i] = data[i] ^ key;
    }
}
```

### 2. FFI Binding Setup (The Bridge)
This is where the magic happens. We tell the Dart compiler exactly what the C function signature looks like, and how to map it to Dart types.

```dart
import 'dart:ffi'; // For FFI
import 'dart:io'; // For Platform check
import 'package:ffi/ffi.dart'; // For calloc and String conversion (must add `ffi` to pubspec)

// 1. Define the C Function Signature
// void encrypt_data(uint8_t* data, int length, uint8_t key)
typedef EncryptDataC = Void Function(Pointer<Uint8> data, Int32 length, Uint8 key);

// 2. Define the equivalent Dart Function Signature
typedef EncryptDataDart = void Function(Pointer<Uint8> data, int length, int key);

class NativeCryptoBridge {
  late EncryptDataDart _encryptFunc;

  NativeCryptoBridge() {
    // 3. Load the Dynamic Library (.so on Android, .dylib on iOS/macOS, .dll on Win)
    final DynamicLibrary nativeLib = Platform.isAndroid
        ? DynamicLibrary.open('libnative_crypto.so')
        : DynamicLibrary.process(); // iOS/macOS statically link

    // 4. Look up the C function and cast it to the Dart signature
    _encryptFunc = nativeLib
        .lookup<NativeFunction<EncryptDataC>>('encrypt_data')
        .asFunction<EncryptDataDart>();
  }

  // 5. The safe Dart wrapper handling memory
  String encryptString(String input, int key) {
    // Convert Dart String to a list of UTF-8 bytes
    final bytes = input.codeUnits;
    final length = bytes.length;

    // VERY IMPORTANT: Allocate unmanaged memory in C-space
    final Pointer<Uint8> pointer = calloc<Uint8>(length);

    try {
      // Copy Dart bytes into the C memory pointer
      for (int i = 0; i < length; i++) {
        pointer[i] = bytes[i];
      }

      // Call the Native C function (synchronous, blocking, zero-overhead)
      _encryptFunc(pointer, length, key);

      // Read the modified memory back into Dart space
      final encryptedBytes = pointer.asTypedList(length);

      // Convert to a Hex string for display
      return encryptedBytes.map((b) => b.toRadixString(16).padLeft(2, '0')).join('');
    } finally {
      // MANDATORY: Free the memory to prevent a leak
      calloc.free(pointer);
    }
  }
}
```

### 3. Tying it to the UI
Now we just instantiate the bridge and use it like a normal Dart class. Note: `ffi` must be added to `pubspec.yaml`.

```dart
class _VaultScreenState extends State<VaultScreen> {
  final TextEditingController _controller = TextEditingController();
  String _encryptedHex = "No data";

  // Note: In a real environment without the C library compiled, this will throw an error on instantiation.
  // late final NativeCryptoBridge _bridge;

  @override
  void initState() {
    super.initState();
    // _bridge = NativeCryptoBridge();
  }

  void _encryptData() {
    final text = _controller.text;
    if (text.isEmpty) return;

    // Use a fixed key of 42 for the XOR cipher
    // final hex = _bridge.encryptString(text, 42);

    // Stubbed output for demonstration:
    final stubHex = text.codeUnits.map((b) => (b ^ 42).toRadixString(16).padLeft(2, '0')).join('');

    setState(() {
      _encryptedHex = stubHex; // Use `hex` in production
    });
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(title: const Text('FFI Secure Vault')),
      body: Padding(
        padding: const EdgeInsets.all(16.0),
        child: Column(
          children: [
            const Text("This text bypasses the Dart VM and is encrypted directly via C CPU instructions."),
            const SizedBox(height: 20),
            TextField(
              controller: _controller,
              decoration: const InputDecoration(labelText: "Enter Private Key", border: OutlineInputBorder()),
            ),
            const SizedBox(height: 20),
            ElevatedButton(
              onPressed: _encryptData,
              child: const Text('Encrypt via Native C (XOR 42)'),
            ),
            const SizedBox(height: 20),
            Container(
              padding: const EdgeInsets.all(12),
              color: Colors.grey[200],
              child: Text("Hex: $_encryptedHex", style: const TextStyle(fontFamily: 'monospace', fontSize: 18)),
            ),
          ],
        ),
      ),
    );
  }
}
```

### 4. Architecture Diagram
```text
[ Dart VM ]
  |-- "Hello" (Dart String)
  |-- Convert to List<int> [72, 101, 108, 108, 111]
  |
  |-- calloc(5) ---> Allocates memory outside the VM
  |-- copy bytes to Pointer
  |
  |-- Call _encryptFunc(pointer, 5, 42)
  v
[ Native C / Rust (Compiled Binary) ]
  |-- CPU Executes XOR Loop synchronously
  |-- Modifies Pointer memory in place
  v
[ Dart VM ]
  |-- pointer.asTypedList() reads the memory
  |-- calloc.free(pointer) ---> MUST FREE!
  |-- Display to UI
```

## Pro Tips for Production
- **`ffigen`:** Never write FFI bindings by hand in production. Use the `ffigen` package. You point it at a C header file (`.h`), and it automatically generates hundreds of lines of perfectly typed Dart FFI boilerplate.
- **Asynchronous FFI:** Standard FFI blocks the Dart main thread. If your C encryption takes 500ms, your UI will freeze. To fix this, you must run the FFI call inside an `Isolate.run`, OR use `NativePorts` to pass a C-callback that triggers a Dart asynchronous stream when the C thread finishes.