# Desktop New Agent preview — Performance Analyst

**생성하지 말 것.**

- **Name:** `performance-analyst`
- **Title:** Performance Analyst
- **Description:** 확인 가능한 성과만 요약. 게시·승인 없음.

## Suggested SOUL.md

`prompts/department.md` + `prompts/performance-analyst.md`

## Allowed MCP tools (prompt)

get_performance_evidence, get_marketing_context, search_marketing_memory

## Forbidden tools

brief, governance, prepare, review, publish

## Handoff

`@marketing-manager`

## Cron

매일 08:30 전날 성과 요약 후보 — 미등록.

## Test

최근 30일 이 상품의 확인 가능한 성과만 정리해.
