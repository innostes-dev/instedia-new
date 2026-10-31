# Challenge 3: DOM Virtualization Feed (100k Items at 60 FPS)

## Problem Statement
You are building a social media feed. The API returns 100,000 posts. If you use `document.createElement` 100,000 times, the browser will freeze, crash, and the user's laptop fans will sound like a jet engine. The DOM cannot handle 100k nodes.

Build a simplified Virtualization Engine that:
1. Takes an array of 100,000 strings.
2. Only renders exactly 10 DOM elements at any given time.
3. As the user scrolls, it updates the `textContent` of those 10 existing elements based on the scroll position, creating the *illusion* of a massive list.

---

## The Solution Walkthrough

### 1. The Setup (HTML/CSS required for the illusion)
*(Conceptual setup)* You need a container with a fixed height (e.g., `500px`) and `overflow-y: auto`. Inside it, a "ghost" div that is exactly the height of all 100k items combined (e.g., `100,000 * 50px = 5,000,000px`). This forces the browser to draw a real scrollbar.

### 2. The JS Engine
We create a class that listens to the `scroll` event, calculates the current index, and mutates a small pool of DOM nodes.

```javascript
class VirtualList {
  constructor(containerId, dataArray, itemHeight = 50) {
    this.container = document.getElementById(containerId);
    this.data = dataArray;
    this.itemHeight = itemHeight;

    // We only render enough items to fill the screen + 2 buffer items
    this.visibleCount = Math.ceil(this.container.clientHeight / itemHeight) + 2;
    this.domPool = [];

    this.init();
  }

  init() {
    // 1. Create the Ghost Div for the scrollbar
    const totalHeight = this.data.length * this.itemHeight;
    const ghostElement = document.createElement("div");
    ghostElement.style.height = `${totalHeight}px`;
    ghostElement.style.width = "1px";
    this.container.appendChild(ghostElement);

    // 2. Create the Node Pool (Absolute positioned)
    for (let i = 0; i < this.visibleCount; i++) {
      const node = document.createElement("div");
      node.style.position = "absolute";
      node.style.height = `${this.itemHeight}px`;
      node.style.width = "100%";
      node.className = "feed-item";

      this.container.appendChild(node);
      this.domPool.push(node);
    }

    // 3. Attach Throttled/Fast Scroll Listener
    this.container.addEventListener("scroll", (e) => {
      // requestAnimationFrame is the ultimate throttle! It runs exactly at 60fps.
      window.requestAnimationFrame(() => this.render());
    });

    // Initial Render
    this.render();
  }

  render() {
    // Determine where we are in the scroll
    const scrollTop = this.container.scrollTop;

    // Calculate which index in our data array should be at the top
    const startIndex = Math.floor(scrollTop / this.itemHeight);

    // Loop through our limited pool of 10 nodes
    for (let i = 0; i < this.visibleCount; i++) {
      const node = this.domPool[i];
      const dataIndex = startIndex + i;

      if (dataIndex < this.data.length) {
        // Move the physical node down the screen to match the scroll
        const topPosition = dataIndex * this.itemHeight;
        node.style.transform = `translateY(${topPosition}px)`;

        // Update the text to match the new data
        node.textContent = this.data[dataIndex];
        node.style.display = "block";
      } else {
        node.style.display = "none";
      }
    }
  }
}
```

### 3. Usage
```javascript
// Generate 100k items instantly
const massiveData = Array.from({ length: 100000 }, (_, i) => `Post #${i}`);

// Initialize (Assuming <div id="feed" style="height: 500px; overflow: auto; position: relative;">)
// const feed = new VirtualList("feed", massiveData);
```

### Senior Engineer Takeaways
- **DOM Node Pooling:** We created exactly 12 `div` tags. We NEVER create or destroy another one. We just recycle them, changing their Y-position and text. This drops memory usage by 99.9%.
- **requestAnimationFrame:** Using this instead of `throttle()` or `debounce()` for scroll events guarantees the DOM updates in sync with the monitor's 60Hz refresh rate, preventing visual tearing.
