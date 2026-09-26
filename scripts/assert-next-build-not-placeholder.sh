#!/usr/bin/env bash
# Fail closed if a Next.js production build baked placeholder Supabase hosts.
#
# NEXT_PUBLIC_SUPABASE_URL is inlined at `next build` time. WSL verify often uses
# scripts/env.build-test.example placeholders (example.supabase.co). Rsync'ing that
# .next onto Pi breaks Edge middleware (ENOTFOUND → Internal Server Error).
#
# Usage:
#   ./scripts/assert-next-build-not-placeholder.sh [path/to/.next]
#   ASSERT_NEXT_ALLOW_PLACEHOLDER=1  # verify-only: warn + write marker, exit 0
#
# Exit codes:
#   0 — deployable (or allow-placeholder mode after writing NOT_FOR_PI_DEPLOY)
#   1 — placeholder detected (default) or .next missing / scan failed
set -euo pipefail

NEXT_DIR="${1:-.next}"
ALLOW_PLACEHOLDER="${ASSERT_NEXT_ALLOW_PLACEHOLDER:-0}"
MARKER_OK="${NEXT_DIR}/THEALLTOUR_DEPLOYABLE"
MARKER_BAD="${NEXT_DIR}/THEALLTOUR_NOT_FOR_PI_DEPLOY"

PLACEHOLDER_PATTERNS=(
  'example.supabase.co'
  'example.supabase.com'
  'public-anon-placeholder'
  'service-role-placeholder'
)

die() { echo "ERROR: $*" >&2; exit 1; }

[[ -d "$NEXT_DIR" ]] || die "missing Next build dir: $NEXT_DIR"
[[ -f "${NEXT_DIR}/BUILD_ID" ]] || die "missing ${NEXT_DIR}/BUILD_ID (incomplete build)"

rm -f "$MARKER_OK" "$MARKER_BAD"

hits=()

scan_pattern() {
  local pat="$1"
  if command -v rg >/dev/null 2>&1; then
    # Limit to JS/JSON artifacts Next emits; ignore traces/cache noise when possible.
    rg -l -F --glob '*.js' --glob '*.json' --glob '*.nft.json' -- "$pat" "$NEXT_DIR" 2>/dev/null | head -n 20 || true
  else
    grep -RIl --include='*.js' --include='*.json' -- "$pat" "$NEXT_DIR" 2>/dev/null | head -n 20 || true
  fi
}

for pat in "${PLACEHOLDER_PATTERNS[@]}"; do
  mapfile -t found < <(scan_pattern "$pat")
  if [[ ${#found[@]} -gt 0 ]]; then
    hits+=("$pat")
    echo "PLACEHOLDER_HIT pattern=$pat" >&2
    printf '  %s\n' "${found[@]:0:5}" >&2
  fi
done

BUILD_ID="$(tr -d '[:space:]' <"${NEXT_DIR}/BUILD_ID")"
NOW_ISO="$(date -u +%Y-%m-%dT%H:%M:%SZ)"

if [[ ${#hits[@]} -gt 0 ]]; then
  {
    echo "status=not_for_pi_deploy"
    echo "build_id=${BUILD_ID}"
    echo "checked_at=${NOW_ISO}"
    echo "reason=placeholder_inlined_at_build"
    echo "patterns=${hits[*]}"
    echo "hint=Do not rsync this .next to Pi. Use scripts/deploy-internal-next-from-wsl.sh (real env) or on-Pi npm run build."
  } >"$MARKER_BAD"

  echo "============================================================" >&2
  echo "NEXT BUILD IS NOT SAFE TO DEPLOY TO PI" >&2
  echo "  BUILD_ID=${BUILD_ID}" >&2
  echo "  placeholders: ${hits[*]}" >&2
  echo "  marker: ${MARKER_BAD}" >&2
  echo "  Edge middleware will ENOTFOUND and return Internal Server Error." >&2
  echo "============================================================" >&2

  if [[ "$ALLOW_PLACEHOLDER" == "1" ]]; then
    echo "ASSERT_NEXT_ALLOW_PLACEHOLDER=1 → verify continues (deploy still forbidden)" >&2
    exit 0
  fi
  exit 1
fi

{
  echo "status=deployable"
  echo "build_id=${BUILD_ID}"
  echo "checked_at=${NOW_ISO}"
} >"$MARKER_OK"

echo "NEXT_BUILD_DEPLOYABLE=1 BUILD_ID=${BUILD_ID} marker=${MARKER_OK}"
exit 0
