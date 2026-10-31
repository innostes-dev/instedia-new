# Challenge 2: Deep Immutable Object Freezing Engine

## Scenario
You are building a central state manager (like Redux). The state object is deeply nested (e.g., `state.user.preferences.notifications.email`). If a developer accidentally mutates this state directly instead of using a reducer (`state.user.preferences = ...`), React won't re-render, and bugs ensue.
The built-in `Readonly<T>` utility only freezes the top level. You need a recursive `DeepReadonly<T>` type to lock down the entire tree.

## Challenge Requirements
1. Create a `DeepReadonly<T>` mapped type.
2. It should check if `T` is an object. If it is a primitive (string, number, boolean), it should just return the primitive (you can't freeze a number).
3. If it is an object, it should make all properties `readonly`.
4. Crucially, it must apply itself *recursively* to all nested properties.
5. Create a nested state object and prove that TS blocks mutating deeply nested properties.

<details>
<summary>Solution Walkthrough</summary>

```typescript
// 1. The Recursive Type Definition
// This uses "Conditional Types" (T extends condition ? true : false)
// and "Mapped Types" ({ [Key in keyof T]: Type })
type DeepReadonly<T> =
  // If T is a function, we don't freeze it
  T extends Function ? T :
  // If T is an object (and not null), we iterate over its keys
  T extends object ? {
    // For every key K in object T, make it readonly, and...
    readonly [K in keyof T]: DeepReadonly<T[K]>; // ...Recursively call DeepReadonly on the value!
  } :
  // If it's a primitive (string, number), just return it as is
  T;


// --- Usage & Testing ---

interface AppState {
  user: {
    id: string;
    preferences: {
      theme: "light" | "dark";
      notifications: {
        email: boolean;
        sms: boolean;
      };
    };
  };
  dataLoaded: boolean;
}

// We wrap our state type in the engine
const state: DeepReadonly<AppState> = {
  user: {
    id: "u_1",
    preferences: {
      theme: "dark",
      notifications: {
        email: true,
        sms: false
      }
    }
  },
  dataLoaded: true
};

// Level 1 freeze (Handled by standard Readonly)
// state.dataLoaded = false; // ERROR: Cannot assign to 'dataLoaded'

// Level 2 freeze
// state.user.id = "u_2"; // ERROR: Cannot assign to 'id'

// Level 4 deep freeze!
// state.user.preferences.notifications.email = false; // ERROR: Cannot assign to 'email' because it is a read-only property.

```

**Walkthrough:**
This challenge introduces two extremely advanced but vital TS concepts: Conditional Types (`T extends U ? X : Y`) and Recursive Types (a type that calls itself). By mapping over the keys and applying `DeepReadonly` to the values, the compiler travels all the way down the object tree, locking every single door it finds.
</details>
