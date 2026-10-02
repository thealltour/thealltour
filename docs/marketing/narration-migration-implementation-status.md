# S1–S5 implementation status

## Implemented code in the isolated checkout

Remote checkout: `/home/ysh/thealltour-narration-s1`, based on `e82ddccb46fe73bcbb7a019f3c61026ba909947e`. The operating `/home/ysh/thealltour` tracked files remain untouched. The local edit mirror is `work/narration-s1` in this ChatGPT project, outside synced `sources/`.

| Phase | Implemented code | Execution status |
| --- | --- | --- |
| S1 | Manual Narration artifact/editor, stable IDs/revisions, exact-revision approval and Canonical stale gate | Contract and UI tests passed; not deployed |
| S2 | Approved Narration audio request, explicit VoiceStudio worker, measured per-sentence WAV/timeline, config/source gates | No TTS job executed |
| S3 | Separate sentence-scene visual plan, manual approval, 1:1 Astra handoff, strict 9:16 upload/integrity gate | No actual Astra/image generation/upload executed |
| S4 | 4–10 unique selected-scene cards, copy review, separate external handoff/import, existing renderer adapter and protected previews | No actual card render executed |
| S5 | File-backed render job, immutable media snapshots, measured still-scene FFmpeg graph, output QA, soft captions and protected MP4/SRT delivery | No worker or FFmpeg render executed |

All new paths are additive. Existing Instagram ChatGPT v1, channel-generation/review/publication behavior, old Shared Visual Plan/Astra flow, production DB and scheduled worker services are unchanged. The new paths do not silently inherit old approval or missing-fingerprint fallback. Both workflows remain visible during migration; default production cutover and old-path removal are not part of these code changes.

## Important limitations before verification

- Narrative sentence entry and visual prompt planning are manual in this first version; no new model call was introduced. The new external Instagram JSON is optional and still requires human review.
- TTS needs an explicitly configured real profile and endpoint. Existing development profiles are placeholders; no production voice was inferred.
- Audio and shortform jobs require explicit worker execution. No service/timer was installed or started, and no new cross-host package transport was introduced.
- Shortform uses generated stills and per-sentence soft subtitles/SRT; burned captions, generated motion, word timing and publication integration are deferred.
- New Instagram output does not yet replace legacy caption/other-channel/publication artifact consumers.
- Source gates are derived at read/execution boundaries. There is no cross-artifact filesystem transaction; already downloaded media cannot be revoked.
- Old workflow unit expectations were updated for the additive stages during the subsequently authorized test phase.

## Next authorized boundary

The user subsequently authorized WSL build/tests and a local Git commit. Live TTS, representative FFmpeg rendering and production deploy/publication remain separate actions. No push, deploy or production mutation is included.

## WSL verification, 2026-10-03

- Node 22.23.2, dependency installation from the committed lockfile in a separate WSL validation checkout.
- Related contract, legacy Instagram handoff, TTS and workflow UI tests: 103 passed, 1 skipped across 12 files. The optional ffprobe integration test was skipped because ffprobe is unavailable in WSL.
- Five new temporary-package tests exercise persisted identity/approval, lost-update rejection, measured audio with a mocked provider, exact scene/card mapping, image-change invalidation, card bounds/order and the FFmpeg argument graph. No external TTS request was made.
- Verification exposed field-order-sensitive hashes. Narration/audio/scene fingerprints now normalize JSON object keys while preserving array order; optional Canonical lineage fields normalize absent values to null.
- Final `npm run build` passed, including TypeScript checking and page-data/static generation. Build uses loopback-only dummy Supabase values, with no production credentials. Actual media encoding and live voice quality are not validated by these tests.

Phase-specific contract/storage/API details and deferred acceptance cases are in:

- `editorial-narration-v1.md`
- `editorial-narration-audio-v1.md`
- `narration-scene-plan-v1.md`
- `narration-instagram-adaptation-v1.md`
- `narration-shortform-render-v1.md`
