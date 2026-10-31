# Challenge 4: Enterprise Micro-Frontend Portal

## Architecture Overview
In this challenge, you will architect an Enterprise Micro-Frontend Portal using Angular Standalone Components and Webpack Module Federation. The goal is to dynamically load a remote standalone component into a host shell application without using `NgModule` or complex routing configurations. This demonstrates how Standalone Components make Module Federation significantly easier.

*Note: This challenge focuses on the Angular implementation logic. The Webpack config is provided as context.*

## 1. Context: Webpack Module Federation (Conceptual)

```javascript
// HOST (Shell App) - webpack.config.js
plugins: [
  new ModuleFederationPlugin({
    remotes: {
      mfeBilling: "mfeBilling@http://localhost:4201/remoteEntry.js",
    },
    // ... shared dependencies (Angular core, common, etc.)
  })
]

// REMOTE (Billing App) - webpack.config.js
plugins: [
  new ModuleFederationPlugin({
    name: "mfeBilling",
    filename: "remoteEntry.js",
    exposes: {
      // Exposing a Standalone Component directly! No NgModule needed!
      './InvoiceList': './src/app/invoice-list.component.ts',
    },
    // ... shared dependencies
  })
]
```

## 2. Starter Template

```typescript
import { Component, ViewChild, ViewContainerRef, ComponentRef } from '@angular/core';

// Note: In a real MFE setup, you would use dynamic imports `import('mfeBilling/InvoiceList')`
// For this challenge simulation, we provide a mock remote component.
@Component({
  selector: 'app-mock-remote-invoice',
  standalone: true,
  template: `<div class="remote-module"><h3>🧾 Remote Billing Module Loaded Successfully</h3><p>Invoices: 3 Pending</p></div>`,
  styles: [`.remote-module { border: 2px dashed #4f46e5; padding: 2rem; background: #e0e7ff; color: #3730a3; border-radius: 8px; margin-top: 1rem; }`]
})
export class MockRemoteInvoiceComponent {}

@Component({
  selector: 'app-shell-portal',
  standalone: true,
  template: `
    <div class="shell">
      <nav class="sidebar">
        <h2>Enterprise Shell</h2>
        <ul>
          <li>Dashboard</li>
          <li>Users</li>
          <li>
            <!-- TODO: Bind a click event to load the remote billing module -->
            <button class="menu-btn">Load Billing (MFE)</button>
          </li>
        </ul>
      </nav>

      <main class="content">
        <h1>Welcome to the Portal</h1>
        <p>This is the host application.</p>

        <!-- TODO: Create an ng-container with a template reference variable to act as the anchor -->
        <ng-container></ng-container>
      </main>
    </div>
  `,
  styles: [`
    .shell { display: flex; height: 100vh; font-family: sans-serif; }
    .sidebar { width: 250px; background: #1e293b; color: white; padding: 2rem; }
    .sidebar ul { list-style: none; padding: 0; }
    .sidebar li { margin-bottom: 1rem; }
    .menu-btn { width: 100%; text-align: left; background: #334155; color: white; border: none; padding: 0.75rem; border-radius: 4px; cursor: pointer; }
    .menu-btn:hover { background: #475569; }
    .content { flex: 1; padding: 3rem; background: #f8fafc; }
  `]
})
export class ShellPortalComponent {
  // TODO: Use @ViewChild to get a reference to the ViewContainerRef of the anchor

  // TODO: Create an async method `loadBillingModule()`
  // Inside, clear the container, then use `createComponent` (or simulate dynamic import) to load the MockRemoteInvoiceComponent.
}
```

## 3. Production Solution & Walkthrough

### Step 1: Setting up the ViewContainerRef Anchor
In the template, we add `<ng-container #mfeAnchor></ng-container>`. This provides a stable, invisible DOM element where Angular can dynamically insert a component. In the class, we grab it using `@ViewChild('mfeAnchor', { read: ViewContainerRef })`.

### Step 2: Dynamic Component Loading (Standalone)
Because the remote component is standalone (`MockRemoteInvoiceComponent`), we do *not* need to compile a module or deal with `createNgModuleRef`. We can simply call `this.mfeAnchor.createComponent(ComponentClass)`.
In a true Webpack MFE setup, we would dynamically import it first:
`const { InvoiceListComponent } = await import('mfeBilling/InvoiceList');`
`this.mfeAnchor.createComponent(InvoiceListComponent);`

### Step 3: Managing Component Refs
We store the `ComponentRef` so we can destroy it later if the user navigates away, preventing memory leaks.

### Complete Solution Code

```typescript
import { Component, ViewChild, ViewContainerRef, ComponentRef, OnDestroy, signal } from '@angular/core';

// --- MOCK REMOTE MFE COMPONENT ---
// In reality, this lives in a completely different Git repository and runs on port 4201.
@Component({
  selector: 'app-mock-remote-invoice',
  standalone: true,
  template: `
    <div class="remote-module">
      <h3>🧾 Remote Billing Module Loaded Successfully</h3>
      <p>Invoices: 3 Pending</p>
      <button (click)="pay()">Pay All</button>
    </div>
  `,
  styles: [`
    .remote-module { border: 2px dashed #4f46e5; padding: 2rem; background: #e0e7ff; color: #3730a3; border-radius: 8px; margin-top: 1rem; animation: fade-in 0.5s; }
    button { padding: 0.5rem 1rem; background: #4f46e5; color: white; border: none; border-radius: 4px; cursor: pointer; }
    @keyframes fade-in { from { opacity: 0; transform: translateY(10px); } to { opacity: 1; transform: translateY(0); } }
  `]
})
export class MockRemoteInvoiceComponent {
  pay() { alert('Payment processing logic inside MFE!'); }
}
// ---------------------------------

@Component({
  selector: 'app-shell-portal',
  standalone: true,
  template: `
    <div class="shell">
      <nav class="sidebar">
        <h2>Enterprise Shell</h2>
        <ul>
          <li>Dashboard</li>
          <li>Users</li>
          <li>
            <button class="menu-btn" (click)="loadBillingModule()">
              Load Billing (MFE)
            </button>
          </li>
          <li>
            <!-- Added to demonstrate cleanup -->
            <button class="menu-btn danger" (click)="unloadModule()">
              Unload Module
            </button>
          </li>
        </ul>
      </nav>

      <main class="content">
        <h1>Welcome to the Portal</h1>
        <p>This is the host application (Shell). The Billing module below is loaded dynamically.</p>

        @if (isLoading()) {
          <p style="color: #666; font-style: italic;">Downloading remote entry...</p>
        }

        <!-- The Anchor for the dynamically loaded Standalone Component -->
        <ng-container #mfeAnchor></ng-container>
      </main>
    </div>
  `,
  styles: [`
    .shell { display: flex; height: 100vh; font-family: sans-serif; }
    .sidebar { width: 250px; background: #1e293b; color: white; padding: 2rem; }
    .sidebar ul { list-style: none; padding: 0; }
    .sidebar li { margin-bottom: 1rem; }
    .menu-btn { width: 100%; text-align: left; background: #334155; color: white; border: none; padding: 0.75rem; border-radius: 4px; cursor: pointer; }
    .menu-btn:hover { background: #475569; }
    .danger { background: #991b1b; } .danger:hover { background: #7f1d1d; }
    .content { flex: 1; padding: 3rem; background: #f8fafc; }
  `]
})
export class ShellPortalComponent implements OnDestroy {
  @ViewChild('mfeAnchor', { read: ViewContainerRef })
  mfeAnchor!: ViewContainerRef;

  private mfeComponentRef: ComponentRef<any> | null = null;
  isLoading = signal(false);

  async loadBillingModule() {
    this.isLoading.set(true);

    // 1. Clear any existing component in the container
    this.unloadModule();

    // 2. Simulate Webpack Federation Network Request
    // In production: const { InvoiceComponent } = await import('mfeBilling/InvoiceList');
    await this.simulateNetworkDelay(800);
    const ComponentToLoad = MockRemoteInvoiceComponent;

    // 3. Instantiate the Standalone Component dynamically
    // No NgModule factories required!
    this.mfeComponentRef = this.mfeAnchor.createComponent(ComponentToLoad);

    // (Optional) You can pass inputs to the dynamic component:
    // this.mfeComponentRef.setInput('userId', 12345);

    this.isLoading.set(false);
  }

  unloadModule() {
    if (this.mfeAnchor) {
      this.mfeAnchor.clear();
      this.mfeComponentRef = null;
    }
  }

  ngOnDestroy() {
    this.unloadModule();
  }

  private simulateNetworkDelay(ms: number) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}
```
