# Handoff contracts

## Manager → Content

`ContentDraftRequest`

- productId
- channel
- goal
- agenda
- brief
- constraints
- memory references
- contentAssignmentId / contentAssignment / contentPlanScaffold / selectedAgenda
- `deliverableRequirements` (`content-deliverable-requirements-v1`) — structural CS contract
- `evidencePack` (`evidence-pack-v1`) — deterministic locked facts for draft

Content는 brief/assignment/Evidence Pack에 없는 사실을 채우지 않는다. Manager-selected agenda를 재선택하지 않는다. destination/section completeness의 최종 pass/fail은 Completeness Validator가 소유한다.

## Manager decision contracts

- `SelectedAgenda` (`selected-agenda-v1`) — MM final agenda decision, separate from `AgendaCandidate`
- `ContentAssignment` (`content-assignment-v1`) — bounded CS task with evidence/facts
- `ContentPlan` (`content-plan-v1`) — structured format/angle plan separate from final draft
- `ContentDeliverableRequirements` (`content-deliverable-requirements-v1`) — requiredDestinations / sections / outputs
- `EvidencePack` (`evidence-pack-v1`) — ephemeral handoff pack (no DB migration)

MCP:

- MM: `create_content_assignment` (deterministic/idempotent business state)
- CS: `get_content_assignment`, `get_assignment_research_evidence` (read-only)

## Content → Completeness → Governance

CS draft는 Completeness Validator를 거친 뒤에만 GA로 간다.

- structural miss → `revision: completeness:…` (shared `MAX_AUTO_REVISION_ROUNDS=1`) 또는 `revision_required`
- structural miss는 Human REVIEW/`approval_pending`이 아니다
- factual pack이 있으면 cited `contentPlan.evidenceRefs`를 visible `sourceReferences`로 project

`StructuredGovernanceReviewRequest` (`governance-review-request-v1`)

- reviewId, assignmentId, selectedAgendaId
- draft, contentPlan, claims[], evidenceRefs[]
- commercialIntent, matchedProductIds, cta, constraints
- preflightSignals (deterministic unsupported-claim hints)

Governance Auditor returns structured `GovernanceDecision` (`governance-decision-v1`) with ALLOW/REVIEW/BLOCK, requiredRevisions on BLOCK. GA는 destination/section/output completeness를 재심판하지 않는다.

MCP read-only: `get_governance_review`, `get_assignment_governance_status`

Legacy slim payload fields (`title`, `body`, `channel`, `productId`, `agendaId`) remain compatible via nested draft/body.

## Governance → Manager

`GovernanceReviewResult`

- decision: ALLOW | REVIEW | BLOCK
- riskScore
- reasons
- revisionHints
- humanApprovalRequired

Manager 매핑:

- BLOCK → Content에 revision
- REVIEW → Human Owner
- ALLOW → publish_ready에서 중단, 게시 없음

## Performance → Manager

`PerformanceBrief`

- period
- product / channel
- key metrics
- observed patterns
- confidence

TypeScript: `src/lib/marketing/bot/organization/handoffs.ts`  
Envelope / pipeline: `src/lib/marketing/bot/organization/envelope.ts`, `pipeline.ts`  
Hermes primitive: [runtime-handoff.md](./runtime-handoff.md)  
Human: [human-approval.md](./human-approval.md)

Provenance on every envelope:

- sourceAgent / targetAgent (Hermes profile id, not a secret)
- taskType
- productId / channel / goal
- contextMemoryRefs
- governance decision / riskScore / reasonCodes when present

Embedding vector와 raw PII는 envelope에 넣지 않는다.


## Marketing Manager → Story/Point Miner → RA-1 (ED-1)

After agenda selection / content assignment handoff:

1. **Story/Point Miner** (TypeScript staff) mines 5–8 editorial story candidates (no web search).
2. **Point Quality Gate** evaluates each candidate structurally (not phrase bans alone).
3. Rank PASS candidates; select Top 1–3 into a durable `storyPointCandidateSet` on the production request.
4. If none PASS after ≤3 attempts → `story_point_skip` (deferred). Do **not** call RA-1 / Content Strategist / channel composers.
5. If PASS → **ED-2 targeted RA-1**: `ensureStoryTargetedResearch` runs bounded external search from `researchQuestions[]` (max 2 StoryPoints / 8 search requests per agenda), adjudicates `EvidenceBackedStoryBrief`, and gates Content Strategist on `SUPPORTED` / `PARTIALLY_SUPPORTED` only.
6. If PASS → **ED-3 ContentProposition lock**: CS derives a Story-locked ContentProposition from StoryPoint + EvidenceBackedStoryBrief; deterministic lock validator; max 1 repair; fail closed before channel composers.

Contract: `story-content-point-v1` / `story-point-candidate-set-v1` under `src/lib/marketing/storyPoint/`.
