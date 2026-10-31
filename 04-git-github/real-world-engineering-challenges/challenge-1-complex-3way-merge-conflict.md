# Challenge 1: Complex 3-Way Merge Conflict Resolution on a Critical Production Hotfix

## The Scenario
You are the release engineer. The team is preparing for a massive V2 launch. The `main` branch contains all the new V2 features, including a heavily refactored `database.js` file.

Suddenly, a critical security vulnerability is found in production (which runs on an older `release-v1` branch).
A developer branches off `release-v1` into `hotfix/security`, patches the vulnerability in `database.js`, and merges it back into `release-v1`. Production is saved!

However, your job is to make sure that security patch *also* makes it into the V2 code on `main`. You must merge `release-v1` into `main`. Because both branches heavily modified `database.js`, you are going to hit a massive merge conflict.

## The Setup Script
Run this script in an empty directory to generate the scenario:

```bash
#!/bin/bash
git init
echo "const db = 'localhost:5432';
function connect() {
  console.log('Connected to ' + db);
}
module.exports = { connect };" > database.js
git add database.js && git commit -m "base: v1 database"

# Create the release-v1 branch
git branch release-v1

# Main advances with V2 features
git switch main
echo "const db = process.env.DB_URL || 'localhost:5432';
const poolSize = 20;

async function connect() {
  console.log('V2: Async connection to ' + db + ' with pool ' + poolSize);
}

module.exports = { connect, poolSize };" > database.js
git commit -am "feat(v2): async database pool"

# The Hotfix happens on release-v1
git switch release-v1
git switch -c hotfix/security
echo "const db = 'localhost:5432';
function connect() {
  // SECURITY PATCH APPLIED
  console.log('Securely connected to ' + db);
}
module.exports = { connect };" > database.js
git commit -am "fix: patch database injection"
git switch release-v1
git merge hotfix/security

# Return to main to prepare for the challenge
git switch main
```

## Your Mission
1. Merge the `release-v1` branch into `main`.
2. Git will throw a conflict.
3. Open `database.js`. You must resolve the conflict intelligently. You must KEEP the V2 features (`async`, `poolSize`, `process.env.DB_URL`), but you must INTEGRATE the security patch logic (`// SECURITY PATCH APPLIED`, `Securely connected to`).
4. Finalize the merge.
5. Verify the history graph shows a successful merge commit.

---

## Solution Walkthrough

<details>
<summary>Click to view the step-by-step solution</summary>

### Step 1: Initiate the Merge
Make sure you are on `main`.
```bash
git merge release-v1
```
Output:
```text
Auto-merging database.js
CONFLICT (content): Merge conflict in database.js
Automatic merge failed; fix conflicts and then commit the result.
```

### Step 2: Open and Analyze the File
Open `database.js`. You will see something like this:

```javascript
<<<<<<< HEAD
const db = process.env.DB_URL || 'localhost:5432';
const poolSize = 20;

async function connect() {
  console.log('V2: Async connection to ' + db + ' with pool ' + poolSize);
}

module.exports = { connect, poolSize };
=======
const db = 'localhost:5432';
function connect() {
  // SECURITY PATCH APPLIED
  console.log('Securely connected to ' + db);
}
module.exports = { connect };
>>>>>>> release-v1
```

### Step 3: Resolve the Logic intelligently
We need the V2 variables (`db`, `poolSize`), the V2 `async function`, the `module.exports`, AND the security logic.

Delete the `<<<<<<<`, `=======`, and `>>>>>>>` markers. Combine the logic like this:

```javascript
const db = process.env.DB_URL || 'localhost:5432';
const poolSize = 20;

async function connect() {
  // SECURITY PATCH APPLIED
  console.log('V2: Securely connected to ' + db + ' with pool ' + poolSize);
}

module.exports = { connect, poolSize };
```

### Step 4: Finalize the Merge
Now that the file is correct, stage it and commit to finalize the merge.
```bash
git add database.js
git commit -m "Merge release-v1 into main: apply security patch to V2 async logic"
```

### Step 5: Verify History
```bash
git log --oneline --graph -n 5
```
You will see a beautiful graph showing the hotfix branching off, merging back to release, and then release merging into main!

</details>
