# Challenge: Fluid Mathematical Typography Engine

## Overview
You are tasked with building a typography system for a news publication. The font sizes must smoothly scale between mobile and desktop without using a single media query.

## Requirements
- H1 must scale between 2rem and 4rem.
- Body text must scale between 1rem and 1.25rem.
- Container padding must scale between 1rem and 3rem.
- Must use the `clamp()` function exclusively for scaling.

## Starting Code
```html
<main class="article-container">
  <h1 class="headline">Breaking News: CSS is Awesome</h1>
  <p class="body-text">This is a paragraph that will perfectly adapt to any screen size.</p>
</main>
```

## Solution & Walkthrough
<details>
<summary>View Complete Solution</summary>

### The Approach
We use CSS Custom Properties to define our clamp values, keeping the logic centralized. `clamp(MIN, IDEAL, MAX)` uses viewport widths (vw) for the ideal value to drive the fluid scaling.

### The Code
```css
:root {
  /* Fluid Typographic Scale */
  --fs-h1: clamp(2rem, 5vw + 1rem, 4rem);
  --fs-body: clamp(1rem, 1vw + 0.5rem, 1.25rem);
  --space-container: clamp(1rem, 5vw, 3rem);
}

.article-container {
  padding: var(--space-container);
  max-width: 800px;
  margin: 0 auto;
}

.headline {
  font-size: var(--fs-h1);
  line-height: 1.1;
  margin-bottom: 1em;
}

.body-text {
  font-size: var(--fs-body);
  line-height: 1.6;
}
```
</details>
