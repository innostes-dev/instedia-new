# Challenge 5: Multi-Brand Component Architecture (Level 5: Principal Boss)

## Scenario
You are the Principal Engineer for a massive conglomerate (e.g., GAP Inc., which owns Gap, Old Navy, Banana Republic). You need to build a single UI monorepo.

## The Pain Point
If you build a standard `<Button className="bg-blue-500">`, it only works for one brand. If you try to pass hex codes via props `<Button color="#123456">`, you lose all the benefits of Tailwind's utility system (hover states, focus rings, dark mode).

## The Challenge
Architect a system where a single React codebase renders completely different visual brands based on a data attribute injected at the root of the document, strictly using Tailwind and CSS variables.

### Requirements:
1. **The Data Attribute:** The system must respond to `<html data-brand="brand-a">` or `<html data-brand="brand-b">`.
2. **CSS Variables Mapping:** Write CSS that maps brand-specific variables to generic tokens (e.g., `--color-primary`).
3. **Tailwind Plugin/Config:** Configure Tailwind to read those generic variables.
4. **CVA Integration:** Build a `<Button>` and a `<Card>` component using CVA that utilize the generic tokens.
5. **Demonstration:** Write a React app that maps over the brands and renders the *exact same React components* side-by-side, proving they style themselves contextually based on a wrapper data attribute.

## Architecture Diagram
```text
<div data-brand="brand-a">
  css: [data-brand="brand-a"] { --primary: 255 0 0; --radius: 0px; }
  <Button intent="primary"> (renders red, square)
</div>

<div data-brand="brand-b">
  css: [data-brand="brand-b"] { --primary: 0 0 255; --radius: 999px; }
  <Button intent="primary"> (renders blue, pill-shaped)
</div>
```

## Complete Production Solution

### 1. `theme.css` (The Token Layer)
```css
@tailwind base;
@tailwind components;
@tailwind utilities;

@layer base {
  /* Brand A (e.g., Corporate/Strict) */
  [data-brand="brand-a"] {
    --primary: 15 23 42;       /* Slate 900 */
    --primary-foreground: 255 255 255;
    --surface: 248 250 252;    /* Slate 50 */
    --border: 226 232 240;     /* Slate 200 */
    --radius: 0rem;            /* Sharp corners */
    --font-heading: 'Georgia', serif;
  }

  /* Brand B (e.g., Playful/Startup) */
  [data-brand="brand-b"] {
    --primary: 139 92 246;     /* Violet 500 */
    --primary-foreground: 255 255 255;
    --surface: 250 245 255;    /* Fuchsia 50 */
    --border: 233 213 255;     /* Purple 200 */
    --radius: 9999px;          /* Pill shaped */
    --font-heading: 'Comic Sans MS', cursive; /* Extreme example */
  }
}
```

### 2. `tailwind.config.js` (The Framework Bridge)
```javascript
/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ["./src/**/*.{js,jsx,ts,tsx}"],
  theme: {
    extend: {
      colors: {
        brand: {
          primary: "rgb(var(--primary) / <alpha-value>)",
          foreground: "rgb(var(--primary-foreground) / <alpha-value>)",
          surface: "rgb(var(--surface) / <alpha-value>)",
          border: "rgb(var(--border) / <alpha-value>)",
        }
      },
      borderRadius: {
        theme: "var(--radius)",
      },
      fontFamily: {
        heading: "var(--font-heading)",
      }
    },
  },
  plugins: [],
}
```

### 3. `components.tsx` (The Implementation)
```tsx
import React from 'react';
import { cva, type VariantProps } from 'class-variance-authority';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

// Button Component
const buttonVariants = cva(
  "inline-flex items-center justify-center font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 disabled:opacity-50",
  {
    variants: {
      intent: {
        primary: "bg-brand-primary text-brand-foreground hover:opacity-90",
        outline: "border-2 border-brand-primary text-brand-primary hover:bg-brand-surface",
      },
      size: {
        default: "h-10 py-2 px-4 text-sm",
        lg: "h-12 px-8 text-base",
      },
    },
    defaultVariants: {
      intent: "primary",
      size: "default",
    },
  }
);

interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement>, VariantProps<typeof buttonVariants> {}

export function Button({ className, intent, size, ...props }: ButtonProps) {
  return (
    // Notice `rounded-theme` mapping to the CSS variable!
    <button className={cn(buttonVariants({ intent, size }), "rounded-theme", className)} {...props} />
  );
}

// Card Component
export function Card({ children, title }: { children: React.ReactNode, title: string }) {
  return (
    <div className="bg-white border border-brand-border rounded-theme p-6 shadow-sm">
      <h3 className="font-heading text-xl text-brand-primary mb-4">{title}</h3>
      <div className="text-gray-600">
        {children}
      </div>
    </div>
  );
}
```

### 4. `App.tsx` (The Multi-Tenant Environment)
```tsx
import React from 'react';
import { Button, Card } from './components';

export default function MultiBrandShowcase() {
  return (
    <div className="min-h-screen bg-gray-100 p-8 grid md:grid-cols-2 gap-8">

      {/* BRAND A ENVIRONMENT */}
      <div data-brand="brand-a" className="bg-brand-surface p-8 border border-brand-border">
        <h2 className="text-2xl font-bold mb-6 font-heading">Brand A: Corporate</h2>

        <Card title="Quarterly Report">
          <p className="mb-6">Please review the Q3 financials before the board meeting.</p>
          <div className="flex gap-4">
            <Button intent="primary">Download PDF</Button>
            <Button intent="outline">View Online</Button>
          </div>
        </Card>
      </div>

      {/* BRAND B ENVIRONMENT (EXACT SAME CODE!) */}
      <div data-brand="brand-b" className="bg-brand-surface p-8 border border-brand-border">
        <h2 className="text-2xl font-bold mb-6 font-heading">Brand B: Startup</h2>

        <Card title="Quarterly Report">
          <p className="mb-6">Please review the Q3 financials before the board meeting.</p>
          <div className="flex gap-4">
            <Button intent="primary">Download PDF</Button>
            <Button intent="outline">View Online</Button>
          </div>
        </Card>
      </div>

    </div>
  );
}
```

### Engineering Notes:
- **`rgb(var(...) / <alpha-value>)`:** This is the highest-level Tailwind configuration trick. By using this exact syntax in `tailwind.config.js`, Tailwind can apply its native opacity modifiers to your CSS variables (e.g., `bg-brand-primary/50`).
- **`rounded-theme`:** We mapped `--radius` to `theme` in the config. Now a `<Button>` written once will automatically be sharp for Brand A and pill-shaped for Brand B, purely based on the CSS context.
- **The Power of `data-brand`:** Because we attached the variables to `[data-brand="..."]` instead of `:root`, the tokens become scoped. You can literally nest one brand inside another on the same page, and the CSS cascade will seamlessly handle the token overrides. This is how enterprise micro-frontends maintain brand consistency.

## Test Suite (React Testing Library)
```tsx
import React from 'react';
import { render, screen } from '@testing-library/react';
import { Button, Card } from './components';
import MultiBrandShowcase from './App';

describe('MultiBrand Architecture', () => {
  it('renders the Button with the correct CVA classes and theme bridging class', () => {
    render(<Button intent="primary">Click Me</Button>);
    const button = screen.getByRole('button', { name: /click me/i });

    // Checks for the CVA intent logic
    expect(button).toHaveClass('bg-brand-primary text-brand-foreground');

    // Checks for the crucial CSS Variable link
    expect(button).toHaveClass('rounded-theme');
  });

  it('renders the Card with the correct structural classes', () => {
    render(<Card title="Test Card">Content</Card>);

    expect(screen.getByText('Test Card')).toHaveClass('font-heading text-brand-primary');

    const cardContainer = screen.getByText('Test Card').parentElement;
    expect(cardContainer).toHaveClass('bg-white border-brand-border rounded-theme');
  });

  it('renders the MultiBrandShowcase with proper data attributes', () => {
    const { container } = render(<MultiBrandShowcase />);

    // Ensure the data-brand attributes are correctly placed for the CSS cascade to work
    const brandA = container.querySelector('[data-brand="brand-a"]');
    const brandB = container.querySelector('[data-brand="brand-b"]');

    expect(brandA).toBeInTheDocument();
    expect(brandB).toBeInTheDocument();

    // Check that both render the exact same component logic inside
    expect(screen.getAllByText('Quarterly Report')).toHaveLength(2);
  });
});
```
