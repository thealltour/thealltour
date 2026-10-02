# Narration audio S2

## Scope

An additive file-backed audio job flow for the approved S1 Narration. Existing shortform render queue, media-brief transport, legacy audio paths and Instagram contracts remain unchanged. No renderer consumes these jobs yet; S3/S5 must read the fresh completed job envelope rather than the legacy shared `reel/timeline.json`.

The existing VoiceStudio `/v1/audio/speech` adapter returns WAV bytes without sentence/word timestamps. S2 deliberately generates one WAV per sentence, in order, with the existing measured timeline orchestrator. ffprobe on persisted WAV is authoritative. Timing includes the existing 250 ms between sentences and no trailing pause. This favors deterministic debugging over whole-script prosody. No target-duration padding/trimming, automatic split, merge or asset reuse.

## Request, execution and result

`POST /api/admin/marketing-review/:candidateId/narration-audio` receives `profileId`, `expectedRevision`, `expectedFingerprint`; requires settings.manage and candidate canEdit. It reads a valid saved approved Canonical and Narration, writes a queued `narration-audio-job-v1`, and returns HTTP 202 with jobId. It does not call TTS. `GET .../narration-audio?jobId=<UUID>` reads that candidate's job and hides the timeline if lineage or configuration has changed. Corrupt jobs or modified/missing audio fail closed.

Jobs live at `context/narration/audio-jobs/<UUID>.json`. They hold an exact approved Narration snapshot, complete profile snapshot, endpoint identity, config fingerprint, status, nullable error code and nullable timeline. No API key is stored. Endpoints containing URL credentials/query/fragment are rejected. Config fingerprints include all profile settings (voice/model/language/locale/style/speed), provider URL, timing algorithm and pause policy.

The existing local file layout is reused under a new per-attempt subroot:

`reel/narration/v<revision>/<config-fingerprint>/<job-id>/reel/audio/...`

The completed job's timeline paths are relative to the candidate package root. Every segment maps by sentenceId; the envelope is published only after all segments succeed and the approved revision is still current. Freshness is checked before each provider call and after completion. The raw nested timeline is an intermediate artifact, never sufficient proof of freshness. There is no global latest-audio pointer and no overwritten legacy timeline. Partial files are retained for diagnosis but no usable completed envelope is published. No RIFF buffers are concatenated.

## Worker and configuration

The explicit worker is `scripts/run-marketing-narration-audio.ts`, with arguments `--package-root <absolute candidate package path> --job-id <UUID> --run`. It uses the existing server-only shim and environment loader, VoiceStudio provider and ffprobe implementation. It must run on the host holding the candidate package and with access to the configured TTS endpoint. No worker, scheduled service or deployment was started by this change.

Existing `VOICESTUDIO_BASE_URL`, `OMNIVOICE_API_KEY` and timeout settings apply. `NARRATION_TTS_PROFILE_JSON` optionally supplies one complete enabled `tts-profile-v1` object. The profileId in the UI must match its profileId. No production voice is guessed. Existing development profiles can still be selected explicitly by their IDs; they remain development placeholders. The UI starts with an empty profile selection.

The adapter's existing transient retry policy remains unchanged. The new worker does not automatically retry a job or reuse completed sentences. Failed/stale jobs require a new request/jobId. Per-job exclusive locks prevent duplicate workers. A killed process leaves a lock/running status; after verifying no worker is active, an operator may remove that specific lock and request a new job. Different jobs are not globally concurrency-limited; until a GPU-aware scheduler is added, operators should run one worker at a time. This is a manual additive execution path, not a replacement for the existing Supabase production queue.

Pi-to-mini-PC audio calls use the existing configured VoiceStudio HTTP client directly. No new media-brief transport allowlist is needed for this path: the mini-PC returns raw WAV bytes, which the worker stores on the package host. Deploying a worker on the mini-PC without shared storage would require explicit audio transport support and is outside this change.

## Downstream stale lineage

Consumers must bind candidateId, narration revision/fingerprint and audio config fingerprint/jobId. A changed narration, loss of Narration approval, Canonical drift/revocation, or different voice/config makes an earlier result unavailable. S3 must additionally pin the scene mapping; S5 must check freshness at both start and completion. The read endpoint verifies sentence order/text, duration arithmetic, total duration, package-relative paths and WAV SHA-256 before returning completed timing.

## Deferred verification

No tests, type checking, build, worker execution, external TTS request or production DB mutation was performed. After approval, acceptance checks should cover exact sentence mapping; changed speed/style/language/voice; rejection of stale queued/completed jobs; mid-generation edits; partial failures; missing/modified WAV; duplicate workers; no cross-job reuse; and 250 ms pause/total-duration arithmetic. Live TTS validation requires separate authorization.
