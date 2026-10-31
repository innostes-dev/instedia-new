# Challenge 2: Zero-Downtime SSL Auto-Renewal

## Context
You have a production application secured with Let's Encrypt SSL certificates via Certbot. These certificates expire every 90 days. If a certificate expires, browsers will block users from accessing your site, causing a massive incident. You need an automated way to renew the certificate and restart the web server only if the renewal was actually successful.

## The Engineering Challenge
Write a Bash script and a Cron schedule to handle this. The script should:
1. Attempt to renew the certificate using `certbot`.
2. Check the exit code to verify success.
3. If successful, reload (not restart) the Nginx configuration to apply the new certificate without dropping active user connections.
4. Log the result to a custom file with timestamps.
5. Set up a Cron job to run this script twice a day (Certbot recommends this to handle potential Let's Encrypt service outages).

---

## Starter Template
Save this as `ssl_renew.sh`.

```bash
#!/usr/bin/env bash

LOG_FILE="/var/log/ssl_renew.log"

# Function to write to log with timestamp
log_message() {
    # TODO: write the first argument to the LOG_FILE with a date prefix
}

log_message "Starting SSL renewal process."

# TODO: Run certbot renew. (Hint: you want the --quiet flag for automation)

# TODO: Check the exit code. If 0, reload Nginx. If not 0, log an error.
```

---

## Solution Walkthrough

<details>
<summary>Click to reveal the full production solution</summary>

### 1. The Script (`/opt/scripts/ssl_renew.sh`)

```bash
#!/usr/bin/env bash

# Define paths
LOG_FILE="/var/log/ssl_renew.log"
NGINX_SERVICE="nginx"

# Helper function for standardized logging
log_message() {
    local MESSAGE=$1
    echo "[$(date '+%Y-%m-%d %H:%M:%S')] $MESSAGE" >> "$LOG_FILE"
}

log_message "Starting SSL renewal check."

# 1. Run Certbot
# We use --quiet to suppress output unless there is an error.
# We redirect standard output and error to our log file so we can debug failures.
certbot renew --quiet >> "$LOG_FILE" 2>&1

# 2. Check Exit Code
if [ $? -eq 0 ]; then
    log_message "Certbot renewal check finished successfully."

    # 3. Reload Nginx
    # We use 'reload' instead of 'restart'. Reload gracefully starts new worker
    # processes with the new cert, while letting old workers finish current requests.
    systemctl reload "$NGINX_SERVICE" >> "$LOG_FILE" 2>&1

    if [ $? -eq 0 ]; then
        log_message "Nginx reloaded successfully."
    else
        log_message "ERROR: Failed to reload Nginx after renewal."
    fi
else
    log_message "CRITICAL: Certbot renewal failed. Check logs."
fi

log_message "SSL renewal process complete."
echo "----------------------------------------" >> "$LOG_FILE"
```

### 2. The Cron Job

You must run this as `root` because it needs permission to run `certbot` and reload `systemctl`.
Run `sudo crontab -e` and add:

```bash
# Run at 2:15 AM and 2:15 PM every day
15 2,14 * * * /opt/scripts/ssl_renew.sh > /dev/null 2>&1
```

### Architecture Breakdown
1. **Logging Function:** `log_message()` defines a local variable `$MESSAGE` and prefixes every log entry with an exact timestamp formatting `[YYYY-MM-DD HH:MM:SS]`.
2. **Certbot Quiet Mode:** `certbot renew` checks all certificates on the server. If they are within 30 days of expiry, it renews them. If not, it does nothing and exits with code `0`.
3. **Zero-Downtime Reload:** `systemctl reload nginx` is the key to zero downtime. Unlike `restart`, which kills the process and drops all active user connections, `reload` simply tells the master Nginx process to re-read the configuration and certificates and spin up new child workers seamlessly.
4. **Cron Schedule:** `15 2,14 * * *` means minute 15, hours 2 and 14 (2:15 AM and 2:15 PM). Let's Encrypt requests that you do not run cron jobs precisely on the hour (e.g., `00 00`) because millions of other servers do that, which DDoSes their servers. Picking a random minute like `15` is best practice.

</details>
