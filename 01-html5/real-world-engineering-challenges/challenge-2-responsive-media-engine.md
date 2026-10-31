# Challenge 2: Responsive Media Engine

## The Engineering Scenario
You are a Principal Frontend Engineer for Apple's e-commerce site. The launch page for the new "MacBook Pro" is destroying users' data plans on 3G networks. The main hero image is a 5MB desktop-sized PNG that is being forced onto tiny iPhone screens. Furthermore, the layout shifts violently when the image finally loads, pushing the "Buy Now" button off the screen.
Your task is to build a hyper-optimized, responsive media engine using the `<picture>` element to serve perfect art direction and modern image formats, while achieving a score of zero Cumulative Layout Shift (CLS).

## Acceptance Criteria
- Use the `<picture>` element to serve multiple formats and sizes.
- If the screen is `1024px` or wider, serve `macbook-wide.avif` (fallback to `macbook-wide.webp`).
- If the screen is smaller, default to `macbook-tall.jpg`.
- The fallback `<img>` must include `width` and `height` attributes to reserve space and prevent layout shift.
- The fallback `<img>` must have high-priority fetching since it is a hero image above the fold.
- The `<img>` must have highly descriptive `alt` text.

---

## Starter Code
```html
<!-- Refactor this single, un-optimized image into an Art Direction masterpiece -->
<div class="hero">
  <h1>New MacBook Pro</h1>
  <img src="macbook-huge.png">
  <button>Buy Now</button>
</div>
```

---

## Production Solution Walkthrough

<details>
<summary>View the Principal-Level Solution</summary>

```html
<section class="hero-section">
  <h1>New MacBook Pro</h1>

  <!-- The Picture Engine -->
  <picture>
    <!-- Desktop Art Direction + Next-Gen Formats -->
    <source media="(min-width: 1024px)" type="image/avif" srcset="assets/macbook-wide.avif">
    <source media="(min-width: 1024px)" type="image/webp" srcset="assets/macbook-wide.webp">

    <!-- We don't need a media query for mobile, because the img tag below acts as the default! -->

    <!-- The Core Image Element -->
    <img
      src="assets/macbook-tall.jpg"
      alt="A sleek silver MacBook Pro slightly open, displaying a colorful abstract wallpaper"
      width="400"
      height="800"
      fetchpriority="high"
    >
  </picture>

  <a href="/checkout" class="btn-primary">Buy Now</a>
</section>
```

### Why this is production-grade:
1. **Zero CLS:** By providing `width="400"` and `height="800"` on the fallback image, the browser calculates the aspect ratio instantly and reserves a physical box on the screen before the image downloads. The text below it will never jump.
2. **Bandwidth Savings:** A mobile device on a 3G network will completely ignore the massive AVIF and WebP desktop files. It will only download the small `macbook-tall.jpg`, saving megabytes of data and battery life.
3. **Format Fallbacks:** If a modern desktop browser visits, it gets the ultra-compressed AVIF. If an older desktop browser (that doesn't support AVIF) visits, it falls back to WebP.
4. **Performance:** `fetchpriority="high"` tells the browser's networking thread to download this specific asset before downloading other less critical scripts or images.
</details>
