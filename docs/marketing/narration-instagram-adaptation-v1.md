# Instagram from Narration / scene visuals — S4

## Behavior

The new Instagram adaptation is an explicit opt-in workflow after the sentence visual stage. A human selects 4–10 distinct approved scenes and edits the copy of each selected card. There is no initial card selection, five-card default, automatic filler, silent slicing, role-based fixed count or extra closing/CTA card. If the narration has fewer than four scenes, this contract cannot produce an Instagram carousel; narration is not padded to make the card count fit.

Card order follows the selected subset's original Narration order. Operators adjust composition by selecting/deselecting scenes, not by reordering the story. Each card has exactly one sceneId/sentenceId/visualId; all are the same stable UUID in this initial contract, and cardId uses that UUID too. Duplicate scene selections and combining multiple visuals into a card are rejected. Shortform scene count and TTS duration remain unchanged by Instagram selection.

The selected 9:16 image is used to derive a center-cropped 4:5 image for card rendering. This is a channel presentation derivative of the same scene visual, not a second generated visual. The UI previews the crop. Configurable focal/crop selection and 1:1 thumbnail variants are deferred.

## Contracts and review

`narration-instagram-adaptation-v1` contains candidateId, revision/fingerprint, exact scene-plan revision/fingerprint/upstream lineage, 4–10 cards, createdAt and exact-revision approval. Each card stores scene/sentence/visual identity, contiguous card order, copy, the selected image path/SHA-256 and fixed `center-4:5` crop policy.

Copy limits match the existing review form: kicker 40, headline 80 (required), body 400 and microcopy 120 characters; optional values are null. Nothing is silently truncated on import. The stored artifact is the new review authority; it is not mirrored into existing channel-review DB records or legacy card-copy JSON.

Saving a changed selection, copy, source or image advances revision and clears approval. A true no-op preserves approval. Concurrent editors use expected revision/fingerprint and fail closed. Reverting earlier copy still creates a new revision/fingerprint, so an old render cannot revive accidentally. Previous revisions remain archived. Replaced selected images stale the adaptation; replacing an unselected scene image does not unnecessarily stale a saved subset. Every consumed image is verified against its active scene mapping and file SHA.

The separate `narration-instagram-chatgpt-handoff-v1` packages approved Canonical factual context, approved narration/scene text, ready-image availability and current fresh card copy for external writing/review. Instructions explicitly require 4–10 distinct ready scenes in Narration order with one visual per card, and forbid a five-card default or changing Canonical. It performs no model call and no external message sending.

`narration-instagram-chatgpt-result-v1` requires exactly:

```text
contract
candidateId
source { scenePlanRevision, scenePlanFingerprint, upstream }
baseRevision
baseFingerprint
visualInventoryFingerprint
cards [{ sceneId, kicker, headline, body, microcopy }]
```

Source/base/inventory values must echo the handoff exactly. The inventory fingerprint binds the set of ready images when the handoff was built; replacing or adding/removing an image invalidates an old external result. Imports additionally validate source freshness, unique real scene IDs, increasing scene order, complete selected images and field/card-count bounds. Result import saves a draft and still requires explicit human approval. Unknown fields, wrong contracts, identity changes or stale base revisions are rejected rather than rebound.

## Render integration

The new adapter calls the existing deterministic `renderCardNewsPackage` with only the chosen cards, their exact approved copy and their corresponding image snapshots. It bypasses legacy slide-headline/card-copy fallback selection, so the old generated card count cannot displace the new composition. First selected card uses the existing cover layout; others use the existing image-backed editorial layouts. No automatic text-only visual fallback is accepted as a completed new render.

Render attempts store cropped input snapshots and output PNGs under `cardnews/narration/<adaptation-fingerprint>/<attempt-id>/...`. The existing MediaBrief is read only for package/renderer structure and branding; old card text is overwritten in memory by the approved selection. Legacy MediaBrief, publishable bundle, cardnews files and manifests are not overwritten. The adapter requires an existing matching candidate MediaBrief.

Before rendering and before publishing a result envelope, the approved adaptation and upstream lineage must still be current. Each attempt has its own path; a failed/stale attempt leaves diagnostic files but no usable render envelope. The envelope binds exact adaptation/plan fingerprints, ordered scene/card IDs and both input-image and output-PNG hashes. Protected previews require fresh approval, validate the envelope and files, and return no-store images. No publication/SNS job is enqueued.

## Storage / API

- `context/narration/instagram/current.json`
- `context/narration/instagram/revisions/<revision>-<fingerprint>.json`
- `context/narration/instagram/<fingerprint>.render.json`
- `cardnews/narration/<fingerprint>/<attempt-id>/inputs/<card-id>.png`
- Existing renderer's date/candidate/cardnews layout inside the isolated attempt root.

GET `/api/admin/marketing-review/:candidateId/narration-instagram` returns current source readiness, available scenes, adaptation gate and verified render.

POST accepts save/approve/handoff/import/render, expected adaptation revision/fingerprint (null initially), expectedScenePlanFingerprint and optional cards/result according to action. Render requires the exact approved fresh adaptation; the browser cannot supply arbitrary paths or visuals. Every route requires settings.manage, and mutations additionally require existing candidate canEdit. Only package files are changed; no new DB mutation or schema change.

GET `.../narration-instagram/:cardId?fingerprint=...` returns a fresh verified rendered PNG, usable as preview/download. Arbitrary card IDs or file paths are not accepted.

## UI and compatibility

The **Instagram 파생** stage uses stable tab ID 9; older IDs 1–8 are preserved. It displays actual selected count, source sentences, image readiness, per-card copy editing, save/approval, separate ChatGPT handoff/import and render previews. Checkbox selections control composition dynamically; text-only editing of a fixed generated set is no longer the new path's limit. Dirty input survives tab switches and asynchronous parent refreshes; an outdated optimistic concurrency baseline is retained so a later save cannot overwrite intervening work.

Legacy `instagram-cardnews-chatgpt-handoff-v1` / result-v1 public shapes and their original routes remain intact. The previous five-role examples, diagnostic helper and five-card fixtures are not rewritten in this additive phase. The new path has no five-card requirement/default, and does not use the legacy helper/prompts to determine count. Existing channel captions, other-channel generation, publication approvals and legacy render automation still consume the old channel artifacts; cutover to the new adaptation must be handled explicitly after verification rather than silently publishing new content through an old gate.

## Deferred acceptance checks

No tests, type checking, build, actual render, external model call, production DB write, commit or deployment was performed. After approval, verify 4/5/6/10 valid selections; reject 3/11, duplicate/foreign IDs and descending order; no default/filler cards; preserved stable IDs; copy bounds; stale source/image/result; selected vs unselected replacement; no-op/reversion behavior; concurrent editors; exact one-image/card injection; 4:5 crop; all output-count/order/hash checks; protected stale preview rejection; dirty draft behavior; and legacy public v1 compatibility. S5 remains the shortform renderer migration.
