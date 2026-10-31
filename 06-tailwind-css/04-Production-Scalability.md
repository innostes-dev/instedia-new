# Module 04: Production Scalability (CVA & Design Tokens)

## Phase A: The Core Concept

### 1. Real-World Pain Point (The Why)
Tailwind string concatenation in JavaScript gets messy fast. Imagine a Button component that has sizes (sm, md, lg), variants (primary, secondary, outline), and states (disabled, loading). Writing `` `btn ${variant === 'primary' ? 'bg-blue-500' : 'bg-gray-200'} ${size === 'lg' ? 'p-4' : 'p-2'}` `` turns into unreadable spaghetti. Furthermore, passing a custom class (`className="px-8"`) to override default padding (`px-4`) often fails due to CSS cascade issues (Tailwind relies on the order in the stylesheet, not the string).

### 2. Plain English Metaphor (The What)
CVA (Class Variance Authority) is like a vending machine for CSS classes. You define the "inventory" of your component upfront: "Here are my base button classes. Here are the colors it comes in. Here are the sizes." When you want a button, you just press the buttons for "Primary" and "Large", and CVA drops a perfectly formatted string of Tailwind classes. `twMerge` is the janitor that ensures if you accidentally ask for `px-4` AND `px-8`, only the winning class (`px-8`) is kept, preventing conflicts.

### 3. Complete Runnable Code
*(Note: This conceptualizes the React/CVA setup often used in production frameworks like Next.js)*

```tsx
import { cva, type VariantProps } from "class-variance-authority";
import { twMerge } from "tailwind-merge";
import { clsx, type ClassValue } from "clsx";

// 1. The Utility to merge classes safely
export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

// 2. The CVA Definition
const buttonVariants = cva(
  "inline-flex items-center justify-center rounded-md text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 disabled:opacity-50 disabled:pointer-events-none",
  {
    variants: {
      variant: {
        default: "bg-blue-600 text-white hover:bg-blue-700",
        destructive: "bg-red-500 text-white hover:bg-red-600",
        outline: "border border-gray-300 hover:bg-gray-100",
        ghost: "hover:bg-gray-100 hover:text-gray-900",
      },
      size: {
        default: "h-10 py-2 px-4",
        sm: "h-9 px-3 rounded-md",
        lg: "h-11 px-8 rounded-md",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  }
);

// 3. The Component
export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {}

export function Button({ className, variant, size, ...props }: ButtonProps) {
  return (
    <button
      className={cn(buttonVariants({ variant, size, className }))}
      {...props}
    />
  );
}

// Usage:
// <Button variant="destructive" size="lg" className="mt-4">Delete</Button>
```

### 4. Progressive Step-by-Step Breakdown

**Step 1: The Base Classes**
```tsx
const buttonVariants = cva(
  "inline-flex items-center justify-center rounded-md font-medium transition-colors",
  // ...
```
The first argument to `cva()` is a string of Tailwind classes that will *always* apply to this component, regardless of what variant or size is chosen. It sets the baseline styling.

**Step 2: Defining Variants**
```tsx
variants: {
  variant: {
    default: "bg-blue-600 text-white",
    outline: "border border-gray-300 text-gray-700",
  }
}
```
We define an object where keys are the property names (`variant`) and values are maps of the possible options (`default`, `outline`) to their specific Tailwind classes.

**Step 3: Resolving Conflicts with `twMerge` (`cn` utility)**
```tsx
className={cn(buttonVariants({ variant, size, className }))}
```
If `buttonVariants` outputs `bg-blue-600 px-4` and the user passes `className="px-8 bg-red-500"`, a standard string join results in `bg-blue-600 px-4 px-8 bg-red-500`. The browser might apply `bg-blue-600` depending on the CSS file generation order! `twMerge` analyzes this and correctly outputs: `px-8 bg-red-500`, stripping the overridden base classes.

### 5. ASCII Data Flow
```text
[ Base Classes ] + [ Variant: 'outline' ] + [ Size: 'lg' ] + [ className: 'px-12' ]
       |                   |                       |                    |
       V                   V                       V                    V
cva() outputs: "inline-flex border h-11 px-8 px-12"
       |
       V
twMerge sees conflicting padding (px-8 vs px-12). Keeps the later one.
       |
       V
Final DOM string: "inline-flex border h-11 px-12"
```

### 6. Noob Trap vs Pro Tip
**Noob Trap:** Using template literals to build complex dynamic classes in React: `<div className={`p-4 ${isActive ? 'bg-blue-500' : 'bg-gray-200'}`} />`. As components grow, this becomes unreadable and hard to maintain.
**Pro Tip:** Treat your UI components like a Design System API. Use CVA to strictly define the API (`variant="ghost"`, `size="sm"`). This creates robust, predictable components that match Figma designs exactly.

---

## Phase B: Engineering Challenges

### Level 1: Warm-Up
**Challenge:** Design a Tailwind Configuration (`tailwind.config.js`) that extends the default theme.
Add a custom brand color named `brand` with values for `500` (primary) and `600` (hover).
Add a custom font family named `display` that uses `Inter, sans-serif`.

<details>
<summary>Hint</summary>
Export an object. Use the `theme.extend.colors` and `theme.extend.fontFamily` properties.
</details>

<details>
<summary>Solution Walkthrough</summary>
```javascript
/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ["./src/**/*.{js,jsx,ts,tsx}"],
  theme: {
    extend: {
      colors: {
        brand: {
          500: '#3b82f6', // example hex
          600: '#2563eb', // example hex
        }
      },
      fontFamily: {
        display: ['Inter', 'sans-serif'],
      }
    },
  },
  plugins: [],
}
```
- By using `extend`, we keep all of Tailwind's default colors and spacing, but inject our custom tokens. You can now use `bg-brand-500` or `font-display` in your HTML.
</details>

### Level 2: Real-World
**Challenge:** Write a CVA configuration for a "Badge" component.
Base classes: `inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold transition-colors`
Variants:
- `intent`: `info` (blue), `success` (green), `warning` (yellow)
Default Variant: `intent: "info"`

<details>
<summary>Hint</summary>
Use the `cva` function. Pass the base string as the first argument, and the config object with `variants.intent` and `defaultVariants` as the second argument.
</details>

<details>
<summary>Solution Walkthrough</summary>
```typescript
import { cva } from "class-variance-authority";

const badgeVariants = cva(
  "inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold transition-colors",
  {
    variants: {
      intent: {
        info: "bg-blue-100 text-blue-800",
        success: "bg-green-100 text-green-800",
        warning: "bg-yellow-100 text-yellow-800",
      },
    },
    defaultVariants: {
      intent: "info",
    },
  }
);

// Usage: badgeVariants({ intent: "success" })
```
- This perfectly isolates the visual logic of the Badge.
</details>

### Level 3: Boss Level
**Challenge:** Build the ultimate `cn()` utility wrapper and a fully typed `Alert` component.
Requirements:
- Create the `cn` function using `clsx` and `twMerge`.
- Define an `Alert` component using CVA with two variants: `status` (info, error) and `layout` (default, compact).
- Apply Dark Mode classes to the variants! (e.g., info alert has a dark blue background in dark mode).
- Ensure the component accepts arbitrary `className` strings via props and passes them through `cn()`.

<details>
<summary>Hint</summary>
Combine knowledge from Modules 3 and 4. In CVA definitions, write classes like `bg-red-50 dark:bg-red-900/20`. Build a React component that destructures `status`, `layout`, and `className`, feeding them into `cn(alertVariants(...))`.
</details>

<details>
<summary>Solution Walkthrough</summary>
```tsx
import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";
import { cva, type VariantProps } from "class-variance-authority";

// 1. Core Utility
export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

// 2. CVA Definition with Dark Mode integration
const alertVariants = cva(
  "relative w-full rounded-lg border p-4 [&>svg]:absolute [&>svg]:left-4 [&>svg]:top-4 [&>svg]:text-foreground",
  {
    variants: {
      status: {
        info: "border-blue-200 bg-blue-50 text-blue-900 dark:border-blue-900/50 dark:bg-blue-900/20 dark:text-blue-200",
        error: "border-red-200 bg-red-50 text-red-900 dark:border-red-900/50 dark:bg-red-900/20 dark:text-red-200",
      },
      layout: {
        default: "p-4",
        compact: "p-2 text-sm",
      }
    },
    defaultVariants: {
      status: "info",
      layout: "default",
    },
  }
);

// 3. Fully Typed Component
export interface AlertProps
  extends React.HTMLAttributes<HTMLDivElement>,
    VariantProps<typeof alertVariants> {}

export function Alert({ className, status, layout, children, ...props }: AlertProps) {
  return (
    <div
      role="alert"
      className={cn(alertVariants({ status, layout, className }))}
      {...props}
    >
      {children}
    </div>
  );
}
```
- **Enterprise Architecture:** This is exactly how massive component libraries (like shadcn/ui) are built.
- **Robustness:** Using `cn()` ensures that if a consumer writes `<Alert className="bg-purple-500" />`, `twMerge` will safely strip the default CVA backgrounds (`bg-blue-50`, `bg-red-50`) without the dev needing to use `!important`.
- **Dark Mode Context:** The CVA encapsulates the complex dark mode token mappings, keeping the React render function completely clean.
</details>
