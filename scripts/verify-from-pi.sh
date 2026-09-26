#!/usr/bin/env bash
# Verify hermes-pi working tree on a WSL2 (or other) Linux x86_64 machine.
# Does NOT deploy .next / node_modules to Pi. Production runtime stays on Pi.
#
# Usage:
#   ./scripts/verify-from-pi.sh --fast
#   ./scripts/verify-from-pi.sh --build
#   ./scripts/verify-from-pi.sh --build --skip-tests
#   ./scripts/verify-from-pi.sh --fast --test visualOrchestration
#   ./scripts/verify-from-pi.sh --dry-sync   # sync only + print plan
#
# Config: env vars or .env.verify-local next to this script / in cwd / in workspace.
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_HINT="$(cd "${SCRIPT_DIR}/.." && pwd)"

MODE="fast"
SKIP_TESTS=0
TEST_PATTERN=""
DRY_SYNC=0
SKIP_SYNC=0

usage() {
  cat <<'EOF'
Usage: verify-from-pi.sh [--fast|--build] [--skip-tests] [--test <pattern>] [--dry-sync] [--skip-sync]

  --fast       sync + deps + typecheck + tests (default)
  --build      sync + deps + typecheck + tests + npm run build
  --skip-tests skip vitest stage
  --test PAT   pass -t PAT to vitest (or filter path)
  --dry-sync   rsync --dry-run only, then exit
  --skip-sync  use existing HERMES_BUILD_WORKSPACE without rsync (local iterate)
EOF
}

while [[ $# -gt 0 ]]; do
  case "$1" in
    --fast) MODE="fast"; shift ;;
    --build) MODE="build"; shift ;;
    --skip-tests) SKIP_TESTS=1; shift ;;
    --test) TEST_PATTERN="${2:-}"; shift 2 ;;
    --dry-sync) DRY_SYNC=1; shift ;;
    --skip-sync) SKIP_SYNC=1; shift ;;
    -h|--help) usage; exit 0 ;;
    *) echo "Unknown arg: $1" >&2; usage; exit 2 ;;
  esac
done

load_env_file() {
  local f="$1"
  [[ -f "$f" ]] || return 0
  set -a
  # shellcheck disable=SC1090
  source "$f"
  set +a
}

# Prefer explicit env; then local config files (never committed secrets).
load_env_file "${PWD}/.env.verify-local"
load_env_file "${SCRIPT_DIR}/.env.verify-local"
load_env_file "${REPO_HINT}/.env.verify-local"

HERMES_PI_HOST="${HERMES_PI_HOST:-}"
HERMES_PI_PATH="${HERMES_PI_PATH:-/home/ysh/thealltour}"
HERMES_BUILD_WORKSPACE="${HERMES_BUILD_WORKSPACE:-}"

die() { echo "ERROR: $*" >&2; exit 1; }

[[ -n "$HERMES_PI_HOST" ]] || die "HERMES_PI_HOST is required (see scripts/verify-local.env.example)"
[[ -n "$HERMES_BUILD_WORKSPACE" ]] || die "HERMES_BUILD_WORKSPACE is required (see scripts/verify-local.env.example)"

# --- Destination guard -------------------------------------------------------
assert_safe_workspace() {
  local dest="$1"
  [[ "$dest" == /* ]] || die "HERMES_BUILD_WORKSPACE must be an absolute path, got: $dest"
  if [[ "$dest" == "/" || "$dest" == "/home" || "$dest" == "/root" || "$dest" == "/usr" || "$dest" == "/etc" || "$dest" == "/var" || "$dest" == "/mnt" ]]; then
    die "Refusing dangerous HERMES_BUILD_WORKSPACE=$dest"
  fi
  if [[ "$dest" != *thealltour* && "$dest" != *verify* && "$dest" != *build-workspace* ]]; then
    die "HERMES_BUILD_WORKSPACE must contain 'thealltour', 'verify', or 'build-workspace' in the path (got: $dest)"
  fi
  if [[ "$dest" == "/home/ysh/thealltour" || "$dest" == "/home/ysh/theallcloud" ]]; then
    die "Refusing to use Pi production path as HERMES_BUILD_WORKSPACE"
  fi
  if [[ -e "$dest" ]]; then
    local resolved
    resolved="$(readlink -f "$dest" 2>/dev/null || realpath "$dest" 2>/dev/null || echo "$dest")"
    if [[ "$resolved" == "/home/ysh/thealltour" || "$resolved" == "/home/ysh/theallcloud" ]]; then
      die "Resolved workspace points at Pi production tree: $resolved"
    fi
  fi
}

assert_safe_workspace "$HERMES_BUILD_WORKSPACE"
mkdir -p "$HERMES_BUILD_WORKSPACE"

STAGE_SYNC="SKIP"
STAGE_DEPS="SKIP"
STAGE_TSC="SKIP"
STAGE_TEST="SKIP"
STAGE_BUILD="SKIP"
T_SYNC=0
T_DEPS=0
T_TSC=0
T_TEST=0
T_BUILD=0

elapsed() {
  local start="$1"
  local end
  end="$(date +%s)"
  echo $((end - start))
}

print_summary() {
  echo ""
  echo "======== VERIFY SUMMARY ========"
  echo "SYNC:         $STAGE_SYNC${T_SYNC:+ (${T_SYNC}s)}"
  echo "DEPENDENCIES: $STAGE_DEPS${T_DEPS:+ (${T_DEPS}s)}"
  echo "TYPECHECK:    $STAGE_TSC${T_TSC:+ (${T_TSC}s)}"
  echo "TESTS:        $STAGE_TEST${T_TEST:+ (${T_TEST}s)}"
  echo "NEXT BUILD:   $STAGE_BUILD${T_BUILD:+ (${T_BUILD}s)}"
  echo "workspace:    $HERMES_BUILD_WORKSPACE"
  echo "==============================="
}

fail_stage() {
  local name="$1"
  shift
  echo "$*" >&2
  print_summary
  exit 1
}

# --- Sync --------------------------------------------------------------------
if [[ "$SKIP_SYNC" -eq 0 ]]; then
  t0="$(date +%s)"
  RSYNC_FLAGS=(-az --delete)
  if [[ "$DRY_SYNC" -eq 1 ]]; then
    RSYNC_FLAGS+=(--dry-run --itemize-changes)
  fi
  EXCLUDES=(
    --exclude=node_modules/
    --exclude=.next/
    --exclude=.git/
    --exclude=.verify-lock-hash
    --exclude=.env.local
    --exclude=.env.verify-local
    # WSL may keep a local .env.build-test; do not clobber with Pi copies.
    --exclude=.env.build-test
    --exclude='*.log'
    --exclude=coverage/
    --exclude=.turbo/
    --exclude=.cache/
    --exclude=tmp/
    --exclude=temp/
    --exclude='lighthouse-report.html'
    --exclude='*.tsbuildinfo'
  )
  echo ">>> SYNC ${HERMES_PI_HOST}:${HERMES_PI_PATH}/ → ${HERMES_BUILD_WORKSPACE}/"
  # Trailing slashes: copy contents into workspace
  if ! rsync "${RSYNC_FLAGS[@]}" "${EXCLUDES[@]}" \
    "${HERMES_PI_HOST}:${HERMES_PI_PATH}/" \
    "${HERMES_BUILD_WORKSPACE}/"; then
    STAGE_SYNC="FAIL"
    fail_stage SYNC "SYNC: FAIL"
  fi
  T_SYNC="$(elapsed "$t0")"
  STAGE_SYNC="PASS"
  if [[ "$DRY_SYNC" -eq 1 ]]; then
    print_summary
    exit 0
  fi

  # hermes-tools/scripts/verify-from-pi.sh can lag the Pi repo. After sync, re-exec
  # the workspace copy so placeholder-env guards and assert scripts are current.
  WS_VERIFY="${HERMES_BUILD_WORKSPACE}/scripts/verify-from-pi.sh"
  if [[ -f "$WS_VERIFY" ]]; then
    self="$(readlink -f "${BASH_SOURCE[0]}" 2>/dev/null || realpath "${BASH_SOURCE[0]}" 2>/dev/null || echo "${BASH_SOURCE[0]}")"
    ws="$(readlink -f "$WS_VERIFY" 2>/dev/null || realpath "$WS_VERIFY" 2>/dev/null || echo "$WS_VERIFY")"
    if [[ "$self" != "$ws" ]]; then
      echo ">>> RE-EXEC workspace verify script (synced from Pi)"
      re_args=(--skip-sync)
      if [[ "$MODE" == "build" ]]; then
        re_args+=(--build)
      else
        re_args+=(--fast)
      fi
      [[ "$SKIP_TESTS" -eq 1 ]] && re_args+=(--skip-tests)
      [[ -n "$TEST_PATTERN" ]] && re_args+=(--test "$TEST_PATTERN")
      exec bash "$WS_VERIFY" "${re_args[@]}"
    fi
  fi
else
  STAGE_SYNC="SKIP (--skip-sync)"
fi

cd "$HERMES_BUILD_WORKSPACE"

# Optional build-test env (do not require Pi secrets).
# CRITICAL: never export placeholder Supabase hosts into process.env — they override
# .env.local for `next build` and bake example.supabase.co into Edge middleware.
# That poisoned .next must never be rsynced to Pi (Internal Server Error).
is_placeholder_supabase_value() {
  local v="$1"
  [[ "$v" == *example.supabase.co* || "$v" == *example.supabase.com* ]] && return 0
  [[ "$v" == *public-anon-placeholder* || "$v" == *service-role-placeholder* ]] && return 0
  return 1
}

load_build_test_env_file() {
  local f="$1"
  local skipped=0
  local loaded=0
  local line key val
  echo ">>> ENV: loading ${f} (placeholder Supabase keys skipped)"
  while IFS= read -r line || [[ -n "$line" ]]; do
    # strip CR, comments, blanks
    line="${line%$'\r'}"
    [[ -z "$line" || "$line" =~ ^[[:space:]]*# ]] && continue
    [[ "$line" == *"="* ]] || continue
    key="${line%%=*}"
    val="${line#*=}"
    key="${key#"${key%%[![:space:]]*}"}"
    key="${key%"${key##*[![:space:]]}"}"
    [[ "$key" =~ ^[A-Za-z_][A-Za-z0-9_]*$ ]] || continue
    # strip optional surrounding quotes
    if [[ "$val" =~ ^\"(.*)\"$ ]]; then val="${BASH_REMATCH[1]}"; fi
    if [[ "$val" =~ ^\'(.*)\'$ ]]; then val="${BASH_REMATCH[1]}"; fi
    if is_placeholder_supabase_value "$val"; then
      echo "    skip ${key}=<placeholder> (would poison next build inlining)"
      skipped=$((skipped + 1))
      continue
    fi
    export "${key}=${val}"
    loaded=$((loaded + 1))
  done <"$f"
  echo "    loaded=${loaded} skipped_placeholder=${skipped}"
}

if [[ -f .env.build-test ]]; then
  load_build_test_env_file .env.build-test
elif [[ -f "${SCRIPT_DIR}/env.build-test.example" && ! -f .env.build-test ]]; then
  echo "NOTE: no .env.build-test in workspace (optional). See scripts/env.build-test.example"
fi

if [[ -f .env.local ]]; then
  echo "NOTE: .env.local present in workspace — Next will load it for build (preferred over placeholders)"
fi

# --- Node runtime (non-interactive SSH: do not rely on shell profile) -------
# nvm is normally loaded from .bashrc only for interactive shells.
export NVM_DIR="${NVM_DIR:-$HOME/.nvm}"
if [[ -s "$NVM_DIR/nvm.sh" ]]; then
  # shellcheck disable=SC1090
  . "$NVM_DIR/nvm.sh"
fi
if command -v nvm >/dev/null 2>&1 && [[ -f "${HERMES_BUILD_WORKSPACE}/.nvmrc" ]]; then
  # Select the workspace .nvmrc version (no hardcoded node path).
  nvm use --silent || nvm use
fi
if ! command -v node >/dev/null 2>&1 || ! command -v npm >/dev/null 2>&1; then
  echo "NODE_RUNTIME: FAIL - node/npm not available in non-interactive shell" >&2
  echo "  NVM_DIR=${NVM_DIR}" >&2
  echo "  which node: $(command -v node 2>/dev/null || echo missing)" >&2
  echo "  which npm:  $(command -v npm 2>/dev/null || echo missing)" >&2
  exit 1
fi
echo ">>> NODE_RUNTIME"
echo "    node: $(command -v node) ($(node -v))"
echo "    npm:  $(command -v npm) ($(npm -v 2>/dev/null || echo unknown))"
if [[ -f .nvmrc ]]; then
  echo "    .nvmrc: $(tr -d '[:space:]' < .nvmrc)"
fi

# --- Dependencies ------------------------------------------------------------
t0="$(date +%s)"
LOCK_FILE="package-lock.json"
HASH_FILE=".verify-lock-hash"
need_ci=0
if [[ ! -d node_modules ]]; then
  need_ci=1
elif [[ ! -f "$LOCK_FILE" ]]; then
  die "package-lock.json missing after sync"
else
  CURRENT_HASH="$(sha256sum "$LOCK_FILE" | awk '{print $1}')"
  PREV_HASH=""
  [[ -f "$HASH_FILE" ]] && PREV_HASH="$(tr -d '[:space:]' < "$HASH_FILE")"
  if [[ "$CURRENT_HASH" != "$PREV_HASH" ]]; then
    need_ci=1
  fi
fi

if [[ "$need_ci" -eq 1 ]]; then
  echo ">>> DEPENDENCIES: npm ci"
  if ! npm ci; then
    STAGE_DEPS="FAIL"
    fail_stage DEPS "DEPENDENCIES: FAIL"
  fi
  sha256sum "$LOCK_FILE" | awk '{print $1}' >"$HASH_FILE"
  STAGE_DEPS="PASS (npm ci)"
else
  echo ">>> DEPENDENCIES: skip npm ci (lock unchanged)"
  STAGE_DEPS="PASS (skipped npm ci)"
fi
T_DEPS="$(elapsed "$t0")"

# --- Typecheck ---------------------------------------------------------------
t0="$(date +%s)"
echo ">>> TYPECHECK: npx tsc --noEmit"
if ! npx tsc --noEmit; then
  STAGE_TSC="FAIL"
  STAGE_TEST="SKIP (typecheck failed)"
  STAGE_BUILD="SKIP (typecheck failed)"
  fail_stage TYPECHECK "TYPECHECK: FAIL → tests/build not attempted"
fi
T_TSC="$(elapsed "$t0")"
STAGE_TSC="PASS"

# --- Tests -------------------------------------------------------------------
if [[ "$SKIP_TESTS" -eq 1 ]]; then
  STAGE_TEST="SKIP (--skip-tests)"
else
  t0="$(date +%s)"
  echo ">>> TESTS"
  TEST_ARGS=()
  if [[ -n "$TEST_PATTERN" ]]; then
    # Prefer path/file filter; vitest treats extra args as filters
    TEST_ARGS+=("$TEST_PATTERN")
  fi
  if ! npm test -- "${TEST_ARGS[@]}"; then
    STAGE_TEST="FAIL"
    STAGE_BUILD="SKIP (tests failed)"
    fail_stage TESTS "TESTS: FAIL → build not attempted"
  fi
  T_TEST="$(elapsed "$t0")"
  STAGE_TEST="PASS"
fi

# --- Build -------------------------------------------------------------------
if [[ "$MODE" == "build" ]]; then
  t0="$(date +%s)"
  echo ">>> NEXT BUILD: npm run build"
  if ! npm run build; then
    STAGE_BUILD="FAIL"
    fail_stage BUILD "NEXT BUILD: FAIL"
  fi
  T_BUILD="$(elapsed "$t0")"
  # Verify may intentionally build with placeholders; never treat that as Pi-deployable.
  echo ">>> NEXT BUILD GUARD: assert-next-build-not-placeholder.sh"
  if ASSERT_NEXT_ALLOW_PLACEHOLDER=1 bash "${SCRIPT_DIR}/assert-next-build-not-placeholder.sh" .next; then
    if [[ -f .next/THEALLTOUR_DEPLOYABLE ]]; then
      STAGE_BUILD="PASS (deployable marker written — still do not auto-deploy)"
    else
      STAGE_BUILD="PASS (verify-only; NOT for Pi — see .next/THEALLTOUR_NOT_FOR_PI_DEPLOY)"
      echo "WARNING: This WSL .next must NOT be rsynced to Pi." >&2
      echo "         Use ./scripts/deploy-internal-next-from-wsl.sh from Pi for a real-env build." >&2
    fi
  else
    STAGE_BUILD="FAIL (placeholder guard)"
    fail_stage BUILD "NEXT BUILD GUARD: FAIL"
  fi
else
  STAGE_BUILD="SKIP (--fast)"
fi

print_summary
exit 0
