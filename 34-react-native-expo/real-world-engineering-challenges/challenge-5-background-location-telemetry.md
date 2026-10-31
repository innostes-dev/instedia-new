# Challenge 5: Uber-Style Battery-Efficient Background Location Telemetry

## 1. Challenge Overview
You are building the driver application for a ride-sharing startup. The app must track the driver's location continuously, even when the phone is locked and the app is in the background. However, if you simply ping the GPS chip every second, the OS will kill your app for draining the battery, and the driver will uninstall it.

You must use Expo TaskManager and Expo Location to configure a battery-efficient background tracking system. It should use `accuracy: Balanced` or `distanceInterval` to only wake up the app and send telemetry to the server when the driver actually moves a significant distance.

**Key Technologies:**
- `expo-location`
- `expo-task-manager`
- Background execution boundaries (iOS Info.plist / Android Manifest configurations handled by Expo)

## 2. Architecture Diagram
```text
[ Device Locked / App Backgrounded ]
              |
[ OS Native Location Services (Low Power Mode) ]
              | (Driver moves > 50 meters)
              v
[ OS Wakes App Headless JS Task ]
              |
[ TaskManager: BACKGROUND_LOCATION_TASK ]
              | (Array of location objects)
              v
[ HTTP POST to Ride-Share Backend API ]
              |
[ Task Completes & OS Suspends App Again ]
```

## 3. Starter Template

```tsx
import React, { useState, useEffect } from 'react';
import { View, Text, Button, StyleSheet } from 'react-native';
// TODO: Import Location and TaskManager

const BACKGROUND_LOCATION_TASK = 'background-location-task';

// TODO: Define the TaskManager callback function outside of any React components

export default function DriverApp() {
  const [isTracking, setIsTracking] = useState(false);

  useEffect(() => {
    // TODO: Check if background task is already registered on boot
  }, []);

  const requestPermissions = async () => {
    // TODO: Request foreground, THEN request background permissions
  };

  const startTracking = async () => {
    // TODO: Start Location updates using TaskManager name
  };

  const stopTracking = async () => {
    // TODO: Stop Location updates
  };

  return (
    <View style={styles.container}>
      <Text style={styles.header}>Driver Telemetry</Text>
      <Text style={styles.status}>Status: {isTracking ? 'ONLINE' : 'OFFLINE'}</Text>

      {!isTracking ? (
        <Button title="Go Online (Start Tracking)" onPress={startTracking} color="green" />
      ) : (
        <Button title="Go Offline (Stop Tracking)" onPress={stopTracking} color="red" />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  header: { fontSize: 24, fontWeight: 'bold', marginBottom: 20 },
  status: { fontSize: 18, marginBottom: 30 }
});
```

## 4. Production Walkthrough & Full Solution

### Step 1: Define the Headless Background Task
React components do not run in the background. We must define a headless JS task using `TaskManager` in the global scope (outside of React) so it can execute even when the UI is unmounted.

```tsx
import * as TaskManager from 'expo-task-manager';
import * as Location from 'expo-location';

const BACKGROUND_LOCATION_TASK = 'background-location-task';

// 1. Define the task in global scope
TaskManager.defineTask(BACKGROUND_LOCATION_TASK, async ({ data, error }) => {
  if (error) {
    console.error("Background Location Error:", error);
    return;
  }

  if (data) {
    const { locations } = data as { locations: Location.LocationObject[] };
    const latestLocation = locations[0];

    console.log("Received background location:", latestLocation.coords);

    // In production, send to backend:
    /*
    await fetch('https://api.rideshare.com/telemetry', {
      method: 'POST',
      body: JSON.stringify({
        driverId: '123',
        lat: latestLocation.coords.latitude,
        lng: latestLocation.coords.longitude,
        speed: latestLocation.coords.speed
      })
    });
    */
  }
});
```

### Step 2: Complex Permission Flow
Background location requires the most stringent permissions in mobile development. You cannot ask for background permission immediately; you must secure foreground permission first, then explain to the user why you need background access, and then ask for it.

```tsx
const requestPermissions = async () => {
  // Step 1: Request Foreground
  const foreground = await Location.requestForegroundPermissionsAsync();
  if (foreground.status !== 'granted') {
    alert('Permission to access location in foreground was denied');
    return false;
  }

  // Step 2: Request Background (this will open OS settings on modern iOS/Android)
  const background = await Location.requestBackgroundPermissionsAsync();
  if (background.status !== 'granted') {
    alert('Permission to access location in background was denied. Driver tracking requires "Always Allow".');
    return false;
  }

  return true;
};
```

### Step 3: Configuring the Battery-Efficient Tracker
If we use `accuracy: Location.Accuracy.Highest` and `timeInterval: 1000`, the phone's battery will die in two hours. We must configure distance filters and deferred updates.

```tsx
const startTracking = async () => {
  const hasPermissions = await requestPermissions();
  if (!hasPermissions) return;

  await Location.startLocationUpdatesAsync(BACKGROUND_LOCATION_TASK, {
    // Use Balanced or High, never Highest unless actively navigating turn-by-turn
    accuracy: Location.Accuracy.Balanced,
    // Only wake the app if they move 50 meters
    distanceInterval: 50,
    // Or wait at least 30 seconds between updates
    timeInterval: 30000,
    // OS config: Wake app in background, show persistent blue pill/notification
    showsBackgroundLocationIndicator: true,
    foregroundService: {
      notificationTitle: "Driver App Online",
      notificationBody: "Tracking your location for ride requests",
      notificationColor: "#000000",
    },
    // Don't wake up the GPS chip while the user is sitting still
    pausesUpdatesAutomatically: true,
  });

  setIsTracking(true);
};
```

### Step 4: Complete Solution Component Integration

```tsx
// App.tsx
import React, { useState, useEffect } from 'react';
import { View, Text, Button, StyleSheet } from 'react-native';
import * as TaskManager from 'expo-task-manager';
import * as Location from 'expo-location';

const BACKGROUND_LOCATION_TASK = 'background-location-task';

TaskManager.defineTask(BACKGROUND_LOCATION_TASK, async ({ data, error }) => {
  if (error) return console.error(error);
  if (data) {
    const { locations } = data as { locations: Location.LocationObject[] };
    console.log("Background coords:", locations[0].coords.latitude, locations[0].coords.longitude);
  }
});

export default function DriverApp() {
  const [isTracking, setIsTracking] = useState(false);

  useEffect(() => {
    // Check boot state: Did the app crash and get rebooted by the OS while tracking?
    const checkStatus = async () => {
      const isRegistered = await TaskManager.isTaskRegisteredAsync(BACKGROUND_LOCATION_TASK);
      setIsTracking(isRegistered);
    };
    checkStatus();
  }, []);

  const startTracking = async () => {
    const { status: fg } = await Location.requestForegroundPermissionsAsync();
    if (fg !== 'granted') return alert('Foreground permission denied');

    const { status: bg } = await Location.requestBackgroundPermissionsAsync();
    if (bg !== 'granted') return alert('Background permission denied');

    await Location.startLocationUpdatesAsync(BACKGROUND_LOCATION_TASK, {
      accuracy: Location.Accuracy.Balanced,
      distanceInterval: 50,
      showsBackgroundLocationIndicator: true,
      foregroundService: {
        notificationTitle: "Driver App Online",
        notificationBody: "Tracking your location for ride requests",
      },
    });

    setIsTracking(true);
  };

  const stopTracking = async () => {
    await Location.stopLocationUpdatesAsync(BACKGROUND_LOCATION_TASK);
    setIsTracking(false);
  };

  return (
    <View style={styles.container}>
      <Text style={styles.header}>Driver Telemetry</Text>
      <Text style={styles.status}>Status: {isTracking ? 'ONLINE' : 'OFFLINE'}</Text>

      {!isTracking ? (
        <Button title="Go Online" onPress={startTracking} color="green" />
      ) : (
        <Button title="Go Offline" onPress={stopTracking} color="red" />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#F9FAFB' },
  header: { fontSize: 24, fontWeight: 'bold', marginBottom: 20 },
  status: { fontSize: 18, marginBottom: 30, fontWeight: '600' }
});
```

### Pro Tip for Production (Geofencing)
If a driver is waiting at an airport lot, even `distanceInterval: 50` might trigger too often if GPS signal bounces around (urban canyon effect). To save extreme amounts of battery when stationary, combine background location with Geofencing (`Location.startGeofencingAsync`). When the driver stops, pause location updates and set a 200m geofence around them. The OS consumes virtually zero battery maintaining a geofence. When the OS wakes the app indicating they left the geofence, resume the standard background location updates.