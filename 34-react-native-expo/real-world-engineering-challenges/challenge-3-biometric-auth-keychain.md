# Challenge 3: Bank-Grade Secure Biometric Authentication Flow

## 1. Challenge Overview
You are tasked with building the authentication gateway for a Neobank mobile application. Because this app handles sensitive financial data, simply storing a session token in generic async storage is insufficient.

You must implement a flow where:
1. On first login, a mock JWT token is generated and stored securely in the device's hardware enclave (iOS Keychain / Android Keystore).
2. On subsequent app launches, the app detects the stored token and immediately prompts the user for Biometric Authentication (FaceID/TouchID).
3. The token is only retrieved and decrypted *after* a successful biometric scan.
4. If the user minimizes the app (backgrounds it) and returns, they must instantly be re-prompted for FaceID to prevent someone from looking at their screen while the phone is unlocked.

**Key Technologies:**
- `expo-secure-store`
- `expo-local-authentication`
- React Native `AppState` API

## 2. Architecture Diagram
```text
[ App Launch ]
      |
      v
[ Check SecureStore for 'auth_token' ]
      |
      +-- (No Token) --> [ Show Standard Login Screen ] --> (Login Success) --> [ Save Token to SecureStore ]
      |
      +-- (Token Exists)
               |
               v
[ LocalAuthentication.authenticateAsync() ]
               |
               +-- (Fail/Cancel) --> [ Show "Unlock with FaceID" Button ]
               |
               +-- (Success)
                     |
                     v
[ SecureStore.getItemAsync() ] --> [ Load Bank Dashboard ]

--- LATER ---
[ User Backgrounds App ] --> (AppState = 'background')
[ User Foregrounds App ] --> (AppState = 'active') --> [ Trigger FaceID Re-auth ]
```

## 3. Starter Template

```tsx
import React, { useState, useEffect, useRef } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, AppState } from 'react-native';
// TODO: Import SecureStore and LocalAuthentication

export default function NeobankAuth() {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [hasToken, setHasToken] = useState(false);

  // TODO: Add AppState listener for background locking

  useEffect(() => {
    // TODO: Check if token exists on boot
  }, []);

  const handleFirstLogin = async () => {
    // TODO: Generate fake token and save to SecureStore
    // TODO: Set hasToken to true
  };

  const unlockApp = async () => {
    // TODO: Trigger Biometrics
    // TODO: If success, read token from SecureStore and set isAuthenticated to true
  };

  const lockApp = () => {
    setIsAuthenticated(false);
  };

  const clearData = async () => {
    // TODO: Delete token from SecureStore to reset the app
    setHasToken(false);
    setIsAuthenticated(false);
  };

  if (isAuthenticated) {
    return (
      <View style={styles.container}>
        <Text style={styles.title}>Account Balance: $1,420,000</Text>
        <TouchableOpacity style={styles.buttonRed} onPress={lockApp}>
          <Text style={styles.buttonText}>Lock Phone</Text>
        </TouchableOpacity>
        <TouchableOpacity style={{ marginTop: 20 }} onPress={clearData}>
          <Text style={{ color: 'red' }}>Reset App Data</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <Text style={styles.title}>NeoBank Secure</Text>

      {!hasToken ? (
        <TouchableOpacity style={styles.buttonBlue} onPress={handleFirstLogin}>
          <Text style={styles.buttonText}>1. Login (Save Token)</Text>
        </TouchableOpacity>
      ) : (
        <TouchableOpacity style={styles.buttonGreen} onPress={unlockApp}>
          <Text style={styles.buttonText}>Unlock with FaceID</Text>
        </TouchableOpacity>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#111827' },
  title: { fontSize: 24, fontWeight: 'bold', color: 'white', marginBottom: 40 },
  buttonBlue: { backgroundColor: '#3B82F6', padding: 15, borderRadius: 8, width: 250, alignItems: 'center' },
  buttonGreen: { backgroundColor: '#10B981', padding: 15, borderRadius: 8, width: 250, alignItems: 'center' },
  buttonRed: { backgroundColor: '#EF4444', padding: 15, borderRadius: 8, width: 250, alignItems: 'center' },
  buttonText: { color: 'white', fontWeight: 'bold', fontSize: 16 }
});
```

## 4. Production Walkthrough & Full Solution

### Step 1: Token Lifecycle Management
We need functions to check for the token on app boot, save it securely, and delete it.

```tsx
import * as SecureStore from 'expo-secure-store';
import * as LocalAuthentication from 'expo-local-authentication';

const TOKEN_KEY = 'neobank_secure_jwt';

// Inside Component:
const checkBootState = async () => {
  const token = await SecureStore.getItemAsync(TOKEN_KEY);
  if (token) {
    setHasToken(true);
    // Auto-prompt unlock on boot if token exists
    unlockApp();
  }
};

const handleFirstLogin = async () => {
  const mockJwt = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...';

  // Require device to be unlocked to access this keychain item
  await SecureStore.setItemAsync(TOKEN_KEY, mockJwt, {
    keychainAccessible: SecureStore.WHEN_UNLOCKED_THIS_DEVICE_ONLY
  });

  setHasToken(true);
  setIsAuthenticated(true);
};

const clearData = async () => {
  await SecureStore.deleteItemAsync(TOKEN_KEY);
  setHasToken(false);
  setIsAuthenticated(false);
};
```

### Step 2: The Biometric Unlock Function
Before trusting the user, invoke the OS-level scanner.

```tsx
const unlockApp = async () => {
  const hasHardware = await LocalAuthentication.hasHardwareAsync();
  const isEnrolled = await LocalAuthentication.isEnrolledAsync();

  if (!hasHardware || !isEnrolled) {
    alert('Biometrics not available. Please use PIN.');
    // In production, fallback to a secure PIN entry screen here
    return;
  }

  const result = await LocalAuthentication.authenticateAsync({
    promptMessage: 'Authenticate to access NeoBank',
    cancelLabel: 'Cancel',
    disableDeviceFallback: false // Allow device passcode if FaceID fails 3 times
  });

  if (result.success) {
    // Identity verified. We can now safely retrieve the token for API calls.
    const token = await SecureStore.getItemAsync(TOKEN_KEY);
    console.log("Secure Token Retrieved:", token);
    setIsAuthenticated(true);
  } else {
    // User cancelled or failed. App remains locked.
  }
};
```

### Step 3: Implementing the AppState Lock (Background Privacy)
If the user minimizes the app, it must immediately lock so that when they bring it back to the foreground, they must re-authenticate.

```tsx
import { AppState } from 'react-native';

// Inside Component:
const appState = useRef(AppState.currentState);

useEffect(() => {
  const subscription = AppState.addEventListener('change', nextAppState => {
    // If the app goes from active to background/inactive
    if (appState.current.match(/active/) && nextAppState.match(/inactive|background/)) {
      // Force lock instantly
      setIsAuthenticated(false);
    }

    // If the app returns to foreground and they have a token, auto-prompt FaceID
    if (appState.current.match(/inactive|background/) && nextAppState === 'active') {
      if (hasToken && !isAuthenticated) {
        unlockApp();
      }
    }

    appState.current = nextAppState;
  });

  return () => {
    subscription.remove();
  };
}, [hasToken, isAuthenticated]); // Re-bind when auth state changes
```

### Step 4: Assemble the Complete Solution

```tsx
import React, { useState, useEffect, useRef } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, AppState } from 'react-native';
import * as SecureStore from 'expo-secure-store';
import * as LocalAuthentication from 'expo-local-authentication';

const TOKEN_KEY = 'neobank_secure_jwt';

export default function NeobankAuth() {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [hasToken, setHasToken] = useState(false);
  const appState = useRef(AppState.currentState);

  useEffect(() => {
    checkBootState();
  }, []);

  // --- Background Locking Logic ---
  useEffect(() => {
    const subscription = AppState.addEventListener('change', nextAppState => {
      // Lock when backgrounded
      if (appState.current.match(/active/) && nextAppState.match(/inactive|background/)) {
        setIsAuthenticated(false);
      }

      // Attempt auto-unlock when brought to foreground
      if (appState.current.match(/inactive|background/) && nextAppState === 'active') {
        SecureStore.getItemAsync(TOKEN_KEY).then(token => {
          if (token && !isAuthenticated) {
             unlockApp();
          }
        });
      }
      appState.current = nextAppState;
    });

    return () => subscription.remove();
  }, [isAuthenticated]);

  const checkBootState = async () => {
    const token = await SecureStore.getItemAsync(TOKEN_KEY);
    if (token) {
      setHasToken(true);
      unlockApp();
    }
  };

  const handleFirstLogin = async () => {
    const mockJwt = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...';
    await SecureStore.setItemAsync(TOKEN_KEY, mockJwt, {
      keychainAccessible: SecureStore.WHEN_UNLOCKED_THIS_DEVICE_ONLY
    });
    setHasToken(true);
    setIsAuthenticated(true);
  };

  const unlockApp = async () => {
    const hasHardware = await LocalAuthentication.hasHardwareAsync();
    const isEnrolled = await LocalAuthentication.isEnrolledAsync();

    if (!hasHardware || !isEnrolled) {
      alert('Biometrics not available. Please use PIN.');
      return;
    }

    const result = await LocalAuthentication.authenticateAsync({
      promptMessage: 'Authenticate to access NeoBank',
    });

    if (result.success) {
      setIsAuthenticated(true);
    }
  };

  const lockApp = () => setIsAuthenticated(false);

  const clearData = async () => {
    await SecureStore.deleteItemAsync(TOKEN_KEY);
    setHasToken(false);
    setIsAuthenticated(false);
  };

  if (isAuthenticated) {
    return (
      <View style={styles.container}>
        <Text style={styles.title}>Account Balance: $1,420,000</Text>
        <TouchableOpacity style={styles.buttonRed} onPress={lockApp}>
          <Text style={styles.buttonText}>Lock Phone</Text>
        </TouchableOpacity>
        <TouchableOpacity style={{ marginTop: 20 }} onPress={clearData}>
          <Text style={{ color: '#F87171' }}>Reset App Data (Log out)</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <Text style={styles.title}>NeoBank Secure</Text>

      {!hasToken ? (
        <TouchableOpacity style={styles.buttonBlue} onPress={handleFirstLogin}>
          <Text style={styles.buttonText}>1. Login (Save Token)</Text>
        </TouchableOpacity>
      ) : (
        <TouchableOpacity style={styles.buttonGreen} onPress={unlockApp}>
          <Text style={styles.buttonText}>Unlock with FaceID</Text>
        </TouchableOpacity>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#111827' },
  title: { fontSize: 24, fontWeight: 'bold', color: 'white', marginBottom: 40 },
  buttonBlue: { backgroundColor: '#3B82F6', padding: 15, borderRadius: 8, width: 250, alignItems: 'center' },
  buttonGreen: { backgroundColor: '#10B981', padding: 15, borderRadius: 8, width: 250, alignItems: 'center' },
  buttonRed: { backgroundColor: '#EF4444', padding: 15, borderRadius: 8, width: 250, alignItems: 'center' },
  buttonText: { color: 'white', fontWeight: 'bold', fontSize: 16 }
});
```

### Pro Tip for Production
When an app goes into the background on iOS, the OS takes a "screenshot" of the active UI to show in the multitasking app switcher. If you do not explicitly blank the screen or blur it before the app enters the background, sensitive banking data (like balances) will be visible in the multitasking view to anyone looking over the user's shoulder. You can use libraries like `expo-screen-capture` or manually render a `<View style={{ flex: 1, backgroundColor: 'black' }} />` immediately when `nextAppState === 'inactive'`.