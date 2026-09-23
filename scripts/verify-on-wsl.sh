#!/usr/bin/env bash
# Pi → WSL remote verification bridge.
#
# Runs on hermes-pi. SSHs to a WSL verification host and executes the existing
# verify-from-pi.sh there (which rsyncs Pi → WSL workspace and runs checks).
#
# Does NOT: npm run build on Pi, copy node_modules/.next, deploy, or touch systemd.
#
# Usage:
#   ./scripts/verify-on-wsl.sh --fast
#   ./scripts/verify-on-wsl.sh --build
#   ./scripts/verify-on-wsl.sh --fast --test visualOrchestration
#   ./scripts/verify-on-wsl.sh --build --skip-tests
#
# Config (no hardcoded IPs):
#   HERMES_WSL_VERIFY_HOST   SSH Host alias or user@host (default: hermes-build-laptop)
#   HERMES_WSL_VERIFY_SCRIPT Remote path to verify-from-pi.sh
#                            (default: ~/hermes-tools/scripts/verify-from-pi.sh)
#   Optional: scripts/verify-on-wsl.env / .env.verify-wsl (gitignored) or env exports
#
# See: docs/WSL_REMOTE_VERIFICATION.md
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "${SCRIPT_DIR}/.." && pwd)"

load_env_file() {
  local f="$1"
  [[ -f "$f" ]] || return 0
  set -a
  # shellcheck disable=SC1090
  source "$f"
  set +a
}

load_env_file "${PWD}/.env.verify-wsl"
load_env_file "${SCRIPT_DIR}/verify-on-wsl.env"
load_env_file "${REPO_ROOT}/.env.verify-wsl"

HERMES_WSL_VERIFY_HOST="${HERMES_WSL_VERIFY_HOST:-hermes-build-laptop}"
HERMES_WSL_VERIFY_SCRIPT="${HERMES_WSL_VERIFY_SCRIPT:-}"

MODE="fast"
PASSTHROUGH=()

usage() {
  cat <<'EOF'
Usage: verify-on-wsl.sh [--fast|--build] [--skip-tests] [--test <pattern>] [--dry-sync] [--skip-sync] [...]

  Pi-side wrapper: SSH to WSL and run verify-from-pi.sh with the same flags.

  --fast / --build / --skip-tests / --test / --dry-sync / --skip-sync
      Passed through to the remote verify-from-pi.sh.

Environment:
  HERMES_WSL_VERIFY_HOST    SSH destination (default: hermes-build-laptop)
  HERMES_WSL_VERIFY_SCRIPT  Remote script path
                            (default: $HOME/hermes-tools/scripts/verify-from-pi.sh on WSL)

Docs: docs/WSL_REMOTE_VERIFICATION.md
EOF
}

while [[ $# -gt 0 ]]; do
  case "$1" in
    --fast)
      MODE="fast"
      PASSTHROUGH+=(--fast)
      shift
      ;;
    --build)
      MODE="build"
      PASSTHROUGH+=(--build)
      shift
      ;;
    --skip-tests)
      PASSTHROUGH+=(--skip-tests)
      shift
      ;;
    --test)
      if [[ $# -lt 2 ]]; then
        echo "ERROR: --test requires a pattern" >&2
        exit 2
      fi
      PASSTHROUGH+=(--test "$2")
      shift 2
      ;;
    --dry-sync)
      PASSTHROUGH+=(--dry-sync)
      shift
      ;;
    --skip-sync)
      PASSTHROUGH+=(--skip-sync)
      shift
      ;;
    -h|--help)
      usage
      exit 0
      ;;
    *)
      # Forward unknown flags so future verify-from-pi.sh options keep working.
      PASSTHROUGH+=("$1")
      shift
      ;;
  esac
done

if [[ ${#PASSTHROUGH[@]} -eq 0 ]]; then
  PASSTHROUGH=(--fast)
  MODE="fast"
fi

# Infer MODE for summary if only passthrough unknowns were given.
for arg in "${PASSTHROUGH[@]}"; do
  case "$arg" in
    --build) MODE="build" ;;
    --fast) MODE="fast" ;;
  esac
done

echo ">>> WSL remote verify"
echo "    host:   ${HERMES_WSL_VERIFY_HOST}"
echo "    mode:   ${MODE}"
echo "    args:   ${PASSTHROUGH[*]}"
echo ""

# BatchMode: fail fast without password prompt (Cursor non-interactive).
SSH_OPTS=(-o BatchMode=yes -o ConnectTimeout=15)

set +e
# Remote bash reads this script on stdin; Pi-side "${PASSTHROUGH[@]}" become remote "$@".
ssh "${SSH_OPTS[@]}" "${HERMES_WSL_VERIFY_HOST}" bash -s -- "${PASSTHROUGH[@]}" <<'REMOTE'
set -euo pipefail

set -a
if [[ -f "${HOME}/.env.verify-local" ]]; then
  # shellcheck disable=SC1090
  source "${HOME}/.env.verify-local"
fi
set +a

SCRIPT="${HERMES_WSL_VERIFY_SCRIPT:-}"
if [[ -z "$SCRIPT" ]]; then
  SCRIPT="${HOME}/hermes-tools/scripts/verify-from-pi.sh"
fi

if [[ ! -x "$SCRIPT" && ! -f "$SCRIPT" ]]; then
  echo "ERROR: remote verify script not found: $SCRIPT" >&2
  echo "Set HERMES_WSL_VERIFY_SCRIPT or install ~/hermes-tools/scripts/verify-from-pi.sh" >&2
  exit 127
fi

# Prefer executable bit; fall back to bash if not +x.
if [[ -x "$SCRIPT" ]]; then
  exec "$SCRIPT" "$@"
else
  exec bash "$SCRIPT" "$@"
fi
REMOTE
EXIT_CODE=$?
set -e

echo ""
if [[ "$EXIT_CODE" -eq 0 ]]; then
  echo "VERIFY_RESULT=PASS"
  echo "VERIFY_MODE=${MODE}"
else
  echo "VERIFY_RESULT=FAIL"
  echo "VERIFY_MODE=${MODE}"
  echo "EXIT_CODE=${EXIT_CODE}"
fi

exit "$EXIT_CODE"
