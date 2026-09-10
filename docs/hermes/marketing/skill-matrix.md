# Skill / Tool Matrix

MCP 서버 `thealltour-marketing`은 **14개** tool을 모두 노출한다 (`MARKETING_BOT_TOOL_NAMES`).
Hermes Desktop이 Agent identity를 MCP에 넘기지 않으므로 **enforcement는 prompt-level + profile `tools.include`** 이다.

TypeScript source of truth:

`src/lib/marketing/bot/organization/skillMatrix.ts`

Helpers:

- `allowedToolsForRole` → `allow` only
- `desktopExposedToolsForRole` → `allow ∪ optional` (Hermes profile include target)
- `isToolAllowedForRole` → allow or optional

## Permission

| 값 | 의미 |
|---|---|
| allow | 이 역할의 기본 도구 |
| optional | 필요 시만, 남용하지 않음 |
| deny | 호출하지 않음. 필요하면 상위/담당 역할로 handoff |

## Matrix (14 tools)

| Tool | Marketing Manager | Content Strategist | Governance Auditor | Performance Analyst |
|---|---|---|---|---|
| get_marketing_context | allow | allow | optional | allow |
| search_marketing_memory | allow | allow | allow | allow |
| build_content_brief | allow | allow | deny | deny |
| evaluate_governance | optional | optional | allow | deny |
| prepare_marketing_task | allow | deny | deny | deny |
| review_generated_content | allow | deny | allow | deny |
| get_performance_evidence | allow | deny | deny | allow |
| get_research_context | allow | optional | optional | optional |
| create_content_assignment | allow | deny | deny | deny |
| get_content_assignment | optional | allow | optional | deny |
| get_assignment_research_evidence | optional | allow | optional | deny |
| get_governance_review | optional | allow | allow | deny |
| get_assignment_governance_status | optional | allow | allow | deny |
| run_department_orchestration | allow | deny | deny | deny |

`prepare_marketing_task` / `create_content_assignment` / `run_department_orchestration`는 Manager 전용.

## Production queue vs Desktop interactive

| Path | MCP `get_*` needed? | Notes |
|------|---------------------|-------|
| Production queue / `runDepartmentPipeline` oneshot | **No (intentional)** | Handoff JSON embedded in specialist prompt |
| Desktop / message_agent interactive | **Yes** | Profile `tools.include` must match `desktopExposedToolsForRole` |

Do not treat missing Desktop include as a production-spine bug. Do treat it as **configuration drift** for interactive collaboration.

## Reproducing live Hermes MCP includes (no secrets in git)

Live files under `~/.hermes/profiles/*/config.yaml` stay **outside git** (tokens/headers).

Repo source of truth:

1. `src/lib/marketing/bot/organization/skillMatrix.ts` → `desktopExposedToolsForRole(role)`
2. `docs/hermes/examples/config.mcp.thealltour-marketing.yaml` (reference lists)
3. Apply helper (updates **only** `tools.include`, never Authorization):

```bash
npx tsx scripts/apply-hermes-marketing-mcp-includes.ts --print
npx tsx scripts/apply-hermes-marketing-mcp-includes.ts --check
npx tsx scripts/apply-hermes-marketing-mcp-includes.ts --apply
```

Fresh Pi / regenerated profiles: create profiles first, then `--apply` to align includes with skillMatrix.

## Forbidden actions (모든 역할)

publish, send, post, delete, archive, auto_approve, override_governance, invent_product_facts, use_raw_pii

모든 역할 `autoPublishAllowed = false`.
