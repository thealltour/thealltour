# Shortform VideoRenderJob v1 (SV-6)

## What this is

`shortform_video_render_jobs` is **durable orchestration state** for shortform video production.

```text
CompletedMarketingCandidate
  → explicit enqueueShortformVideoRenderJob(...)
  → VideoRenderJob (QUEUED)
  → worker claim (RUNNING)
  → READY | FAILED
```

It is **not**:

- the rendered video file
- Remotion / FFmpeg execution
- Mini-PC worker implementation (SV-7)
- media download / TTS / Fal (SV-8)

## Attachment

Jobs attach to `candidateId` (primary), with optional `productionRequestId` and `businessDateKst`.

Human Review / publication are **not** auto-linked.

## Explicit enqueue only

Candidate completion does **not** enqueue a render job.

Call `enqueueShortformVideoRenderJob(...)` from a future admin or production orchestration path.
SV-6 ships **no** admin UI button and **no** HTTP enqueue API.

## Idempotency

`logical_run_key` =

```text
shortform-video-render:{candidateId}:{sha256(candidate|briefSha|selectionHash|profile)[:24]}
```

Same input while a row exists → return existing job (no duplicate).

Changed source selection snapshot → new logical run.

`FAILED` → use `requeueFailed` (same key). `READY` is terminal for that key (no silent re-run).

## Input snapshot

Compact JSON only:

- brief contract + sha256 + relative path
- optional resolution contract + sha256
- scene → sourceId picks + rights/factualMatch/origin
- `renderProfile = shortform_vertical_v1`

Worker must honor job input identity — do not rebuild “latest” picks ad hoc.

## Lifecycle

Allowed:

```text
QUEUED → RUNNING
RUNNING → READY
RUNNING → FAILED
FAILED → QUEUED   (explicit requeue)
QUEUED|FAILED → CANCELLED
```

Forbidden:

```text
READY → RUNNING
READY → QUEUED
READY → FAILED
```

## Claim / lease

Postgres `claim_shortform_video_render_job`:

- `FOR UPDATE SKIP LOCKED`
- QUEUED with `next_attempt_at <= now`
- or RUNNING with `lease_expires_at < now`
- requires `attempt_count < max_attempts` (default 3)
- sets RUNNING, claim token, lease, increments attempt

Stale lease reclaim follows the marketing production queue pattern (default lease 30m).

## Completion invariant

```text
persist durable final artifact
→ commit manifest/provenance
→ markReady(outputArtifactPath)
→ only then ephemeral cleanup eligible
```

SV-1 `ephemeralSuccessTtlMs = 0` means eligible **after** success durability, not delete-while-creating.

SV-6 does not verify the filesystem; the path is required on `markReady`.

## Renderability gate (enqueue)

Blocked:

- missing scene PICK
- `rights=unknown`
- factual scene with non `confirmed|probable` pick
- `generated_video_plan` → `JOB_NOT_RENDERABLE_YET` (until SV-8)

Allowed as input identity:

- `photo_motion` when a real image source was picked (rendering is still SV-8)

## Security

- RLS enabled; service_role only
- no browser direct table access
- `error_summary` bounded/sanitized; no secrets/stacks

## Ownership split

| Step | Owner |
|------|--------|
| SV-6 | durable job contract / claim / enqueue validation |
| SV-7 | Mini-PC worker claim loop / workspace / systemd |
| SV-8 | download / TTS / Remotion / FFmpeg execution |

## Migration

File: `supabase/migrations/20260911060000_shortform_video_render_jobs.sql`

Not applied in the SV-6 coding step. SV-2 catalog migration remains unapplied as well until authorized.
