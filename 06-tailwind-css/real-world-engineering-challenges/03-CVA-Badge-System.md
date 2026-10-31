# Challenge 3: CVA Badge System (Level 3: Component Architect)

## Scenario
The design team has created a comprehensive "Status Badge" system. It comes in 4 colors (gray, blue, green, red) and 2 styles (solid, outline). It also needs an optional leading dot indicator.

## The Pain Point
Developers are currently copying and pasting massive strings of Tailwind classes every time they need a badge. When the design team decides to round the corners more, someone has to find and replace 50 instances of `rounded-md` across the codebase.

## The Challenge
Architect a strictly typed React component using `class-variance-authority` (CVA) and `tailwind-merge`.

### Requirements:
1. **Utility:** Implement a `cn()` function combining `clsx` and `twMerge`.
2. **CVA Definition:** Define a `badgeVariants` CVA with:
   - `intent`: `default`, `info`, `success`, `destructive`
   - `variant`: `solid`, `outline`
3. **Component:** Build the `<Badge>` React component that accepts these variants as props.
4. **Features:** Include a boolean `hasDot` prop. If true, render a small dot `<svg>` or `<div>` inside the badge that matches the text color of the current intent.

## Architecture Diagram
```text
Props: { intent: 'success', variant: 'outline', hasDot: true }
                              |
                              V
                       [ cva config ]
  (base: inline-flex items-center rounded-full px-2.5 py-0.5)
  (intent: success -> text-green-700)
  (variant: outline -> border border-green-700 bg-transparent)
                              |
                              V
                  [ twMerge / clsx (cn) ]
                              |
                              V
HTML: <div class="inline-flex... text-green-700 border...">
        {hasDot && <div class="w-1.5 h-1.5 rounded-full bg-current mr-1.5" />}
        {children}
      </div>
```

## Complete Production Solution

```tsx
import React from 'react';
import { cva, type VariantProps } from 'class-variance-authority';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

// 1. The Merge Utility
export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

// 2. The CVA Definition
const badgeVariants = cva(
  "inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold transition-colors focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2",
  {
    variants: {
      intent: {
        default: "border-transparent bg-gray-900 text-white hover:bg-gray-900/80",
        info: "border-transparent bg-blue-100 text-blue-900 hover:bg-blue-100/80",
        success: "border-transparent bg-green-100 text-green-900 hover:bg-green-100/80",
        destructive: "border-transparent bg-red-100 text-red-900 hover:bg-red-100/80",
      },
      variant: {
        solid: "",
        outline: "text-current bg-transparent border",
      },
    },
    compoundVariants: [
      // When intent is default AND variant is outline, we need specific overrides
      {
        intent: "default",
        variant: "outline",
        className: "text-gray-900 border-gray-200 hover:bg-gray-100",
      },
      {
        intent: "info",
        variant: "outline",
        className: "text-blue-700 border-blue-200 hover:bg-blue-50",
      },
      {
        intent: "success",
        variant: "outline",
        className: "text-green-700 border-green-200 hover:bg-green-50",
      },
      {
        intent: "destructive",
        variant: "outline",
        className: "text-red-700 border-red-200 hover:bg-red-50",
      }
    ],
    defaultVariants: {
      intent: "default",
      variant: "solid",
    },
  }
);

// 3. The Component Interface
export interface BadgeProps
  extends React.HTMLAttributes<HTMLDivElement>,
    VariantProps<typeof badgeVariants> {
  hasDot?: boolean;
}

// 4. The Component
export function Badge({
  className,
  intent,
  variant,
  hasDot = false,
  children,
  ...props
}: BadgeProps) {
  return (
    <div className={cn(badgeVariants({ intent, variant }), className)} {...props}>
      {hasDot && (
        <svg
          viewBox="0 0 6 6"
          aria-hidden="true"
          className="mr-1.5 h-1.5 w-1.5 fill-current"
        >
          <circle cx="3" cy="3" r="3" />
        </svg>
      )}
      {children}
    </div>
  );
}

// 5. Usage Example (Showcase)
export default function BadgeShowcase() {
  return (
    <div className="p-8 flex flex-col gap-6 bg-white min-h-screen">
      <div className="flex gap-4">
        <Badge intent="default">Draft</Badge>
        <Badge intent="info">In Progress</Badge>
        <Badge intent="success">Completed</Badge>
        <Badge intent="destructive">Failed</Badge>
      </div>

      <div className="flex gap-4">
        <Badge intent="default" variant="outline" hasDot>Draft</Badge>
        <Badge intent="info" variant="outline" hasDot>In Progress</Badge>
        <Badge intent="success" variant="outline" hasDot>Completed</Badge>
        <Badge intent="destructive" variant="outline" hasDot>Failed</Badge>
      </div>
    </div>
  );
}
```

### Engineering Notes:
- **`compoundVariants`:** This is CVA's superpower. A solid green badge uses `bg-green-100 text-green-900`. But an *outline* green badge shouldn't just drop the background; it needs a specific border color (`border-green-200`) and a modified text color (`text-green-700`). Compound variants allow you to target intersections of props.
- **`fill-current`:** By using `<svg className="fill-current">` for the dot, we ensure the dot automatically inherits whatever text color is applied to the parent badge by CVA, without needing to write conditional logic for the dot's color!
- **Strict Typing:** `VariantProps<typeof badgeVariants>` automatically infers TypeScript types based on the strings you provided to CVA. If a dev types `<Badge intent="warning">`, TypeScript will error because "warning" isn't in the config.

## Test Suite (React Testing Library)
```tsx
import React from 'react';
import { render, screen } from '@testing-library/react';
import { Badge } from './Badge';

describe('Badge Component', () => {
  it('renders default badge with correct classes', () => {
    render(<Badge>Default</Badge>);
    const badge = screen.getByText('Default');
    expect(badge).toBeInTheDocument();
    expect(badge).toHaveClass('bg-gray-900 text-white');
  });

  it('renders intent variations correctly', () => {
    render(<Badge intent="success">Success</Badge>);
    expect(screen.getByText('Success')).toHaveClass('bg-green-100 text-green-900');
  });

  it('renders outline variations with compound variant classes', () => {
    render(<Badge intent="info" variant="outline">Info Outline</Badge>);
    const badge = screen.getByText('Info Outline');
    expect(badge).toHaveClass('text-blue-700 border-blue-200');
    expect(badge).not.toHaveClass('bg-blue-100');
  });

  it('renders dot when hasDot is true', () => {
    render(<Badge hasDot data-testid="badge-with-dot">Dot</Badge>);
    const svg = screen.getByTestId('badge-with-dot').querySelector('svg');
    expect(svg).toBeInTheDocument();
  });

  it('merges custom classNames safely', () => {
    render(<Badge className="p-4 bg-red-500">Custom</Badge>);
    const badge = screen.getByText('Custom');
    expect(badge).toHaveClass('p-4 bg-red-500');
  });
});
```
