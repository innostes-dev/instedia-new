# Challenge 4: Disaster Recovery: Reconstructing a Deleted Branch and Orphaned Commits via `reflog`

## The Scenario
It's 4:55 PM on a Friday. You have been working on a complex Dockerfile in the `feature/dockerize` branch all day. You made two commits to it.
You switch back to `main` to test something for a coworker.

While on `main`, you intend to delete an old branch named `feature/old-junk`. By accident, you type `git branch -D feature/dockerize`.
Because you haven't pushed `feature/dockerize` to GitHub yet, Git destroys the branch pointer locally. Your `Dockerfile` vanishes from your working directory. Running `git log` on `main` shows absolutely no trace of your Docker commits.

You need to recover that entire branch exactly as it was, right now, before you leave for the weekend.

## The Setup Script
Run this script in an empty directory to generate the disaster:

```bash
#!/bin/bash
git init
echo "print('hello world')" > app.py
git add app.py && git commit -m "base: initial app"

# The Friday afternoon work
git switch -c feature/dockerize
echo "FROM python:3.9" > Dockerfile
git add Dockerfile && git commit -m "chore: base python image"
echo "COPY . /app" >> Dockerfile
echo "CMD ['python', 'app.py']" >> Dockerfile
git commit -am "feat: finish dockerfile"

# The Accident
git switch main
git branch -D feature/dockerize

echo "Disaster complete. The feature/dockerize branch is gone!"
```

## Your Mission
1. Run `git status` and `ls` to confirm you are on `main` and the `Dockerfile` is completely gone.
2. Run `git log` to confirm the two Docker commits do not exist in the normal history.
3. Access the hidden Git Reference Log.
4. Locate the exact commit hash of the moment you finished the Dockerfile.
5. Create a new branch called `feature/dockerize-recovered` pointing to that exact commit hash.
6. Verify the `Dockerfile` is fully restored and the history contains your two lost commits.

---

## Solution Walkthrough

<details>
<summary>Click to view the step-by-step solution</summary>

### Step 1: Verify the Disaster
```bash
git status
# "On branch main"
ls
# Output: app.py (No Dockerfile!)
git log --oneline
# Output: (hash) base: initial app
```
The work is completely invisible to normal Git commands.

### Step 2: Open the Reference Log
The `reflog` records every time the `HEAD` pointer moves, regardless of branches.
```bash
git reflog
```
Output will look similar to this:
```text
a1b2c3d (HEAD -> main) HEAD@{0}: checkout: moving from feature/dockerize to main
e9f8g7h HEAD@{1}: commit: feat: finish dockerfile
i4j5k6l HEAD@{2}: commit: chore: base python image
a1b2c3d (HEAD -> main) HEAD@{3}: checkout: moving from main to feature/dockerize
a1b2c3d (HEAD -> main) HEAD@{4}: commit (initial): base: initial app
```

### Step 3: Identify the Lost Coordinate
Read the messages on the right. We want the state of the repository exactly at the moment we finished the Dockerfile.
That corresponds to `HEAD@{1}: commit: feat: finish dockerfile`.
Look at the hash on the far left of that line (in our example, `e9f8g7h`). This is the orphaned commit!

### Step 4: Rebuild the Branch
We instruct Git to create a new branch pointer and staple it to that orphaned commit.
```bash
# Replace e9f8g7h with your actual hash from step 3
git branch feature/dockerize-recovered e9f8g7h
```

### Step 5: Verify Recovery
Switch to the newly recovered branch.
```bash
git switch feature/dockerize-recovered
ls
# Output: app.py  Dockerfile (It's back!)

git log --oneline
# Output:
# e9f8g7h feat: finish dockerfile
# i4j5k6l chore: base python image
# a1b2c3d base: initial app
```
Crisis averted! You can now safely push this branch to the cloud and go home.

</details>
