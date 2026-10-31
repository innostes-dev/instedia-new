# Challenge 5: Server Hardening Engine

## Context
You have just provisioned a brand new Ubuntu server in the cloud for a financial application. Currently, it is wide open: anyone can attempt to SSH in using passwords, and bots will start brute-forcing the server within minutes. You need an executable script that transforms a fresh, insecure server into a locked-down fortress automatically.

## The Engineering Challenge
Write a "Hardening Engine" Bash script. The script should:
1. Update and upgrade all system packages.
2. Install `fail2ban` to automatically ban IPs that fail login attempts too many times.
3. Modify the SSH configuration file (`/etc/ssh/sshd_config`) to completely disable password logins (forcing users to use SSH Keys).
4. Modify the SSH configuration to disable Root login (forcing users to log in as a normal user and use `sudo`).
5. Restart the SSH service for the changes to take effect securely.

---

## Starter Template
Save this as `harden.sh`. Run this with `sudo`.

```bash
#!/usr/bin/env bash
set -e

echo "Starting Server Hardening Process..."

# 1. Update packages
echo "Updating packages..."
# TODO: apt-get update and upgrade

# 2. Install Fail2ban
echo "Installing Fail2ban..."
# TODO: apt-get install fail2ban

# 3. Configure SSH (The dangerous part!)
SSHD_CONFIG="/etc/ssh/sshd_config"

echo "Disabling Password Authentication..."
# TODO: Use sed to find PasswordAuthentication and set it to no

echo "Disabling Root Login..."
# TODO: Use sed to find PermitRootLogin and set it to no

# 4. Restart services
echo "Restarting SSH Daemon..."
# TODO: systemctl restart ssh
```

---

## Solution Walkthrough

<details>
<summary>Click to reveal the full production solution</summary>

```bash
#!/usr/bin/env bash
# Strict error handling
set -euo pipefail

# Ensure script is run as root
if [ "$EUID" -ne 0 ]; then
  echo "Please run this script with sudo or as root."
  exit 1
fi

echo "=== 🛡️ Starting Production Server Hardening Engine 🛡️ ==="

# 1. System Updates
echo "[1/4] Updating and upgrading system packages..."
# DEBIAN_FRONTEND=noninteractive prevents pop-up prompts during installation
export DEBIAN_FRONTEND=noninteractive
apt-get update -q
apt-get upgrade -y -q

# 2. Intrusion Prevention
echo "[2/4] Installing and enabling Fail2ban..."
apt-get install -y fail2ban
systemctl enable fail2ban
systemctl start fail2ban

# 3. SSH Lockdown
echo "[3/4] Locking down SSH Daemon..."
SSHD_CONFIG="/etc/ssh/sshd_config"
# Backup the config just in case we break something
cp "$SSHD_CONFIG" "${SSHD_CONFIG}.backup_$(date +%F)"

# Use 'sed' (Stream Editor) to perform inline search and replace.
# -i means "in-place" (modify the file directly).
# ^#? matches the start of line and an optional # (in case it's commented out).
# We replace the entire line with the secure setting.

# Disable Password Authentication (Force SSH Keys)
sed -i -E 's/^#?PasswordAuthentication (yes|no)/PasswordAuthentication no/' "$SSHD_CONFIG"

# Disable Root Login
sed -i -E 's/^#?PermitRootLogin (yes|prohibit-password|no)/PermitRootLogin no/' "$SSHD_CONFIG"

# Disable Empty Passwords
sed -i -E 's/^#?PermitEmptyPasswords (yes|no)/PermitEmptyPasswords no/' "$SSHD_CONFIG"

# 4. Restart Services
echo "[4/4] Applying changes..."
systemctl restart sshd

echo "=== ✅ Server Hardening Complete! ==="
echo "WARNING: You can no longer log in via password or as root."
echo "Ensure your SSH keys are set up correctly before closing this terminal."
```

### Architecture Breakdown
1. **Root Verification:** `if [ "$EUID" -ne 0 ]` is a crucial check. EUID 0 is root. If a user runs this script without `sudo`, it will immediately exit with a helpful error message instead of failing halfway through with permission errors.
2. **Non-Interactive Installs:** `export DEBIAN_FRONTEND=noninteractive` and the `-y` flags on `apt-get` prevent the package manager from pausing the script to ask the user questions (like "Do you want to continue? [Y/n]" or showing a pink configuration screen).
3. **Sed Regex Replacement:** This is the core of config automation.
   - `-i` edits the file directly.
   - `-E` enables extended regular expressions.
   - `s/old/new/` is the search and replace syntax.
   - `^#?` means "start of line, and possibly a `#` character". This handles cases where the configuration option is commented out.
   - `(yes|prohibit-password|no)` handles any current state of the configuration, ensuring we aggressively overwrite it to `no`.
4. **Safety Check:** The script creates a backup copy of `sshd_config` before modifying it, ensuring that if something goes catastrophically wrong, an admin can manually restore the file via `cp sshd_config.backup sshd_config`.

</details>
