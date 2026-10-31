# Challenge 2: Rewriting Messy Git History via Interactive Rebase & Commit Squashing

## The Scenario
You are a developer working on a new `feature/dashboard` branch. Over the course of the week, you have made a total mess of your Git history. You committed things that were broken, you fixed typos in separate commits, and your commit messages are unhelpful (e.g., "wip", "stuff").

Your Tech Lead has reviewed your Pull Request and said:
> "The code works perfectly, but this Git history is unacceptable. We require a linear history with semantic commit messages. Please squash your 6 feature commits into exactly **two** clean commits: one for the 'UI Layout' and one for the 'Data Fetching logic', and then force push to update the PR."

## The Setup Script
Run this script in an empty directory to generate the scenario:

```bash
#!/bin/bash
git init
echo "baseline" > index.html
git add index.html && git commit -m "chore: initial commit"

# The messy feature branch
git switch -c feature/dashboard

# Group 1: UI Layout
echo "<div>Dashboard</div>" > dashboard.html
git add dashboard.html && git commit -m "wip UI"
echo "styles" > style.css
git add style.css && git commit -m "add styles"
echo "<div class='dash'>Dashboard</div>" > dashboard.html
git commit -am "fix class name typo"

# Group 2: Data Fetching
echo "fetch('/api/data')" > api.js
git add api.js && git commit -m "start api logic"
echo "console.log(data)" >> api.js
git commit -am "log data"
echo "return data;" >> api.js
git commit -am "actually return data oops"
```

## Your Mission
1. View your messy history (`git log --oneline`). You will see 6 terrible commits on top of the initial commit.
2. Use interactive rebase to squash the first 3 feature commits into a single commit with the message: `feat: create dashboard UI layout`.
3. Squash the last 3 feature commits into a second single commit with the message: `feat: implement dashboard data fetching`.
4. Verify the final history contains exactly 3 commits total (the initial commit + your 2 clean feature commits).

---

## Solution Walkthrough

<details>
<summary>Click to view the step-by-step solution</summary>

### Step 1: Check the Mess
```bash
git log --oneline
```
Output:
```text
(hash6) actually return data oops
(hash5) log data
(hash4) start api logic
(hash3) fix class name typo
(hash2) add styles
(hash1) wip UI
(hash0) chore: initial commit
```
We need to rewrite the last 6 commits.

### Step 2: Start Interactive Rebase
```bash
git rebase -i HEAD~6
```
This opens your default text editor. It lists the commits chronologically (oldest at the top, newest at the bottom):
```text
pick hash1 wip UI
pick hash2 add styles
pick hash3 fix class name typo
pick hash4 start api logic
pick hash5 log data
pick hash6 actually return data oops
```

### Step 3: Issue the Rebase Commands
Change the text in the editor to instruct Git on how to compress the commits.
- Keep (`pick`) the first UI commit, and `squash` the next two into it.
- Keep (`pick`) the first API commit, and `squash` the next two into it.

```text
pick hash1 wip UI
squash hash2 add styles
squash hash3 fix class name typo

pick hash4 start api logic
squash hash5 log data
squash hash6 actually return data oops
```
Save the file and close the editor.

### Step 4: Write the New Commit Messages
Git will now process Group 1. It opens the editor again, showing the combined messages of hash1, hash2, and hash3.
Delete all the old text and write the new semantic message:
```text
feat: create dashboard UI layout
```
Save and close.

Git immediately processes Group 2 and opens the editor for hashes 4, 5, and 6.
Delete the old text and write:
```text
feat: implement dashboard data fetching
```
Save and close.

### Step 5: Verify the Clean History
```bash
git log --oneline
```
Output:
```text
(new_hash2) feat: implement dashboard data fetching
(new_hash1) feat: create dashboard UI layout
(hash0) chore: initial commit
```
Perfection! If this was connected to a real GitHub repo, you would now run `git push --force origin feature/dashboard` to overwrite the bad history in the cloud PR.

</details>
