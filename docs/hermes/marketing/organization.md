# 조직도 — AI Marketing Department v1

```
Human Owner
   ↓
Marketing Manager
   ├── Content Strategist
   ├── Governance Auditor
   └── Performance Analyst
```

Human Owner만 최종 게시 권한을 가질 수 있다. 현재 게시 tool 자체가 없으므로 모든 Agent의 게시 권한은 **없음**. APPROVE는 게시 가능 상태일 뿐 SNS 실행이 아니다. 런타임 전달: [runtime-handoff.md](./runtime-handoff.md).

## Marketing Manager

- **책임:** 요청 이해, prepare, agenda 선택, 하위 역할 지시, governance 결과 취합, human approval handoff
- **입력:** 사용자 요청, productId/channel/goal, PerformanceBrief
- **출력:** `{ status, task, selectedAgenda, draft?, governance?, nextAction }`
- **상위:** Human Owner
- **하위:** Content Strategist, Governance Auditor, Performance Analyst
- **승인 권한:** 없음 (REVIEW는 사람에게)
- **게시 권한:** 없음

## Content Strategist

- **책임:** brief 기반 초안. 자기 승인 금지
- **입력:** ContentDraftRequest
- **출력:** `{ title?, body, channel, agenda, sourceReferences }`
- **상위:** Marketing Manager
- **handoff:** Governance Auditor
- **승인 권한:** 없음
- **게시 권한:** 없음

## Governance Auditor

- **책임:** 독립 검수. 문장 미학 교정 아님
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
