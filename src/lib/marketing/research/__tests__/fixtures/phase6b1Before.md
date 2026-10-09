# Phase 6B-1 parity baseline

This fixture preserves the pre-cleanup `before.json` capture left by the in-progress
Phase 6B-1 work in `/home/ysh/thealltour/.tmp-6b1/`. `before2.json` is byte-identical.
It is historical evidence; do not regenerate it from the cleaned-up implementation.

SHA-256: `74fd8c4af36eec450d489f8e51dc005ab8a15092f20b3814a844949260b99751`

`sourceSemanticsRuntimeParity.test.ts` runs deterministic feed fixtures, an in-memory
collection cycle including Performance Memory, Meta ingestion, pre-pool selection,
and MM contexts at limits 18 and 30. It compares all captured output with this
baseline after exactly these intentional changes:

- Remove source metadata `destinationFocus` and portfolio `evidenceAuthorityWeight`.
- Remove the dead `evidenceAuthorityWeight` from resolved source role weights.
- Add `attenuatedCandidateCount` equal to `attenuatedRankedCount` in MM diagnostics
  and the existing attenuation log event.

The original capture normalizes generated IDs and volatile timestamps/durations;
set-like signal/brief/candidate collections are sorted, with candidate ordering
captured separately. This checks result parity, not execution-time performance.
Raw and normalized fingerprints, scores, provenance, and MM ordering are retained.
All repositories and feed responses are in-memory fixtures; no operational DB writes.
