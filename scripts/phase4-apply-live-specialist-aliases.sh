#!/usr/bin/env bash
# Phase 4 post-deploy: cut over live Hermes specialist model.default to production aliases.
# Prerequisite: gateway registry deployed + thealltour-internal restarted + alias probe PASS.
set -euo pipefail
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
text, n1 = re.subn(r"(default:\s*)theallcloud/auto(\b)", rf"\1{alias}\2", text, count=1)
text, n2 = re.subn(r"(^[ \t]+)theallcloud/auto:(\s*$)", rf"\1{alias}:\2", text, count=1, flags=re.M)
open(path, "w", encoding="utf8").write(text)
print(f"{path}: default_repl={n1} models_repl={n2} -> {alias}")
if n1 == 0 or n2 == 0:
    raise SystemExit(f"FAILED to update {path}")
PY
done
echo "Phase 4 live specialist alias cutover applied."
