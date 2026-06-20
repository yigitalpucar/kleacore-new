#!/usr/bin/env bash
#
# KLEACORE PostgreSQL backup script
#
# Creates a compressed SQL dump under backups/ and prunes older files,
# keeping only the most recent backups (default: 7).
#
# Usage:
#   ./scripts/backup-postgres.sh
#   DATABASE_URL='postgresql://user:pass@host:5432/kleacore' ./scripts/backup-postgres.sh
#   PGHOST=localhost PGUSER=kleacore PGDATABASE=kleacore ./scripts/backup-postgres.sh
#
# Environment (pick one approach):
#   DATABASE_URL   Full PostgreSQL connection string (recommended)
#   PGHOST         Database host (default: localhost)
#   PGPORT         Database port (default: 5432)
#   PGUSER         Database user (required without DATABASE_URL)
#   PGPASSWORD     Database password (optional; uses .pgpass / peer auth if unset)
#   PGDATABASE     Database name (required without DATABASE_URL)
#
# Optional:
#   BACKUP_DIR         Output directory (default: backups)
#   BACKUP_RETENTION   Number of dumps to keep (default: 7)
#
# Requirements:
#   pg_dump, gzip
#
# Cron example (daily at 02:15 UTC):
#   15 2 * * * cd /path/to/kleacore && DATABASE_URL='...' ./scripts/backup-postgres.sh >> /var/log/kleacore-backup.log 2>&1
#
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT_DIR"

if [[ -f .env ]]; then
  set -a
  # shellcheck disable=SC1091
  source .env
  set +a
fi

BACKUP_DIR="${BACKUP_DIR:-backups}"
BACKUP_RETENTION="${BACKUP_RETENTION:-7}"
TIMESTAMP="$(date -u +"%Y%m%d-%H%M%S")"
OUTPUT_FILE="${BACKUP_DIR}/kleacore-${TIMESTAMP}.sql.gz"

if ! command -v pg_dump >/dev/null 2>&1; then
  echo "error: pg_dump not found in PATH" >&2
  exit 1
fi

if ! command -v gzip >/dev/null 2>&1; then
  echo "error: gzip not found in PATH" >&2
  exit 1
fi

mkdir -p "$BACKUP_DIR"

run_pg_dump() {
  if [[ -n "${DATABASE_URL:-}" ]]; then
    pg_dump --no-owner --no-acl "$DATABASE_URL"
    return
  fi

  : "${PGUSER:?PGUSER or DATABASE_URL is required}"
  : "${PGDATABASE:?PGDATABASE or DATABASE_URL is required}"

  local host="${PGHOST:-localhost}"
  local port="${PGPORT:-5432}"

  pg_dump \
    --no-owner \
    --no-acl \
    -h "$host" \
    -p "$port" \
    -U "$PGUSER" \
    "$PGDATABASE"
}

echo "Starting PostgreSQL backup → ${OUTPUT_FILE}"

if ! run_pg_dump | gzip -c > "$OUTPUT_FILE"; then
  rm -f "$OUTPUT_FILE"
  echo "error: backup failed" >&2
  exit 1
fi

if [[ ! -s "$OUTPUT_FILE" ]]; then
  rm -f "$OUTPUT_FILE"
  echo "error: backup file is empty" >&2
  exit 1
fi

BYTES="$(wc -c < "$OUTPUT_FILE" | tr -d ' ')"
echo "Backup complete (${BYTES} bytes)"

PRUNED=0
while IFS= read -r old_file; do
  rm -f "$old_file"
  PRUNED=$((PRUNED + 1))
done < <(ls -1t "${BACKUP_DIR}"/kleacore-*.sql.gz 2>/dev/null | tail -n +$((BACKUP_RETENTION + 1)) || true)

if [[ "$PRUNED" -gt 0 ]]; then
  echo "Pruned ${PRUNED} old backup(s); keeping last ${BACKUP_RETENTION}"
else
  echo "Retention: keeping last ${BACKUP_RETENTION} backup(s)"
fi