# Shortform Video Worker Runtime v1 (SV-7)

## Role

SV-7 owns the **Mini-PC worker runtime** for durable `VideoRenderJob`s:

- enable gate / executor capability gate
- capacity guard (SV-1)
- workspace under `/home/ysh/.cache/thealltour-shortform/`
- claim / markReady / markFailed lifecycle
- systemd oneshot + timer **artifacts** (not installed in this step)

SV-8 owns actual media execution (stock download, VoiceStudio, Remotion, FFmpeg, final MP4).

## Canonical source

```text
/home/ysh/thealltour
```

Do **not** put Shortform application code into `/home/ysh/thealltour-ai-inference`
(that tree is BGE-M3 inference only).

**Recommended Mini-PC layout (Option A):** checkout the same canonical repo at
`/home/ysh/thealltour` and run the worker script / systemd units from there.
SV-7 does not clone or install on the Mini-PC.

## Fail-closed gates

| Gate | Default | Effect |
|------|---------|--------|
| `SHORTFORM_VIDEO_WORKER_ENABLED` | unset/false | no claim, exit 0 |
| `SHORTFORM_VIDEO_EXECUTION_MODE` | `disabled` | production executor unready until SV-8 |
| Executor `isReady()` | false in production CLI | **no live claim** |

Invariant:

```text
executor unavailable → DO NOT CLAIM LIVE JOB
```

Fake executor exists for tests only; production CLI never constructs it.

## Commands

```bash
npm run marketing:shortform-worker
npm run marketing:shortform-worker:health
npx tsx scripts/process-shortform-video-render-queue.ts --dry-run
```

Health is read-only: no claim, no mutation, no secrets.

## Workspace

```text
/home/ysh/.cache/thealltour-shortform/
  jobs/<jobId>/{input,source,audio,render,output,state}
```

- 40 GiB workspace budget (SV-1)
- root free &lt; 100 GiB → CLEANUP_REQUIRED (claim still allowed per SV-1)
- root free &lt; 75 GiB → BLOCK_NEW_JOB (no claim)
- bulk media must not use `/tmp` (Mini-PC tmpfs ~14 GiB)
- failure → retain workspace (24h policy; no sweeper in SV-7)
- success → markReady first, then delete job workspace only

## Runtime limits

- concurrency = 1
- `SHORTFORM_WORKER_MAX_JOBS_PER_RUN` default **1**
- no automatic `requeueFailed()` — explicit/manual retry only
- lease = **45m** (`DEFAULT_SHORTFORM_VIDEO_RENDER_LEASE_MS=2700000`); **no lease renewal/heartbeat** (oneshot + timer; stale reclaim recovers)
- systemd `TimeoutStartSec=1800` (30m) — must stay **below** lease (15m margin)
- SIGTERM/SIGINT → AbortSignal; leave RUNNING for lease reclaim if needed

## Systemd (artifacts only)

```text
deploy/systemd/thealltour-shortform-video-render-queue.service
deploy/systemd/thealltour-shortform-video-render-queue.timer
```

- Nice=15 (below typical inference priority)
- secrets via `.env.local`, not unit Environment=
- **not** enabled/started in SV-7 code phase

## Env (names only)

```text
SHORTFORM_VIDEO_WORKER_ENABLED=false
SHORTFORM_VIDEO_EXECUTION_MODE=disabled
SHORTFORM_WORKER_ID=
SHORTFORM_WORKER_WORKSPACE_PATH=
SHORTFORM_WORKER_MAX_JOBS_PER_RUN=1
SHORTFORM_VIDEO_RENDER_LEASE_MS=
```

Plus existing server-side Supabase service-role vars for repository access (never browser keys).

## Migrations

Lease default SQL/RPC aligned to 45m in `20260911140000_shortform_render_claim_lease_default_45m.sql`. No lease-renewal migration.

## Production operating policy (SV-8C4-E)

Canonical Mini-PC units: `deploy/systemd/thealltour-shortform-video-render-queue.{service,timer}`.

| Item | Policy |
|------|--------|
| Timer cadence | `OnBootSec=2min`, `OnUnitActiveSec=1min`, `AccuracySec=15s`, `Persistent=false` |
| Service | `Type=oneshot`, `TimeoutStartSec=1800`, `Nice=15` |
| Max jobs / run | default **1** (`SHORTFORM_WORKER_MAX_JOBS_PER_RUN`) |
| Lease | **2700000ms (45m)** — 15m greater than worker hard timeout |
| Empty queue | clean exit 0 / `skippedReason=empty_queue` |
| READY job | never claimable |
| Success workspace | ephemeral cleaned **after** durable READY |
| Failed workspace | retained (evidence retention; no sweeper in this path) |
| Stale RUNNING | reclaimable after lease expiry if attempts remain |
| Auto retry | **none** — operator `requeueFailed(logicalRunKey)` only |
| Publication | out of scope for the worker |

### Failure / recovery

| Case | Behavior |
|------|----------|
| TTS/render/upload failure | `markFailed` → `FAILED`; no automatic requeue |
| Operator retry | `requeueFailed` → same durable row → `QUEUED` (clears claim/output/error; resets attempt_count) |
| Process crash / SIGTERM | leave `RUNNING`; reclaim after lease expiry |
| maxAttempts | default **3**; claim requires `attempt_count < max_attempts` |
| Existing durable final on retry | requeue clears `output_artifact_path`; pipeline re-renders and **overwrites** package final via atomic write (no skip-if-exists shortcut) |

### Boot (when timer permanently enabled)

- Timer is `WantedBy=timers.target` → starts on boot after enable
- First fire ≈ `OnBootSec=2min` after boot
- Service has `After=`/`Wants=network-online.target` (Tailscale/Pi transfer reachability soft-dependent)
- No hard `Requires=` on VoiceStudio; if VoiceStudio or Asset Transfer is down, the claimed job fails safely to `FAILED` (no unrelated row mutation)
- Enable gate: persistent `.env.local` `SHORTFORM_VIDEO_WORKER_ENABLED=true` for permanent operation (temporary systemd drop-in is canary-only)

