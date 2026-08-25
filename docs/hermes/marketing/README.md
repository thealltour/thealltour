# AI Marketing Department v1

더올투어 마케팅을 Hermes Agent 4역할로 조율한다. **이번 문서는 source of truth다. Desktop Agent 생성·Cron 활성화는 하지 않는다.**

## 조직

```
Human Owner
   ↓
Marketing Manager
   ├── Content Strategist
   ├── Governance Auditor
   └── Performance Analyst
```

작성자가 자기 글을 최종 승인하지 않는다. 검사는 Governance Auditor가 독립 수행한다.

## MCP

서버 `thealltour-marketing` (publish/send/post 없음):

- `get_marketing_context`
- `search_marketing_memory`
- `build_content_brief`
- `evaluate_governance`
- `prepare_marketing_task`
- `review_generated_content`

Agent별 권한은 현재 **prompt-level**이다. MCP 서버가 Agent identity를 받지 않으므로 server ACL은 아직 없다. 표: [skill-matrix.md](./skill-matrix.md)

## 문서

| 층 | 경로 |
|---|---|
| 조직도 | [organization.md](./organization.md) |
| 공통 정책 | [department-policy.md](./department-policy.md) |
| Prompt A/B | [prompts/](./prompts/) |
| Handoff | [handoffs.md](./handoffs.md) |
| Cron 설계 | [cron-plan.md](./cron-plan.md) |
| Desktop New Agent | [agents/](./agents/) |
| Machine contract | `src/lib/marketing/bot/contracts/` |
| TS config | `src/lib/marketing/bot/organization/` |

## 수동 테스트 (Agent 생성 후)

Marketing Manager:

> 스페인/포르투갈 상품으로 오늘 Threads 콘텐츠를 준비해줘. 게시하지 말고 governance 결과까지 보여줘.

Content Strategist:

> 제공된 상품 brief만 근거로 Threads 초안을 작성해. 없는 혜택은 만들지 마.

Governance Auditor:

> 이 초안을 검사하고 ALLOW/REVIEW/BLOCK 및 이유만 보고해.

Performance Analyst:

> 최근 30일 이 상품의 확인 가능한 성과만 정리해.

## Desktop / Profile 배포

Pi에 실제 profile이 있다. 생성 방식과 Bot 목록 조건: [desktop-deployment.md](./desktop-deployment.md).

Cron은 [cron-plan.md](./cron-plan.md) 체크리스트 전에는 만들지 않음.

## Human Approval

REVIEW는 DB에 저장하지 않는다. Manager가 사용자에게 reason, riskScore, 유사 콘텐츠 요약을 보여주고 멈춘다.

## 게시

v1 모든 역할 `autoPublishAllowed = false`. ALLOW여도 publish_ready에서 중단.

## Internal runtime (Pi)

localhost MCP 서버 운영: [internal-runtime.md](./internal-runtime.md). public website(Vercel)와 별개다.
