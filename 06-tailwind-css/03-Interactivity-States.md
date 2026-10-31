# Module 03: Interactivity & States (hover, focus, group, peer, dark)

## Phase A: The Core Concept

### 1. Real-World Pain Point (The Why)
Handling interaction states in traditional CSS requires writing multiple separate blocks: `:hover`, `:focus`, `:active`, and managing parent-child hover states (e.g., changing an icon's color when the parent card is hovered). When you add Dark Mode into the mix using `@media (prefers-color-scheme: dark)`, your CSS file size doubles, and maintaining the visual connection between `button.primary` and `button.primary:hover` becomes a scrolling nightmare.

### 2. Plain English Metaphor (The What)
State modifiers in Tailwind are like context-sensitive tools. Instead of having one hammer for daylight and a completely different hammer for night, you have one smart hammer. By prefixing a class with `hover:`, `focus:`, or `dark:`, you are telling the browser, "Only apply this specific coat of paint when the user interacts with it or when the lights go out." It keeps the logic exactly where the element is.

### 3. Complete Runnable Code
```html
<!DOCTYPE html>
<html lang="en">
<head>
    <script src="https://cdn.tailwindcss.com"></script>
    <script>
        // Enable dark mode variant for the CDN
        tailwind.config = { darkMode: 'class' }
    </script>
</head>
<!-- Toggle 'dark' class on the body to see Dark Mode -->
<body class="p-12 bg-white dark:bg-gray-900 transition-colors duration-300">

    <!-- Group Hover Example -->
    <div class="group block max-w-xs mx-auto rounded-lg p-6 bg-white ring-1 ring-slate-900/5 shadow-lg space-y-3 hover:bg-sky-500 hover:ring-sky-500 transition-all cursor-pointer">
        <div class="flex items-center space-x-3">
            <!-- Icon changes color when PARENT is hovered -->
            <svg class="h-6 w-6 stroke-sky-500 group-hover:stroke-white" fill="none" viewBox="0 0 24 24"><!-- ... --></svg>
            <h3 class="text-slate-900 group-hover:text-white text-sm font-semibold">New project</h3>
        </div>
        <p class="text-slate-500 group-hover:text-white text-sm">Create a new project from a variety of starting templates.</p>
    </div>

    <!-- Peer Example (Floating Label) -->
    <div class="relative max-w-xs mx-auto mt-12">
        <input type="text" id="email" class="peer border-b-2 border-gray-300 text-gray-900 dark:text-white dark:border-gray-600 focus:outline-none focus:border-sky-500 dark:focus:border-sky-400 bg-transparent w-full pt-4 pb-1" placeholder=" " />
        <!-- Label reacts to the INPUT's state -->
        <label for="email" class="absolute left-0 top-0 text-gray-500 text-xs transition-all peer-placeholder-shown:text-base peer-placeholder-shown:top-4 peer-focus:top-0 peer-focus:text-xs peer-focus:text-sky-500">Email Address</label>
    </div>

</body>
</html>
```

### 4. Progressive Step-by-Step Breakdown

**Step 1: Basic Hover & Focus**
```html
<button class="bg-blue-500 hover:bg-blue-600 focus:ring-4 focus:ring-blue-300">
    Click Me
</button>
```
`hover:bg-blue-600` changes the background on mouse over. `focus:ring-4` adds a focus ring for accessibility when tabbing via keyboard.

**Step 2: The Magic of `group`**
```html
<div class="group hover:bg-blue-500">
    <h3 class="text-black group-hover:text-white">Title</h3>
</div>
```
When you hover over the child `<h3>`, it won't change unless you hover directly on the text. But by adding `group` to the parent div, you can use `group-hover:` on the child. Now, hovering *anywhere* on the card turns the text white.

**Step 3: The Wizardry of `peer`**
```html
<input class="peer" type="checkbox" />
<span class="text-gray-400 peer-checked:text-green-500">I agree</span>
```
`peer` allows a sibling element to style itself based on the state of a preceding sibling. Here, the `<span>` turns green only when the checkbox (`peer`) is checked.

### 5. ASCII Data Flow
```text
State Dependencies:

[ group ] ---> Controls ---> [ group-hover:text-white ]
(Parent)                     (Child)

[ peer ]  ---> Controls ---> [ peer-focus:text-blue-500 ]
(Input)                      (Next Sibling)
```

### 6. Noob Trap vs Pro Tip
**Noob Trap:** Using JavaScript `onMouseEnter` and `onMouseLeave` state to manage complex hover effects (like showing/hiding a child button when a card is hovered). This is slow and unnecessary.
**Pro Tip:** Use `group` and `group-hover:opacity-100` (starting with `opacity-0`) to handle complex UI reveals entirely in CSS, keeping your React/Vue components pure and performant.

---

## Phase B: Engineering Challenges

### Level 1: Warm-Up
**Challenge:** Build an interactive button that supports Dark Mode.
Light mode: Light gray background, dark text, hovers to slightly darker gray.
Dark mode: Dark gray background, white text, hovers to a slightly lighter dark gray.
Add a focus ring that works cleanly in both modes.

<details>
<summary>Hint</summary>
Use `bg-gray-100 dark:bg-gray-800`. For hover, `hover:bg-gray-200 dark:hover:bg-gray-700`. For focus, `focus:ring-2 focus:ring-blue-500 focus:outline-none`.
</details>

<details>
<summary>Solution Walkthrough</summary>
```html
<button class="px-6 py-2 font-medium rounded-lg transition-colors
               bg-gray-100 text-gray-900 hover:bg-gray-200
               dark:bg-gray-800 dark:text-white dark:hover:bg-gray-700
               focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 dark:focus:ring-offset-gray-900">
    Submit
</button>
```
- Notice the use of `dark:` prefix to completely swap the color palette.
- `focus:ring-offset-2` creates a small gap between the button and the focus ring. `dark:focus:ring-offset-gray-900` ensures the gap matches a dark background.
</details>

### Level 2: Real-World
**Challenge:** Build an Airbnb-style Image Card with a Group Hover effect.
Create a card with an image placeholder (gray box) and some text below it. When the user hovers *anywhere* on the card:
1. The image placeholder should scale up slightly (zoom effect).
2. A heart icon in the top right corner of the image should appear (fade in).

<details>
<summary>Hint</summary>
Make the parent card a `group`.
Wrap the image area in `overflow-hidden`. Apply `transition-transform duration-300 group-hover:scale-105` to the image div.
Apply `opacity-0 group-hover:opacity-100 transition-opacity` to the heart icon div.
</details>

<details>
<summary>Solution Walkthrough</summary>
```html
<div class="group cursor-pointer max-w-xs">
    <!-- Image Wrapper -->
    <div class="relative w-full aspect-square rounded-xl overflow-hidden mb-3">
        <!-- The Image (Mock) -->
        <div class="w-full h-full bg-gray-200 transition-transform duration-500 group-hover:scale-110"></div>

        <!-- The Heart Icon -->
        <div class="absolute top-3 right-3 opacity-0 group-hover:opacity-100 transition-opacity duration-300">
            <svg class="w-6 h-6 text-white stroke-current fill-transparent hover:fill-red-500 hover:text-red-500 transition-colors" viewBox="0 0 24 24" stroke-width="2"><!-- heart path --></svg>
        </div>
    </div>

    <!-- Content -->
    <h3 class="font-bold text-gray-900">Lake Tahoe, California</h3>
    <p class="text-gray-500">234 miles away</p>
    <p class="font-bold text-gray-900 mt-1">$250 <span class="font-normal">night</span></p>
</div>
```
- `group-hover:scale-110` handles the zoom. The parent `overflow-hidden` ensures the image doesn't break out of rounded corners during the zoom.
- `opacity-0 group-hover:opacity-100` gracefully fades the heart in via pure CSS.
</details>

### Level 3: Boss Level
**Challenge:** Build an Enterprise "Settings Row" Component.
Cumulative Challenge: Combines Flexbox, Typography, Group, Peer, and Dark Mode.
Requirements:
- A list row that contains a label, a description, and a custom CSS-only Toggle Switch.
- The row must look great in both Light and Dark mode.
- The toggle switch must be built using an `<input type="checkbox" class="peer sr-only">` and a `div` that acts as the track/thumb.
- When the input is `:checked` (via `peer-checked`), the toggle track must turn green, and the thumb must slide to the right (`translate-x`).
- The entire row should have a subtle background hover effect.

<details>
<summary>Hint</summary>
Use `peer` on the hidden checkbox. The track div follows it. Use `peer-checked:bg-green-500` on the track. Inside the track, use a thumb div with `peer-checked:translate-x-full`.
</details>

<details>
<summary>Solution Walkthrough</summary>
```html
<!-- The Row (Group for row-level hover) -->
<label class="group flex items-center justify-between p-4 cursor-pointer rounded-xl hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors">

    <!-- Text Content -->
    <div class="flex flex-col pr-4">
        <span class="text-sm font-semibold text-gray-900 dark:text-white">Enable Notifications</span>
        <span class="text-sm text-gray-500 dark:text-gray-400">Receive push notifications for critical alerts.</span>
    </div>

    <!-- Custom Toggle Structure -->
    <div class="relative inline-flex items-center">
        <!-- Hidden Input (The State Machine) -->
        <input type="checkbox" class="peer sr-only" />

        <!-- Toggle Track -->
        <div class="w-11 h-6 bg-gray-200 dark:bg-gray-700 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-blue-300 dark:peer-focus:ring-blue-800 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-green-500"></div>
    </div>
</label>
```
- **The State Machine:** `<input type="checkbox" class="peer sr-only">` handles accessibility, focus, and state without JavaScript.
- **The Track:** The `div` following it reads the state. `peer-checked:bg-green-500` changes the background.
- **The Thumb:** We use pseudo-elements (`after:`) styled via Tailwind to create the circle. `peer-checked:after:translate-x-full` slides it over perfectly.
- **Enterprise Polish:** Wrapping everything in a `<label class="group">` means clicking anywhere on the row toggles the checkbox, and the whole row has a cohesive hover state in both light/dark modes.
</details>
