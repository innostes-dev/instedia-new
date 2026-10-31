# Challenge: 60 FPS GPU Micro-Interactions

## Overview
Create a highly performant 'Add to Cart' button interaction. On click, it shrinks slightly, then fires off a particle that flies into a cart icon.

## Requirements
- Must achieve 60fps by ONLY animating `transform` and `opacity`.
- The button must depress on `:active`.
- Use CSS animations (`@keyframes`) for a dot that appears and translates to the cart.

## Starting Code
```html
<div class="shop-ui">
  <button class="add-btn">Add to Cart</button>
  <div class="particle"></div>
  <div class="cart-icon">🛒</div>
</div>
```

## Solution & Walkthrough
<details>
<summary>View Complete Solution</summary>

### The Approach
We isolate all movement to the GPU. The button scales down on `:active`. The particle animation uses an absolute position and keyframes to translate across the screen, avoiding any layout repaints.

### The Code
```css
.shop-ui { position: relative; }

.add-btn {
  padding: 12px 24px;
  background: #000; color: #fff;
  border: none; border-radius: 4px;
  transition: transform 0.1s cubic-bezier(0.4, 0, 0.2, 1);
}

/* GPU Button Press */
.add-btn:active {
  transform: scale(0.95);
}

.particle {
  position: absolute;
  width: 10px; height: 10px;
  background: red;
  border-radius: 50%;
  top: 15px; left: 50px;
  opacity: 0;
  pointer-events: none;
}

/* Trigger animation on button click via :has (or via JS class add in prod) */
.shop-ui:has(.add-btn:active) .particle {
  animation: flyToCart 0.6s cubic-bezier(0.2, 1, 0.3, 1) forwards;
}

@keyframes flyToCart {
  0% {
    opacity: 1;
    transform: translate(0, 0) scale(1);
  }
  100% {
    opacity: 0;
    /* Cart is roughly 200px right, 50px up */
    transform: translate(200px, -50px) scale(0.5);
  }
}
```
</details>
