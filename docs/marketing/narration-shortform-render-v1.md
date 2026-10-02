# Measured Narration Shortform — S5

## Architecture and behavior

```text
Approved Canonical → approved Narration
  → current measured sentence-WAV timeline
    → approved 1:1 sentence scene plan + one current image per scene
      → queued immutable render job snapshot
        → explicit FFmpeg worker → ffprobe output QA
          → fresh MP4 + sentence SRT + protected preview/download

Instagram subset selection is independent and is not a render input.
```

The first renderer produces a simple 9:16 sequence of generated still images with the actual sentence narration. It uses every sentence/scene exactly once and in the approved order. There is no additional video generation, scene merge/split, grouped narration, asset reuse, adaptive editing, target-duration template, looped audio, fabricated timing or minimum scene length. The previous scene's still image covers the timeline's explicit intersentence pause.

Existing FFmpeg execution, ffprobe preview QA and SRT serialization helpers are reused. The legacy production renderer and Supabase render queue remain unchanged. In particular, the new flow never uses the legacy fixed 18-second scene allocation, byte-concatenated WAV logic, missing-narration-hash fallback or shared final MP4 path.

## Timing and media

Output: 720×1280, 30fps, H.264/libx264 CRF 23/veryfast, yuv420p, 48 kHz stereo AAC, MP4 faststart, soft mov_text subtitles. Encoder configuration and graph version are fingerprinted.

Each persisted WAV is copied intact into the job's input directory and mixed at its measured start with aformat/atrim/adelay/amix. Whole WAV containers are never concatenated as raw bytes. The graph's total duration comes directly from the measured timeline; no `-shortest` truncation or recommended-duration constraint is used. Millisecond/sample and video-frame quantization are presentation limits, not edits to the authoritative timeline.

Video frames use rounded absolute scene-end boundaries (the final boundary uses ceil), then derive each scene's frame count from adjacent boundaries. This prevents rounding error from accumulating over many scenes. An unrepresentable zero-frame scene fails rather than being silently merged. All images are scaled/padded proportionally without an additional generated visual. Original scene timestamps remain unchanged. Output ffprobe QA requires exactly one compatible H.264 video stream, 720×1280/30fps, AAC audio, mov_text subtitles and duration within the existing one-frame 34 ms tolerance of the measured total.

Subtitles use the measured speech interval for each sentence, one cue per sentence. They are embedded as a soft MP4 track and also supplied as SRT. They are **not burned into video pixels** in this version. Browser/social-platform support for MP4 internal subtitles varies; do not assume Reels will display the track. Burned captions, word highlighting and word timestamps are deferred. No AI resegmentation or subtitle-based scene regrouping is introduced.

## Job contract and stale lineage

`narration-shortform-render-job-v1` stores job/candidate identity, an approved scene-plan snapshot, complete measured timeline, ordered image mapping, renderer/input fingerprints, creation time, state, nullable error code and nullable output. The input fingerprint covers the plan fingerprint, exact timeline, every ordered visual identity/path/hash and renderer configuration. Approval/upload timestamps that do not change content do not force a new input fingerprint.

Before queuing, all scene images and the approved source are required. Before execution, before FFmpeg, after FFmpeg/output QA and when reading a completed result, source freshness is checked. Canonical/Narration revocation or changes, scene prompt/revision changes, replaced/missing images, changed audio/config/timing or renderer config differences block the old result. Missing/corrupt/modified output MP4/SRT also fails closed. Completed historical jobs are retained; the read gate reports stale and hides output when upstream has moved on.

Each job snapshots PNG/WAV inputs under its own fingerprint/UUID directory. No concurrent job overwrites another job's output. A stale/failed attempt may retain diagnostic files, but is not exposed as a usable result. There is no global final MP4 pointer, implicit rebind, fallback to previous footage or automatic retry/reuse.

## API, worker and UI

POST `/api/admin/marketing-review/:candidateId/narration-shortform` receives only expectedScenePlanFingerprint. It queues a package-local job and returns 202/jobId; it never runs FFmpeg in the web request. GET without jobId reports source readiness/config. GET with jobId reports effective state and verified completed output metadata. settings.manage is required; queuing additionally requires candidate canEdit. No new DB mutation is performed.

The explicit worker `scripts/run-marketing-narration-shortform.ts` accepts `--package-root <absolute candidate package path> --job-id <UUID> --run`. It uses the existing server-only shim/environment loader. It runs on the host holding the package, with FFmpeg/ffprobe installed. It calls no TTS/external image provider. No worker/service/timer was started by this implementation. Timeout is 30 minutes per FFmpeg render, and filter execution uses one thread.

Exclusive per-job and per-candidate worker locks prevent duplicate/overlapping workers for the same candidate. Different candidates are not globally scheduled; run one manual worker at a time until an explicit host scheduler is added. A killed process can leave running state/locks. Verify no worker is active before removing only that job/candidate's locks; request a fresh job rather than automatically resuming or reusing partial assets. The existing production queue/leases/retries are deliberately not repurposed without a separate cutover.

The new **Shortform** stage has stable ID 10 and sits after sentence visuals, before Instagram adaptation. It reports true source scene count/timeline length, queues a render, remembers the last requested job ID locally, checks status on demand and displays a video plus MP4/SRT downloads only for a current completed result. It does not poll automatically. An unavailable historical job cannot block requesting a new job from ready inputs. Old workflow IDs stay unchanged.

Protected GET `.../narration-shortform/:jobId` streams the verified MP4 with single-range byte support and no-store headers; `?format=srt` downloads the verified SRT. File paths are server-controlled, candidate/job identity is checked and freshness/integrity is rechecked before exposing output. An already delivered/downloaded file cannot be revoked if upstream changes later; every subsequent request is gated again.

## Files and storage

- `publishable/narrationShortform/{contracts,graph,service}.ts`
- New narration-shortform status/queue and protected output routes.
- `scripts/run-marketing-narration-shortform.ts`
- `MarketingReviewNarrationShortformPanel.tsx`, workflow navigation/detail updates.
- `context/narration/shortform-jobs/<jobId>.json` (+ explicit worker locks)
- `reel/narration-render/<inputFingerprint>/<jobId>/inputs/<sentenceId>.png|wav`
- Same run directory: `render-input.json`, `subtitles.srt`, `shortform.mp4`

The broader S1–S5 change remains additive in the isolated checkout. Legacy channel artifacts, publication approvals, production automation and existing public Instagram v1 routes have not been switched over. New Narration/scene/Instagram/Shortform artifacts have their own review and read gates. The code is ready for the deferred verification stage, not yet verified for deployment or publication.

## Deferred acceptance checks

As requested, no tests, type checking, build, worker execution, actual rendering, external TTS job, production DB mutation, commit, push or deploy was performed.

After approval: verify one-sentence and multi-sentence media; 16-scene endpoint rounding; long/short measured durations; exact order/count/IDs; unchanged TTS total and pause coverage; all input snapshots/hashes; distinct job paths; stale edits during rendering; audio/image/config replacements; partial/FFmpeg/QA failure; duplicate workers; MP4 codecs/geometry/subtitle track and one-frame duration tolerance; byte-range/MP4/SRT downloads; output corruption; browser/subtitle expectations; and backward compatibility. Live TTS, actual render and deployment require their own authorized execution step.
