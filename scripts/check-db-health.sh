#!/bin/bash
# SQLite Health Check Script
# Returns exit code 0 if healthy, non-zero if corrupted

set -e

DB_PATH="${DB_PATH:-/data/glass-loans.db}"

if [ ! -f "$DB_PATH" ]; then
  echo "ERROR: Database file not found at $DB_PATH"
  exit 1
fi

echo "Checking database integrity..."

# Run integrity check
RESULT=$(sqlite3 "$DB_PATH" "PRAGMA integrity_check;")

if [ "$RESULT" = "ok" ]; then
  echo "✅ Database integrity: OK"

  # Check table count
  TABLE_COUNT=$(sqlite3 "$DB_PATH" "SELECT COUNT(*) FROM sqlite_master WHERE type='table';")
  echo "📊 Tables: $TABLE_COUNT"

  # Check WAL file size
  if [ -f "${DB_PATH}-wal" ]; then
    WAL_SIZE=$(stat -f%z "${DB_PATH}-wal" 2>/dev/null || stat -c%s "${DB_PATH}-wal" 2>/dev/null || echo "0")
    echo "📝 WAL size: $((WAL_SIZE / 1024)) KB"

    # Warn if WAL is too large (> 10MB)
    if [ "$WAL_SIZE" -gt 10485760 ]; then
      echo "⚠️  WARNING: WAL file is large, consider checkpointing"
    fi
  fi

  exit 0
else
  echo "❌ Database corruption detected:"
  echo "$RESULT"
  exit 1
fi
