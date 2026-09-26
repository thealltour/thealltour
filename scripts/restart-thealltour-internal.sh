#!/usr/bin/env bash
# Restart thealltour-internal only when the installed .next is not a placeholder bake.
#
# Usage (on Pi):
#   ./scripts/restart-thealltour-internal.sh
#   ./scripts/restart-thealltour-internal.sh --force   # skip guard (emergency only)
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "${SCRIPT_DIR}/.." && pwd)"
FORCE=0

while [[ $# -gt 0 ]]; do
  case "$1" in
    --force) FORCE=1; shift ;;
    -h|--help)
      echo "Usage: restart-thealltour-internal.sh [--force]"
      exit 0
      ;;
    *) echo "Unknown arg: $1" >&2; exit 2 ;;
  esac
done

cd "$REPO_ROOT"

if [[ "$FORCE" -ne 1 ]]; then
  bash "${SCRIPT_DIR}/assert-next-build-not-placeholder.sh" .next
else
  echo "WARNING: --force skips placeholder guard" >&2
fi

UNIT=thealltour-internal.service

if sudo -n systemctl restart "$UNIT" 2>/dev/null; then
  echo "restarted via sudo systemctl"
else
  echo "sudo unavailable — SIGTERM MainPID (Restart=on-failure will bring it back)"
  MAIN_PID="$(systemctl show -p MainPID --value "$UNIT")"
  if [[ -n "$MAIN_PID" && "$MAIN_PID" != "0" ]]; then
    kill -TERM "$MAIN_PID" || true
  else
    echo "ERROR: no MainPID for $UNIT" >&2
    exit 1
  fi
fi

for i in 1 2 3 4 5 6 7 8 9 10 11 12 13 14 15; do
  if systemctl is-active --quiet "$UNIT"; then
    code="$(curl -s -o /dev/null -w '%{http_code}' http://127.0.0.1:3000/ || true)"
    if [[ "$code" != "000" && -n "$code" ]]; then
      systemctl status "$UNIT" --no-pager | head -n 14
      ss -ltnp | grep ':3000' || true
      echo "RESTART_OK http=${code} BUILD_ID=$(tr -d '[:space:]' <.next/BUILD_ID)"
      exit 0
    fi
  fi
  sleep 1
done

echo "ERROR: service did not become ready" >&2
systemctl status "$UNIT" --no-pager | head -n 25 || true
exit 1
