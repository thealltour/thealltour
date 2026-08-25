# Human Approval

기존 Governance policy / `applyApprovalDecision()` 이 source of truth다. 새 decision table을 만들지 않는다.

| Governance | workflow | Human |
|---|---|---|
| ALLOW + semantic available | publish_ready | 결과만 보고, **게시 없음** |
| ALLOW + semantic unavailable | approval_pending | 사람 승인 |
| REVIEW | approval_pending | APPROVE / REJECT / REQUEST_CHANGES |
| BLOCK | revision_required | 자동 revision 최대 1회 후 사람에게 |

Human action (`applyApprovalDecision`):

- APPROVE → `approved` (게시 가능 상태일 뿐, SNS publish 아님)
- REJECT → `rejected`
- REQUEST_CHANGES → `revision_required`

v1 persistence: **없음**. DB migration 없음. runtime contract만.

payload: 기존 `HumanApprovalHandoff` (`src/lib/marketing/bot/types.ts`).
