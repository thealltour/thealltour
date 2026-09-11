# Shortform Production Executor v1 (SV-8A)

## Role

SV-8A owns the **production media executor code** for durable `VideoRenderJob`s:

- `ProductionShortformVideoRenderExecutor` implementing SV-7 `ShortformVideoRenderExecutor`
- staged pipeline: materialize → narration → Remotion → FFmpeg finalize → validate → durable persist
- fail-closed `isReady()` (ffmpeg / ffprobe / Remotion packages / VoiceStudio config / workspace / `MARKETING_ASSET_ROOT`)

SV-8B = Mini-PC runtime/deployment.  
SV-8C = live provider / VoiceStudio / render smoke.  
This step does **not** install systemd, apt packages, apply migrations, or call live APIs.

## Canonical source

```text
/home/ysh/thealltour
```

## Execution chain

```text
VideoRenderJob
  → load picks / catalog rows
  → source materialization (workspace only)
  → VoiceStudio narration (injected TtsProvider)
  → Remotion TravelShortInfoV1 composition
  → FFmpeg finalize (libx264 + AAC mux)
  → ffprobe validation
  → Candidate Package durable artifact (reel/final/shortform.mp4)
  → executor returns outputArtifactPath
  → worker markReady()
  → ephemeral workspace cleanup
```

Invariant:

```text
render success ≠ READY
durable package persistence must succeed first
```

## Source materialization

| Origin | Behavior |
|--------|----------|
| Internal (`managedRelativePath`) | Resolve under `MARKETING_ASSET_ROOT` via `assertSafeRelativeArtifactPath` / `assertPathInside`; copy into `workspace/jobs/<jobId>/source/` |
| Pexels / Pixabay | Provider materializer + host allowlist download into workspace only |
| `photo_motion` | Image → Remotion Ken Burns-style scale/pan |
| `generated_video_plan` | `JOB_NOT_RENDERABLE_YET` (Fal deferred) |
| Arbitrary URL | **Denied** — no generic fetch (SSRF) |

External binaries are **ephemeral** (workspace). They are **not** auto-ingested into Global Archive / `MARKETING_ASSET_ROOT` as source masters.

CDN URLs from search time are not assumed permanent. Materializers may refresh via provider-specific `resolveFreshDownloadUrl` when expiry/missing.

### Download safety

- HTTPS/HTTP only
- provider host allowlist (redirect targets re-checked)
- timeout, max redirects, max bytes, content-type check
- `AbortSignal` support

## Remotion vs FFmpeg

| Layer | Responsibility |
|-------|----------------|
| Remotion | Visual composition, scene timing, baked subtitle layout, photo motion |
| FFmpeg | Normalization, codec/mux (`libx264` + `yuv420p` + AAC), final validation via ffprobe |

Output profile v1: **1080×1920 @ 30fps**, H.264/AAC/MP4. Hardware encoders (`h264_vaapi`) deferred until Mini-PC verification.

Template: **TravelShortInfoV1** only (9:16, scene sequence, narration text overlay, CTA slot).

Remotion entry/renderer are **server/worker-only** (`server-only`, not imported from Next client pages).

## VoiceStudio / narration

Reuses existing `VoiceStudioTtsProvider` / `TtsProvider`.

Narration SoT (fail-closed):

```text
ShortVideoBrief.scenes[].narrationSegmentRefs
  → MediaBrief.formats.shortform.narrationSegments[].narrationText
  → VoiceStudio TTS
```

- No placeholder `Scene N` text on the production path.
- Missing ref → `NARRATION_SEGMENT_NOT_FOUND` (no TTS / no Remotion).
- Baked Remotion subtitles use the same resolved MediaBrief `subtitleText` (fallback `narrationText`).
- WAV lands under `workspace/jobs/<jobId>/audio/`. Tests use fake TTS — **no live :3900** in SV-8A.

## Subtitles

SV-8A bakes mobile-readable captions in Remotion from the **same resolved narration plan** as TTS. Full package `reel/subtitles.srt` + audio-master-timeline path remains available from existing TTS subtitle modules for later wiring; this step does not replace that convention.

## Deferred

- Fal / `generated_video_plan` real generation
- BGM
- Mini-PC deploy / apt ffmpeg / systemd (SV-8B)
- Live provider + TTS + render job (SV-8C)
- OBS spans
- Admin enqueue / publication changes
- Lease heartbeat (add only if measured job duration exceeds ~10–15 minutes)

## Worker gate

Default remains:

```text
SHORTFORM_VIDEO_WORKER_ENABLED=false
```

Production CLI may construct `ProductionShortformVideoRenderExecutor`, but `isReady() === false` prevents claim until runtime deps exist.

## Migrations

SV-2 / SV-6 migrations remain **unapplied** during SV-8A CODE_ACCEPTANCE.
