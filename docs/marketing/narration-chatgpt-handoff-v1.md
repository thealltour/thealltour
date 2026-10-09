# Narration ChatGPT exchange

The Narration panel provides `Narration handoff 복사` and `Narration 결과 가져오기` through its existing authenticated endpoint. No model/TTS call is made. JSON import saves a draft; approval remains a separate manual action.

- Handoff contract: `narration-chatgpt-handoff-v1`.
- Result contract: `narration-chatgpt-result-v1`.
- Result fields, all required: `contract`, `candidateId`, `handoffFingerprint`, `lineage`, `expectedRevision`, `expectedFingerprint`, `sentences`.
- Each sentence has exactly `sentenceId` (existing UUID or null for new), `text` and nullable `purpose`. There are 1–16 sentences in array order. The server assigns new IDs and order.
- The handoff includes the complete approved Canonical, newest imported Research verification, existing Narration sentences, identity/lineage, instructions and an exact result template. Unsaved manual edits must be saved before exporting.
- Research must exist and match candidate/asset identity. Blocked, partial and historical imports are reference material for further investigation, not generation blockers. Narration may directly research and use new verified facts without first amending Canonical. Current source revisions remain fingerprinted for stale-result detection.
- The immutable import ID and lossless Research content fingerprint enter Narration lineage. New Research imports/content changes invalidate Narration and every downstream audio/scene/card/render path; older artifacts without Research lineage require a save/review when Research exists.
- Result import rejects unknown fields, bad sentence counts/IDs, mismatched candidate/lineage, old source snapshots and stale Narration revision/fingerprint. Handoff identity covers the source, instructions and baseline. Existing approvals are cleared even when importing identical approved text.
- Latest Research is chosen just as the Research panel's default; alternate Research selection is not a new persisted preference. No publication integration or production mutation is performed by export.

WSL verification was authorized: production build and TypeScript checking passed. Related tests passed 77/77, including the 8-test migration suite covering full source handoff, malformed result rejection, stale Canonical/Research/baseline rejection, stable IDs, approval clearing and downstream stale gates. Tests use temporary packages and mocked TTS, without external jobs or production data writes. The native Hermes-Pi build also passed with a 4GB Node heap limit; its built artifacts were deployed and the Next service restarted successfully. HTTP checks verified login delivery and the unauthenticated API boundary; an authenticated browser import against production data was not performed.
