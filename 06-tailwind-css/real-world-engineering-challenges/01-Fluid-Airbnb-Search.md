# Challenge 1: Fluid Airbnb Search Bar (Level 1: Resilient Client)

## Scenario
You are a frontend engineer at a travel startup. The core feature of the homepage is a prominent search bar. The design team has handed you a Figma file showing a pill-shaped container that holds three distinct search inputs (Location, Check-in, Guests) and a prominent Search button.

## The Pain Point
Traditional CSS struggles with responsive input groups. Floats cause wrapping issues, and managing borders between inputs often requires messy `first-child`/`last-child` selectors or complex calc() math for widths.

## The Challenge
Build a single, resilient search bar component using Tailwind CSS.

### Requirements:
1. **Container:** A pill shape (`rounded-full`) with a white background and a subtle shadow (`shadow-md`), constrained to a max-width and centered.
2. **Layout:** Use Flexbox to align the inputs side-by-side. The inputs should evenly divide the available space.
3. **Dividers:** Include a subtle vertical divider (`border-l`) between each input area, but *not* before the first one.
4. **Interactive States:** When a user hovers over an input area, it should gain a subtle gray background (`hover:bg-gray-100`) and fully rounded corners (`rounded-full`).
5. **Button:** A prominent, brightly colored, fully rounded button on the far right.

## Starter Template (React)
```tsx
import React from 'react';

export default function SearchBar() {
  return (
    <div className="min-h-screen bg-gray-100 flex items-center justify-center p-4">
      {/* Build your Search Bar here */}
      <div className="YOUR_CONTAINER_CLASSES">

        {/* Block 1: Location */}
        <div className="YOUR_BLOCK_CLASSES">
          <label>Where</label>
          <input placeholder="Search destinations" />
        </div>

        {/* Block 2: Dates */}
        <div className="YOUR_BLOCK_CLASSES">
           <label>Check in</label>
           <input placeholder="Add dates" />
        </div>

        {/* Block 3: Guests + Button */}
        <div className="YOUR_BLOCK_CLASSES">
           <div>
             <label>Who</label>
             <input placeholder="Add guests" />
           </div>
           <button>Search</button>
        </div>

      </div>
    </div>
  );
}
```

## Architecture Diagram
```text
[ Container: flex, rounded-full, shadow, bg-white ]
  ├─ [ Block 1: flex-1, hover:bg-gray-100, rounded-full ]
  │    └─ [ Input Content ]
  ├─ [ Divider: w-px, h-8, bg-gray-200 ]
  ├─ [ Block 2: flex-1, hover:bg-gray-100, rounded-full ]
  │    └─ [ Input Content ]
  ├─ [ Divider: w-px, h-8, bg-gray-200 ]
  └─ [ Block 3: flex-1, flex items-center justify-between ]
       ├─ [ Input Content ]
       └─ [ Button: rounded-full, bg-red-500 ]
```

## Complete Production Solution
```tsx
import React from 'react';

export default function SearchBar() {
  return (
    <div className="min-h-screen bg-gray-100 flex items-center justify-center p-4 font-sans">

      {/* Outer Pill Container */}
      <div className="flex items-center w-full max-w-4xl bg-white rounded-full shadow-lg border border-gray-200 p-2">

        {/* Block 1: Location */}
        <button className="flex-1 flex flex-col justify-center px-6 py-2 rounded-full hover:bg-gray-100 transition text-left cursor-pointer group">
          <span className="text-xs font-bold text-gray-900">Where</span>
          <input
            type="text"
            placeholder="Search destinations"
            className="text-sm text-gray-600 bg-transparent focus:outline-none placeholder-gray-400 group-hover:placeholder-gray-500 w-full truncate"
          />
        </button>

        {/* Divider */}
        <div className="w-px h-8 bg-gray-200 hidden sm:block"></div>

        {/* Block 2: Dates */}
        <button className="flex-1 hidden sm:flex flex-col justify-center px-6 py-2 rounded-full hover:bg-gray-100 transition text-left cursor-pointer group">
          <span className="text-xs font-bold text-gray-900">Check in</span>
          <span className="text-sm text-gray-400 group-hover:text-gray-500 truncate">Add dates</span>
        </button>

        {/* Divider */}
        <div className="w-px h-8 bg-gray-200 hidden md:block"></div>

        {/* Block 3: Guests & Button */}
        <div className="flex-1 hidden md:flex items-center justify-between pl-6 pr-2 py-2 rounded-full hover:bg-gray-100 transition cursor-pointer group">
          <div className="flex flex-col justify-center text-left">
            <span className="text-xs font-bold text-gray-900">Who</span>
            <span className="text-sm text-gray-400 group-hover:text-gray-500 truncate">Add guests</span>
          </div>

          {/* Search Button */}
          <button className="flex items-center justify-center bg-rose-600 hover:bg-rose-700 text-white rounded-full h-12 w-12 md:w-auto md:px-6 transition flex-shrink-0">
            <svg className="w-4 h-4 md:mr-2 stroke-current" fill="none" viewBox="0 0 24 24" strokeWidth="3">
              <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
            <span className="hidden md:block font-bold">Search</span>
          </button>
        </div>

      </div>
    </div>
  );
}
```

### Engineering Notes:
- **`flex-1`:** This is critical. It forces the 3 search blocks to distribute the remaining space evenly inside the flex container.
- **`truncate`:** Prevents long input values from breaking the flex layout, replacing overflow text with an ellipsis.
- **Interactive Focus (`group-hover`):** We use a `button` element for the blocks (except the input) for accessibility. By applying `group` to the button, we can darken the placeholder text on hover to indicate interactivity.
- **Responsive Hide:** Notice the use of `hidden sm:flex` and `hidden md:flex`. The full bar is too wide for mobile, so this solution progressively reveals sections as the screen size grows.

## Test Suite (React Testing Library)
```tsx
import React from 'react';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import SearchBar from './SearchBar';

describe('SearchBar Component', () => {
  it('renders all inputs and the search button', () => {
    render(<SearchBar />);

    expect(screen.getByText('Where')).toBeInTheDocument();
    expect(screen.getByPlaceholderText('Search destinations')).toBeInTheDocument();

    expect(screen.getByText('Check in')).toBeInTheDocument();
    expect(screen.getByText('Add dates')).toBeInTheDocument();

    expect(screen.getByText('Who')).toBeInTheDocument();
    expect(screen.getByText('Add guests')).toBeInTheDocument();

    expect(screen.getByRole('button', { name: /search/i })).toBeInTheDocument();
  });

  it('allows typing into the location input', async () => {
    render(<SearchBar />);
    const locationInput = screen.getByPlaceholderText('Search destinations');
    await userEvent.type(locationInput, 'Paris');
    expect(locationInput).toHaveValue('Paris');
  });
});
```
