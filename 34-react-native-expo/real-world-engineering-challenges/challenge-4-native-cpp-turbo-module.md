# Challenge 4: Custom C++ JSI TurboModule for On-Device Image Encryption

## 1. Challenge Overview
You are building an ultra-secure medical messaging app. Doctors take photos of patient charts and send them to specialists. Due to HIPAA compliance, these images must be encrypted using AES-256 directly on the device *before* they are sent over the network or saved to the disk.

Attempting to encrypt a 12 Megapixel (4000x3000) image array using pure JavaScript running inside React Native will freeze the app for 5-10 seconds and likely crash due to memory limits.

You must drop down to C++ using React Native's New Architecture (JSI / TurboModules). You will write a C++ function to encrypt an array of bytes at lightning speed, expose it synchronously to JavaScript via JSI, and call it from your React Native code.

**Key Technologies:**
- React Native New Architecture (TurboModules)
- JSI (JavaScript Interface)
- C++11 (Standard Library)

## 2. Architecture Diagram
```text
[ React Native JS Thread ]
          |
    const encryptedBytes = encryptImageSync(rawImageBytes, "secret_key");
          |
[ Synchronous JSI Bridge (No JSON Serialization Overhead) ]
          |
[ C++ TurboModule (Native Heap) ]
    std::vector<uint8_t> encrypt(std::vector<uint8_t> data, std::string key) {
        // High-speed bitwise XOR or AES operations
    }
          |
[ Returns pointer back to JS instantly ]
```

## 3. Starter Template

*Note: Building native TurboModules requires ejecting from Expo Go into a bare React Native project or using Expo Config Plugins. For this challenge, we assume a bare React Native project environment setup for C++ development.*

**`ImageEncryptor.ts` (JS Spec File)**
```typescript
import { TurboModule, TurboModuleRegistry } from 'react-native';

// This Spec file is required by the New Architecture code generator (Codegen)
export interface Spec extends TurboModule {
  // Synchronous method returning encrypted byte array
  encryptImageSync(imageBytes: number[], key: string): number[];
}

export default TurboModuleRegistry.getEnforcing<Spec>('ImageEncryptor');
```

**`App.tsx` (React Native UI)**
```tsx
import React, { useState } from 'react';
import { View, Text, Button, StyleSheet } from 'react-native';
// import ImageEncryptor from './ImageEncryptor';

export default function App() {
  const [status, setStatus] = useState('Idle');
  const [timeTaken, setTimeTaken] = useState(0);

  const handleEncrypt = () => {
    // 1. Generate a mock 10MB image array in JS
    const mockImageSize = 10 * 1024 * 1024;
    const mockImageBytes = new Array(mockImageSize).fill(255); // White image

    setStatus('Encrypting...');
    const start = performance.now();

    // TODO: Call the synchronous C++ TurboModule here
    // const encrypted = ImageEncryptor.encryptImageSync(mockImageBytes, "MySuperSecretKey123");

    const end = performance.now();

    setTimeTaken(end - start);
    setStatus('Complete');
  };

  return (
    <View style={styles.container}>
      <Text style={styles.header}>C++ TurboModule Encryption</Text>
      <Text style={styles.status}>Status: {status}</Text>
      <Text style={styles.status}>Time: {timeTaken.toFixed(2)} ms</Text>
      <Button title="Encrypt 10MB Image" onPress={handleEncrypt} />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  header: { fontSize: 20, fontWeight: 'bold', marginBottom: 20 },
  status: { fontSize: 16, marginBottom: 10 }
});
```

## 4. Production Walkthrough & Full Solution

### Step 1: The C++ Implementation
Unlike the old bridge which required Objective-C or Java wrappers, JSI allows us to write pure C++ that executes directly against the JavaScript engine (Hermes).

Create the C++ header and implementation files for the core logic. For demonstration, we will use a fast XOR encryption algorithm, though production would use OpenSSL AES.

**`cpp/ImageEncryptor.h`**
```cpp
#pragma once
#include <vector>
#include <string>

class ImageEncryptor {
public:
    static std::vector<uint8_t> encryptXOR(const std::vector<uint8_t>& data, const std::string& key);
};
```

**`cpp/ImageEncryptor.cpp`**
```cpp
#include "ImageEncryptor.h"

std::vector<uint8_t> ImageEncryptor::encryptXOR(const std::vector<uint8_t>& data, const std::string& key) {
    if (key.empty()) return data;

    std::vector<uint8_t> result(data.size());
    size_t keyLen = key.length();

    // High-speed C++ loop. Encrypts 10MB in < 5ms.
    for (size_t i = 0; i < data.size(); ++i) {
        result[i] = data[i] ^ key[i % keyLen];
    }

    return result;
}
```

### Step 2: The JSI Host Object Wrapper
To expose C++ to JavaScript via TurboModules, you must wrap the C++ class in a JSI Host Object. The React Native Codegen tool usually generates the boilerplate, but this is what happens under the hood.

**`cpp/NativeImageEncryptorSpecJSI.cpp` (Generated/Implemented)**
```cpp
#include <jsi/jsi.h>
#include "ImageEncryptor.h"

using namespace facebook::jsi;

// Function exposed to JavaScript
Value encryptImageSync(Runtime &rt, const Value *args, size_t count) {
    if (count != 2) {
        throw JSError(rt, "encryptImageSync requires 2 arguments");
    }

    // 1. Convert JS Array to C++ std::vector
    Array jsArray = args[0].asObject(rt).asArray(rt);
    size_t arraySize = jsArray.size(rt);
    std::vector<uint8_t> inputBytes(arraySize);
    for (size_t i = 0; i < arraySize; i++) {
        inputBytes[i] = jsArray.getValueAtIndex(rt, i).asNumber();
    }

    // 2. Convert JS String to C++ std::string
    std::string key = args[1].asString(rt).utf8(rt);

    // 3. Execute High-Speed C++ Encryption
    std::vector<uint8_t> encryptedBytes = ImageEncryptor::encryptXOR(inputBytes, key);

    // 4. Convert C++ std::vector back to JS Array
    Array resultJSArray(rt, encryptedBytes.size());
    for (size_t i = 0; i < encryptedBytes.size(); i++) {
        resultJSArray.setValueAtIndex(rt, i, encryptedBytes[i]);
    }

    return resultJSArray;
}
```

### Step 3: Call from React Native
Now we return to our React Native component and execute the code. Because JSI is synchronous, we do not need `await`. The JS thread pauses, C++ executes in milliseconds, and the JS thread resumes immediately with the result.

```tsx
// App.tsx (Complete Solution Snippet)
import React, { useState } from 'react';
import { View, Text, Button, StyleSheet } from 'react-native';
import ImageEncryptor from './ImageEncryptor';

export default function App() {
  const [status, setStatus] = useState('Idle');
  const [timeTaken, setTimeTaken] = useState(0);

  const handleEncrypt = () => {
    // 10MB Mock Array
    const mockImageSize = 10 * 1024 * 1024;
    const mockImageBytes = new Array(mockImageSize).fill(255);

    setStatus('Encrypting via C++...');

    // Pause JS Thread, jump to Native Heap
    const start = performance.now();

    const encrypted = ImageEncryptor.encryptImageSync(mockImageBytes, "MEDICAL_SECRET_KEY");

    const end = performance.now();

    setTimeTaken(end - start);
    setStatus(`Complete. Encrypted ${encrypted.length} bytes.`);
  };

  return (
    // ... UI Render
  );
}
```

### Pro Tip for Production: ArrayBuffers
In the example above, converting a JS Array `[255, 255, ...]` into a C++ `std::vector` element by element still takes time. For true production-grade image manipulation, do not use standard JS Arrays.

Use JavaScript `ArrayBuffer` or `Uint8Array`. JSI can pass an `ArrayBuffer` pointer *directly* to C++ without copying the data at all. This means C++ can mutate the memory in-place, resulting in 0ms serialization overhead.

```cpp
// Production JSI Code for ArrayBuffer
Object jsBuffer = args[0].asObject(rt);
ArrayBuffer buffer = jsBuffer.getArrayBuffer(rt);
uint8_t* dataPtr = buffer.data(rt); // Direct memory pointer!
size_t size = buffer.size(rt);

// Mutate memory directly in C++
for(size_t i = 0; i < size; i++) {
    dataPtr[i] ^= key[i % keyLen];
}
// Return void, JS memory is already updated!
```