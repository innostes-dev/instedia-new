# Challenge: Zero-JS Interactive Component Engine

## Overview
Create a fully functional expanding accordion/pricing selector without a single line of JavaScript using the `:has()` selector.

## Requirements
- When a radio button is selected, its parent `.plan-card` must gain a thick blue border and elevate.
- When a checkbox for 'yearly billing' is toggled anywhere in the form, all prices in the cards should switch from monthly to yearly display.
- No JavaScript allowed.

## Starting Code
```html
<form class="pricing-engine">
  <label class="billing-toggle">
    <input type="checkbox" class="yearly-check" />
    Bill Yearly (Save 20%)
  </label>

  <div class="plans">
    <label class="plan-card">
      <input type="radio" name="plan" class="plan-radio" />
      <h3>Pro</h3>
      <span class="price-monthly">$10/mo</span>
      <span class="price-yearly">$100/yr</span>
    </label>
  </div>
</form>
```

## Solution & Walkthrough
<details>
<summary>View Complete Solution</summary>

### The Approach
We use `:has(:checked)` to apply styles up the DOM tree. If the card has a checked radio, we style the card. If the entire form has a checked billing toggle, we hide the monthly prices and show the yearly prices.

### The Code
```css
/* Base Card Styles */
.plan-card {
  display: block;
  border: 2px solid #ccc;
  padding: 20px;
  border-radius: 8px;
  transition: all 0.3s ease;
  cursor: pointer;
}

/* Base Price Display */
.price-yearly { display: none; }
.price-monthly { display: block; }

/* 1. Card Selection Logic via :has */
.plan-card:has(.plan-radio:checked) {
  border-color: blue;
  background: #f0f8ff;
  transform: translateY(-4px);
  box-shadow: 0 10px 20px rgba(0,0,255,0.1);
}

/* 2. Global Billing Toggle Logic via :has on parent */
.pricing-engine:has(.yearly-check:checked) .price-monthly {
  display: none;
}
.pricing-engine:has(.yearly-check:checked) .price-yearly {
  display: block;
  color: green;
  font-weight: bold;
}
```
</details>
