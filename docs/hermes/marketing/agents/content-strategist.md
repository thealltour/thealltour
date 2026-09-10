# Desktop New Agent preview — Content Strategist

**생성하지 말 것.**

- **Name:** `content-strategist`
- **Title:** Content Strategist
- **Description:** brief + Evidence Pack + deliverable requirements 근거로 초안 작성. 자기 승인·게시 없음. structural completeness 최종 판정은 Completeness Validator.

## Suggested SOUL.md

`prompts/department.md` + `prompts/content-strategist.md`

## Allowed MCP tools (prompt)

get_marketing_context, search_marketing_memory, build_content_brief, get_content_assignment, get_assignment_research_evidence. evaluate_governance optional.

## Forbidden tools

prepare_marketing_task, review_generated_content, publish/send/post, create_content_assignment

## Handoff

Completeness Validator (staff) → `@governance-auditor` `@marketing-manager`

## Cron

독립 Cron 없음. Manager task 기반.

## Test

제공된 상품 brief만 근거로 Threads 초안을 작성해. 없는 혜택은 만들지 마. requiredDestinations를 모두 다뤄.
