# 조직도 — AI Marketing Department v2 foundation

```
Human Owner
   ↓
Marketing Manager
   ├── Content Strategist
   ├── Governance Auditor
   └── Performance Analyst

Deterministic staff (not Hermes Bots):
   Evidence Pack Builder
   Completeness Validator

Services (Bot org 밖):
   Research Intelligence → MM
   Media/Channel Layer (post-candidate)
```

Hermes Bot profile / registry slot은 v1과 동일하다 (`marketing-manager`, `content-strategist`, `governance-auditor`, `performance-analyst`). Evidence Pack Builder·Completeness Validator는 TypeScript staff이며 Desktop agent를 추가하지 않는다.

Human Owner만 최종 게시 권한을 가질 수 있다. 현재 게시 tool 자체가 없으므로 모든 Agent의 게시 권한은 **없음**. APPROVE는 게시 가능 상태일 뿐 SNS 실행이 아니다. 런타임 전달: [runtime-handoff.md](./runtime-handoff.md).

Production spine은 `runDepartmentPipeline` / Agenda queue다. Group Chat은 협업 UX일 뿐 pipeline을 대체하지 않는다 — [desktop-deployment.md](./desktop-deployment.md#hermes-desktop-group-topology-ops).

## Marketing Manager

- **책임:** 요청 이해, prepare, agenda 선택, 하위 역할 지시, governance 결과 취합, human approval handoff
- **입력:** 사용자 요청, productId/channel/goal, PerformanceBrief
- **출력:** `{ status, task, selectedAgenda, draft?, governance?, nextAction }`
- **상위:** Human Owner
- **하위:** Content Strategist, Governance Auditor, Performance Analyst
- **승인 권한:** 없음 (REVIEW는 사람에게)
- **게시 권한:** 없음

## Content Strategist

- **책임:** brief + Evidence Pack + deliverable requirements 기반 초안. 자기 승인 금지
- **입력:** ContentDraftRequest (+ `deliverableRequirements`, `evidencePack`)
- **출력:** `{ title?, body, channel, agenda, sourceReferences, contentPlan? }`
- **상위:** Marketing Manager
- **handoff:** Completeness Validator → Governance Auditor
- **승인 권한:** 없음
- **게시 권한:** 없음

## Completeness Validator (staff)

- **책임:** destination/section/output/sourceReferences structural gate. fail → deterministic revise / `revision_required` (Human REVIEW 아님)
- **삽입:** CS draft 이후, GA 이전. `MAX_AUTO_REVISION_ROUNDS=1`을 GA와 공유

## Evidence Pack Builder (staff)

- **책임:** assignment facts를 `evidence-pack-v1`으로 lock. CS는 `allowedForDraft`만 사용
- **삽입:** `prepareManagerToContentHandoff` 이후, CS `ContentDraftRequest` 이전

## Governance Auditor

- **책임:** 독립 검수 (policy / unsupported factual / commercial-legal). 문장 미학 교정 아님. structural completeness 비소유
- **입력:** GovernanceReviewRequest
- **출력:** GovernanceWorkflowResult (ALLOW/REVIEW/BLOCK)
- **상위:** Marketing Manager / Human Owner (REVIEW)
- **승인 권한:** 엔진 결과만 전달. 자동 승인 없음
- **게시 권한:** 없음

## Performance Analyst

- **책임:** 확인 가능한 성과만 요약
- **입력:** product/channel/period
- **출력:** `{ period, metrics, observations, confidence, recommendations }`
- **상위:** Marketing Manager
- **승인/게시 권한:** 없음
