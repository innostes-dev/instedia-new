# Challenge 4: Offline Kanban Board

## The Engineering Scenario
You are a Principal Frontend Engineer at Trello. The team is building a new "Offline Mode" prototype. Users need to be able to drag and drop tasks between columns, and if they close their browser and return an hour later (without an internet connection), the tasks must remain in the exact columns they were dropped into.
Your task is to build the HTML and Native Drag-and-Drop architecture, integrated with Browser Storage Persistence.

## Acceptance Criteria
- Build two columns (`<section>`) titled "To Do" and "Done".
- Create one task card (`<article>`) that is draggable.
- Use `data-*` attributes to store a unique ID on the task card.
- The columns must intercept the `dragover` event to authorize dropping.
- When the task is dropped, a provided JS function will execute. You must write the HTML triggers to package the data using `ondragstart` and the drop handler using `ondrop`.
- Add a "Save State" button that triggers a `localStorage` save.

---

## Starter Code
```html
<main>
  <!-- Make these columns capable of receiving drops -->
  <section id="col-todo">
    <h2>To Do</h2>

    <!-- Make this card draggable and attach the data transfer -->
    <article id="task-99">
      <h3>Write Documentation</h3>
    </article>
  </section>

  <section id="col-done">
    <h2>Done</h2>
  </section>

  <button>Save State</button>
</main>
```

---

## Production Solution Walkthrough

<details>
<summary>View the Principal-Level Solution</summary>

```html
<main style="display: flex; gap: 2rem;">

  <!-- Column 1: To Do -->
  <!-- preventDefault() is required to tell the browser this is a valid drop target -->
  <section
    id="col-todo"
    class="kanban-column"
    ondragover="event.preventDefault()"
    ondrop="handleDrop(event)"
  >
    <h2>To Do</h2>

    <!-- The Draggable Task -->
    <!-- data-task-id is used for strict state tracking -->
    <!-- ondragstart loads the ID into the browser's drag memory buffer -->
    <article
      id="task-99"
      class="task-card"
      draggable="true"
      data-task-id="99"
      ondragstart="event.dataTransfer.setData('text/plain', event.target.id)"
    >
      <h3>Write Documentation</h3>
    </article>

  </section>

  <!-- Column 2: Done -->
  <section
    id="col-done"
    class="kanban-column"
    ondragover="event.preventDefault()"
    ondrop="handleDrop(event)"
  >
    <h2>Done</h2>
    <!-- Dropped items will be appended here by JS -->
  </section>

</main>

<hr>

<!-- Storage Trigger -->
<button onclick="saveBoardState()">Save Board Offline</button>

<!-- The Integration Logic (For demonstration of the HTML Hooks) -->
<script>
  // 1. Move the DOM Node
  function handleDrop(event) {
    event.preventDefault();
    // Retrieve the ID we packaged in the HTML ondragstart attribute
    const taskId = event.dataTransfer.getData("text/plain");
    const draggedElement = document.getElementById(taskId);

    // Check if we dropped it directly onto the section, or accidentally onto another card
    if (event.currentTarget.classList.contains('kanban-column')) {
       event.currentTarget.appendChild(draggedElement);
    }
  }

  // 2. Persist the State
  function saveBoardState() {
    // We could read the data-task-id from the DOM to build a JSON object
    const doneColumn = document.getElementById('col-done');
    const tasksInDone = doneColumn.querySelectorAll('.task-card').length > 0;

    // Save to permanent browser storage
    const state = { task99: tasksInDone ? 'done' : 'todo' };
    localStorage.setItem('trello_offline_state', JSON.stringify(state));
    alert('Board saved offline!');
  }
</script>
```

### Why this is production-grade:
1. **Native Performance:** By using `draggable="true"` and the native `dataTransfer` API, we offload the heavy lifting of the drag visual (the ghost image attached to the cursor) entirely to the browser's C++ rendering engine, rather than relying on slow JavaScript math.
2. **Strict Data Typing:** We use a semantic `id` for DOM manipulation, but we *also* include `data-task-id="99"` so that when the JS eventually scans the board to save to the database, it has a clean, math-ready integer to work with instead of having to parse the string "task-99".
3. **Persistence:** `localStorage` ensures that even if the user restarts their computer, the board state is preserved securely on their hard drive.
</details>
