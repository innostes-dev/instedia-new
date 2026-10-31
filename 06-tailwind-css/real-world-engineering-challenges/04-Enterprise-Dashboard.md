# Challenge 4: Enterprise Dashboard Sidebar (Level 4: System Integration)

## Scenario
You are migrating an old dashboard to a modern tech stack. The sidebar navigation is complex. It needs active states, hover states, expandable sub-menus (accordions), and a collapsible state (collapsing down to just icons).

## The Pain Point
Managing active states and nested navigation in CSS usually involves deep, fragile selectors like `.sidebar .menu-item.active > .icon { color: blue; }`. Translating these into React state while maintaining CSS transitions is painful.

## The Challenge
Build a robust, collapsible Sidebar using Tailwind group modifiers, state-driven styling, and React.

### Requirements:
1. **Layout:** The sidebar should be fixed to the left, full height (`h-screen`).
2. **State Management:** A toggle button that switches the sidebar between "expanded" (240px wide) and "collapsed" (64px wide). Use CSS transitions (`transition-all duration-300`) to animate the width.
3. **Item Active States:** If an item is active, it should have a subtle background and a different text/icon color.
4. **Group Hover:** When hovering over an inactive item, the text and icon should change color together. If the sidebar is collapsed, hovering over the icon should show a tooltip (using `group-hover`).

## Architecture Diagram
```text
[ Sidebar Container: h-screen, bg-white, transition-all ]
  (Width: isExpanded ? w-64 : w-16)

  ├─ [ Header: Logo + Toggle Button ]
  │
  └─ [ Nav Items ]
       ├─ [ Item (Active): bg-blue-50, text-blue-600 ]
       └─ [ Item (Inactive): group, hover:bg-gray-50 ]
            ├─ [ Icon: group-hover:text-gray-900 ]
            └─ [ Label: truncate, opacity based on isExpanded ]
                 └─ [ Tooltip (if collapsed): absolute, group-hover:opacity-100 ]
```

## Complete Production Solution

```tsx
import React, { useState } from 'react';
import {
  HomeIcon,
  UsersIcon,
  FolderIcon,
  CalendarIcon,
  ChevronLeftIcon,
  ChevronRightIcon
} from 'lucide-react'; // Assuming lucide-react for icons
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

// Mock Data
const navigation = [
  { name: 'Dashboard', href: '#', icon: HomeIcon, current: true },
  { name: 'Team', href: '#', icon: UsersIcon, current: false },
  { name: 'Projects', href: '#', icon: FolderIcon, current: false },
  { name: 'Calendar', href: '#', icon: CalendarIcon, current: false },
];

export default function Sidebar() {
  const [isExpanded, setIsExpanded] = useState(true);

  return (
    <div className="min-h-screen bg-gray-100 flex">
      {/* Sidebar */}
      <nav
        className={cn(
          "bg-white border-r border-gray-200 flex flex-col transition-all duration-300 ease-in-out relative",
          isExpanded ? "w-64" : "w-16"
        )}
      >
        {/* Header */}
        <div className="h-16 flex items-center px-4 border-b border-gray-200 justify-between">
          <div className={cn(
            "font-bold text-xl text-blue-600 transition-opacity duration-300 overflow-hidden whitespace-nowrap",
            isExpanded ? "opacity-100 w-auto" : "opacity-0 w-0"
          )}>
            NexusUI
          </div>
          <button
            onClick={() => setIsExpanded(!isExpanded)}
            className="p-1 rounded-md hover:bg-gray-100 text-gray-500 hover:text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500 absolute -right-3 top-5 bg-white border border-gray-200 shadow-sm"
          >
            {isExpanded ? <ChevronLeftIcon size={16} /> : <ChevronRightIcon size={16} />}
          </button>
        </div>

        {/* Navigation Links */}
        <div className="flex-1 py-4 flex flex-col gap-1 px-2">
          {navigation.map((item) => (
            <a
              key={item.name}
              href={item.href}
              className={cn(
                "group relative flex items-center px-2 py-2 text-sm font-medium rounded-md transition-colors",
                item.current
                  ? "bg-blue-50 text-blue-700"
                  : "text-gray-700 hover:bg-gray-100 hover:text-gray-900"
              )}
            >
              <item.icon
                className={cn(
                  "mr-3 flex-shrink-0 h-5 w-5 transition-colors",
                  item.current
                    ? "text-blue-700"
                    : "text-gray-400 group-hover:text-gray-900"
                )}
                aria-hidden="true"
              />

              {/* Text Label (Animated hiding) */}
              <span className={cn(
                "transition-all duration-300 overflow-hidden whitespace-nowrap",
                isExpanded ? "opacity-100 w-auto" : "opacity-0 w-0"
              )}>
                {item.name}
              </span>

              {/* Tooltip (Only visible when collapsed AND hovered) */}
              {!isExpanded && (
                <div className="absolute left-full ml-2 px-2 py-1 bg-gray-900 text-white text-xs rounded opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all whitespace-nowrap z-50 pointer-events-none shadow-sm">
                  {item.name}
                </div>
              )}
            </a>
          ))}
        </div>
      </nav>

      {/* Main Content Area */}
      <main className="flex-1 p-8">
        <h1 className="text-2xl font-semibold text-gray-900">Dashboard Content</h1>
        <p className="mt-4 text-gray-600">The sidebar seamlessly animates between {isExpanded ? 'expanded' : 'collapsed'} states.</p>
      </main>
    </div>
  );
}
```

### Engineering Notes:
- **`cn()` for State:** We heavily rely on `cn()` to conditionally apply classes based on React state (e.g., `item.current ? "bg-blue-50..." : "hover:bg-gray-100..."`). This keeps the JSX clean.
- **Animating Width & Opacity:** Animating width in CSS can be janky. By applying `transition-all duration-300` to the parent container, and specifically targeting `w-64` vs `w-16`, we get a smooth slide. For the text labels inside, we animate `opacity` and `width` (`opacity-0 w-0` to `opacity-100 w-auto`) alongside `overflow-hidden whitespace-nowrap` to prevent text from wrapping awkwardly as the container shrinks.
- **Tooltips via `group`:** The tooltip is an absolute div inside the anchor tag. It uses `opacity-0 invisible` by default. When the parent anchor (which has the `group` class) is hovered, it applies `group-hover:opacity-100 group-hover:visible`. This creates a CSS-only tooltip without needing heavy JavaScript libraries like Popper.js.

## Test Suite (React Testing Library)
```tsx
import React from 'react';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import Sidebar from './Sidebar';

describe('Sidebar Component', () => {
  it('renders all navigation items', () => {
    render(<Sidebar />);
    expect(screen.getByText('Dashboard')).toBeInTheDocument();
    expect(screen.getByText('Team')).toBeInTheDocument();
    expect(screen.getByText('Projects')).toBeInTheDocument();
    expect(screen.getByText('Calendar')).toBeInTheDocument();
  });

  it('toggles expansion state when button is clicked', async () => {
    render(<Sidebar />);

    // Initially Expanded
    const logo = screen.getByText('NexusUI');
    expect(logo).toHaveClass('opacity-100');

    // The button that toggles state (assuming it's the only button in the sidebar header)
    const toggleButton = screen.getByRole('button');

    // Click to collapse
    await userEvent.click(toggleButton);
    expect(logo).toHaveClass('opacity-0');

    // Click to expand
    await userEvent.click(toggleButton);
    expect(logo).toHaveClass('opacity-100');
  });

  it('applies active styling to the current item', () => {
    render(<Sidebar />);
    // "Dashboard" is mocked as current: true
    const activeItem = screen.getByText('Dashboard').closest('a');
    expect(activeItem).toHaveClass('bg-blue-50 text-blue-700');

    const inactiveItem = screen.getByText('Team').closest('a');
    expect(inactiveItem).not.toHaveClass('bg-blue-50');
    expect(inactiveItem).toHaveClass('text-gray-700');
  });
});
```
