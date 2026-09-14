#!/usr/bin/env bash
# Idempotent dependency setup for the TheAllTour Next.js app.
# Runs after the repository is checked out. Safe to run repeatedly.
set -euo pipefail

cd "$(dirname "$0")/.."

# Use Node 24 (package.json engines) via nvm. Prepend explicitly because the
# runtime may ship its own node earlier on PATH.
export NVM_DIR="${NVM_DIR:-$HOME/.nvm}"
if [ -s "$NVM_DIR/nvm.sh" ]; then
  # shellcheck disable=SC1091
  . "$NVM_DIR/nvm.sh"
  nvm install 24 >/dev/null
  nvm use 24 >/dev/null
  export PATH="$(dirname "$(nvm which 24)"):$PATH"
fi

echo "Using node $(node -v) / npm $(npm -v)"

npm ci

# Provide a local env file so the dev server can boot. The app degrades
# gracefully to default content when the Supabase DB is unreachable.
# These are Supabase's well-known non-secret local demo keys.
if [ ! -f .env.local ]; then
  cat > .env.local <<'EOF'
NEXT_PUBLIC_SUPABASE_URL=http://127.0.0.1:54321
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJyb2xlIjoiYW5vbiIsImlzcyI6InN1cGFiYXNlLWRlbW8iLCJpYXQiOjE2NDE3NjkyMDAsImV4cCI6MTc5OTUzNTYwMH0.dc_X5iR_VP_qT0zsiyj_I_OZ2T9FtRU2BBNWN8Bu4GE
SUPABASE_SERVICE_ROLE_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJyb2xlIjoic2VydmljZV9yb2xlIiwiaXNzIjoic3VwYWJhc2UtZGVtbyIsImlhdCI6MTY0MTc2OTIwMCwiZXhwIjoxNzk5NTM1NjAwfQ.DaYlNEoUrrEn2Ig7tqibS-PHK5vgusbcbo7X36XVt4Q
SUPABASE_URL=http://127.0.0.1:54321
MEMBER_SESSION_SECRET=local-dev-member-session-secret-change-me
ADMIN_SESSION_SECRET=local-dev-admin-session-secret-change-me
EOF
  echo "Created .env.local with local development defaults."
fi

echo "Install complete."
