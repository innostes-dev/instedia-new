# Challenge 1: Zoneless High-Frequency Crypto Trading Terminal

## Architecture Overview
In this challenge, you will build a High-Frequency Crypto Trading Terminal using purely Zoneless Angular. Traditional Zone.js struggles with data feeds updating 60+ times a second (60FPS), leading to massive CPU overhead due to global dirty checking. By utilizing Signals, we ensure that only the exact text node representing a changing price is updated in the DOM.

## 1. Starter Template

```typescript
import { Component, OnInit } from '@angular/core';
import { CurrencyPipe, NgClass } from '@angular/common';

interface CryptoAsset {
  symbol: string;
  name: string;
  price: number;
  24hChange: number;
  trend: 'up' | 'down' | 'flat';
}

@Component({
  selector: 'app-trading-terminal',
  standalone: true,
  imports: [CurrencyPipe, NgClass],
  template: `
    <div class="terminal-container">
      <header>
        <h1>PRO-TRADE TERMINAL</h1>
        <div class="status">LIVE FEED <span class="dot pulse"></span></div>
      </header>

      <div class="asset-grid">
        <!-- TODO: Iterate over the assets signal here -->
        <!-- TODO: Apply green text if trend is 'up', red if 'down' -->
        <div class="asset-card">
          <div class="asset-header">
            <span class="symbol">BTC/USD</span>
            <span class="name">Bitcoin</span>
          </div>
          <div class="asset-price">
            $0.00
          </div>
          <div class="asset-change">
            0.00%
          </div>
        </div>
      </div>

      <div class="portfolio-summary">
        <h3>Portfolio Value</h3>
        <!-- TODO: Use a computed signal for Total Portfolio Value -->
        <div class="total-value">$0.00</div>
      </div>
    </div>
  `,
  styles: [`
    .terminal-container { font-family: 'Courier New', Courier, monospace; background: #000; color: #0f0; padding: 20px; min-height: 100vh; }
    header { display: flex; justify-content: space-between; align-items: center; border-bottom: 1px solid #333; padding-bottom: 10px; margin-bottom: 20px; }
    h1 { margin: 0; font-size: 1.5rem; color: #fff; }
    .status { color: #f00; font-weight: bold; display: flex; align-items: center; gap: 8px; }
    .dot { width: 10px; height: 10px; background: #f00; border-radius: 50%; display: inline-block; }
    .pulse { animation: pulse 1s infinite; }
    @keyframes pulse { 0% { opacity: 1; } 50% { opacity: 0.3; } 100% { opacity: 1; } }

    .asset-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(250px, 1fr)); gap: 15px; }
    .asset-card { background: #111; border: 1px solid #333; padding: 15px; border-radius: 4px; }
    .asset-header { display: flex; justify-content: space-between; margin-bottom: 10px; color: #888; }
    .symbol { font-weight: bold; color: #fff; }
    .asset-price { font-size: 2rem; font-weight: bold; text-align: right; margin-bottom: 5px; font-variant-numeric: tabular-nums; }
    .asset-change { text-align: right; font-size: 0.9rem; }

    .trend-up { color: #0f0; }
    .trend-down { color: #f00; }
    .trend-flat { color: #aaa; }

    .portfolio-summary { margin-top: 30px; border-top: 1px solid #333; padding-top: 20px; }
    .total-value { font-size: 3rem; font-weight: bold; color: #fff; }
  `]
})
export class TradingTerminalComponent implements OnInit {
  // TODO: Define a WritableSignal for the asset list.
  // Initial data: BTC ($64000), ETH ($3400), SOL ($140)

  // TODO: Define a WritableSignal for user holdings (e.g., { BTC: 0.5, ETH: 10, SOL: 50 })

  // TODO: Define a ComputedSignal that calculates Total Portfolio Value based on current prices and holdings.

  ngOnInit() {
    // TODO: Setup a setInterval (e.g., every 50ms) to simulate high-frequency price updates.
    // Update the asset signal array immutably.
    // Randomize the price slightly up or down, and update the 'trend' property accordingly.
  }
}
```

## 2. Production Solution & Walkthrough

### Step 1: Defining State with Signals
We define `assets` as a writable signal holding an array of `CryptoAsset`.
We define `holdings` as a writable signal holding a dictionary of quantities.
We define `portfolioValue` as a `computed()` signal. This is critical: it automatically re-evaluates *only* when `assets` or `holdings` changes.

### Step 2: High-Frequency Mutation
In `ngOnInit`, we use `setInterval` running at 50ms (20 updates per second). We use `.update()` on the `assets` signal. To ensure immutability, we map over the old array and return new object references for each asset. We calculate a random volatility factor to adjust the price up or down, and set the `trend` string to 'up' or 'down' so the UI can flash green or red.

### Step 3: Template Binding
We use the modern `@for` control flow block, binding directly to `assets()`. We *must* use `track asset.symbol` so Angular knows exactly which DOM nodes to update without destroying the whole list. We use `@if` or `[ngClass]` to apply CSS classes based on the `trend`.

### Complete Solution Code

```typescript
import { Component, OnInit, OnDestroy, signal, computed, effect } from '@angular/core';
import { CurrencyPipe, PercentPipe, NgClass } from '@angular/common';

interface CryptoAsset {
  symbol: string;
  name: string;
  price: number;
  dailyChange: number; // Percentage
  trend: 'up' | 'down' | 'flat';
}

@Component({
  selector: 'app-trading-terminal',
  standalone: true,
  imports: [CurrencyPipe, PercentPipe, NgClass],
  template: `
    <div class="terminal-container">
      <header>
        <h1>PRO-TRADE TERMINAL</h1>
        <div class="status">LIVE FEED <span class="dot pulse"></span></div>
      </header>

      <div class="asset-grid">
        @for (asset of assets(); track asset.symbol) {
          <div class="asset-card">
            <div class="asset-header">
              <span class="symbol">{{ asset.symbol }}</span>
              <span class="name">{{ asset.name }}</span>
            </div>
            <!-- Fine-grained DOM patching occurs right here -->
            <div class="asset-price"
                 [ngClass]="{'trend-up': asset.trend === 'up', 'trend-down': asset.trend === 'down', 'trend-flat': asset.trend === 'flat'}">
              {{ asset.price | currency:'USD':'symbol':'1.2-2' }}
            </div>
            <div class="asset-change"
                 [ngClass]="{'trend-up': asset.dailyChange > 0, 'trend-down': asset.dailyChange < 0}">
              {{ asset.dailyChange > 0 ? '+' : '' }}{{ asset.dailyChange / 100 | percent:'1.2-2' }}
            </div>
          </div>
        }
      </div>

      <div class="portfolio-summary">
        <h3>Portfolio Value</h3>
        <!-- Computed signal binding -->
        <div class="total-value">{{ portfolioValue() | currency:'USD' }}</div>
      </div>
    </div>
  `,
  styles: [`
    .terminal-container { font-family: 'Courier New', Courier, monospace; background: #000; color: #0f0; padding: 20px; min-height: 100vh; }
    header { display: flex; justify-content: space-between; align-items: center; border-bottom: 1px solid #333; padding-bottom: 10px; margin-bottom: 20px; }
    h1 { margin: 0; font-size: 1.5rem; color: #fff; }
    .status { color: #f00; font-weight: bold; display: flex; align-items: center; gap: 8px; }
    .dot { width: 10px; height: 10px; background: #f00; border-radius: 50%; display: inline-block; }
    .pulse { animation: pulse 1s infinite; }
    @keyframes pulse { 0% { opacity: 1; } 50% { opacity: 0.3; } 100% { opacity: 1; } }
    .asset-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(250px, 1fr)); gap: 15px; }
    .asset-card { background: #111; border: 1px solid #333; padding: 15px; border-radius: 4px; transition: border-color 0.1s; }
    .asset-header { display: flex; justify-content: space-between; margin-bottom: 10px; color: #888; }
    .symbol { font-weight: bold; color: #fff; }
    .asset-price { font-size: 2rem; font-weight: bold; text-align: right; margin-bottom: 5px; font-variant-numeric: tabular-nums; transition: color 0.1s; }
    .asset-change { text-align: right; font-size: 0.9rem; }
    .trend-up { color: #0f0; text-shadow: 0 0 5px rgba(0,255,0,0.3); }
    .trend-down { color: #f00; text-shadow: 0 0 5px rgba(255,0,0,0.3); }
    .trend-flat { color: #aaa; }
    .portfolio-summary { margin-top: 30px; border-top: 1px solid #333; padding-top: 20px; }
    .total-value { font-size: 3rem; font-weight: bold; color: #fff; text-shadow: 0 0 10px rgba(255,255,255,0.2); }
  `]
})
export class TradingTerminalComponent implements OnInit, OnDestroy {
  // 1. Core State
  assets = signal<CryptoAsset[]>([
    { symbol: 'BTC/USD', name: 'Bitcoin', price: 64200.50, dailyChange: 2.5, trend: 'flat' },
    { symbol: 'ETH/USD', name: 'Ethereum', price: 3450.25, dailyChange: -1.2, trend: 'flat' },
    { symbol: 'SOL/USD', name: 'Solana', price: 145.80, dailyChange: 5.8, trend: 'flat' },
    { symbol: 'ADA/USD', name: 'Cardano', price: 0.45, dailyChange: 0.1, trend: 'flat' }
  ]);

  holdings = signal<Record<string, number>>({
    'BTC/USD': 0.5,   // 0.5 BTC
    'ETH/USD': 10.0,  // 10 ETH
    'SOL/USD': 50.0,  // 50 SOL
    'ADA/USD': 0.0
  });

  // 2. Derived State (Cached & Reactively evaluated)
  portfolioValue = computed(() => {
    const currentAssets = this.assets();
    const currentHoldings = this.holdings();

    return currentAssets.reduce((total, asset) => {
      const amountHeld = currentHoldings[asset.symbol] || 0;
      return total + (asset.price * amountHeld);
    }, 0);
  });

  private feedInterval: any;

  ngOnInit() {
    // 3. High-Frequency Simulation (Runs outside Zone.js in a real zoneless setup)
    // Even if Zone.js is present, Signals ensure DOM patching is O(1) for the specific nodes.
    this.feedInterval = setInterval(() => {
      this.assets.update(currentList =>
        currentList.map(asset => {
          // Calculate a random volatility factor (-0.1% to +0.1% price swing)
          const volatility = (Math.random() * 0.002) - 0.001;
          const priceChange = asset.price * volatility;
          const newPrice = asset.price + priceChange;

          return {
            ...asset,
            price: newPrice,
            // Determine trend for UI flashing
            trend: priceChange > 0 ? 'up' : priceChange < 0 ? 'down' : 'flat',
            // Slightly adjust daily change
            dailyChange: asset.dailyChange + (volatility * 10)
          };
        })
      );
    }, 50); // 20 FPS updates
  }

  ngOnDestroy() {
    clearInterval(this.feedInterval);
  }
}
```
