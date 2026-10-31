# Challenge 3: Automated Git Bisect Bug Hunting Script across 200 Mock Commits

## The Scenario
You are a Staff Engineer at a large enterprise. The automated nightly tests failed, reporting that the `calculate_tax()` function is returning incorrect values in production.
You check `git log` and see that since the last successful release (`v1.0.0`), a junior developer ran an automated script that generated exactly 200 commits on the `main` branch.

Somewhere in those 200 commits, someone broke the `calculate_tax()` function. Manually checking out 200 commits to test the function is out of the question. You must use `git bisect` combined with a test script to find the exact commit hash that introduced the bug in less than 10 seconds.

## The Setup Script
Run this script in an empty directory to generate the 200 commits and plant the bug:

```bash
#!/bin/bash
git init
echo "def calculate_tax(amount): return amount * 0.20" > math_utils.py
git add math_utils.py && git commit -m "feat: initial release"
git tag v1.0.0

# Generate 142 good commits
for i in {1..142}; do
  echo "# good commit $i" >> history.log
  git commit -am "chore: update history $i"
done

# The Bug happens at commit 143!
echo "def calculate_tax(amount): return amount * 0.02 # BUG!" > math_utils.py
git commit -am "fix: adjust tax calculation for new laws"
BAD_COMMIT=$(git rev-parse HEAD)

# Generate 57 more bad commits on top of it
for i in {144..200}; do
  echo "# bad commit $i" >> history.log
  git commit -am "chore: update history $i"
done

echo "Setup complete. The bug is hidden somewhere in the last 200 commits!"
# (We stored the bad hash in a variable so we can verify later, but assume you don't know it!)
```

## Your Mission
1. Verify the current state of `math_utils.py` is broken (tax is 0.02).
2. Write an executable bash script `test_tax.sh` that checks if the word `0.20` exists in `math_utils.py`. The script should exit with `0` (Success) if it finds it, and exit with `1` (Failure) if it does not.
3. Start a `git bisect` session. The current `HEAD` is bad. The `v1.0.0` tag is good.
4. Run `git bisect run ./test_tax.sh`.
5. Watch Git automatically find the commit titled "fix: adjust tax calculation for new laws".
6. Clean up the bisect session.

---

## Solution Walkthrough

<details>
<summary>Click to view the step-by-step solution</summary>

### Step 1: Verify the Bug
```bash
cat math_utils.py
# Output shows the bug: def calculate_tax(amount): return amount * 0.02 # BUG!
```

### Step 2: Write the Automated Test Script
Create a file named `test_tax.sh`:
```bash
echo '#!/bin/bash
grep "0.20" math_utils.py > /dev/null' > test_tax.sh
```
*Explanation: `grep` searches for the string "0.20". If it finds it, `grep` exits with code 0. If it doesn't find it (because the bug changed it to 0.02), `grep` exits with code 1. `> /dev/null` just hides the output so it doesn't clutter our screen.*

Make the script executable:
```bash
chmod +x test_tax.sh
```

### Step 3: Start the Bisect Hunt
```bash
git bisect start
git bisect bad HEAD
git bisect good v1.0.0
```
Output:
```text
Bisecting: 99 revisions left to test after this (roughly 7 steps)
```

### Step 4: Unleash the Robot
```bash
git bisect run ./test_tax.sh
```
Output:
```text
running ./test_tax.sh
Bisecting: 49 revisions left to test after this (roughly 6 steps)
running ./test_tax.sh
...
[a bunch of fast output]
...
<hash> is the first bad commit
commit <hash>
Author: Your Name <you@example.com>
Date:   ...
    fix: adjust tax calculation for new laws
```

**Git found the exact commit in 8 steps (log2(200) ≈ 8) in about 2 seconds!**

### Step 5: Clean Up
Don't forget to reset your repository to its normal state before you start trying to fix the bug!
```bash
git bisect reset
```

</details>
