# Challenge 1: Nginx Log Aggregator & Suspicious IP Blocker

## Context
You manage a public-facing Nginx web server. Recently, the server has been experiencing high CPU load. You suspect a brute-force attack or an overly aggressive web scraper is hammering your server. You need to identify the malicious IP addresses from your access logs and block them using the Uncomplicated Firewall (UFW).

## The Engineering Challenge
Write a Bash script that acts as an automated security enforcer. The script should:
1. Parse an Nginx access log file (or a simulated one).
2. Count the number of requests made by each IP address.
3. Identify any IP address that exceeds a set threshold (e.g., 100 requests).
4. Automatically block that IP address using `ufw`.
5. Run safely by ensuring it doesn't block critical IPs (like localhost or your own admin IP).

---

## Starter Template
Here is a skeleton to get you started. Save this as `blocker.sh`.

```bash
#!/usr/bin/env bash
# Strict mode
set -euo pipefail

LOG_FILE="/var/log/nginx/access.log"
THRESHOLD=100
WHITELIST_IP="192.168.1.50" # Your admin IP
# TODO: Define localhost IP to whitelist

echo "Analyzing logs for IPs with > $THRESHOLD requests..."

# TODO: Extract IPs, sort, and count them

# TODO: Loop through the list of IPs. If the count > THRESHOLD and not whitelisted, block via UFW.
```

---

## Solution Walkthrough

<details>
<summary>Click to reveal the full production solution</summary>

```bash
#!/usr/bin/env bash
# Strict mode for error handling
set -euo pipefail

# Configuration
LOG_FILE="/tmp/access.log" # Use /var/log/nginx/access.log in production
THRESHOLD=100
WHITELIST_IP="192.168.1.50"
LOCALHOST_IP="127.0.0.1"

# For testing, we create a fake log file if it doesn't exist
if [ ! -f "$LOG_FILE" ]; then
    echo "Creating fake log for testing..."
    for i in {1..120}; do echo "203.0.113.45 - - [10/Oct] GET / HTTP/1.1" >> "$LOG_FILE"; done
    for i in {1..50}; do echo "198.51.100.2 - - [10/Oct] GET / HTTP/1.1" >> "$LOG_FILE"; done
    for i in {1..150}; do echo "$WHITELIST_IP - - [10/Oct] GET / HTTP/1.1" >> "$LOG_FILE"; done
fi

echo "Analyzing logs for IPs with > $THRESHOLD requests..."

# 1. Extract IPs, sort, count, and sort descending
# Output format of uniq -c is: "    150 192.168.1.50" (Count then IP)
OFFENDERS=$(awk '{print $1}' "$LOG_FILE" | sort | uniq -c | sort -nr)

# 2. Read the results line by line
# Using 'while read' is the standard way to loop through multiline string output in bash
echo "$OFFENDERS" | while read count ip; do

    # Break loop if we reach IPs below the threshold (since it's sorted descending)
    if [ "$count" -lt "$THRESHOLD" ]; then
        break
    fi

    # 3. Check Whitelists
    if [ "$ip" == "$WHITELIST_IP" ] || [ "$ip" == "$LOCALHOST_IP" ]; then
        echo "Ignoring $ip ($count requests) - Whitelisted."
        continue
    fi

    # 4. Action: Block the IP
    echo "ALERT: Blocking $ip! ($count requests)"

    # In a real environment, uncomment the following line.
    # It requires sudo to run ufw.
    # sudo ufw deny from "$ip" to any

    # For testing, we just simulate the block:
    echo "[Simulated] ufw deny from $ip"

done

echo "Security sweep complete."
```

### Architecture Breakdown
1. **Extraction & Counting:** We use `awk '{print $1}'` to grab the first column (IP). We `sort` it so identical IPs are adjacent, run `uniq -c` to count them, and `sort -nr` to put the highest counts at the top.
2. **Reading the Stream:** `echo "$OFFENDERS" | while read count ip` is a powerful pattern. `read` automatically splits the space-separated output of `uniq -c` into two variables: `$count` and `$ip`.
3. **Threshold Break:** Because the list is sorted highest to lowest, as soon as we hit an IP with requests `< $THRESHOLD`, we can `break` (exit the loop entirely) to save processing time.
4. **Whitelisting:** We use an `if` statement with the `||` (OR) operator to ensure we never lock ourselves out of the server or break local loopback traffic.

</details>
