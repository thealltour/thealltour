# Skill / Tool Matrix

MCP 서버 `thealltour-marketing`은 6개 tool을 모두 노출한다. Hermes Desktop이 Agent identity를 MCP에 넘기지 않으므로 **v1 enforcement는 prompt-level**이다.

향후 `AgentRole → allowedTools`를 server-side에서 검사할 수 있도록 TypeScript source of truth:

`src/lib/marketing/bot/organization/skillMatrix.ts`

## Permission

| 값 | 의미 |
|---|---|
| allow | 이 역할의 기본 도구 |
| optional | 필요 시만, 남용하지 않음 |
| deny | 호출하지 않음. 필요하면 상위/담당 역할로 handoff |

## Matrix

| Tool | Marketing Manager | Content Strategist | Governance Auditor | Performance Analyst |
|---|---|---|---|---|
| get_marketing_context | allow | allow | optional | allow |
| search_marketing_memory | allow | allow | allow | allow |
| build_content_brief | allow | allow | deny | deny |
| evaluate_governance | optional | optional | allow | deny |
| prepare_marketing_task | allow | deny | deny | deny |
| review_generated_content | allow | deny | allow | deny |

`prepare_marketing_task`는 Manager 전용.

## Forbidden actions (모든 역할)

publish, send, post, delete, archive, auto_approve, override_governance, invent_product_facts, use_raw_pii

모든 역할 `autoPublishAllowed = false`.
