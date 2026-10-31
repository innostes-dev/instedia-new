# Challenge: Multi-Brand Design Token Theme Architecture

## Overview
Build a robust CSS architecture for a white-label dashboard used by multiple brands. Manage base styles, brand overrides, and a dark mode matrix.

## Requirements
- Define base CSS Custom properties.
- Create data attributes for `[data-brand='acme']` and `[data-brand='globex']`.
- Implement a `[data-theme='dark']` modifier that recalculates colors based on the current brand.

## Starting Code
```html
<html data-brand="acme" data-theme="light">
<body>
  <nav class="navbar">Dashboard</nav>
  <button class="primary-btn">Action</button>
</body>
</html>
```

## Solution & Walkthrough
<details>
<summary>View Complete Solution</summary>

### The Approach
We use layered custom properties. We define abstract functional tokens (`--nav-bg`) and map them to brand-specific primitives. When the theme or brand changes, we only swap the primitive mapping, and the rest of the UI automatically responds.

### The Code
```css
/* 1. Base Structure & Token Mapping */
:root {
  /* Default Brand (Acme Light) */
  --brand-primary: #0052cc;
  --surface-color: #ffffff;
  --text-main: #172b4d;

  /* Functional Tokens mapping to Brand */
  --nav-bg: var(--brand-primary);
  --btn-bg: var(--brand-primary);
  --bg-color: var(--surface-color);
}

/* 2. Apply Functional Tokens to Components */
body {
  background: var(--bg-color);
  color: var(--text-main);
}
.navbar { background: var(--nav-bg); color: white; }
.primary-btn { background: var(--btn-bg); color: white; border: none; }

/* 3. Brand Matrix Overrides */

/* Globex Brand */
[data-brand="globex"] {
  --brand-primary: #e63946; /* Red instead of Blue */
}

/* 4. Theme Matrix Overrides */

/* Dark Mode Generic */
[data-theme="dark"] {
  --surface-color: #121212;
  --text-main: #e0e0e0;
}

/* Dark Mode Brand Specific Adjustments */
[data-theme="dark"][data-brand="acme"] {
  --brand-primary: #4c9aff; /* Lighter blue for dark mode contrast */
}
[data-theme="dark"][data-brand="globex"] {
  --brand-primary: #ff8fa3; /* Lighter red for dark mode contrast */
}
```
</details>
