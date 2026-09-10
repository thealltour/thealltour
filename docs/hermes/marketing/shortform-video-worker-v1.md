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
- lease = 30m; **no lease renewal/heartbeat in SV-7** (oneshot + timer; stale reclaim recovers)
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

SV-2 / SV-6 remain unapplied. No SV-7 lease-renewal migration (not required for oneshot + 30m lease).
