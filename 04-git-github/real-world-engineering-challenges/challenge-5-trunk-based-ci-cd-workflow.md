# Challenge 5: Enterprise Trunk-Based CI/CD Workflow with Branch Protection & Automated Releases

## The Scenario
You are setting up the core infrastructure for a new startup. The startup wants to move fast but not break things. They have decided to use **Trunk-Based Development**.

The rules are:
1. Developers cannot push directly to `main`.
2. All code must pass an automated Python Linter (`flake8`) before it can be merged via Pull Request.
3. Every time a new SemVer Tag (e.g., `v1.2.0`) is pushed to GitHub, an automated script should compile the code and create a "Release" artifact.

Since you are running this locally without a real GitHub server, you will write the exact GitHub Actions `.yaml` files required to enforce this policy, and you will simulate the Git branching and tagging commands a developer would use to navigate this workflow.

## The Setup Script
Run this script in an empty directory to initialize the project:

```bash
#!/bin/bash
git init
mkdir src
echo "def hello():
    print('Hello World')
" > src/main.py
echo "flake8" > requirements.txt
git add .
git commit -m "chore: initial project structure"
```

## Your Mission

**Part 1: The CI Pipeline (Pull Request Gatekeeper)**
1. Create the necessary directory structure for GitHub Actions.
2. Write a workflow file named `ci.yml` that triggers on `pull_request` to the `main` branch.
3. It must check out the code, set up Python 3.10, install `flake8` via pip, and run `flake8 src/`.

**Part 2: The CD Pipeline (Automated Release)**
1. Write a workflow file named `release.yml` that triggers ONLY when a tag starting with `v` is pushed.
2. It must check out the code and run a dummy build command: `echo "Compiled binary" > binary.zip`.
3. It must use the `softprops/action-gh-release@v1` action to upload `binary.zip` to the GitHub Releases page.

**Part 3: The Developer Simulation**
1. Commit the two `.yaml` files to `main`.
2. Simulate a developer workflow: Create a feature branch `feat/add-math`.
3. Add a new file `src/math.py` with some code. Commit it.
4. (Simulation): Assume the developer pushes this branch, opens a PR, the `ci.yml` robot passes, and the PR is merged into `main`. Switch back to `main` and merge the feature branch locally to simulate the PR merge.
5. Create an annotated SemVer tag for this new release (`v1.1.0`).

---

## Solution Walkthrough

<details>
<summary>Click to view the step-by-step solution</summary>

### Step 1: Create the CI Pipeline (`ci.yml`)
```bash
mkdir -p .github/workflows
```

Create `.github/workflows/ci.yml`:
```yaml
name: CI Gatekeeper

on:
  pull_request:
    branches: [ "main" ]

jobs:
  lint:
    runs-on: ubuntu-latest
    steps:
      - name: Checkout Code
        uses: actions/checkout@v3

      - name: Setup Python
        uses: actions/setup-python@v4
        with:
          python-version: '3.10'

      - name: Install dependencies
        run: pip install flake8

      - name: Run Linter
        run: flake8 src/
```

### Step 2: Create the CD Pipeline (`release.yml`)
Create `.github/workflows/release.yml`:
```yaml
name: Automated Release

on:
  push:
    tags:
      - 'v*'

jobs:
  build-and-release:
    runs-on: ubuntu-latest
    steps:
      - name: Checkout Code
        uses: actions/checkout@v3

      - name: Build Artifact
        run: echo "Compiled binary" > binary.zip

      - name: Publish Release
        uses: softprops/action-gh-release@v1
        with:
          files: binary.zip
        env:
          GITHUB_TOKEN: ${{ secrets.GITHUB_TOKEN }}
```

### Step 3: Commit the Infrastructure
```bash
git add .github/
git commit -m "ci: add GitHub actions for PR linting and automated releases"
```
*(In the real world, you would push this to GitHub and setup Branch Protection in the UI).*

### Step 4: Developer Workflow Simulation
A developer picks up a ticket to add math functions.
```bash
git switch -c feat/add-math
echo "def add(a, b): return a + b" > src/math.py
git add src/math.py
git commit -m "feat: add math utility"
```
*(The developer pushes this branch to GitHub and opens a PR. The `ci.yml` robot runs `flake8`. It passes! A reviewer clicks "Merge".)*

Simulate the PR merge locally:
```bash
git switch main
git merge feat/add-math
```

### Step 5: Cut a Release
The team decides the math utility is ready for customers. We cut a minor version release.
```bash
git tag -a v1.1.0 -m "Release v1.1.0: Added math utility"
```
*(You run `git push origin --tags`. The `release.yml` robot wakes up, sees the `v1.1.0` tag, builds `binary.zip`, and publishes it to the GitHub Releases page!)*

</details>
