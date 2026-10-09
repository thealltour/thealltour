# Narration audio S2

## Scope

An additive file-backed audio job flow for the approved S1 Narration. Existing shortform render queue, media-brief transport, legacy audio paths and Instagram contracts remain unchanged. Sentence scene planning and shortform rendering consume the fresh completed job envelope rather than the legacy shared `reel/timeline.json`.

The existing VoiceStudio `/v1/audio/speech` adapter returns WAV bytes without sentence/word timestamps. S2 deliberately generates one WAV per sentence, in order, with the existing measured timeline orchestrator. ffprobe on persisted WAV is authoritative. Timing includes the existing 250 ms between sentences and no trailing pause. This favors deterministic debugging over whole-script prosody. No target-duration padding/trimming, automatic split, merge or asset reuse.

## Request, execution and result

`POST /api/admin/marketing-review/:candidateId/narration-audio` receives `profileId`, `expectedRevision`, `expectedFingerprint`; requires settings.manage and candidate canEdit. It reads a valid saved approved Canonical and Narration, writes a queued `narration-audio-job-v1`, and returns HTTP 202 with jobId. It launches a detached worker immediately; the HTTP handler never waits for synthesis. `GET .../narration-audio?jobId=<UUID>` reads that candidate's job and hides the timeline if lineage or configuration has changed. Corrupt jobs or modified/missing audio fail closed.

Jobs live at `context/narration/audio-jobs/<UUID>.json`. They hold an exact approved Narration snapshot, complete profile snapshot, endpoint identity, config fingerprint, status, nullable error code and nullable timeline. No API key is stored. Endpoints containing URL credentials/query/fragment are rejected. Config fingerprints include all profile settings (voice/model/language/locale/style/speed), provider URL, timing algorithm and pause policy.

The existing local file layout is reused under a new per-attempt subroot:

`reel/narration/v<revision>/<config-fingerprint>/<job-id>/reel/audio/...`

The completed job's timeline paths are relative to the candidate package root. Every segment maps by sentenceId; the envelope is published only after all segments succeed and the approved revision is still current. Freshness is checked before each provider call and after completion. The raw nested timeline is an intermediate artifact, never sufficient proof of freshness. There is no global latest-audio pointer and no overwritten legacy timeline. Partial files are retained for diagnosis but no usable completed envelope is published. No RIFF buffers are concatenated.

## Worker and configuration

The explicit worker is `scripts/run-marketing-narration-audio.ts`, with arguments `--package-root <absolute candidate package path> --job-id <UUID> --run`. It uses the existing server-only shim and environment loader, VoiceStudio provider and ffprobe implementation. It must run on the host holding the candidate package and with access to the configured TTS endpoint. The POST route dispatches this worker with a detached Node/tsx process and an endpoint-wide Linux flock. The process outlives the initiating HTTP request and browser session; the lock serializes requests to the mini PC and waits at most 30 minutes. The current systemd service uses KillMode=control-group, so a service restart can terminate an active worker; the next status read reports that interruption and the user can request a new attempt. Status reads detect dead dispatch processes and report a retryable failed job. There is no cron/service prerequisite. The deployment must include scripts, tsx, ffprobe and /usr/bin/flock.

Existing `VOICESTUDIO_BASE_URL`, `OMNIVOICE_API_KEY` and timeout settings apply. Both Next and the worker load missing settings from `~/.config/thealltour/voicestudio.env` (override path: `VOICESTUDIO_ENV_FILE`); process/project/Hermes settings take precedence. `NARRATION_TTS_PROFILE_JSON` accepts one complete `tts-profile-v1` object or an array with unique IDs. The HTTP/UI flow accepts only enabled configured profiles, never development placeholders. The UI lists display names, restores the latest candidate job, polls queued/running jobs every four seconds, and provides authenticated per-sentence WAV playback. GET without a job ID returns profiles and the latest job; GET with jobId + sentenceId streams only fresh completed audio with private no-store caching. No API keys or package paths reach the browser. Selecting another voice creates a new job; completed audio is never reused.

The adapter's existing transient retry policy remains unchanged. The new worker does not automatically retry a job or reuse completed sentences. Failed/stale jobs require a new request/jobId. Per-job exclusive locks prevent duplicate workers. A killed process leaves a lock/running status; after verifying no worker is active, an operator may remove that specific lock and request a new job. Different jobs are not globally concurrency-limited; until a GPU-aware scheduler is added, operators should run one worker at a time. This is a manual additive execution path, not a replacement for the existing Supabase production queue.

Pi-to-mini-PC audio calls use the existing configured VoiceStudio HTTP client directly. No new media-brief transport allowlist is needed for this path: the mini-PC returns raw WAV bytes, which the worker stores on the package host. Deploying a worker on the mini-PC without shared storage would require explicit audio transport support and is outside this change.

## Downstream stale lineage

Consumers must bind candidateId, narration revision/fingerprint and audio config fingerprint/jobId. A changed narration, loss of Narration approval, Canonical drift/revocation, or different voice/config makes an earlier result unavailable. S3 must additionally pin the scene mapping; S5 must check freshness at both start and completion. The read endpoint verifies sentence order/text, duration arithmetic, total duration, package-relative paths and WAV SHA-256 before returning completed timing.

## Deferred verification

No tests, type checking, build, worker execution, external TTS request or production DB mutation was performed. After approval, acceptance checks should cover exact sentence mapping; changed speed/style/language/voice; rejection of stale queued/completed jobs; mid-generation edits; partial failures; missing/modified WAV; duplicate workers; no cross-job reuse; and 250 ms pause/total-duration arithmetic. Live TTS validation requires separate authorization.

## Hermes mini PC connection (2026-10-07)

The existing `thealltour-voicestudio-tunnel.service` forwards hermes-pi `127.0.0.1:13900` to the 7840HS mini PC `127.0.0.1:3900`. Read-only API discovery confirmed Supertonic-3 is available, its license was already accepted, and its pinned model cache exists. Supported presets are M1/M3/M4/M5/F3/F4/F5; requests explicitly use model `supertonic3`, language `ko`, WAV and speed 1. Existing authorization remains server-side. Real narration synthesis and build/test validation require the subsequent approved validation step; API discovery alone does not establish audio quality.

## Per-request speed and voice audition (2026-10-07)

The UI offers 0.7–2.0x speaking speed. New selections start at 1.15x; an existing job restores its recorded speed. POST accepts optional speed for backward compatibility. New jobs store it alongside the applied profile snapshot; the worker and scene planner resolve that override against current configured voice/model settings. Changing speed creates a new job/config fingerprint and ffprobe remeasures every segment. The latest requested job supersedes older audio and invalidates plans/assets/renders linked to old timing, even while the replacement is pending or failed. Existing jobs without a speed field retain the previous configured-profile behavior.

POST .../narration-audio/preview is authenticated and requires an editable candidate, but requires no approved Narration. It reads a fixed short Korean audition sentence, at the selected voice/speed, through the existing adapter. It never creates a candidate audio job, changes narration, or publishes a timeline. Fixed audition WAVs alone are cached under ~/.cache/thealltour/narration-voice-previews, keyed by text, complete profile, provider endpoint and sample contract version. Candidate audio is never reused. A nonblocking lock shares the full worker's endpoint lock: uncached auditions report 429 while another synthesis holds the lock. Samples already cached can be replayed immediately. Sample requests happen only on the user's preview click; no external synthesis was invoked during implementation.

Preview timeout is at most 60 seconds per provider attempt, with the existing adapter retry policy. The browser revokes audition object URLs when selections change or the panel unmounts. Speed selection is a synthesis parameter, not browser playbackRate; measured output duration remains authoritative.
