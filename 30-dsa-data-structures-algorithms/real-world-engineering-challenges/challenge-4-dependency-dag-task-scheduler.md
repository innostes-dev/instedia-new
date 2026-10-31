# Challenge 4: Dependency DAG Task Scheduler

## 1. The Real-World Engineering Problem
You are writing the core execution engine for a CI/CD pipeline (like GitHub Actions). You are given a list of `tasks` (represented by string names) and a list of `dependencies` (pairs of `[TaskA, TaskB]`, meaning TaskA *must finish before* TaskB can start).
You must output a valid execution order. If the user accidentally creates a circular dependency (TaskA -> TaskB -> TaskA), your engine must detect it and throw an error rather than entering an infinite loop.

## 2. Architecture Diagram (Topological Sort)
```text
Tasks: A, B, C, D
Rules: [A, B] (A before B), [A, C], [B, D], [C, D]

Graph (Adjacency List):
A -> [B, C]
B -> [D]
C -> [D]
D -> []

In-Degree (Incoming Arrows):
A: 0  (Starts in Queue)
B: 1
C: 1
D: 2

Execution: Pop A. Erase arrows A->B, A->C.
In-Degrees update: B(0), C(0). Push B, C to Queue.
```

## 3. Starter Template
```javascript
// starter-template.js

class TaskScheduler {
  /**
   * @param {string[]} tasks - Array of task names
   * @param {string[][]} dependencies - Array of [Prerequisite, Dependent]
   * @return {string[]} A valid execution order
   * @throws {Error} If a cyclic dependency is detected
   */
  schedule(tasks, dependencies) {
    // TODO: Build Graph Map and InDegree Map

    // TODO: Find starting tasks (InDegree 0)

    // TODO: Kahn's Algorithm (BFS)

    // TODO: Cycle Detection

    return [];
  }
}
```

## 4. Production Walkthrough (Full Solution)

<details>
<summary>✅ View Full Production Solution & Tests</summary>

### The Kahn's Algorithm Solution
We map string names to a Graph and an In-Degree map. We process the DAG using a queue. If the final output length doesn't match the input task count, a cycle exists.

```javascript
class TaskScheduler {
  schedule(tasks, dependencies) {
    const graph = new Map();
    const inDegree = new Map();

    // 1. Initialize data structures
    for (const task of tasks) {
      graph.set(task, []);
      inDegree.set(task, 0);
    }

    // 2. Populate Graph and In-Degrees
    for (const [prereq, dependent] of dependencies) {
      if (!graph.has(prereq) || !graph.has(dependent)) {
        throw new Error("Unknown task in dependencies");
      }
      graph.get(prereq).push(dependent);
      inDegree.set(dependent, inDegree.get(dependent) + 1);
    }

    // 3. Bootstrap Queue with 0-dependency tasks
    const queue = [];
    for (const [task, degree] of inDegree.entries()) {
      if (degree === 0) {
        queue.push(task);
      }
    }

    // 4. Process (Kahn's Algorithm)
    const executionOrder = [];
    while (queue.length > 0) {
      const currentTask = queue.shift();
      executionOrder.push(currentTask);

      for (const dependentTask of graph.get(currentTask)) {
        inDegree.set(dependentTask, inDegree.get(dependentTask) - 1);

        if (inDegree.get(dependentTask) === 0) {
          queue.push(dependentTask);
        }
      }
    }

    // 5. Cycle Check
    if (executionOrder.length !== tasks.length) {
      throw new Error("Deadlock detected: Cyclic dependency");
    }

    return executionOrder;
  }
}
```

### Test Suite (Jest)
```javascript
describe('TaskScheduler', () => {
  const scheduler = new TaskScheduler();

  it('should schedule valid tasks correctly', () => {
    const tasks = ["build", "test", "lint", "deploy"];
    const rules = [
      ["lint", "build"],
      ["build", "test"],
      ["test", "deploy"]
    ];

    const order = scheduler.schedule(tasks, rules);
    expect(order).toEqual(["lint", "build", "test", "deploy"]);
  });

  it('should detect cycles and throw', () => {
    const tasks = ["A", "B", "C"];
    const rules = [
      ["A", "B"],
      ["B", "C"],
      ["C", "A"] // Cycle!
    ];

    expect(() => scheduler.schedule(tasks, rules)).toThrow(/Deadlock/);
  });
});
```
</details>
