# Challenge 5: SSR Hydrated E-Commerce Storefront

## Architecture Overview
In this challenge, you will build an E-Commerce Storefront that utilizes Modern SSR, Non-Destructive Hydration, and Event Replay. A critical requirement for e-commerce is Zero Cumulative Layout Shift (CLS) for SEO (especially for Art Direction on images). The initial HTML payload from the server must be structurally perfect. If a user clicks the "Add to Cart" button while the Angular JS bundles are still downloading, Event Replay must catch that click and process it once the app hydrates.

## 1. Starter Template

```typescript
import { Component, Inject, PLATFORM_ID, signal, OnInit } from '@angular/core';
import { isPlatformServer } from '@angular/common';

@Component({
  selector: 'app-ecommerce-storefront',
  standalone: true,
  template: `
    <div class="storefront">
      <header class="navbar">
        <div class="logo">NEXT-GEN TECH</div>

        <!-- TODO: Bind the cart count to a signal -->
        <div class="cart-icon">🛒 Cart (0)</div>
      </header>

      <main class="product-page">
        <!-- ZERO CLS IMAGE: The aspect ratio is strictly defined in CSS -->
        <div class="image-gallery">
          <div class="main-image-container">
            <!-- Simulated image placeholder -->
            <div class="img-placeholder">Product Image</div>
          </div>
        </div>

        <div class="product-details">
          <!-- TODO: Render product details dynamically from state (transferred from SSR) -->
          <h1>Loading Title...</h1>
          <p class="price">Loading Price...</p>

          <div class="description">
            <p>Loading description...</p>
          </div>

          <!-- TODO: Add click handler. Event Replay will catch this if clicked before JS loads! -->
          <button class="add-to-cart-btn">
            Add to Cart
          </button>
        </div>
      </main>
    </div>
  `,
  styles: [`
    .storefront { font-family: 'Inter', system-ui, sans-serif; }
    .navbar { display: flex; justify-content: space-between; padding: 1.5rem 2rem; background: #0f172a; color: white; }
    .logo { font-weight: 900; letter-spacing: 1px; }
    .cart-icon { font-weight: bold; background: #3b82f6; padding: 0.25rem 0.75rem; border-radius: 99px; }

    .product-page { max-width: 1200px; margin: 2rem auto; display: grid; grid-template-columns: 1fr 1fr; gap: 4rem; padding: 0 2rem; }

    /* Zero CLS Image Container */
    .main-image-container { aspect-ratio: 4 / 3; width: 100%; background: #f1f5f9; border-radius: 12px; overflow: hidden; display: flex; align-items: center; justify-content: center; border: 1px solid #e2e8f0; }
    .img-placeholder { color: #94a3b8; font-size: 1.5rem; font-weight: bold; }

    .product-details h1 { font-size: 2.5rem; margin-top: 0; color: #1e293b; }
    .price { font-size: 2rem; color: #16a34a; font-weight: bold; margin: 1rem 0; }
    .description { color: #475569; line-height: 1.6; margin-bottom: 2rem; }

    .add-to-cart-btn { width: 100%; padding: 1rem; background: #0f172a; color: white; border: none; border-radius: 8px; font-size: 1.1rem; font-weight: bold; cursor: pointer; transition: background 0.2s, transform 0.1s; }
    .add-to-cart-btn:hover { background: #1e293b; }
    .add-to-cart-btn:active { transform: scale(0.98); background: #3b82f6; }
  `]
})
export class EcommerceStorefrontComponent implements OnInit {
  // TODO: Define signals for product data and cart count

  // TODO: Inject TransferState and PLATFORM_ID

  ngOnInit() {
    // TODO: Implement TransferState logic.
    // Check if key exists. If yes, set signal.
    // If no, simulate a fetch (500ms delay), set signal, and write to TransferState if on Server.
  }

  // TODO: Implement addToCart method to increment the signal
}
```

## 2. Production Solution & Walkthrough

### Step 1: App Config (Event Replay)
Though not in the component file, the application *must* be bootstrapped with `provideClientHydration(withEventReplay())`. This ensures the DOM isn't destroyed, and the "Add to Cart" button works even during the JS download phase.

### Step 2: TransferState for Product Data
We define a `StateKey` called `PRODUCT_KEY`.
In `ngOnInit`, if the client hydrates and finds `PRODUCT_KEY` in the HTML, it instantly populates the `product` signal without an HTTP request.
If the Node.js server is rendering the page, it mocks a DB fetch, populates the signal, and writes to `TransferState` so it's serialized in the output HTML.

### Step 3: Hydration and State Interaction
We add an `addToCart` method that increments the `cartCount` signal. If a user clicks the button before hydration finishes, Angular's Event Replay script (which is a tiny inline script loaded instantly) records the `PointerEvent`. Once the main `main.js` bundle parses and hydration completes, Angular replays the event, triggering our `addToCart` method and updating the UI correctly.

### Complete Solution Code

```typescript
import { Component, Inject, PLATFORM_ID, signal, OnInit } from '@angular/core';
import { isPlatformServer, CurrencyPipe } from '@angular/common';
import { TransferState, makeStateKey } from '@angular/core';

interface Product {
  id: string;
  title: string;
  price: number;
  description: string;
}

const PRODUCT_KEY = makeStateKey<Product>('product-data');

@Component({
  selector: 'app-ecommerce-storefront',
  standalone: true,
  imports: [CurrencyPipe],
  template: `
    <div class="storefront">
      <header class="navbar">
        <div class="logo">NEXT-GEN TECH</div>
        <div class="cart-icon">🛒 Cart ({{ cartCount() }})</div>
      </header>

      <main class="product-page">
        <!-- Zero CLS logic handled purely by CSS aspect-ratio on container -->
        <div class="image-gallery">
          <div class="main-image-container">
            <div class="img-placeholder">High-Res Product Image</div>
          </div>
        </div>

        <div class="product-details">
          @if (product(); as p) {
            <h1>{{ p.title }}</h1>
            <p class="price">{{ p.price | currency }}</p>
            <div class="description">
              <p>{{ p.description }}</p>
            </div>
          } @else {
             <!-- SSR fallback skeleton -->
            <h1 style="background: #e2e8f0; color: transparent; width: 80%; border-radius: 4px;">Loading Title</h1>
            <p class="price" style="background: #e2e8f0; color: transparent; width: 40%; border-radius: 4px;">$00.00</p>
          }

          <!--
            EVENT REPLAY MAGIC:
            If you throttle your network to Slow 3G in DevTools and click this button
            BEFORE the Angular bundle finishes downloading, the click is saved.
            Once Angular hydrates, the cart count will immediately update!
          -->
          <button class="add-to-cart-btn" (click)="addToCart()">
            Add to Cart
          </button>
        </div>
      </main>
    </div>
  `,
  styles: [`
    .storefront { font-family: 'Inter', system-ui, sans-serif; }
    .navbar { display: flex; justify-content: space-between; padding: 1.5rem 2rem; background: #0f172a; color: white; }
    .logo { font-weight: 900; letter-spacing: 1px; }
    .cart-icon { font-weight: bold; background: #3b82f6; padding: 0.25rem 0.75rem; border-radius: 99px; transition: transform 0.2s; }
    .pop { transform: scale(1.2); }

    .product-page { max-width: 1200px; margin: 2rem auto; display: grid; grid-template-columns: 1fr 1fr; gap: 4rem; padding: 0 2rem; }

    /* Zero CLS Image Container */
    .main-image-container { aspect-ratio: 4 / 3; width: 100%; background: #f1f5f9; border-radius: 12px; overflow: hidden; display: flex; align-items: center; justify-content: center; border: 1px solid #e2e8f0; }
    .img-placeholder { color: #94a3b8; font-size: 1.5rem; font-weight: bold; }

    .product-details h1 { font-size: 2.5rem; margin-top: 0; color: #1e293b; line-height: 1.2; }
    .price { font-size: 2rem; color: #16a34a; font-weight: bold; margin: 1rem 0; }
    .description { color: #475569; line-height: 1.6; margin-bottom: 2rem; }

    .add-to-cart-btn { width: 100%; padding: 1rem; background: #0f172a; color: white; border: none; border-radius: 8px; font-size: 1.1rem; font-weight: bold; cursor: pointer; transition: background 0.2s, transform 0.1s; }
    .add-to-cart-btn:hover { background: #1e293b; }
    .add-to-cart-btn:active { transform: scale(0.98); background: #3b82f6; }

    @media (max-width: 768px) {
      .product-page { grid-template-columns: 1fr; gap: 2rem; }
    }
  `]
})
export class EcommerceStorefrontComponent implements OnInit {
  product = signal<Product | null>(null);
  cartCount = signal<number>(0);

  constructor(
    @Inject(PLATFORM_ID) private platformId: Object,
    private transferState: TransferState
  ) {}

  ngOnInit() {
    if (this.transferState.hasKey(PRODUCT_KEY)) {
      // 1. Client Hydration: Read from HTML Cache
      console.log('Hydrating from TransferState cache!');
      this.product.set(this.transferState.get(PRODUCT_KEY, null));
      this.transferState.remove(PRODUCT_KEY); // Clean up memory
    } else {
      // 2. Server (or Client Navigation): Fetch Data
      this.fetchProductData();
    }
  }

  fetchProductData() {
    // Simulate DB read
    setTimeout(() => {
      const data: Product = {
        id: 'prod_99X',
        title: 'Quantum Ergonomic Developer Keyboard',
        price: 249.99,
        description: 'Engineered for 10x developers. Features ultra-tactile optical switches, a split ergonomic design, and full RGB customization. Say goodbye to carpal tunnel and hello to 200 WPM.'
      };

      this.product.set(data);

      if (isPlatformServer(this.platformId)) {
        // Serialize to HTML so the browser doesn't refetch
        this.transferState.set(PRODUCT_KEY, data);
      }
    }, 400); // Simulated latency
  }

  addToCart() {
    // Reactive update
    this.cartCount.update(c => c + 1);
    console.log('Added to cart! Total:', this.cartCount());

    // (Optional) You could also run an effect to sync this cart count to localStorage
  }
}
```
