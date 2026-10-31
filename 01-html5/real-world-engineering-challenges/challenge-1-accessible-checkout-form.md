# Challenge 1: Accessible Checkout Form

## The Engineering Scenario
You are a Principal Frontend Engineer at Stripe. A large FinTech client is experiencing massive drop-off rates on their mobile checkout page. Users complain the form is frustrating to use on phones, doesn't validate data correctly, and visually impaired users are completely blocked from purchasing.
Your task is to refactor their checkout form using strict semantic HTML5, zero-JS native validation, and optimal mobile keyboard triggers.

## Acceptance Criteria
- Must be a `<form>` submitting via POST.
- Must logically group "Billing Details" and "Payment Details" using `<fieldset>` and `<legend>`.
- All inputs MUST have heavily linked `<label>` tags.
- Email input must trigger the mobile email keyboard and validate native email format.
- Credit Card input must be grouped logically. It must trigger the numeric keyboard (`inputmode`), but not use `type="number"` (to avoid spinners).
- CVV must obscure input like a password, trigger the numeric keyboard, and use a Regex `pattern` to enforce exactly 3 or 4 digits.
- Must include a `required` checkbox for "Terms and Conditions".

---

## Starter Code
```html
<!-- Refactor this awful Div Soup into a masterpiece -->
<div class="checkout">
  <div>Billing</div>
  <div>Name: <input type="text"></div>
  <div>Email: <input type="text"></div>

  <div>Payment</div>
  <div>Card: <input type="text"></div>
  <div>CVV: <input type="text"></div>

  <div><input type="checkbox"> I agree to terms</div>
  <button>Buy</button>
</div>
```

---

## Production Solution Walkthrough

<details>
<summary>View the Principal-Level Solution</summary>

```html
<form action="/process-payment" method="POST">

  <!-- Group 1: Billing -->
  <fieldset>
    <legend>Billing Details</legend>

    <div class="form-group">
      <label for="billing-name">Full Name</label>
      <input type="text" id="billing-name" name="fullName" required minlength="2">
    </div>

    <div class="form-group">
      <label for="billing-email">Email Address</label>
      <!-- type="email" ensures the '@' key appears on mobile and natively validates format -->
      <input type="email" id="billing-email" name="email" required>
    </div>
  </fieldset>

  <!-- Group 2: Payment -->
  <fieldset>
    <legend>Payment Details</legend>

    <div class="form-group">
      <label for="card-num">Card Number</label>
      <!-- text + numeric inputmode is the safest way to handle CC numbers on mobile -->
      <input type="text" id="card-num" name="cardNumber" inputmode="numeric" required pattern="[0-9\s]{13,19}" title="Please enter a valid card number (13-19 digits)">
    </div>

    <div class="form-group">
      <label for="card-cvv">Security Code (CVV)</label>
      <!-- type="password" hides the digits from shoulder surfers -->
      <input type="password" id="card-cvv" name="cvv" inputmode="numeric" required pattern="[0-9]{3,4}" title="CVV must be 3 or 4 digits">
    </div>
  </fieldset>

  <!-- Legal -->
  <div class="form-group checkbox-group">
    <input type="checkbox" id="tos-agree" name="terms" required>
    <label for="tos-agree">I agree to the <a href="/terms" target="_blank" rel="noopener noreferrer">Terms and Conditions</a></label>
  </div>

  <button type="submit">Complete Purchase</button>

</form>
```

### Why this is production-grade:
1. **Accessibility:** Every input is strictly bound to a `<label>` via `id` and `for`. Screen readers will announce the fieldset legend followed by the label, providing perfect context.
2. **Mobile Optimization:** We avoided `type="number"` for the credit card, bypassing rounding errors and ugly UI spinners, but kept `inputmode="numeric"` to guarantee a smooth mobile typing experience.
3. **Security:** The CVV is obscured via `type="password"`.
4. **Validation:** The form cannot be submitted with bad data, saving server bandwidth and providing instantaneous feedback to the user via the `pattern` and `title` attributes.
</details>
