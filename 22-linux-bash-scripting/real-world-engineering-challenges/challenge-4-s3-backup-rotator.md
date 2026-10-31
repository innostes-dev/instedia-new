# Challenge 4: Automated S3 Backup & Rotator

## Context
Data is the most critical part of any business. You have a PostgreSQL database on your server. You need to ensure that every night, a backup is created, compressed into a tiny file, and uploaded securely to an off-site location (AWS S3). Furthermore, to avoid an endless AWS storage bill, you must clean up old backups from your local server.

## The Engineering Challenge
Write a production-grade Bash pipeline that:
1. Connects to PostgreSQL using `pg_dump` to create an SQL backup file.
2. Compresses the large SQL file into a `.tar.gz` archive.
3. Uploads the archive to an AWS S3 bucket using the `aws-cli`.
4. Deletes the original uncompressed SQL file.
5. Deletes compressed archives older than 5 days from the local server to save disk space.

---

## Starter Template
Save this as `s3_backup.sh`.

```bash
#!/usr/bin/env bash
set -e

DB_NAME="production_db"
DB_USER="db_admin"
BACKUP_DIR="/var/backups/postgres"
DATE=$(date +%Y-%m-%d_%H-%M-%S)
S3_BUCKET="s3://my-company-database-backups/"

# 1. Setup
mkdir -p "$BACKUP_DIR"
cd "$BACKUP_DIR"

echo "Starting database backup for $DB_NAME at $DATE..."

# TODO: Dump the database using pg_dump
# Example: pg_dump -U "$DB_USER" "$DB_NAME" > "backup_$DATE.sql"

# TODO: Compress the sql file using tar

# TODO: Upload to S3 using 'aws s3 cp'

# TODO: Cleanup local files (delete the .sql, and use find to delete old .tar.gz files)
```

---

## Solution Walkthrough

<details>
<summary>Click to reveal the full production solution</summary>

```bash
#!/usr/bin/env bash
# Strict mode: fail on any error, undefined variable, or failed pipe
set -euo pipefail

# Configuration
DB_NAME="production_db"
DB_USER="postgres"
BACKUP_DIR="/var/backups/postgres"
DATE=$(date +%Y-%m-%d_%H-%M-%S)
SQL_FILE="db_backup_$DATE.sql"
ARCHIVE_FILE="db_backup_$DATE.tar.gz"
S3_BUCKET="s3://my-company-database-backups/"
RETENTION_DAYS=5

# Ensure backup directory exists
mkdir -p "$BACKUP_DIR"
cd "$BACKUP_DIR"

echo "[1/4] Dumping database: $DB_NAME..."
# Note: In production, password should be handled via ~/.pgpass file, not in the script
pg_dump -U "$DB_USER" "$DB_NAME" > "$SQL_FILE"

echo "[2/4] Compressing backup..."
# czf = Create, Gzip, File
tar -czf "$ARCHIVE_FILE" "$SQL_FILE"

echo "[3/4] Uploading to AWS S3..."
# aws s3 cp copies the local file to the remote bucket
aws s3 cp "$ARCHIVE_FILE" "$S3_BUCKET$ARCHIVE_FILE"

echo "[4/4] Cleaning up local filesystem..."
# Remove the massive uncompressed SQL file immediately
rm "$SQL_FILE"

# Rotate old compressed backups locally
echo "Removing local backups older than $RETENTION_DAYS days..."
find "$BACKUP_DIR" -type f -name "*.tar.gz" -mtime +$RETENTION_DAYS -exec rm {} \;

echo "Backup Pipeline Complete: $ARCHIVE_FILE securely stored in S3."
```

### Architecture Breakdown
1. **Idempotency & Directories:** The script runs `mkdir -p` and `cd` first. This ensures that no matter where the script is executed from, the files are always created in the correct location.
2. **Compression:** The `tar -czf archive.tar.gz file.sql` command drastically reduces text file sizes (often compressing databases to 10% of their original size). This saves massive amounts of AWS data transfer costs and S3 storage costs.
3. **AWS CLI Integration:** The `aws s3 cp` tool handles the secure, encrypted upload to AWS. (Note: The server must have the AWS CLI installed and configured with `aws configure` containing IAM credentials that have write access to that specific bucket).
4. **Cleanup:** Leaving uncompressed SQL files on the server is the #1 cause of "Disk Full" outages. `rm "$SQL_FILE"` executes immediately after upload. Then `find ... -mtime +5 -exec rm {} \;` acts as a garbage collector for old compressed files, keeping exactly 5 days of backups locally for fast recovery.

</details>
