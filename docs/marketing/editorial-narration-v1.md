# Editorial Narration S1

An additive, manually reviewed `editorial-narration-v1` artifact. Existing Instagram ChatGPT v1 contracts, renderers, production queues and legacy Narrative beats remain unchanged. S1 does not yet generate narration automatically or call TTS.

## Contract

`candidateId`, positive `revision`, content SHA-256 `fingerprint`, Canonical `lineage`, ordered `sentences`, `createdAt`, nullable exact-revision `approval`.

Each sentence contains server-issued UUID `sentenceId`, zero-based contiguous `order`, nonempty `text` and nullable `purpose`. The editor accepts 1–16 explicitly entered sentences. This is an explicit initial cap, not a duration target. No silent slicing or automatic sentence splitting. A human must enter one spoken sentence per row; punctuation alone cannot reliably validate Korean sentence boundaries. Existing IDs survive text edits and moves; new rows receive new IDs. Duplicate and foreign IDs fail closed.

S2 adds audio/timing metadata separately, keyed by the approved narration revision and fingerprint. S3 must enforce exactly one scene/plan/generated visual per sentence. Instagram selection and 4–10-card adaptation arrive in S4, independent of sentence count.

## Storage and API

Package-local `context/narration/current.json`; prior revisions are archived to `context/narration/revisions/<revision>-<fingerprint>.json` when a new revision is published. Archival captures the previous revision's latest approval. No database migration or new database mutation. GET/POST `/api/admin/marketing-review/:candidateId/narration` requires `settings.manage`; mutation additionally requires existing candidate `canEdit`.

POST includes `action: save|approve`, `expectedRevision`, `expectedFingerprint`, exact `lineage`; save additionally includes ordered `sentences` without `order`, with nullable ID for new rows. Initial expected revision/fingerprint are null. Empty/oversized input is rejected. Save uses a package-local exclusive mutation lock and atomic rename; changing text/order/purpose/source invalidates approval and advances revision. A true no-op preserves approval. Approve requires the current revision and fresh approved Canonical.

Canonical lineage includes identity/revision plus factual content, evidence boundaries and research revision. Corrupt package Canonical never falls back to an older candidate copy. Corrupt Narration fails closed. Canonical is rechecked before publishing the pointer. Canonical writers do not share this lock, so reads/approval always recompute freshness; future renderer execution must also check lineage at start and completion. A process killed during mutation may leave `.mutation-lock`; an operator must verify no writer is active before removing that specific lock. Atomic rename provides process-level atomicity, not a power-loss durability guarantee.

## Review UI / compatibility

The new Narration stage sits after Research. Historical numeric tab IDs 1–6 are preserved; Narration uses ID 7, while displayed numbers reflect sequence. Editors remain mounted across tab switches. Canonical refresh preserves dirty input and its original optimistic concurrency baseline. The old card review now states the actual imported count and explains that it edits copy, while composition remains in generation/import.

S1 freshness applies only to this new artifact. Strong downstream invalidation becomes active as consumers migrate in S2–S5; legacy card-only flows do not acquire an incomplete gate. No TTS/network job, production database write, commit or deployment was performed during implementation.

## Deferred acceptance checks (require user approval before execution)

- Initial save assigns unique IDs and contiguous order; reload preserves them.
- Text/order/purpose changes advance revision and clear approval; no-op preserves both.
- Canonical revision/content/boundary changes produce stale; stale approval fails.
- Two editors cannot overwrite an intervening revision; concurrent file writers return conflict.
- Duplicate/foreign IDs, missing/17+ rows, corrupt files and wrong candidate identity fail closed.
- Legacy tab selection/keyboard navigation and public Instagram v1 shapes stay compatible.
- Dirty drafts survive tab switching and Canonical refresh; saved revision is approved only after save.
- Next S2: approved revision/config fingerprints bind measured audio; no fabricated timings.

Tests, type checking and builds were intentionally not run for this implementation, as requested.
