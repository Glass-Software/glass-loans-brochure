#!/bin/bash
# SQLite Backup Script for Production
# Run this via cron or Fly.io scheduled task

set -e

DB_PATH="${DB_PATH:-/data/glass-loans.db}"
BACKUP_DIR="${BACKUP_DIR:-/data/backups}"
TIMESTAMP=$(date +%Y%m%d_%H%M%S)
BACKUP_FILE="${BACKUP_DIR}/glass-loans_${TIMESTAMP}.db"

# Create backup directory if it doesn't exist
mkdir -p "$BACKUP_DIR"

echo "Starting SQLite backup at $(date)"

# Use SQLite's built-in backup command (safe for live databases)
sqlite3 "$DB_PATH" ".backup '${BACKUP_FILE}'"

echo "Backup created: $BACKUP_FILE"

# Verify backup integrity
sqlite3 "$BACKUP_FILE" "PRAGMA integrity_check;" > /dev/null
echo "Backup integrity verified"

# Compress backup
gzip "$BACKUP_FILE"
echo "Backup compressed: ${BACKUP_FILE}.gz"

# Keep only last 7 days of backups
find "$BACKUP_DIR" -name "glass-loans_*.db.gz" -mtime +7 -delete
echo "Old backups cleaned up"

echo "Backup completed successfully at $(date)"
