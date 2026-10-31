# Real-World Engineering Challenge: 100,000-Item Virtualized High-Speed Catalog

## Context & Architecture
You are tasked with building the frontend for a massive e-commerce wholesale distributor. The user must be able to scroll through a catalog of 100,000 items on a single page. Rendering 100,000 DOM elements simultaneously will immediately crash the browser or cause severe scroll lag.
You must implement a **Virtual Scroller**. A virtual scroller calculates which items are currently visible in the viewport and only renders those specific DOM elements (plus a small buffer). As the user scrolls, it re-uses the existing DOM nodes and swaps out the data, creating the illusion of an infinite list while maintaining a DOM size of only ~20 elements.

## Specifications
1. Create a `useVirtualScroll` composable.
2. The composable must track the scroll container's `scrollTop` to calculate the `startIndex` and `endIndex` of the visible items.
3. Calculate the total height of the container to render a "ghost" div that maintains the correct scrollbar size.
4. Implement a `ResizeObserver` to automatically recalculate visible items if the container size changes.

## Starter Template

```vue
<!-- App.vue -->
<template>
  <div class="app">
    <h1>Wholesale Catalog ({{ items.length }} Items)</h1>

    <!-- Implement your virtual scroller here -->
    <div class="scroll-container" ref="containerRef" @scroll="onScroll">
      <!-- Ghost div for scroll height -->
      <div :style="{ height: totalHeight + 'px' }" class="spacer"></div>

      <!-- Visible items -->
      <div
        class="viewport"
        :style="{ transform: `translateY(${offsetY}px)` }"
      >
        <div v-for="item in visibleItems" :key="item.id" class="item">
          <strong>{{ item.name }}</strong> - ${{ item.price }}
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, computed } from 'vue';
// TODO: Import and use your useVirtualScroll composable

// Generate 100k items
const items = ref(Array.from({ length: 100000 }, (_, i) => ({
  id: i,
  name: `Wholesale Item ${i}`,
  price: (Math.random() * 100).toFixed(2)
})));

const ITEM_HEIGHT = 40; // Fixed height for simplicity
const containerRef = ref(null);

// TODO: Implement logic to calculate visibleItems, totalHeight, and offsetY
</script>

<style scoped>
.scroll-container {
  height: 500px;
  overflow-y: auto;
  border: 1px solid #ccc;
  position: relative;
}
.viewport {
  position: absolute;
  top: 0;
  left: 0;
  width: 100%;
}
.item {
  height: 40px; /* Must match ITEM_HEIGHT */
  display: flex;
  align-items: center;
  padding: 0 10px;
  border-bottom: 1px solid #eee;
  box-sizing: border-box;
}
</style>
```

---

## Production Solution Walkthrough

### 1. The Composable (`composables/useVirtualScroll.js`)
We extract the complex math into a reusable Vue 3 composable.

```javascript
import { ref, computed, onMounted, onUnmounted } from 'vue';

export function useVirtualScroll(itemsRef, itemHeight, containerRef) {
  const scrollTop = ref(0);
  const containerHeight = ref(500); // Default fallback

  // ResizeObserver to detect if the container height changes dynamically
  let observer = null;

  onMounted(() => {
    if (containerRef.value) {
      observer = new ResizeObserver((entries) => {
        for (let entry of entries) {
          containerHeight.value = entry.contentRect.height;
        }
      });
      observer.observe(containerRef.value);
    }
  });

  onUnmounted(() => {
    if (observer) observer.disconnect();
  });

  // Calculate the total required height for the scrollbar to be accurate
  const totalHeight = computed(() => itemsRef.value.length * itemHeight);

  // How many items can physically fit in the current view?
  const visibleCount = computed(() => Math.ceil(containerHeight.value / itemHeight));

  // Determine indices based on scroll position
  const startIndex = computed(() => Math.floor(scrollTop.value / itemHeight));

  // Add a buffer of 5 items so scrolling doesn't show white flashes
  const endIndex = computed(() => Math.min(
    itemsRef.value.length - 1,
    startIndex.value + visibleCount.value + 5
  ));

  // The slice of the massive array that we will actually render
  const visibleItems = computed(() => {
    // Start slightly early for the top buffer
    const start = Math.max(0, startIndex.value - 2);
    return itemsRef.value.slice(start, endIndex.value + 1);
  });

  // Offset the visible block down the container so it aligns with the scrollbar
  const offsetY = computed(() => {
    const start = Math.max(0, startIndex.value - 2);
    return start * itemHeight;
  });

  // Event handler to attach to the @scroll event on the container
  const onScroll = (event) => {
    scrollTop.value = event.target.scrollTop;
  };

  return {
    visibleItems,
    totalHeight,
    offsetY,
    onScroll
  };
}
```

### 2. The Consumer Component Implementation

```vue
<script setup>
import { ref } from 'vue';
import { useVirtualScroll } from './composables/useVirtualScroll';

const items = ref(Array.from({ length: 100000 }, (_, i) => ({
  id: i,
  name: `Wholesale Item ${i}`,
  price: (Math.random() * 100).toFixed(2)
})));

const ITEM_HEIGHT = 40;
const containerRef = ref(null);

// Consume the composable, passing in our refs
const {
  visibleItems,
  totalHeight,
  offsetY,
  onScroll
} = useVirtualScroll(items, ITEM_HEIGHT, containerRef);
</script>
```

### Key Takeaways
* **`ResizeObserver` inside `onMounted`**: By placing the observer in the lifecycle hook, the composable becomes self-managing. It cleans up after itself in `onUnmounted` to prevent memory leaks.
* **Math over Rendering**: Vue handles 100,000 array calculations in memory instantly. The bottleneck is DOM nodes. We use computed properties to map array math to the `scrollTop` value, ensuring Vue only ever mounts ~15-20 nodes.
* **`offsetY` via CSS Transform**: Instead of dealing with complex CSS positioning, we wrap the visible items in a `.viewport` div and apply `transform: translateY()`. The GPU handles this, resulting in buttery 60fps scrolling even while JS runs the math.
