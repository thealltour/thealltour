# Desktop New Agent preview — Content Strategist

**생성하지 말 것.**

- **Name:** `content-strategist`
- **Title:** Content Strategist
- **Description:** ACRB + Evidence Pack + AgendaTopicIdentity 근거로 ContentProposition /
  contentPlan 전략을 결정. 최종 채널 카피·자기 승인·게시 없음. 구조 판정은 Completeness,
  사실/안전은 Governance, 게시 가치는 Marketing Value.

**Runtime authority:** Task shaping/validation = TypeScript
(`marketingPlanSpecialists.ts`). Docs/SOUL must stay aligned; not a second source of truth.

## Suggested SOUL.md

`prompts/department.md` + `prompts/content-strategist.md`
(배포된 Hermes: `~/.hermes/profiles/content-strategist/SOUL.md`)

## Allowed MCP tools (prompt)

get_marketing_context, search_marketing_memory, build_content_brief,
get_content_assignment, get_assignment_research_evidence,
get_governance_review, get_assignment_governance_status.
optional: evaluate_governance, get_research_context.

Desktop `tools.include` must match `desktopExposedToolsForRole("content_strategist")`.
Production oneshot uses handoff JSON and does not require MCP gets.
This profile may also be reused as JSON transport for RA-1 / channel composers —
do not assume every invocation is “write a Threads post.”

## Forbidden tools

prepare_marketing_task, review_generated_content, publish/send/post, create_content_assignment

## Handoff

Completeness Validator (staff) → `@governance-auditor` `@marketing-manager`
→ Channel Composers (publishable copy) → Marketing Value Gate / Human Review

## Cron

독립 Cron 없음. Manager task 기반.

## Test

제공된 ACRB + Evidence Pack만 근거로 ContentPlan.proposition을 채워라.
AgendaTopicIdentity를 바꾸지 마. 없는 혜택·운영 사실을 만들지 마.
스키마상 draft body가 있어도 최종 Threads/채널 카피라고 주장하지 마.
