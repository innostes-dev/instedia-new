# Challenge 1: Multi-Tenant SaaS Billing Engine

## Architecture Blueprint

This challenge combines relational database integrity, strict API validation, multi-tenant authentication, and optimistic UI into a cohesive SaaS billing module.

**Core Requirements:**
1. **Tenant Isolation:** A user must only see subscriptions and invoices belonging to their `tenant_id`.
2. **Robust Validation:** All API inputs must be validated against a strict schema.
3. **Optimistic UI:** When a user upgrades their plan, the UI should reflect the change instantly while the backend processes it.
4. **Webhook Resilience:** Handle Stripe webhook events (`invoice.paid`, `invoice.payment_failed`) asynchronously and securely.

## Starter Template (TypeScript/Express/React)

### Backend: Express API

```typescript
import express from 'express';
import { z } from 'zod';
import { PrismaClient } from '@prisma/client';
import Stripe from 'stripe';

const app = express();
const prisma = new PrismaClient();
const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, { apiVersion: '2023-10-16' });

// 1. DTO Validation
const UpgradePlanSchema = z.object({
  planId: z.string().uuid(),
  paymentMethodId: z.string()
});

// Mock Auth Middleware
const requireAuth = (req: any, res: any, next: any) => {
  req.user = { id: 'user_1', tenantId: 'tenant_abc' }; // Hardcoded for template
  next();
};

// 2. The Upgrade Endpoint
app.post('/api/billing/upgrade', requireAuth, express.json(), async (req: any, res: any) => {
  try {
    const data = UpgradePlanSchema.parse(req.body);
    const { tenantId } = req.user;

    // TODO: 1. Verify tenant exists and current plan allows upgrade
    // TODO: 2. Call Stripe API to create/update subscription
    // TODO: 3. Update database with new plan status (ensure WHERE tenantId = ?)

    res.status(200).json({ status: 'success', message: 'Plan upgraded' });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: error.errors });
    }
    res.status(500).json({ error: 'Internal server error' });
  }
});

// 3. Webhook Endpoint
app.post('/api/webhooks/stripe', express.raw({ type: 'application/json' }), async (req: any, res: any) => {
  // TODO: Verify signature using stripe.webhooks.constructEvent
  // TODO: Acknowledge receipt to Stripe immediately (200 OK)
  // TODO: Asynchronously process 'invoice.paid' to update tenant status
});

app.listen(3000, () => console.log('Billing Service running'));
```

### Frontend: React UI

```tsx
import React, { useState } from 'react';

type PlanStatus = 'FREE' | 'PRO' | 'UPGRADING' | 'ERROR';

export default function BillingDashboard() {
  const [status, setStatus] = useState<PlanStatus>('FREE');

  const handleUpgrade = async () => {
    // 1. Optimistic Update
    const previousStatus = status;
    setStatus('UPGRADING');

    try {
      const res = await fetch('/api/billing/upgrade', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ planId: '123-uuid', paymentMethodId: 'pm_card' })
      });

      if (!res.ok) throw new Error('Upgrade failed');

      // 2. Success State
      setStatus('PRO');
    } catch (error) {
      // 3. Rollback
      setStatus('ERROR');
      setTimeout(() => setStatus(previousStatus), 3000); // Revert UI after showing error
    }
  };

  return (
    <div className="p-8">
      <h1>Current Plan: {status}</h1>
      {status === 'FREE' && (
        <button onClick={handleUpgrade} className="bg-blue-500 text-white p-2">
          Upgrade to PRO ($10/mo)
        </button>
      )}
      {status === 'UPGRADING' && <p>Processing payment...</p>}
      {status === 'ERROR' && <p className="text-red-500">Payment failed. Please try again.</p>}
    </div>
  );
}
```

## Production Solution Walkthrough

1. **Database Schema Setup:** Ensure all billing-related tables (`subscriptions`, `invoices`) have a `tenant_id` column. Create a foreign key constraint linking it to the `tenants` table. Add a compound index on `(tenant_id, status)` for fast filtering.
2. **API Layer Security:** The `UpgradePlanSchema` must be enforced. If the user passes unexpected fields (e.g., `amount: 0`), Zod will strip them or reject the request, preventing mass assignment vulnerabilities. The `tenant_id` must NEVER be read from the request body; it must be extracted from the authenticated session (`req.user.tenantId`).
3. **Webhook Verification:** The Stripe webhook route uses `express.raw`. It calls `stripe.webhooks.constructEvent` with the `STRIPE_WEBHOOK_SECRET`. If validation passes, it returns `res.send({received: true})` immediately. It then pushes the event payload to a Background Queue (e.g., BullMQ) for processing.
4. **Optimistic UI Implementation:** The React component updates its local state to `UPGRADING` before the `fetch` call. This gives the user instant visual feedback. If the network request fails (e.g., card declined), it catches the error and reverts the state back to `FREE`.
5. **Idempotency:** When the background worker processes the `invoice.paid` webhook, it checks if the invoice ID has already been processed in the database to prevent granting the user duplicate credits if Stripe retries the webhook.
