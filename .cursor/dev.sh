#!/usr/bin/env bash
# Starts the Next.js dev server on port 4000.
set -euo pipefail

cd "$(dirname "$0")/.."

export NVM_DIR="${NVM_DIR:-$HOME/.nvm}"
if [ -s "$NVM_DIR/nvm.sh" ]; then
  # shellcheck disable=SC1091
  . "$NVM_DIR/nvm.sh"
  nvm use 24 >/dev/null 2>&1 || true
  export PATH="$(dirname "$(nvm which 24 2>/dev/null || echo node)"):$PATH"
fi

exec npm run dev
