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

Content는 brief/assignment에 없는 사실을 채우지 않는다. Manager-selected agenda를 재선택하지 않는다.

## Manager decision contracts

- `SelectedAgenda` (`selected-agenda-v1`) — MM final agenda decision, separate from `AgendaCandidate`
- `ContentAssignment` (`content-assignment-v1`) — bounded CS task with evidence/facts
- `ContentPlan` (`content-plan-v1`) — structured format/angle plan separate from final draft

MCP:

- MM: `create_content_assignment` (deterministic/idempotent business state)
- CS: `get_content_assignment`, `get_assignment_research_evidence` (read-only)

## Content → Governance

`GovernanceReviewRequest`

- title
- body
- channel
- productId
- campaignId?
- agendaId / agendaKey?

작성자가 `review_generated_content`를 직접 호출하지 않는 것이 기본이다. Manager 또는 Auditor가 호출한다.

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
