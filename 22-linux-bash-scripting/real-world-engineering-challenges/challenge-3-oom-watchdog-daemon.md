# Challenge 3: OOM Watchdog Daemon

## Context
You have a heavily used microservice running on a small cloud server. Occasionally, there is a memory leak, and the process consumes all available RAM. When this happens, the Linux Kernel's "OOM (Out of Memory) Killer" kicks in and randomly kills processes to save the system, causing unexpected outages. You need a script that runs constantly in the background, watches memory usage, restarts the service *before* it crashes the server, and alerts your team via a Slack Webhook.

## The Engineering Challenge
Write a Bash daemon (a long-running script). It should:
1. Run an infinite loop that checks memory usage every 10 seconds.
2. Check the percentage of RAM used by a specific process name (e.g., `node`).
3. If the process exceeds 80% RAM usage, forcefully restart it.
4. Send an HTTP POST request using `curl` to a Slack Webhook URL to notify the engineering team of the restart.

---

## Starter Template
Save this as `oom_watchdog.sh`.

```bash
#!/usr/bin/env bash

PROCESS_NAME="node"
MEM_THRESHOLD=80
SLACK_WEBHOOK_URL="https://hooks.slack.com/services/YOUR/WEBHOOK/HERE"

# Function to send Slack alert
send_slack_alert() {
    local MESSAGE=$1
    # TODO: Write a curl command to send a JSON payload to the SLACK_WEBHOOK_URL
}

echo "Starting OOM Watchdog for process: $PROCESS_NAME"

# Infinite loop
while true; do
    # TODO: Get the RAM percentage of the PROCESS_NAME. (Hint: use ps and awk)

    # TODO: If RAM > MEM_THRESHOLD, restart process and call send_slack_alert

    sleep 10
done
```

---

## Solution Walkthrough

<details>
<summary>Click to reveal the full production solution</summary>

```bash
#!/usr/bin/env bash

PROCESS_NAME="node" # The target process to watch
MEM_THRESHOLD=80    # Restart if using > 80% RAM
SLACK_WEBHOOK_URL="https://hooks.slack.com/services/T000/B000/XXXX" # Replace with real URL

# 1. Alerting Function
send_slack_alert() {
    local MESSAGE=$1
    local JSON_PAYLOAD="{\"text\": \"🚨 *OOM Watchdog Alert:* $MESSAGE\"}"

    # Send POST request quietly.
    # In testing, you can change the URL to https://httpbin.org/post to view the output
    curl -s -X POST -H "Content-type: application/json" -d "$JSON_PAYLOAD" "$SLACK_WEBHOOK_URL" > /dev/null
}

echo "Starting OOM Watchdog for process: $PROCESS_NAME"
send_slack_alert "Watchdog daemon started for $PROCESS_NAME."

# 2. Infinite Daemon Loop
while true; do
    # 3. Extract Memory Usage
    # Get PID of the process (if multiple, grab the first one)
    PID=$(pgrep -x "$PROCESS_NAME" | head -n 1)

    # If the process is running, check its memory
    if [ -n "$PID" ]; then
        # 'ps -p PID -o %mem' outputs a header "%MEM" and the value " 45.2".
        # We use tail -n 1 to skip header, and awk '{print int($1)}' to grab the number and convert to integer (removing decimals)
        MEM_USAGE=$(ps -p "$PID" -o %mem | tail -n 1 | awk '{print int($1)}')

        echo "Current memory usage for $PROCESS_NAME (PID $PID): $MEM_USAGE%"

        # 4. Threshold Check and Action
        if [ "$MEM_USAGE" -ge "$MEM_THRESHOLD" ]; then
            echo "CRITICAL: Memory at $MEM_USAGE%. Restarting $PROCESS_NAME..."

            # Action: Restart process gracefully, then forcefully if needed
            kill -15 "$PID"
            sleep 2
            kill -9 "$PID" 2>/dev/null || true # Suppress error if it's already dead

            # Restart the service (assuming it's managed by systemd)
            systemctl start my-node-app

            # Alert team
            send_slack_alert "$PROCESS_NAME exceeded $MEM_THRESHOLD% RAM ($MEM_USAGE%). Service restarted automatically."
        fi
    else
        echo "Process $PROCESS_NAME is not currently running."
    fi

    # 5. Sleep interval to prevent high CPU usage from the script itself
    sleep 10
done
```

### Architecture Breakdown
1. **Webhook Integration:** `curl -X POST -H "Content-type: application/json" -d '{"text":"..."}' URL` is the standard way to interact with APIs (like Slack, Discord, or custom microservices) directly from Bash.
2. **Integer Conversion:** The `ps` command outputs floating-point numbers (e.g., `85.4`). Bash *cannot* do math on floating-point numbers natively; it only understands integers. Therefore, we use `awk '{print int($1)}'` to convert `85.4` into the integer `85` so our `if [ "$MEM_USAGE" -ge "$MEM_THRESHOLD" ]` check doesn't crash.
3. **Graceful Degradation:** We don't just `kill -9` immediately. We send `kill -15` (SIGTERM), wait 2 seconds, and then send `kill -9` (SIGKILL). The `|| true` ensures that if the process successfully died on step 1, the script doesn't crash trying to kill a non-existent process on step 2.

</details>
