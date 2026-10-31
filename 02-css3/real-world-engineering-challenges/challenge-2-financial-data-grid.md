# Challenge: Enterprise Data Grid with Sticky Headers & Subgrid

## Overview
Build a complex financial data table. The left column (Stock Ticker) and the top row (Headers) must remain pinned while scrolling. The data rows must perfectly align with the headers.

## Requirements
- Use CSS Grid for the main layout.
- Use `subgrid` for the rows to ensure columns align perfectly with the parent grid.
- Use `position: sticky` on both the column headers and the row headers (tickers).
- The top-left intersection (corner cell) must sit above both the scrolling rows and columns.

## Starting Code
```html
<div class="data-grid">
  <!-- Headers -->
  <div class="header corner">Ticker</div>
  <div class="header">Price</div>
  <div class="header">Volume</div>
  <div class="header">Change</div>

  <!-- Data Row -->
  <div class="row">
    <div class="cell sticky-col">AAPL</div>
    <div class="cell">150.00</div>
    <div class="cell">50M</div>
    <div class="cell">+1.5%</div>
  </div>
  <!-- More rows... -->
</div>
```

## Solution & Walkthrough
<details>
<summary>View Complete Solution</summary>

### The Approach
We set up a primary grid defining the columns. The rows themselves become grids that inherit those columns using `subgrid`. We apply `sticky` to the headers and the left column, using `z-index` to manage the stacking context.

### The Code
```css
.data-grid {
  display: grid;
  grid-template-columns: 120px repeat(3, 1fr);
  max-height: 400px;
  overflow: auto;
  position: relative;
}

.header {
  position: sticky;
  top: 0;
  background: #333;
  color: white;
  padding: 10px;
  z-index: 10; /* Above data */
}

.row {
  display: grid;
  grid-column: 1 / -1;
  grid-template-columns: subgrid; /* Inherit columns */
}

.cell {
  padding: 10px;
  border-bottom: 1px solid #ccc;
  background: white;
}

.sticky-col {
  position: sticky;
  left: 0;
  background: #f4f4f4;
  z-index: 5; /* Above scrolling data, below top header */
  font-weight: bold;
}

.header.corner {
  z-index: 20; /* Absolute highest */
  left: 0;
}
```
</details>
