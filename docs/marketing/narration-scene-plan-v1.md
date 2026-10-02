# Sentence-based visual migration — S3

## Architecture

```text
Approved Canonical (factual authority)
  → approved editorial-narration-v1 (ordered stable sentence IDs)
    → completed fresh narration-audio-job-v1 (one measured WAV per sentence)
      → narration-scene-plan-v1 (manual prompt review + approval)
        → narration-astra-handoff-v1 (exactly one 9:16 request per sentence)
          → narration-scene-assets-v1 (one current generated image per scene)
            → S4: Instagram selection/adaptation, 4–10 cards
            → S5: measured-duration shortform renderer

Legacy Instagram → Shared Visual Plan → old Astra/upload/render
  remains independently available during the additive migration.
```

S3 introduces the sentence-based successor to the old card-based Shared Visual Plan as a separate version/artifact. It deliberately does not reinterpret an existing cardId as a sentenceId or silently migrate previously uploaded images. Existing public `instagram-cardnews-chatgpt-handoff-v1` / result-v1 contracts stay unchanged. Existing multi-card shared master behavior remains only in the legacy path.

## Strict contracts

For each approved Narration sentence, `sentenceId = sceneId = visualId` (stable UUID), with the same contiguous zero-based order and exact sentence text. There is exactly one visualPrompt, one scene and one generated-image slot per sentence. No merge/split, grouped scene, optional generated visual, local asset fallback, rebind or cross-scene reuse. Prompt review is manual in this first implementation; S3 does not introduce another model call or claim a factually grounded prompt can be inferred automatically from the sentence alone.

Plan fields include revision, fingerprint, exact source lineage, ordered scenes, totalDurationMs and nullable exact-revision approval. Source includes candidate, full Canonical lineage, narration revision/fingerprint, audio jobId/config fingerprint and complete measured-timeline fingerprint. Each scene carries exact sentence text/purpose, speech start/duration/end, scene end and fixed `9:16`. Timestamps are server-derived, never editable or guessed.

`sceneEndMs` is the next sentence's speech start, or the total duration for the last scene. Thus the preceding scene covers the explicit measured-timeline 250 ms intersentence pause. Scene count is independent of any Instagram card count or video-duration target.

Plan fingerprints include revision as well as source and full scene content. A true no-op preserves approval. A changed prompt or source advances revision and clears approval. Restoring earlier prompt text still produces a distinct plan fingerprint; previously generated assets cannot become current again accidentally. Saved historical revisions remain on disk.

## Operator flow

The new **문장 비주얼** stage follows Narration and sits beside the existing production workflow. Historical stage IDs remain stable: old 1–6, Narration 7, sentence visuals 8. Display numbering and keyboard navigation follow the actual array order.

1. Enter a completed audio job ID and load its approved narration/timing.
2. Write one visual prompt per displayed sentence. The UI cannot add/remove/reorder scenes.
3. Save and approve the exact plan revision.
4. Generate/copy the new Astra JSON; create images manually in Astra.
5. Upload one image into each matching sentence/visual slot.

Changing Narration requires regenerating audio before saving a fresh plan. Previous prompt text may be displayed for surviving IDs as a review starting point, but must be saved under the new source lineage. No previous image is rebound. Dirty input survives tab changes and asynchronous parent refreshes. Editing prompts hides old uploads until the revised plan is saved and approved.

## Storage and APIs

- `context/narration/scenes/current.json`
- `context/narration/scenes/revisions/<revision>-<fingerprint>.json`
- `context/narration/scenes/<plan-fingerprint>.handoff.json`
- `context/narration/scenes/<plan-fingerprint>.assets.json`
- `context/narration/scenes/image-ledger.json`
- `media/narration-scenes/<plan-fingerprint>/<visualId>/<image-sha256>.png`

GET `/api/admin/marketing-review/:candidateId/narration-scenes` optionally accepts audioJobId. It returns the current plan, fresh source, gate state, persisted handoff and verified upload slots. A stale stored source is reported as stale without hiding the historical plan. An explicitly selected invalid/stale audio job is rejected.

POST JSON accepts `action: save|approve|handoff`, audioJobId, expected plan revision/fingerprint (null initially), expected Narration revision/fingerprint, and for save an ordered prompts array `{sentenceId, visualPrompt}` matching all sentences exactly. IDs, sequence, scene count, text and timing are projected by the server, not supplied by the client. Mutations use a package-local exclusive lock and atomic writes; concurrent stale editors fail instead of overwriting changes.

POST multipart accepts file, visualId, planFingerprint and handoffFingerprint. Latest approved plan and persisted matching handoff are mandatory. Filenames do not control identity. Existing PNG/JPEG/WebP size/signature validation is reused, followed by sharp decoding, EXIF rotation and metadata-free PNG normalization. Multi-page/animated images, oversized decoding and non-9:16 proportions are rejected; no crop or resize changes the requested composition.

GET `.../narration-scenes/:visualId?planFingerprint=...` serves the verified PNG only while the plan is still approved and fresh. All routes require settings.manage; mutations additionally require candidate canEdit. They read candidate/review data but perform no new DB mutation.

## Stale and integrity rules

Canonical drift/revocation, Narration change/loss of approval, audio config change, missing or modified WAV, changed timing, or revised visual prompt prevents old plans/handoffs/assets from being consumed. Plan freshness compares exact source and each sentence/timing mapping. Uploaded manifests bind both the plan and the full handoff fingerprint. Image path, aspect and file SHA-256 are verified when reading slots or serving previews.

The image ledger rejects an identical normalized PNG uploaded to another scene or a previous plan. Reuploading the same file to its existing slot is allowed; replacing an image changes the single current asset reference and preserves old files. This protects explicit file reuse, not semantic similarity: code cannot prove an externally supplied image was newly generated, or detect all resized/altered versions of an earlier image. Operators must still follow the handoff's no-reuse instruction. S4/S5 must fingerprint the exact image hashes so a replacement invalidates derived output even if the plan itself is unchanged.

Locks cover scene-plan/handoff/manifest mutations; upstream Canonical/Narration/audio writers use their own paths. Source is rechecked during mutations and consumption. There remains no cross-artifact filesystem transaction; future render execution must recheck lineage at start and completion. Interrupted writes may leave a lock or unreferenced file; after verifying no writer is active, remove only that specific lock. No automatic cleanup, migration or production mutation is introduced.

## Changed code

New `publishable/narrationScenes/{contracts,service,assets,apiContext}.ts`, plan/upload and preview routes, `MarketingReviewNarrationScenesPanel.tsx`; updated workflow navigation/detail and the Narration panel's asynchronous dirty-input protection. No change to the legacy planner, old Astra builder, old upload service, Instagram v1, or render pipeline.

## Deferred acceptance checks

No tests, type checking or build were run. No audio job, Astra generation or production upload was executed. After user approval, check exact 1:1/order/timing mapping; missing/duplicate/foreign prompt IDs; no-op vs changed/reverted prompts; concurrent editors; Canonical/Narration/audio staleness; stale handoff upload rejection; exact 9:16/EXIF handling; duplicate image reuse; missing/modified files; complete-slot readiness; keyboard/history compatibility; dirty-input preservation; and legacy v1 behavior. Actual integration depends on an approved S2 audio job and configured TTS profile.
