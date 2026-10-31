# Challenge 2: 60 FPS Reanimated 3 Gesture-Driven Candlestick Chart

## 1. Challenge Overview
You are tasked with building a high-performance, interactive financial candlestick chart component (e.g., Robinhood or Binance app). Users must be able to drag a crosshair over the chart to inspect prices. Because financial charts often contain hundreds of data points, performing this interaction using React state updates will cause massive frame drops and stuttering.

You must use Reanimated 3 worklets and `react-native-gesture-handler` to track the user's touch and move the crosshair at a flawless 60/120 FPS entirely on the UI thread, bypassing the JS thread.

**Key Technologies:**
- React Native Reanimated 3 (Worklets, Shared Values, Animated Styles)
- React Native Gesture Handler
- Expo Haptics

## 2. Architecture Diagram
```text
[ User Finger ] ---> (PanGestureHandler)
                            |
                     (JSI / UI Thread)
                            |
                 event.x / event.translationX
                            |
             +--------------+--------------+
             |                             |
      translateX.value                opacity.value
             |                             |
      useAnimatedStyle               useAnimatedStyle
             |                             |
             v                             v
[ Animated.View (Crosshair Line) ]  [ Animated.View (Price Label) ]
```

## 3. Starter Template

```tsx
import React, { useState } from 'react';
import { View, Text, StyleSheet, Dimensions } from 'react-native';
// TODO: Import Reanimated and Gesture Handler

const { width: CHART_WIDTH } = Dimensions.get('window');
const CHART_HEIGHT = 200;

// Mock data: 30 days of prices
const mockData = Array.from({ length: 30 }).map((_, i) => ({
  x: (CHART_WIDTH / 30) * i,
  price: 100 + Math.random() * 50
}));

export default function CandlestickChart() {
  // TODO: Create shared values for X position, Y position, and opacity

  // TODO: Create a Pan gesture that updates shared values

  // TODO: Create animated styles for the crosshair lines

  // TODO: (Bonus) Map the current X position to the nearest data point's price
  const [activePrice, setActivePrice] = useState<number | null>(null);

  return (
    <View style={styles.container}>
      <Text style={styles.header}>AAPL - $145.20</Text>
      <Text style={styles.subHeader}>Drag on chart to inspect</Text>

      {/* TODO: Wrap Chart area in GestureDetector */}
      <View style={styles.chartArea}>
        {/* Mock background bars to represent chart data */}
        {mockData.map((d, i) => (
          <View key={i} style={[styles.bar, { left: d.x, height: d.price }]} />
        ))}

        {/* TODO: Implement Animated Vertical Crosshair Line */}
        <View style={styles.crosshairVertical} />

        {/* TODO: Implement Animated Horizontal Crosshair Line */}
        <View style={styles.crosshairHorizontal} />

        {/* TODO: Implement Animated Price Tooltip bubble */}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#000', paddingTop: 60, paddingHorizontal: 10 },
  header: { color: '#FFF', fontSize: 28, fontWeight: 'bold' },
  subHeader: { color: '#888', fontSize: 14, marginBottom: 20 },
  chartArea: { width: '100%', height: CHART_HEIGHT, backgroundColor: '#111', position: 'relative' },
  bar: { position: 'absolute', bottom: 0, width: 4, backgroundColor: '#0f0' },
  crosshairVertical: { position: 'absolute', width: 1, height: '100%', backgroundColor: '#FFF' },
  crosshairHorizontal: { position: 'absolute', width: '100%', height: 1, backgroundColor: '#FFF' }
});
```

## 4. Production Walkthrough & Full Solution

### Step 1: Initialize Shared Values
We need values that live on the UI thread to track the X and Y coordinates of the user's finger, and an opacity value to fade the crosshair in and out.

```tsx
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withTiming,
  runOnJS
} from 'react-native-reanimated';

const touchX = useSharedValue(0);
const touchY = useSharedValue(0);
const crosshairOpacity = useSharedValue(0);
```

### Step 2: Build the UI Thread Gesture Worklet
The `Gesture.Pan()` must run completely synchronously. It intercepts the touch, updates the coordinates, and toggles the opacity.

```tsx
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import * as Haptics from 'expo-haptics';

// Helper function to call from UI thread to JS thread
const triggerHaptic = () => {
  Haptics.selectionAsync();
};

const panGesture = Gesture.Pan()
  .onStart((event) => {
    // Finger down: Show crosshair instantly
    crosshairOpacity.value = withTiming(1, { duration: 150 });
    touchX.value = event.x;
    touchY.value = event.y;
    runOnJS(triggerHaptic)();
  })
  .onChange((event) => {
    // Finger moving: Update position (60 FPS on UI Thread)
    touchX.value = event.x;
    touchY.value = event.y;
    // We could add complex interpolation here to snap to the nearest data point
  })
  .onEnd(() => {
    // Finger lifted: Fade out
    crosshairOpacity.value = withTiming(0, { duration: 150 });
  });
```

### Step 3: Bind Shared Values to Animated Styles
Translate the X and Y coordinate shared values into CSS `transform` styles.

```tsx
const verticalLineStyle = useAnimatedStyle(() => {
  return {
    opacity: crosshairOpacity.value,
    transform: [{ translateX: touchX.value }],
  };
});

const horizontalLineStyle = useAnimatedStyle(() => {
  return {
    opacity: crosshairOpacity.value,
    transform: [{ translateY: touchY.value }],
  };
});
```

### Step 4: Assemble the Final Component

```tsx
// Complete Solution
import React from 'react';
import { View, Text, StyleSheet, Dimensions } from 'react-native';
import { Gesture, GestureDetector, GestureHandlerRootView } from 'react-native-gesture-handler';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withTiming,
  runOnJS
} from 'react-native-reanimated';
import * as Haptics from 'expo-haptics';

const { width: CHART_WIDTH } = Dimensions.get('window');
const CHART_HEIGHT = 200;

const mockData = Array.from({ length: 30 }).map((_, i) => ({
  x: (CHART_WIDTH / 30) * i,
  price: 100 + Math.random() * 50
}));

export default function CandlestickChart() {
  const touchX = useSharedValue(0);
  const touchY = useSharedValue(0);
  const crosshairOpacity = useSharedValue(0);

  const triggerHaptic = () => Haptics.selectionAsync();

  const panGesture = Gesture.Pan()
    .onStart((event) => {
      crosshairOpacity.value = withTiming(1, { duration: 100 });
      touchX.value = event.x;
      touchY.value = Math.max(0, Math.min(event.y, CHART_HEIGHT)); // Clamp Y
      runOnJS(triggerHaptic)();
    })
    .onChange((event) => {
      touchX.value = event.x;
      touchY.value = Math.max(0, Math.min(event.y, CHART_HEIGHT)); // Clamp Y
    })
    .onEnd(() => {
      crosshairOpacity.value = withTiming(0, { duration: 150 });
    });

  const verticalLineStyle = useAnimatedStyle(() => ({
    opacity: crosshairOpacity.value,
    transform: [{ translateX: touchX.value }],
  }));

  const horizontalLineStyle = useAnimatedStyle(() => ({
    opacity: crosshairOpacity.value,
    transform: [{ translateY: touchY.value }],
  }));

  return (
    <GestureHandlerRootView style={styles.container}>
      <Text style={styles.header}>AAPL - $145.20</Text>
      <Text style={styles.subHeader}>Drag on chart to inspect</Text>

      <GestureDetector gesture={panGesture}>
        <View style={styles.chartArea}>
          {mockData.map((d, i) => (
            <View key={i} style={[styles.bar, { left: d.x, height: d.price }]} />
          ))}

          {/* Reanimated views replacing static views */}
          <Animated.View style={[styles.crosshairVertical, verticalLineStyle]} />
          <Animated.View style={[styles.crosshairHorizontal, horizontalLineStyle]} />

        </View>
      </GestureDetector>
    </GestureHandlerRootView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#000', paddingTop: 60, paddingHorizontal: 10 },
  header: { color: '#FFF', fontSize: 28, fontWeight: 'bold' },
  subHeader: { color: '#888', fontSize: 14, marginBottom: 20 },
  chartArea: { width: '100%', height: CHART_HEIGHT, backgroundColor: '#111', position: 'relative' },
  bar: { position: 'absolute', bottom: 0, width: 4, backgroundColor: '#00C805' }, // Robinhood green
  crosshairVertical: { position: 'absolute', width: 1, height: '100%', backgroundColor: 'rgba(255,255,255,0.5)', left: 0 },
  crosshairHorizontal: { position: 'absolute', width: '100%', height: 1, backgroundColor: 'rgba(255,255,255,0.5)', top: 0 }
});
```

### Pro Tip for Production
To display the exact price of the point you are hovering over, you cannot simply `setState(price)` inside the gesture `.onChange()`, because updating React state 60 times a second will cause massive lag.

Instead, you must pass the `mockData` array to the UI thread (using `useSharedValue(mockData)`). Inside the gesture worklet, you iterate through the array to find the closest `d.x` to the `touchX.value`. Then, you assign the corresponding `d.price` to a new `currentPrice = useSharedValue(0)`. Finally, use an `<Animated.Text text={currentPrice} />` (via the `react-native-reanimated` text wrapper) to render the price synchronously on the UI thread without ever touching the React JS renderer.