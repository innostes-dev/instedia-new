# Challenge 2: Custom RenderObject 120Hz Real-Time Audio Waveform

## The Challenge Scenario
You are building a Spotify-like audio application that requires a highly complex, real-time audio visualizer (a waveform).

If you attempt to build a 120Hz moving waveform using thousands of tiny standard Flutter `Container` widgets wrapped in a `Row`, the framework will crash under the sheer weight of creating, destroying, and diffing thousands of Widgets and Elements 120 times a second.

To achieve maximum 120fps performance, you must bypass the Widget and Element trees entirely for the rendering phase and build a custom `LeafRenderObjectWidget`. You will use the low-level `Canvas` API to draw the pixels yourself.

## Core Requirements
1. **Custom RenderObject:** Create a `LeafRenderObjectWidget` that instantiates a custom `RenderBox`.
2. **Low-Level Canvas Painting:** Override the `paint(PaintingContext context, Offset offset)` method to draw the waveform lines directly.
3. **Optimized Updating:** Ensure that when the audio data changes, the RenderObject only marks itself as needing a paint (`markNeedsPaint()`), without triggering a full layout recalculation or widget rebuild.
4. **Animation Ticker:** Use a `SingleTickerProviderStateMixin` in the parent to feed 60/120Hz data to the RenderObject.

## Starter Template

```dart
import 'package:flutter/material.dart';

void main() => runApp(const WaveformApp());

class WaveformApp extends StatelessWidget {
  const WaveformApp({super.key});

  @override
  Widget build(BuildContext context) {
    return const MaterialApp(home: AudioPlayerScreen());
  }
}

class AudioPlayerScreen extends StatefulWidget {
  const AudioPlayerScreen({super.key});

  @override
  State<AudioPlayerScreen> createState() => _AudioPlayerScreenState();
}

class _AudioPlayerScreenState extends State<AudioPlayerScreen> with SingleTickerProviderStateMixin {
  // TODO: Setup a Ticker/AnimationController to generate fake audio data

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: Colors.black,
      body: Center(
        child: SizedBox(
          height: 150,
          width: double.infinity,
          // TODO: Use your CustomWaveformWidget here
          child: Container(color: Colors.grey),
        ),
      ),
    );
  }
}

// TODO: Create CustomWaveformWidget (LeafRenderObjectWidget)
// TODO: Create RenderWaveform (RenderBox)
```

## Production Solution Walkthrough

### 1. The Custom RenderObject (The Engine)
We extend `RenderBox` and override `paint`. We expose a setter for `amplitude` that calls `markNeedsPaint()` whenever the data changes.

```dart
import 'package:flutter/rendering.dart';
import 'dart:math';

class RenderWaveform extends RenderBox {
  double _amplitude;
  final Paint _barPaint;

  RenderWaveform(this._amplitude)
      : _barPaint = Paint()
          ..color = Colors.greenAccent
          ..strokeWidth = 4.0
          ..strokeCap = StrokeCap.round;

  // Optimized Setter: Only repaint if the value actually changed
  set amplitude(double value) {
    if (_amplitude == value) return;
    _amplitude = value;
    markNeedsPaint(); // Tells the Flutter engine "Repaint me next frame!"
  }

  // We define our own size rules. We want to fill the parent.
  @override
  void performLayout() {
    size = constraints.biggest;
  }

  // The low-level draw call
  @override
  void paint(PaintingContext context, Offset offset) {
    final canvas = context.canvas;

    // Draw 30 bars across the screen
    const int barCount = 30;
    final double spacing = size.width / barCount;

    for (int i = 0; i < barCount; i++) {
      // Create some fake wave variation based on the index and amplitude
      final double waveHeight = (sin(i + _amplitude * 10) + 1) * 0.5; // 0.0 to 1.0
      final double barHeight = size.height * 0.1 + (size.height * 0.8 * waveHeight * _amplitude);

      final double x = offset.dx + (i * spacing) + (spacing / 2);
      final double yCenter = offset.dy + size.height / 2;

      canvas.drawLine(
        Offset(x, yCenter - barHeight / 2),
        Offset(x, yCenter + barHeight / 2),
        _barPaint,
      );
    }
  }
}
```

### 2. The Leaf Widget (The Bridge)
Flutter needs a Widget to put into the Widget Tree. A `LeafRenderObjectWidget` is a widget that has no children and generates a raw RenderObject.

```dart
class CustomWaveformWidget extends LeafRenderObjectWidget {
  final double amplitude;

  const CustomWaveformWidget({super.key, required this.amplitude});

  @override
  RenderObject createRenderObject(BuildContext context) {
    return RenderWaveform(amplitude);
  }

  @override
  void updateRenderObject(BuildContext context, covariant RenderWaveform renderObject) {
    // When the parent setState updates the widget, we pass the new data directly
    // into the RenderObject's setter.
    renderObject.amplitude = amplitude;
  }
}
```

### 3. The UI Controller
We use an `AnimationController` acting as a Ticker to push data down to our widget every single frame.

```dart
class _AudioPlayerScreenState extends State<AudioPlayerScreen> with SingleTickerProviderStateMixin {
  late AnimationController _controller;
  double _currentAmplitude = 0.0;
  final Random _random = Random();

  @override
  void initState() {
    super.initState();
    // Runs at the screen's refresh rate (e.g., 60Hz or 120Hz)
    _controller = AnimationController(vsync: this, duration: const Duration(seconds: 1))..repeat();

    _controller.addListener(() {
      setState(() {
        // Simulate incoming audio decibel data
        _currentAmplitude = _random.nextDouble();
      });
    });
  }

  @override
  void dispose() {
    _controller.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: Colors.black87,
      appBar: AppBar(title: const Text("120Hz Custom RenderBox"), backgroundColor: Colors.black),
      body: Center(
        child: SizedBox(
          height: 150,
          width: double.infinity,
          // Our custom highly-optimized Leaf Widget
          child: CustomWaveformWidget(amplitude: _currentAmplitude),
        ),
      ),
    );
  }
}
```

### 4. Architecture Diagram
```text
[ _AudioPlayerScreenState (Ticker) ]
  |-- fires at 120Hz
  |-- setState() changes amplitude
  v
[ CustomWaveformWidget (Element) ]
  |-- updateRenderObject()
  |-- passes new amplitude down
  v
[ RenderWaveform (RenderBox) ]
  |-- set amplitude triggers markNeedsPaint()
  |-- SKIPS Layout phase (Size didn't change)
  |-- paint() called by GPU pipeline
  |-- canvas.drawLine() drawn directly to screen
```

## Pro Tips for Production
- **CustomPainters vs RenderObjects:** A `CustomPainter` is actually just a wrapper around a `RenderCustomPaint` RenderObject. For 90% of canvas drawing, `CustomPainter` is fine. However, writing a raw `RenderBox` gives you ultimate control over layout sizing, hit testing (touch events on specific painted pixels), and avoiding wrapper overhead, which is required for AAA game-level optimizations.
- **markNeedsLayout vs markNeedsPaint:** If your audio visualizer suddenly grows taller, you must call `markNeedsLayout()`. This is expensive because it forces all parent widgets to re-calculate their sizes. Try to design canvas animations so they fit within a fixed bounding box, requiring only `markNeedsPaint()`.