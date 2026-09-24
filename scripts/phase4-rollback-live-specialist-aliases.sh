#!/usr/bin/env bash
# Phase 4: roll back live Hermes specialist aliases to spike theallcloud/auto.
# Does not touch secrets, provider base_url, or non-specialist profiles.
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
text, n1 = re.subn(rf"(default:\s*){re.escape(alias)}(\b)", r"\1theallcloud/auto\2", text, count=1)
text, n2 = re.subn(rf"(^[ \t]+){re.escape(alias)}:(\s*$)", r"\1theallcloud/auto:\2", text, count=1, flags=re.M)
# Idempotent if already on spike
if n1 == 0 and n2 == 0 and "default: theallcloud/auto" in text:
    print(f"{path}: already spike theallcloud/auto")
    raise SystemExit(0)
open(path, "w", encoding="utf8").write(text)
print(f"{path}: default_repl={n1} models_repl={n2} -> theallcloud/auto")
if n1 == 0 and n2 == 0:
    raise SystemExit(f"FAILED to rollback {path}")
PY
done
echo "Phase 4 live specialist alias rollback to theallcloud/auto complete."
