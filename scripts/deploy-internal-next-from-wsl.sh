#!/usr/bin/env bash
# Build a Pi-deployable Next.js artifact on WSL (real env) and install it on Pi.
#
# Why this exists:
#   verify-on-wsl --build may bake example.supabase.co when only .env.build-test
#   placeholders are present. Rsync'ing that .next to Pi breaks Edge auth
#   (ENOTFOUND → Internal Server Error on every admin page).
#
# Run on hermes-pi:
#   ./scripts/deploy-internal-next-from-wsl.sh
#   ./scripts/deploy-internal-next-from-wsl.sh --skip-build   # reuse WSL .next if deployable
#
# Does NOT copy node_modules (arch mismatch). Restarts thealltour-internal.
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
HERMES_WSL_WORKSPACE="${HERMES_WSL_WORKSPACE:-/home/ysh/hermes-build/thealltour-verify}"
PI_REPO="${HERMES_PI_PATH:-/home/ysh/thealltour}"
SKIP_BUILD=0

usage() {
  cat <<'EOF'
Usage: deploy-internal-next-from-wsl.sh [--skip-build]

  1) Sync Pi .env.local → WSL workspace (required for real NEXT_PUBLIC inlining)
  2) npm run build on WSL
  3) Refuse deploy if example.supabase.* is baked in
  4) rsync WSL .next → Pi
  5) Restart thealltour-internal.service

  --skip-build   Skip remote build; only deploy if WSL .next already has THEALLTOUR_DEPLOYABLE
EOF
}

while [[ $# -gt 0 ]]; do
  case "$1" in
    --skip-build) SKIP_BUILD=1; shift ;;
    -h|--help) usage; exit 0 ;;
    *) echo "Unknown arg: $1" >&2; usage; exit 2 ;;
  esac
done

die() { echo "ERROR: $*" >&2; exit 1; }

cd "$PI_REPO" || die "cannot cd $PI_REPO"
[[ -f .env.local ]] || die "Pi .env.local missing — cannot produce a deployable build"

if ! grep -qE '^NEXT_PUBLIC_SUPABASE_URL=https://[^/]+\.supabase\.co' .env.local; then
  die "Pi .env.local NEXT_PUBLIC_SUPABASE_URL must be a real https://*.supabase.co host"
fi
if grep -qE 'example\.supabase\.(co|com)' .env.local; then
  die "Pi .env.local still contains example.supabase.* — refusing"
fi

SSH_OPTS=(-o BatchMode=yes -o ConnectTimeout=20)
ssh "${SSH_OPTS[@]}" "${HERMES_WSL_VERIFY_HOST}" "test -d '${HERMES_WSL_WORKSPACE}'" \
  || die "WSL workspace missing: ${HERMES_WSL_VERIFY_HOST}:${HERMES_WSL_WORKSPACE}"

echo ">>> SYNC .env.local → ${HERMES_WSL_VERIFY_HOST}:${HERMES_WSL_WORKSPACE}/.env.local"
scp "${SSH_OPTS[@]}" .env.local \
  "${HERMES_WSL_VERIFY_HOST}:${HERMES_WSL_WORKSPACE}/.env.local"

echo ">>> Neutralize placeholder Supabase keys in WSL .env.build-test (if present)"
ssh "${SSH_OPTS[@]}" "${HERMES_WSL_VERIFY_HOST}" \
  "WSL_BUILD_TEST='${HERMES_WSL_WORKSPACE}/.env.build-test' python3" <<'PY'
from pathlib import Path
import os
f = Path(os.environ["WSL_BUILD_TEST"])
if not f.exists():
    print("no .env.build-test (ok)")
    raise SystemExit(0)
text = f.read_text()
out = []
for line in text.splitlines():
    raw = line
    stripped = line.lstrip()
    if stripped.startswith("#") or "=" not in line:
        out.append(line)
        continue
    _, _, val = line.partition("=")
    low = val.lower()
    if (
        "example.supabase.co" in low
        or "example.supabase.com" in low
        or "public-anon-placeholder" in low
        or "service-role-placeholder" in low
    ):
        out.append(f"# {raw}  # neutralized by deploy-internal-next-from-wsl")
    else:
        out.append(line)
backup = Path(str(f) + ".bak")
if not backup.exists():
    backup.write_text(text)
f.write_text("\n".join(out) + "\n")
print(f"updated {f}")
PY

if [[ "$SKIP_BUILD" -eq 0 ]]; then
  echo ">>> SYNC Pi scripts → WSL workspace (assert + verify helpers)"
  rsync -az -e "ssh ${SSH_OPTS[*]}" \
    "${PI_REPO}/scripts/assert-next-build-not-placeholder.sh" \
    "${PI_REPO}/scripts/verify-from-pi.sh" \
    "${PI_REPO}/scripts/deploy-internal-next-from-wsl.sh" \
    "${PI_REPO}/scripts/restart-thealltour-internal.sh" \
    "${HERMES_WSL_VERIFY_HOST}:${HERMES_WSL_WORKSPACE}/scripts/"

  echo ">>> WSL npm run build (real .env.local)"
  ssh "${SSH_OPTS[@]}" "${HERMES_WSL_VERIFY_HOST}" bash -s <<REMOTE
set -euo pipefail
cd "${HERMES_WSL_WORKSPACE}"
export NVM_DIR="\${NVM_DIR:-\$HOME/.nvm}"
# shellcheck disable=SC1090
[[ -s "\$NVM_DIR/nvm.sh" ]] && . "\$NVM_DIR/nvm.sh"
command -v nvm >/dev/null 2>&1 && nvm use --silent || true
echo "node=\$(node -v) npm=\$(npm -v)"
# Do not source .env.build-test here — Next loads .env.local.
npm run build
bash ./scripts/assert-next-build-not-placeholder.sh .next
REMOTE
else
  echo ">>> SKIP remote build — checking existing WSL .next"
  ssh "${SSH_OPTS[@]}" "${HERMES_WSL_VERIFY_HOST}" \
    "bash '${HERMES_WSL_WORKSPACE}/scripts/assert-next-build-not-placeholder.sh' '${HERMES_WSL_WORKSPACE}/.next'"
fi

echo ">>> RSYNC WSL .next → Pi (node_modules NOT copied)"
rsync -a --delete -e "ssh ${SSH_OPTS[*]}" \
  "${HERMES_WSL_VERIFY_HOST}:${HERMES_WSL_WORKSPACE}/.next/" \
  "${PI_REPO}/.next/"

bash "${SCRIPT_DIR}/assert-next-build-not-placeholder.sh" "${PI_REPO}/.next"

echo ">>> RESTART thealltour-internal"
bash "${SCRIPT_DIR}/restart-thealltour-internal.sh"

echo "DEPLOY_OK BUILD_ID=$(tr -d '[:space:]' <"${PI_REPO}/.next/BUILD_ID")"
