# Shortform Live Deployment Checklist (SV-8C1)

Preparation only. **Do not** push, apt-install, migrate, systemd start, or enable the worker in this step.

Release pin (Hermes-Pi after SV-8B2 checkpoint):

| Field | Value |
|-------|--------|
| Commit | `b8bfeafd3436d4bf204aa07b89f4204c1c8e74ac` |
| Short | `b8bfeaf` |
| Message | `feat(marketing): add private shortform asset transport` |
| Pushed | **NO** (as of SV-8C1) |

Mini-PC must checkout **this SHA** (or a later explicit release SHA), not an unpinned `git pull`.

---

## Topology (locked)

```text
Mini-PC
  └─ ephemeral workspace only
        │
        ├─ Pi Asset Transfer: briefs + managed source READ
        ├─ provider stock direct READ (Pexels/Pixabay)
        ├─ local VoiceStudio / Remotion / FFmpeg
        └─ final → Pi Asset Transfer durable WRITE

Hermes-Pi
  └─ MARKETING_ASSET_ROOT=/mnt/HDD2TB/marketing-assets
  └─ Asset Transfer API (Tailscale + bearer)
```

No Mini-PC `/mnt/HDD2TB` mount. No Mini-PC `MARKETING_ASSET_ROOT`.

---

## A–M Ordered live deployment (SV-8C2 / SV-8C3)

Execute **in order**. Stop if any step fails.

1. **A. Push release checkpoint** — push pinned SHA from Pi; record `git rev-parse HEAD`.
2. **B. Apply migrations** — SV-2 then SV-6 on verified production Supabase project (commands below). Confirm tables/RLS.
3. **C. Pi env** — set Pi `.env.local` per Pi contract (no secrets in git/unit files).
4. **D. Pi Asset Transfer install/start** — copy unit → daemon-reload → enable → start → `/health` OK.
5. **E. Mini-PC repo checkout** — clone/pull `/home/ysh/thealltour` → `git checkout <SHA>` → `git rev-parse HEAD` matches Pi.
6. **F. Mini-PC OS dependencies** — ffmpeg/ffprobe + Korean fonts (commands below). Validate.
7. **G. Remotion browser** — Remotion-managed Chrome Headless Shell (strategy A). First render may download; do not mix OS Chrome.
8. **H. Korean fonts** — `fonts-noto-cjk` (validate with `fc-list`).
9. **I. Mini-PC env** — HTTP transport + worker still **disabled**.
10. **J. Worker health** — `npm run marketing:shortform-worker:health` (or `--health`) → executionReady/config visible; **enabled=false**.
11. **K. Worker systemd install** — install service+timer; timer may run but worker must stay disabled via env.
12. **L. Worker remains disabled** — `SHORTFORM_VIDEO_WORKER_ENABLED=false` until SV-8C3.
13. **M. SV-8C3 explicit live job** — only then: set `SHORTFORM_VIDEO_EXECUTION_MODE=production`, verify health, then `SHORTFORM_VIDEO_WORKER_ENABLED=true`, enqueue one job, observe, disable again if needed.

### Worker enable sequence (fail-closed)

```text
code deployed (same SHA)
→ runtime dependencies verified (ffmpeg, fonts, Remotion browser path)
→ migrations applied
→ Pi Asset Transfer healthy
→ Mini-PC health command PASS (enabled still false)
→ SHORTFORM_VIDEO_EXECUTION_MODE=production
→ SHORTFORM_VIDEO_WORKER_ENABLED=true   ← last gate before claim
```

Never enable first and install dependencies later.

---

## Runtime env inventory (code-derived)

| Variable | Role | Machine |
|----------|------|---------|
| `NEXT_PUBLIC_SUPABASE_URL` | Supabase project URL | **BOTH** (catalog + render jobs) |
| `SUPABASE_SERVICE_ROLE_KEY` | service-role client | **BOTH** |
| `MARKETING_ASSET_ROOT` | Pi package/HDD root | **PI_ONLY** (`/mnt/HDD2TB/marketing-assets`) |
| `MARKETING_ASSET_TRANSPORT_MODE` | `local` \| `http` | **BOTH** (Pi server local; Mini-PC `http`) |
| `MARKETING_ASSET_TRANSFER_TOKEN` | Bearer shared secret | **BOTH** |
| `MARKETING_ASSET_TRANSFER_BIND_HOST` | Pi listen host | **PI_ONLY** (default `127.0.0.1`; Tailscale bind at deploy) |
| `MARKETING_ASSET_TRANSFER_PORT` | Pi listen port | **PI_ONLY** (default `3101`) |
| `MARKETING_ASSET_TRANSFER_BASE_URL` | Mini-PC → Pi base URL | **MINIPC_ONLY** |
| `SHORTFORM_VIDEO_WORKER_ENABLED` | claim gate (`true` only) | **MINIPC_ONLY** (default false) |
| `SHORTFORM_VIDEO_EXECUTION_MODE` | `disabled` \| `dry_run` \| `production` | **MINIPC_ONLY** |
| `SHORTFORM_WORKER_ID` | claim identity (alias: `SHORTFORM_VIDEO_RENDER_WORKER_ID`) | **MINIPC_ONLY** |
| `SHORTFORM_WORKER_WORKSPACE_PATH` | ephemeral workspace | **MINIPC_ONLY** (default `/home/ysh/.cache/thealltour-shortform`) |
| `SHORTFORM_WORKER_MAX_JOBS_PER_RUN` | max 1 recommended | **MINIPC_ONLY** (default 1) |
| `SHORTFORM_VIDEO_RENDER_LEASE_MS` | claim lease | **MINIPC_ONLY** (optional) |
| `VOICESTUDIO_BASE_URL` | TTS base | **MINIPC_ONLY** (`http://127.0.0.1:3900`) |
| `OMNIVOICE_API_KEY` | TTS bearer (required if non-loopback) | **MINIPC_ONLY** (optional on loopback) |
| `VOICESTUDIO_TIMEOUT_MS` | TTS timeout | **MINIPC_ONLY** (optional, default 120000) |
| `PEXELS_API_KEY` | stock refresh/search | **MINIPC_ONLY** (optional; missing → provider disabled) |
| `PIXABAY_API_KEY` | stock refresh/search | **MINIPC_ONLY** (optional) |
| `SHORTFORM_SOURCE_SEARCH_CACHE_DIR` | Pixabay ≥24h cache | **OPTIONAL** (resolver; not required for execute if URLs present) |
| `SHORTFORM_CANDIDATE_SELECTION_SECRET` | human PICK HMAC | **PI_ONLY / admin** (not Mini-PC worker execute path) |

HTTP mode: Mini-PC **must not** require `MARKETING_ASSET_ROOT` (readiness treats it N/A).

Never use `NEXT_PUBLIC_` for transfer token.

---

## Migrations (not applied in SV-8C1)

| Order | File | Notes |
|-------|------|-------|
| 1 | `supabase/migrations/20260911050000_marketing_media_sources.sql` | SV-2 catalog |
| 2 | `supabase/migrations/20260911060000_shortform_video_render_jobs.sql` | SV-6 jobs; comment: additive after SV-2 |

Verified from SQL:

- Forward-only `create table if not exists` + RLS/policies/grants/RPCs
- No `TRUNCATE` / table `DROP` / mass `DELETE FROM`
- `drop policy if exists` only (idempotent policy recreate) — not data-destructive
- RLS: service_role only; anon/authenticated revoked
- Apply order: **SV-2 → SV-6**

### Prepared apply commands (DO NOT RUN in SV-8C1)

Convention in repo docs: `supabase db push`.

```bash
# On operator machine with linked CLI — VERIFY PROJECT FIRST
cd /home/ysh/thealltour
npx supabase projects list
npx supabase link --project-ref <PRODUCTION_PROJECT_REF>   # only if not already linked
# Confirm ref matches production (dashboard URL / known ref) — abort if wrong
npx supabase db push --dry-run    # if supported by CLI version; else review migration list
npx supabase db push              # APPLY — SV-8C2 only after explicit authorization
```

**Production verification (mandatory before apply):**

1. Record intended production `project-ref` offline (not in this doc as a secret).
2. `supabase projects list` / linked config must match that ref.
3. If mismatch → **STOP**. Wrong-project apply is a hard blocker.
4. Rollback strategy: forward-fix migration only; no automated down migration in these files. Restore from backup / compensatory SQL if needed (ops-owned).

`applied: NO` (SV-8C1).

---

## Mini-PC FFmpeg plan (not installed)

Probed candidate on `thealltour-ai`:

- Package: `ffmpeg` **7:8.0.1-3ubuntu2** (universe)
- Currently: not installed; `ffmpeg`/`ffprobe` absent

Prepared:

```bash
sudo apt update
sudo apt install -y ffmpeg
ffmpeg -version
ffprobe -version
ffmpeg -hide_banner -encoders | grep libx264
```

`libx264` must appear. `installed: NO`.

---

## Korean fonts plan (not installed)

Selected package: **`fonts-noto-cjk`** (main; candidate `1:20240730+repack1-1build1` on Mini-PC).  
Optional later: `fonts-noto-cjk-extra` (all weights) — not required for first E2E.

Prepared:

```bash
sudo apt update
sudo apt install -y fonts-noto-cjk
fc-list :lang=ko family | head
```

No proprietary font files. `installed: NO`.

---

## Remotion browser strategy (locked)

Code: `ProductionShortformRemotionRenderer` → `@remotion/renderer` `renderMedia` with `chromiumOptions: {}`, **no** `browserExecutable`.

**Strategy A — Remotion-managed Chrome Headless Shell** (default Remotion 4.0.x download/cache).  
Do **not** mix with OS Chrome/Chromium unless a later step explicitly sets `browserExecutable`.

Prepared (SV-8C2):

- Ensure Node can write Remotion browser cache under the service user home.
- First production render (or Remotion CLI ensure) may download Headless Shell — allow outbound once on Mini-PC.
- Linux shared libraries: install only what Remotion reports missing at first run (typical: NSS/ATK/GBM/ALSA family). Do not dump an unverified mega-list in advance; capture `ldd` / Remotion error output at SV-8C2 and add minimal packages.

`installed: NO`.

---

## Repo deployment (Mini-PC)

Canonical checkout: **`/home/ysh/thealltour`**  
Never put worker code in `/home/ysh/thealltour-ai-inference`.

Prepared flow (SV-8C2; **not** executed in SV-8C1):

```bash
# After push of release SHA from Pi:
git clone <remote> /home/ysh/thealltour   # or pull in existing checkout
cd /home/ysh/thealltour
git fetch --all
git checkout b8bfeafd3436d4bf204aa07b89f4204c1c8e74ac   # or newer pinned release
git rev-parse HEAD   # must equal release SHA
npm ci               # or npm install — only when authorized in SV-8C2
```

`push_performed: NO` · `clone_performed: NO`

---

## Pi Asset Transfer systemd (static review)

File: `deploy/systemd/thealltour-marketing-asset-transfer.service`

| Check | Status |
|-------|--------|
| `User=ysh` | OK |
| `WorkingDirectory=/home/ysh/thealltour` | OK |
| `ExecStart=... npx tsx scripts/serve-marketing-asset-transfer.ts` | OK |
| Restart on-failure | OK |
| Secrets inline | **none** (`.env.local` via WorkingDirectory load) |
| Canonical path | OK |

Prepared install (SV-8C2 only):

```bash
sudo cp /home/ysh/thealltour/deploy/systemd/thealltour-marketing-asset-transfer.service /etc/systemd/system/
# or symlink — prefer copy for ops clarity
sudo systemctl daemon-reload
sudo systemctl enable thealltour-marketing-asset-transfer.service
sudo systemctl start thealltour-marketing-asset-transfer.service
sudo systemctl status thealltour-marketing-asset-transfer.service
journalctl -u thealltour-marketing-asset-transfer.service -n 50 --no-pager
curl -sS http://127.0.0.1:3101/health   # or Tailscale bind host
```

`installed: NO` · `running: NO`

### Endpoint plan

- Prefer Tailscale MagicDNS / hostname, **no hardcoded Tailscale IP in code**.
- Intended form: `http://<pi-tailscale-hostname>:3101` → Mini-PC `MARKETING_ASSET_TRANSFER_BASE_URL`
- Bind: set `MARKETING_ASSET_TRANSFER_BIND_HOST` explicitly for Tailscale interface at deploy (default code fail-safe is `127.0.0.1`).
- **`TO_VERIFY_AT_DEPLOY`**: confirm MagicDNS name for Hermes-Pi.
- Public Internet / CORS / browser: **forbidden**.

---

## Mini-PC worker systemd (static review)

| Unit | Check |
|------|--------|
| `thealltour-shortform-video-render-queue.service` | `WorkingDirectory=/home/ysh/thealltour`, `User=ysh`, `Nice=15`, oneshot, secrets not inline |
| `thealltour-shortform-video-render-queue.timer` | `OnUnitActiveSec=1min`, `Persistent=false`, requires service |

`maxJobsPerRun` default 1 via env/code.  
`installed: NO` · `enabled: NO` · worker env enabled: **false**

---

## Shared token provisioning (plan only)

- Env: `MARKETING_ASSET_TRANSFER_TOKEN`
- Cryptographically random; identical on Pi + Mini-PC
- Never commit; never put value in `.env.example`; never log
- **Do not generate in SV-8C1**

---

## VoiceStudio

- Mini-PC loopback: `VOICESTUDIO_BASE_URL=http://127.0.0.1:3900`
- Credential env name: `OMNIVOICE_API_KEY` (optional when URL is loopback)
- Topology previously probed ready; **no live TTS in SV-8C1**

---

## Canonical path guard

```bash
npm run check:canonical-paths
```

Must PASS. Filesystem path `/home/ysh/theallcloud` must remain 0 hits (documented-forbidden markers only). <!-- canonical-path-documented-forbidden -->
