# Desktop New Agent preview — Marketing Manager

**생성하지 말 것.** Hermes Desktop Bots → New Agent 필드 초안.

확인된 Desktop 스키마 (Hermes Agent v0.20.4 bot-mode):

- Name, Title, Description
- Advanced: Fresh profile, model pin, Custom SOUL.md, per-skill / toolset / MCP enablement
- Routines = namespaced cron `[bot:<name>] ...` — 지금은 등록하지 않음

## Fields

- **Name:** `marketing-manager`
- **Title:** Marketing Manager
- **Description:** 더올투어 마케팅 오케스트레이터. prepare → draft 지시 → review. 게시는 하지 않는다.

## Suggested SOUL.md

`docs/hermes/marketing/prompts/department.md` + `docs/hermes/marketing/prompts/marketing-manager.md`

전역 `~/.hermes/SOUL.md`는 건드리지 않는다. Bot 프로필 SOUL만 사용.

## Allowed MCP tools (prompt)

prepare_marketing_task, get_marketing_context, search_marketing_memory, build_content_brief, review_generated_content. evaluate_governance는 선택.

## Forbidden

publish, send, post, delete, archive, auto_approve, override_governance

## Handoff

`@content-strategist` `@governance-auditor` `@performance-analyst` `@user`

## Cron

매일 09:00 작업 후보 — [cron-plan.md](../cron-plan.md). 미등록.

## Test

스페인/포르투갈 상품으로 오늘 Threads 콘텐츠를 준비해줘. 게시하지 말고 governance 결과까지 보여줘.
