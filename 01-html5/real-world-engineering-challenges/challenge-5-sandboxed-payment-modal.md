# Challenge 5: Sandboxed Payment Modal

## The Engineering Scenario
You are a Principal Frontend Engineer integrating a risky third-party payment gateway into your application. You need a button that opens a popup window containing the payment form.
Because the payment form is from a third party, you do not trust it. You must load it via an iframe, and you must lock that iframe down so it cannot run popups, access your top-level window, or submit malicious data to your server. Furthermore, the popup itself must be an accessible, focus-trapped native HTML modal.

## Acceptance Criteria
- Use the HTML5 `<dialog>` element to create the popup.
- Inside the dialog, place an `<iframe>` pointing to `https://third-party-pay.com/checkout`.
- The iframe MUST be heavily sandboxed. It should only be allowed to run scripts and submit its own internal forms. (Do not use `allow-same-origin` or `allow-top-navigation`).
- Include a "Cancel Payment" button inside the dialog that uses the native HTML form method to close the dialog without relying on custom JavaScript.

---

## Starter Code
```html
<main>
  <button id="pay-btn">Proceed to Payment</button>

  <!-- Build the secure modal here -->

</main>
```

---

## Production Solution Walkthrough

<details>
<summary>View the Principal-Level Solution</summary>

```html
<main>
  <h1>Checkout</h1>
  <p>Total: $500.00</p>

  <!-- The Trigger -->
  <button onclick="document.getElementById('payment-modal').showModal()">
    Proceed to Payment
  </button>

  <!-- The Native Modal -->
  <dialog id="payment-modal">
    <header>
      <h2>Secure Payment Gateway</h2>
    </header>

    <!-- The High-Security Sandbox -->
    <!--
      - allow-scripts: Allows the third-party to run JS for their credit card validation.
      - allow-forms: Allows the third-party to submit the payment to their own server.
      - We omit allow-top-navigation, so they cannot redirect our main webpage!
      - We omit allow-same-origin, so they cannot read our cookies!
    -->
    <iframe
      src="https://third-party-pay.com/checkout"
      title="Third-party payment processor"
      width="400"
      height="600"
      sandbox="allow-scripts allow-forms"
      loading="lazy">
    </iframe>

    <!-- Native JavaScript-Free Close Mechanism -->
    <form method="dialog">
      <button class="btn-cancel">Cancel Payment & Return</button>
    </form>
  </dialog>
</main>

<!-- Styling the Backdrop for immersion -->
<style>
  dialog::backdrop {
    background-color: rgba(0, 0, 0, 0.8);
    backdrop-filter: blur(4px);
  }
</style>
```

### Why this is production-grade:
1. **Flawless Accessibility:** By using `<dialog>` and `.showModal()`, the browser natively traps the user's "Tab" key. They cannot accidentally tab backward onto the main page while the payment window is open.
2. **Zero-JS Close:** The `<form method="dialog">` pattern guarantees the user can always escape the modal, even if the third-party iframe crashes the browser's JavaScript thread.
3. **Maximum Security:** The `<iframe>` sandbox is configured with surgical precision. It grants the payment processor exactly the permissions it needs (scripts and forms) and absolutely nothing else. If the payment processor is hacked, the hacker's payload remains hopelessly trapped inside the glass cage of the iframe.
</details>
