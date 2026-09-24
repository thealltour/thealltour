#!/usr/bin/env bash
# Phase 4 post-deploy: cut over live Hermes specialist model.default to production aliases.
#
# SAFETY: refuses to rewrite live configs unless gateway smoke PASS (12/12),
# so we never point Hermes at aliases the running gateway does not know.
#
# Prerequisite order:
#   1. Phase 4 .next artifact deployed
#   2. thealltour-internal restarted
#   3. gateway smoke PASS
#   4. this script
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "$0")/.." && pwd)"
SKIP_SMOKE=0
FORCE=0
for arg in "$@"; do
  case "$arg" in
    --skip-smoke)
      echo "ERROR: --skip-smoke is not supported. Run gateway smoke first (or use --force with explicit risk)." >&2
      exit 2
      ;;
    --force)
      FORCE=1
      ;;
    -h|--help)
      echo "Usage: $0 [--force]"
      echo "  Default: runs scripts/phase4-specialist-alias-gateway-smoke.ts; aborts on FAIL."
      echo "  --force: skip smoke (dangerous — only for known-good gateway)."
      exit 0
      ;;
    *)
      echo "Unknown arg: $arg" >&2
      exit 2
      ;;
  esac
done

if [[ "$FORCE" -eq 1 ]]; then
  echo "WARNING: --force set — skipping gateway smoke preflight. Live profiles may 400 if gateway lacks aliases." >&2
else
  echo ">>> Preflight: phase4-specialist-alias-gateway-smoke.ts (must PASS 12/12)"
  SMOKE_OUT="$(mktemp)"
  if ! npx --yes tsx "$ROOT_DIR/scripts/phase4-specialist-alias-gateway-smoke.ts" >"$SMOKE_OUT" 2>&1; then
    echo "ERROR: gateway smoke failed — refusing live profile cutover." >&2
    tail -n 40 "$SMOKE_OUT" >&2 || true
    rm -f "$SMOKE_OUT"
    exit 1
  fi
  if ! python3 - "$SMOKE_OUT" <<'PY'
import json, sys
raw = open(sys.argv[1], encoding="utf8").read()
start = raw.find("{")
if start < 0:
    raise SystemExit("no JSON in smoke output")
j = json.loads(raw[start:])
aliases = j.get("aliases") or {}
if j.get("summary", {}).get("result") != "PASS" or len(aliases) < 12:
    raise SystemExit(f"smoke not PASS or incomplete: summary={j.get('summary')} count={len(aliases)}")
fails = [k for k, v in aliases.items() if v.get("result") != "PASS"]
if fails:
    raise SystemExit(f"smoke failures: {fails}")
print(f"gateway smoke PASS ({len(aliases)}/12)")
PY
  then
    echo "ERROR: gateway smoke result validation failed — refusing live profile cutover." >&2
    tail -n 40 "$SMOKE_OUT" >&2 || true
    rm -f "$SMOKE_OUT"
    exit 1
  fi
  rm -f "$SMOKE_OUT"
fi

SPECIALISTS=(
  editorial-narrative-planner
  instagram-carousel-planner
  instagram-card-copy-writer
  instagram-caption-writer
  instagram-visual-role-architect
  shared-visual-planner
  card-layout-director
  astra-handoff-writer
  threads-copy-writer
  naver-blog-structure-planner
  naver-blog-copy-writer
  naver-band-copy-writer
)
ROOT="${HERMES_HOME:-$HOME/.hermes}/profiles"
for pid in "${SPECIALISTS[@]}"; do
  cfg="$ROOT/$pid/config.yaml"
  alias="thealltour/$pid"
  python3 - "$cfg" "$alias" <<'PY'
import re, sys
path, alias = sys.argv[1], sys.argv[2]
text = open(path, encoding="utf8").read()
# Idempotent if already cut over
if f"default: {alias}" in text:
    print(f"{path}: already {alias}")
    raise SystemExit(0)
text, n1 = re.subn(r"(default:\s*)theallcloud/auto(\b)", rf"\1{alias}\2", text, count=1)
text, n2 = re.subn(r"(^[ \t]+)theallcloud/auto:(\s*$)", rf"\1{alias}:\2", text, count=1, flags=re.M)
open(path, "w", encoding="utf8").write(text)
print(f"{path}: default_repl={n1} models_repl={n2} -> {alias}")
if n1 == 0 or n2 == 0:
    raise SystemExit(f"FAILED to update {path}")
PY
done
echo "Phase 4 live specialist alias cutover applied."
