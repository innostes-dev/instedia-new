# Challenge 2: Sub-Second LCP Enterprise Analytics Dashboard

## Architecture Overview
In an Enterprise Business Intelligence (BI) Dashboard, loading heavy charting libraries immediately blocks the main thread, resulting in a poor Largest Contentful Paint (LCP) score. In this challenge, you will implement hierarchical Deferrable Views (`@defer`). Critical "above-the-fold" KPIs must load instantly. Secondary charts should load `on viewport`. Heavy data tables hidden behind tabs should `prefetch on idle` but only render `on interaction`.

## 1. Starter Template

```typescript
import { Component } from '@angular/core';

// --- Heavy Mock Components (Assume these are massive chunks) ---
@Component({ selector: 'app-heavy-bar-chart', standalone: true, template: `<div class="box chart-box">📊 D3.js Bar Chart Loaded</div>`, styles: ['.box { padding: 40px; border-radius: 8px; text-align: center; font-weight: bold; }', '.chart-box { background: #e0f2fe; color: #0284c7; border: 2px solid #7dd3fc; }'] })
export class HeavyBarChartComponent {}

@Component({ selector: 'app-heavy-pie-chart', standalone: true, template: `<div class="box chart-box">🥧 Highcharts Pie Chart Loaded</div>`, styles: ['.box { padding: 40px; border-radius: 8px; text-align: center; font-weight: bold; }', '.chart-box { background: #e0f2fe; color: #0284c7; border: 2px solid #7dd3fc; }'] })
export class HeavyPieChartComponent {}

@Component({ selector: 'app-massive-data-grid', standalone: true, template: `<div class="box grid-box">📋 AG-Grid 100k Rows Loaded</div>`, styles: ['.box { padding: 40px; border-radius: 8px; text-align: center; font-weight: bold; }', '.grid-box { background: #fce7f3; color: #db2777; border: 2px solid #f9a8d4; }'] })
export class MassiveDataGridComponent {}
// ---------------------------------------------------------------

@Component({
  selector: 'app-bi-dashboard',
  standalone: true,
  imports: [HeavyBarChartComponent, HeavyPieChartComponent, MassiveDataGridComponent],
  template: `
    <div class="dashboard-container">
      <header>
        <h1>Enterprise BI Analytics</h1>
      </header>

      <!-- INSTANT LOAD: KPIs -->
      <section class="kpi-section">
        <div class="kpi-card">Total Revenue: $4.2M</div>
        <div class="kpi-card">Active Users: 12.4K</div>
        <div class="kpi-card">Conversion: 3.2%</div>
      </section>

      <div class="scroll-spacer">↓ Scroll Down for Charts ↓</div>

      <!-- TODO: Implement @defer (on viewport) for these charts -->
      <!-- Show a @placeholder for both -->
      <!-- Show @loading with a minimum of 1s to prevent flicker -->
      <section class="charts-section">
        <h2>Regional Performance</h2>
        <app-heavy-bar-chart />

        <h2>Demographics</h2>
        <app-heavy-pie-chart />
      </section>

      <!-- TODO: Implement @defer (on interaction) for the Data Grid -->
      <!-- It should trigger when the button below is clicked -->
      <!-- It should also prefetch on idle -->
      <section class="data-section">
        <h2>Raw Data Export</h2>
        <button class="btn">Load Data Grid</button>

        <app-massive-data-grid />
      </section>

    </div>
  `,
  styles: [`
    .dashboard-container { font-family: system-ui, -apple-system, sans-serif; max-width: 900px; margin: 0 auto; padding: 20px; }
    header h1 { font-size: 1.8rem; color: #1e293b; border-bottom: 2px solid #e2e8f0; padding-bottom: 10px; }
    .kpi-section { display: flex; gap: 20px; margin-bottom: 20px; }
    .kpi-card { flex: 1; background: #1e293b; color: white; padding: 20px; border-radius: 8px; font-weight: bold; font-size: 1.2rem; text-align: center; box-shadow: 0 4px 6px rgba(0,0,0,0.1); }
    .scroll-spacer { height: 80vh; display: flex; align-items: center; justify-content: center; color: #64748b; font-style: italic; background: #f8fafc; margin: 40px 0; border: 1px dashed #cbd5e1; border-radius: 8px; }
    .charts-section { display: grid; gap: 30px; margin-bottom: 60px; }
    .charts-section h2, .data-section h2 { font-size: 1.4rem; color: #334155; margin-bottom: 15px; }
    .btn { padding: 10px 20px; background: #3b82f6; color: white; border: none; border-radius: 6px; font-size: 1rem; cursor: pointer; transition: background 0.2s; margin-bottom: 20px; }
    .btn:hover { background: #2563eb; }

    /* Utility classes for your placeholders */
    .placeholder-box { height: 120px; border: 2px dashed #cbd5e1; border-radius: 8px; display: flex; align-items: center; justify-content: center; color: #64748b; background: #f8fafc; }
    .loading-box { height: 120px; border: 2px solid #fbbf24; border-radius: 8px; display: flex; align-items: center; justify-content: center; color: #b45309; background: #fef3c7; }
  `]
})
export class BiDashboardComponent {}
```

## 2. Production Solution & Walkthrough

### Step 1: Deferring Viewport Content
We wrap `<app-heavy-bar-chart>` and `<app-heavy-pie-chart>` in `@defer (on viewport)`. When the user scrolls down and the placeholder enters the viewport, Angular automatically fetches the JS chunks for these components. We provide `@placeholder` blocks to reserve the vertical space and prevent layout shifts. We add `@loading (minimum 1s)` to ensure that if the network is fast, the loading indicator doesn't flash on screen for a microsecond.

### Step 2: Prefetching Interactive Content
For the `<app-massive-data-grid>`, we don't want it to load automatically when scrolling, as it's a massive table the user might not need. However, we *do* want it to render instantly if they click the button.
We add a template reference variable `#gridBtn` to the button.
We configure the defer block as `@defer (on interaction(gridBtn); prefetch on idle)`.
This instructs Angular to silently download the JS chunk in the background while the browser is idle, but delay rendering the component until the button is clicked.

### Complete Solution Code

```typescript
import { Component } from '@angular/core';

// --- Heavy Mock Components ---
@Component({ selector: 'app-heavy-bar-chart', standalone: true, template: `<div class="box chart-box">📊 D3.js Bar Chart Loaded</div>`, styles: ['.box { padding: 40px; border-radius: 8px; text-align: center; font-weight: bold; }', '.chart-box { background: #e0f2fe; color: #0284c7; border: 2px solid #7dd3fc; }'] })
export class HeavyBarChartComponent {}

@Component({ selector: 'app-heavy-pie-chart', standalone: true, template: `<div class="box chart-box">🥧 Highcharts Pie Chart Loaded</div>`, styles: ['.box { padding: 40px; border-radius: 8px; text-align: center; font-weight: bold; }', '.chart-box { background: #e0f2fe; color: #0284c7; border: 2px solid #7dd3fc; }'] })
export class HeavyPieChartComponent {}

@Component({ selector: 'app-massive-data-grid', standalone: true, template: `<div class="box grid-box">📋 AG-Grid 100k Rows Loaded</div>`, styles: ['.box { padding: 40px; border-radius: 8px; text-align: center; font-weight: bold; }', '.grid-box { background: #fce7f3; color: #db2777; border: 2px solid #f9a8d4; }'] })
export class MassiveDataGridComponent {}
// ------------------------------

@Component({
  selector: 'app-bi-dashboard',
  standalone: true,
  imports: [HeavyBarChartComponent, HeavyPieChartComponent, MassiveDataGridComponent],
  template: `
    <div class="dashboard-container">
      <header>
        <h1>Enterprise BI Analytics</h1>
      </header>

      <!-- INSTANT LOAD: KPIs (LCP is determined here) -->
      <section class="kpi-section">
        <div class="kpi-card">Total Revenue: $4.2M</div>
        <div class="kpi-card">Active Users: 12.4K</div>
        <div class="kpi-card">Conversion: 3.2%</div>
      </section>

      <div class="scroll-spacer">↓ Scroll Down for Charts ↓</div>

      <section class="charts-section">
        <h2>Regional Performance</h2>

        <!-- DEFER: Triggered when placeholder enters viewport -->
        @defer (on viewport) {
          <app-heavy-bar-chart />
        } @placeholder {
          <div class="placeholder-box">Bar Chart Area (Awaiting scroll)</div>
        } @loading (minimum 1s) {
          <div class="loading-box">🔄 Loading D3.js modules...</div>
        }

        <h2>Demographics</h2>
        @defer (on viewport) {
          <app-heavy-pie-chart />
        } @placeholder {
          <div class="placeholder-box">Pie Chart Area (Awaiting scroll)</div>
        } @loading (minimum 1s) {
          <div class="loading-box">🔄 Loading Highcharts modules...</div>
        }
      </section>

      <section class="data-section">
        <h2>Raw Data Export</h2>
        <!-- Template reference variable for interaction tracking -->
        <button #gridBtn class="btn">Load Data Grid</button>

        <!-- DEFER: Render on click. Download JS chunk on browser idle. -->
        @defer (on interaction(gridBtn); prefetch on idle) {
          <app-massive-data-grid />
        } @placeholder {
          <div class="placeholder-box">Data Grid (Hidden to save memory)</div>
        } @error {
          <div class="error-box">Failed to load AG-Grid module. Please check network.</div>
        }
      </section>

    </div>
  `,
  styles: [`
    .dashboard-container { font-family: system-ui, -apple-system, sans-serif; max-width: 900px; margin: 0 auto; padding: 20px; }
    header h1 { font-size: 1.8rem; color: #1e293b; border-bottom: 2px solid #e2e8f0; padding-bottom: 10px; }
    .kpi-section { display: flex; gap: 20px; margin-bottom: 20px; }
    .kpi-card { flex: 1; background: #1e293b; color: white; padding: 20px; border-radius: 8px; font-weight: bold; font-size: 1.2rem; text-align: center; box-shadow: 0 4px 6px rgba(0,0,0,0.1); }
    .scroll-spacer { height: 800px; display: flex; align-items: center; justify-content: center; color: #64748b; font-style: italic; background: #f8fafc; margin: 40px 0; border: 1px dashed #cbd5e1; border-radius: 8px; }
    .charts-section { display: grid; gap: 30px; margin-bottom: 60px; }
    .charts-section h2, .data-section h2 { font-size: 1.4rem; color: #334155; margin-bottom: 15px; }
    .btn { padding: 10px 20px; background: #3b82f6; color: white; border: none; border-radius: 6px; font-size: 1rem; cursor: pointer; transition: background 0.2s; margin-bottom: 20px; }
    .btn:hover { background: #2563eb; }

    .placeholder-box { height: 120px; border: 2px dashed #cbd5e1; border-radius: 8px; display: flex; align-items: center; justify-content: center; color: #64748b; background: #f8fafc; }
    .loading-box { height: 120px; border: 2px solid #fbbf24; border-radius: 8px; display: flex; align-items: center; justify-content: center; color: #b45309; background: #fef3c7; }
    .error-box { height: 120px; border: 2px solid #ef4444; border-radius: 8px; display: flex; align-items: center; justify-content: center; color: #991b1b; background: #fee2e2; }
  `]
})
export class BiDashboardComponent {}
```
