#!/bin/sh
# Trigger one KLEACORE cron endpoint from INSIDE the app container.
# Used by Dokploy scheduled tasks (shellType "sh"): `/app/cron-run.sh daily-billing`
#
# - Calls the app on loopback, so it doesn't depend on public DNS/TLS.
# - Reads CRON_SECRET from the container env, so the secret never appears in
#   the Dokploy schedule definition or its logs.
# - busybox wget only (the alpine image has no curl/bash); wget exits non-zero
#   on HTTP 4xx/5xx, which Dokploy records as a failed run.
set -eu

job="${1:-}"
case "$job" in
  "" | *[!a-z0-9-]*)
    echo "usage: cron-run.sh <job>  (e.g. daily-billing)" >&2
    exit 2
    ;;
esac

if [ -z "${CRON_SECRET:-}" ]; then
  echo "cron-run: CRON_SECRET is not set in the container environment" >&2
  exit 1
fi

url="http://127.0.0.1:${PORT:-3000}/api/cron/${job}"
echo "cron-run: POST /api/cron/${job}"
body="$(wget -q -O - -T 900 \
  --header "Authorization: Bearer ${CRON_SECRET}" \
  --post-data "" \
  "$url")"
echo "$body"
# Another run of the same job holds its advisory lock: not an error (exit 0).
case "$body" in
  *'"status":"locked"'*) echo "cron-run: ${job} skipped, another run is still in progress" ;;
esac
