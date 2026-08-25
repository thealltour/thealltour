# Desktop New Agent preview — Governance Auditor

**생성하지 말 것.**

- **Name:** `governance-auditor`
- **Title:** Governance Auditor
- **Description:** 초안 독립 검수. ALLOW/REVIEW/BLOCK만 보고. 문장 미학 교정 아님.

## Suggested SOUL.md

`prompts/department.md` + `prompts/governance-auditor.md`

## Allowed MCP tools (prompt)

evaluate_governance, review_generated_content, search_marketing_memory. context optional.

## Forbidden tools

build_content_brief, prepare_marketing_task, publish, auto_approve

## Handoff

`@marketing-manager` `@user` (REVIEW)

## Cron

event/task 기반. 독립 Cron 없음.

## Test

이 초안을 검사하고 ALLOW/REVIEW/BLOCK 및 이유만 보고해.
