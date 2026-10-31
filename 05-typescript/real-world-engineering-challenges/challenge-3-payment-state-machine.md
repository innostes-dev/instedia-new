# Challenge 3: State-Machine Driven Payment Lifecycle

## Scenario
You are integrating with the Stripe API. A Payment Intent has a very specific lifecycle. It starts as `"requires_payment_method"`. Then it transitions to `"processing"`. Then it becomes either `"succeeded"` or `"requires_action"` (e.g., 3D Secure authentication).
If a payment is `"succeeded"`, it has a `receiptUrl`. If it `"requires_action"`, it has a `redirectUrl`.
You need to model this state machine so tightly that developers *cannot* access the `receiptUrl` unless the state is definitively `"succeeded"`.

## Challenge Requirements
1. Create a Discriminated Union `PaymentState`.
2. Define the following states:
    - `"requires_payment_method"` (amount: number)
    - `"processing"` (amount: number, method: string)
    - `"requires_action"` (amount: number, redirectUrl: string)
    - `"succeeded"` (amount: number, receiptUrl: string)
    - `"failed"` (amount: number, errorMessage: string)
3. Write a function `handlePaymentUpdate(state: PaymentState)` using a `switch` statement with an exhaustive `never` check in the default case.
4. Log the appropriate URL or message based on the state.

<details>
<summary>Solution Walkthrough</summary>

```typescript
// 1. Defining the States
interface BasePayment {
  amount: number;
}

interface InitState extends BasePayment {
  status: "requires_payment_method";
}

interface ProcessingState extends BasePayment {
  status: "processing";
  method: string;
}

interface ActionState extends BasePayment {
  status: "requires_action";
  redirectUrl: string;
}

interface SucceededState extends BasePayment {
  status: "succeeded";
  receiptUrl: string;
}

interface FailedState extends BasePayment {
  status: "failed";
  errorMessage: string;
}

// 2. The Discriminated Union
type PaymentState = InitState | ProcessingState | ActionState | SucceededState | FailedState;

// Utility for Exhaustiveness
function assertUnreachable(x: never): never {
  throw new Error(`Unhandled state: ${JSON.stringify(x)}`);
}

// 3. The State Machine Handler
function handlePaymentUpdate(state: PaymentState) {
  // If we try to access state.receiptUrl here, TS throws an error. Perfect!

  switch (state.status) {
    case "requires_payment_method":
      console.log(`Please enter payment details for $${state.amount}`);
      break;

    case "processing":
      console.log(`Processing $${state.amount} via ${state.method}...`);
      break;

    case "requires_action":
      // TS knows `redirectUrl` exists here
      console.log(`Authentication required. Redirecting to: ${state.redirectUrl}`);
      break;

    case "succeeded":
      // TS knows `receiptUrl` exists here
      console.log(`Payment successful! View receipt at: ${state.receiptUrl}`);
      break;

    case "failed":
      // TS knows `errorMessage` exists here
      console.error(`Payment failed: ${state.errorMessage}`);
      break;

    default:
      // 4. Exhaustive verification
      // If Stripe adds a "canceled" status tomorrow, our code won't compile
      // until we add a case block for it.
      return assertUnreachable(state);
  }
}
```

**Walkthrough:**
This is the single most important pattern for writing resilient business logic. By merging Discriminated Unions with Exhaustive Switch blocks, you map the exact real-world business constraints directly into the compiler. Impossible states are literally unrepresentable in code.
</details>
