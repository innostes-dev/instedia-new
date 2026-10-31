# Challenge 2: Linear-Style Dark Mode Palette (Level 2: Stateful Client)

## Scenario
You are building a developer tool. The design mandates a highly polished, high-contrast UI similar to the app "Linear". It must support both Light and Dark modes seamlessly.

## The Pain Point
Managing light and dark mode colors manually via utility classes (`bg-white dark:bg-gray-900 text-gray-900 dark:text-white`) everywhere leads to inconsistent grays across the app, missed `dark:` classes, and extremely bloated markup.

## The Challenge
Implement a token-based Dark Mode system using CSS variables integrated into `tailwind.config.js`. Build a settings card to prove it works.

### Requirements:
1. **CSS Variables:** Define your color palette in a CSS file using `--` variables attached to `:root` and `.dark`.
2. **Tailwind Config:** Map these CSS variables into the Tailwind configuration (e.g., extend `colors: { background: 'var(--bg)' }`).
3. **The Component:** Build a generic "Settings Card" that uses your new custom semantic utilities (e.g., `bg-background`, `text-foreground`, `border-border`) instead of explicit gray values.
4. **Theme Toggle:** Create a simple button that toggles the `.dark` class on the parent container to test the palette shift.

## Architecture Diagram
```text
[ CSS Variables (theme.css) ]
  :root { --bg: #ffffff; --text: #111827; --border: #e5e7eb; }
  .dark { --bg: #030712; --text: #f9fafb; --border: #1f2937; }
         |
         v
[ tailwind.config.js ]
  colors: { background: 'var(--bg)', foreground: 'var(--text)' }
         |
         v
[ React Component ]
  <div className="bg-background text-foreground border-border">...</div>
```

## Complete Production Solution

### 1. `theme.css`
```css
@tailwind base;
@tailwind components;
@tailwind utilities;

@layer base {
  :root {
    --background: 255 255 255; /* #ffffff */
    --foreground: 9 9 11;     /* #09090b */
    --card: 255 255 255;
    --card-foreground: 9 9 11;
    --border: 228 228 231;    /* #e4e4e7 */
    --primary: 24 24 27;      /* #18181b */
    --primary-foreground: 250 250 250; /* #fafafa */
  }

  .dark {
    --background: 9 9 11;     /* #09090b */
    --foreground: 250 250 250;/* #fafafa */
    --card: 9 9 11;
    --card-foreground: 250 250 250;
    --border: 39 39 42;       /* #27272a */
    --primary: 250 250 250;
    --primary-foreground: 24 24 27;
  }
}

body {
  background-color: rgb(var(--background));
  color: rgb(var(--foreground));
}
```

### 2. `tailwind.config.js`
```javascript
/** @type {import('tailwindcss').Config} */
module.exports = {
  darkMode: ["class"],
  content: ["./src/**/*.{js,jsx,ts,tsx}"],
  theme: {
    extend: {
      colors: {
        border: "rgb(var(--border))",
        background: "rgb(var(--background))",
        foreground: "rgb(var(--foreground))",
        card: {
          DEFAULT: "rgb(var(--card))",
          foreground: "rgb(var(--card-foreground))",
        },
        primary: {
          DEFAULT: "rgb(var(--primary))",
          foreground: "rgb(var(--primary-foreground))",
        },
      },
    },
  },
  plugins: [],
}
```

### 3. `SettingsCard.tsx`
```tsx
import React, { useState } from 'react';

export default function ThemeShowcase() {
  const [isDark, setIsDark] = useState(false);

  return (
    // The container that holds the 'dark' class state
    <div className={`${isDark ? 'dark' : ''} min-h-screen bg-background text-foreground transition-colors duration-300 p-8 flex flex-col items-center justify-center font-sans`}>

      {/* Theme Toggle */}
      <button
        onClick={() => setIsDark(!isDark)}
        className="mb-8 px-4 py-2 bg-primary text-primary-foreground rounded-md font-medium text-sm hover:opacity-90 transition-opacity"
      >
        Toggle Theme
      </button>

      {/* The Semantic Card */}
      <div className="w-full max-w-md bg-card border border-border rounded-xl shadow-sm p-6 space-y-6">
        <div>
          <h2 className="text-xl font-semibold tracking-tight">Account Settings</h2>
          <p className="text-sm text-foreground/60 mt-1">Manage your account preferences and settings.</p>
        </div>

        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <span className="text-sm font-medium">Developer Mode</span>
            <div className="w-10 h-6 bg-primary/20 rounded-full relative cursor-pointer border border-border">
              <div className="absolute left-1 top-1 w-4 h-4 bg-primary rounded-full"></div>
            </div>
          </div>

          <div className="pt-4 border-t border-border flex justify-end">
            <button className="px-4 py-2 bg-primary text-primary-foreground rounded-md text-sm font-medium hover:opacity-90 transition-opacity">
              Save Changes
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
```

### Engineering Notes:
- **RGB Variables:** We define variables as bare RGB values (`255 255 255`) instead of hex codes. This is a crucial Tailwind trick that allows us to use opacity modifiers later! E.g., `text-foreground/60` translates to `rgba(250,250,250, 0.6)`.
- **Semantic HTML:** Notice the complete lack of `dark:` classes in the component markup. The HTML is perfectly clean. It just asks for `bg-card` and `border-border`, and the CSS variables handle the context swap automatically.
- **Scalability:** This approach (popularized by libraries like shadcn/ui) allows you to re-theme an entire enterprise application simply by swapping out the values in `theme.css`.

## Test Suite (React Testing Library)
```tsx
import React from 'react';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import ThemeShowcase from './ThemeShowcase';

describe('ThemeShowcase Component', () => {
  it('renders the initial light theme state', () => {
    const { container } = render(<ThemeShowcase />);
    expect(container.firstChild).not.toHaveClass('dark');
  });

  it('toggles to dark theme when the button is clicked', async () => {
    const { container } = render(<ThemeShowcase />);
    const toggleButton = screen.getByRole('button', { name: /toggle theme/i });

    await userEvent.click(toggleButton);
    expect(container.firstChild).toHaveClass('dark');

    await userEvent.click(toggleButton);
    expect(container.firstChild).not.toHaveClass('dark');
  });

  it('renders all elements with proper text', () => {
    render(<ThemeShowcase />);
    expect(screen.getByText('Account Settings')).toBeInTheDocument();
    expect(screen.getByText('Developer Mode')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /save changes/i })).toBeInTheDocument();
  });
});
```
