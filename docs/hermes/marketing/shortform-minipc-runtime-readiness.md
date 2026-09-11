# Shortform Mini-PC Runtime Readiness (SV-8B)

## Role

SV-8B is **readiness only**: confirm Mini-PC (`thealltour-ai`) can host the shortform worker
runtime, and identify blockers before live deployment.

Out of scope for this step:

- application checkout / push / pull
- `apt` / package install
- systemd install / enable / start
- DB migration apply
- live provider / VoiceStudio / render job

## Canonical paths

| Role | Path |
|------|------|
| App repo (Hermes-Pi SoT; Mini-PC Option A checkout) | `/home/ysh/thealltour` |
| Never use as app checkout | `/home/ysh/theallcloud` <!-- canonical-path-documented-forbidden --> |
| Mini-PC ephemeral workspace | `/home/ysh/.cache/thealltour-shortform/` |
| Pi durable marketing assets | `/mnt/HDD2TB/marketing-assets` |
| Embedding (separate) | `/home/ysh/thealltour-ai-inference` (service) |

## Mini-PC baseline (probed)

| Item | Observed |
|------|----------|
| Hostname | `thealltour-ai` |
| OS | Ubuntu 26.04.1 LTS |
| CPU | AMD Ryzen 7 7840HS (16 threads) |
| Memory available | ~23 GiB |
| Root free | ~344 GiB (ext4) |
| `/tmp` | tmpfs ~14 GiB — **bulk media prohibited** |
| Node / npm / git | v22.23.2 / 10.9.8 / 2.53.0 |
| FFmpeg / FFprobe | **MISSING** (apt candidate `7:8.0.1-3ubuntu2` available) |
| `/dev/dri` | present (`card0`, `renderD128`) |
| Checkout `/home/ysh/thealltour` | **NOT FOUND** (expected until push + deploy) |
| Local `/mnt/HDD2TB` | **ABSENT** |
| Korean fonts (`fc-list :lang=ko`) | **NONE** |
| Chrome / Chromium | **MISSING** |
| VoiceStudio `127.0.0.1:3900` | HTTP 200 (local) |
| Embedding `:8100` | listening (service preserved) |

Recommended (not executed in SV-8B):

```bash
sudo apt update
sudo apt install -y ffmpeg
# Korean fonts (pick one family set):
sudo apt install -y fonts-noto-cjk
# Remotion browser: prefer Remotion-managed Chrome via ensureBrowser() after app checkout
# (do not apt-install Chrome blindly). Linux libs likely needed later: libatk, libgbm, libasound2, …
```

## Workspace policy

- Default: `/home/ysh/.cache/thealltour-shortform/`
- Budget / thresholds (SV-1): 40 GiB workspace; cleanup &lt;100 GiB root free; block &lt;75 GiB
- Current root free ~344 GiB → **capacity READY**
- Workspace directory not created yet (OK for readiness)

## MARKETING_ASSET_ROOT topology (BLOCKER)

SV-8A `ProductionShortformVideoRenderExecutor` assumes a **local filesystem**:

| Direction | Current code |
|-----------|--------------|
| READ managed sources | `MARKETING_ASSET_ROOT` + `managedRelativePath` → `copyFileSync` |
| READ MediaBrief / ShortVideoBrief | same package root under `MARKETING_ASSET_ROOT` |
| WRITE final | `reel/final/shortform.mp4` via `writePackageArtifact` into package root |

Pi has `/mnt/HDD2TB/marketing-assets`. Mini-PC does **not**.

**No existing Pi↔Mini-PC media file transport** was found (no scp/rsync job, NFS, sshfs, or internal asset transfer API for packages).

### Verdict

```text
SV8B_MEDIA_TRANSPORT_BLOCKER
```

Do **not** fake `/mnt/HDD2TB` on Mini-PC SSD. Do **not** permanently clone Pi HDD media onto Mini-PC.

### Recommended next step (SV-8B2 — not implemented here)

Ranked options:

1. **Authenticated internal Asset Transfer API** (Pi) — path-safe GET package/managed sources + PUT final; best fit for fail-closed durability and no always-on FS mount
2. **SSH/rsync oneshot** around worker claim/READY — lower code change, operational hooks
3. **NFS/sshfs mount of Pi HDD** — preserves local-path assumption; higher ops coupling; **not auto-installed in SV-8B**

Prefer (1) if building a durable production boundary; (2) if minimizing code before first smoke.

## VoiceStudio

Worker on Mini-PC can use local:

```text
VOICESTUDIO_BASE_URL=http://127.0.0.1:3900
```

(plus `OMNIVOICE_API_KEY`, optional `VOICESTUDIO_TIMEOUT_MS`). No Pi SSH tunnel required for TTS from Mini-PC.

## Env template (names only — no secrets)

```text
SHORTFORM_VIDEO_WORKER_ENABLED=false
SHORTFORM_VIDEO_EXECUTION_MODE=production
SHORTFORM_WORKER_ID=thealltour-ai
SHORTFORM_WORKER_WORKSPACE_PATH=/home/ysh/.cache/thealltour-shortform/
NEXT_PUBLIC_SUPABASE_URL=
SUPABASE_SERVICE_ROLE_KEY=
MARKETING_ASSET_ROOT=???   # blocked until transport decision
VOICESTUDIO_BASE_URL=http://127.0.0.1:3900
OMNIVOICE_API_KEY=
VOICESTUDIO_TIMEOUT_MS=120000
PEXELS_API_KEY=
PIXABAY_API_KEY=
```

## Systemd (static only)

- `WorkingDirectory=/home/ysh/thealltour`
- `ExecStart=…/npx tsx scripts/process-shortform-video-render-queue.ts`
- `User=ysh`, `Nice=15`
- Timer: `OnBootSec=2min`, `OnUnitActiveSec=1min`, `Persistent=false`
- **Not installed / not enabled** in SV-8B

## Required before live (ordered)

1. Media transport (read package + managed sources; durable write final to Pi HDD)
2. Push/deploy `/home/ysh/thealltour` to Mini-PC at SV-8A+ commits
3. Install ffmpeg (+ Remotion browser ensure + missing Linux libs as needed)
4. Korean font package
5. Configure env (worker disabled until ready)
6. Apply SV-2 / SV-6 migrations on shared DB (authorized step)
7. Enable worker + systemd only after smoke gates pass

## Remotion browser note

SV-8A uses `@remotion/renderer@4.0.523` with `renderMedia` / `selectComposition`. Remotion exposes `ensureBrowser()` and optional `browserExecutable`. Prefer Remotion-managed Chrome Headless Shell after checkout rather than guessing `apt install chromium`. Cache location is Remotion/Chrome default under the Mini-PC user home (confirm after first ensure).
