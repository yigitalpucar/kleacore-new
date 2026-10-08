#!/bin/sh
set -eu

# Apply pending migrations before serving traffic. If this fails the container
# must exit non-zero so the deploy is marked failed (and the previous
# container keeps running) instead of serving a schema the code doesn't match.
# Set SKIP_MIGRATIONS=1 only for emergency debugging.
if [ "${SKIP_MIGRATIONS:-0}" = "1" ]; then
  echo "[entrypoint] SKIP_MIGRATIONS=1 — not running prisma migrate deploy" >&2
elif [ -z "${DATABASE_URL:-}" ]; then
  echo "[entrypoint] DATABASE_URL is not set — refusing to start" >&2
  exit 1
else
  echo "[entrypoint] running prisma migrate deploy"
  if ! (cd /app/migrate && ./node_modules/.bin/prisma migrate deploy); then
    echo "[entrypoint] prisma migrate deploy FAILED — aborting startup" >&2
    exit 1
  fi
fi

exec node server.js
