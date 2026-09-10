# ShortVideoBrief v1 (SV-3)

Contract SoT:

- [`src/lib/marketing/assets/shortVideoBrief/`](../../src/lib/marketing/assets/shortVideoBrief/)
- artifact path: `context/short-video-brief.json`

Related:

- MediaBrief: `media-brief-v1` / `context/media-brief.json`
- Shot List: `ai-video-shot-list-v1` / `reel/shot-list.json`
- SV-1 storage policy: [shortform-asset-storage-policy-v1.md](./shortform-asset-storage-policy-v1.md)
- SV-2 catalog: [shortform-source-catalog-v1.md](./shortform-source-catalog-v1.md)

## Role

```text
MediaBrief
    ↓
Shot List (optional timing)
    ↓
ShortVideoBrief   = source resolver INPUT ("What visual do we need?")
    ↓
SV-4 Source Resolver  ("Where do we get that visual?")
```

`ShortVideoBrief` does **not** replace MediaBrief or Shot List.
It is a normalized execution brief for shortform source resolution.

## Duration presets

| Preset | Duration |
|--------|----------|
| `short` | 12s |
| `normal` | 18s (default) |
| `info` | 24s |

Selection is deterministic (no LLM). Honors `MediaBrief.formats.shortform.targetDurationRange` when set.
With a Shot List, scene timings follow TTS shot durations; preset is nearest classification (`shot_list_nearest`).

## Scene contract

- Stable IDs: `scene-001`, `scene-002`, … (suitable for `marketing_media_source_usages.scene_key`)
- `narrationSegmentRefs` — references MediaBrief narration SoT (no conflicting duplicate narration ownership)
- `visual.subject` / `searchQueries` (max 3) — resolver inputs; no fabricated place names
- `factualVisualRequired` — hard safety signal for SV-4
- `generatedVideoAllowed` — must be false when factual visual is required
- Policy-level `sourcePreference.internalFirst` / `stockAllowed` only (no provider names)

## Factual visual safety

```text
factualVisualRequired === true  =>  generatedVideoAllowed === false
```

Deterministic inference (no LLM): evidence refs on the segment, or known destination/entity strings already present on the caller/candidate context appearing in visual/narration text.

## Generation gating

```text
ShortVideoBrief generation = explicit caller only
```

Helpers: `isShortVideoBriefGenerationApplicable`, `productionRequestMentionsShortVideoConcept` (soft hint only).

**No** automatic production-queue / SelectedAgenda / autoVideo wiring in SV-3.

## Artifact write

`planShortVideoBriefArtifact` / `persistShortVideoBrief` reuse Candidate Package `writePackageArtifact` (sha256, safe relative path, origin `short_video_brief`).

Not connected to `exportMarketingCandidatePackage` automatically.

## Out of scope (SV-3)

Provider search/download, Global Catalog auto-query, Asset Picker UI, Remotion, VideoRenderJob, Mini-PC worker, OBS spans, publication changes.
