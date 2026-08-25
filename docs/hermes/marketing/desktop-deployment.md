# Hermes Desktop Agent deployment (Pi)

Hermes Agent v0.20.4에서 Desktop **New Agent**는 SSH 대상의 `~/.hermes/profiles/<id>/` 를 만든다. 별도 DB INSERT가 아니다.

## 공식 생성 경로

지원되는 CLI (Desktop `profiles.create` RPC와 같은 primitive):

```bash
hermes profile create <id> --no-skills --description "..."
```

profile id 규칙: `[a-z0-9][a-z0-9_-]{0,63}` — kebab-case 허용.

`--clone` / 폴더 `cp -r`은 쓰지 않는다. `--no-skills`는 번들 `social-media` 등 게시 유혹 skill을 넣지 않기 위함이다.

Desktop Bot 목록에 보이려면 `profile.yaml`에 `ui_meta.hermes-bots` 블록이 필요하다. 이 블록이 있으면 Bot Mode가 "Bot Chat" 세션에 teammate 프로토콜을 주입한다.

## v1 profile id

| id | Display title |
|---|---|
| marketing-manager | Marketing Manager |
| content-strategist | Content Strategist |
| governance-auditor | Governance Auditor |
| performance-analyst | Performance Analyst |

Gateway는 **stopped** 로 둔다. 마케팅 Agent용 추가 Telegram gateway를 켜지 않는다.

## MCP

각 profile `config.yaml`의 `mcp_servers.thealltour-marketing`:

- url: `http://127.0.0.1:3000/api/internal/marketing/mcp`
- `tools.include`: skill matrix allowlist
- `trust: full` — 우리 localhost MCP. 전역 `~/.hermes/config.yaml`은 `untrusted` 유지
- Authorization은 env interpolation. SOUL에 token 금지

`hermes mcp test`는 서버가 노출한 6개를 보여 준다. Agent 실행 시의 실제 호출 범위는 `tools.include` + prompt다.

## Agent-to-Agent

v0.20.4에는 profile A가 profile B를 직접 부르는 native RPC가 없다.

실제 사용: application-level `runDepartmentPipeline` + `hermes -p <profile> -z`. 상세: [runtime-handoff.md](./runtime-handoff.md).

## Cron

STEP 2-4.8B에서 task-only Cron이 활성화됐다. 상세·수동 실행·pause/resume: [cron-plan.md](./cron-plan.md).
성과 수집 범위( SNS 직접 수집 없음 ): [performance-collection.md](./performance-collection.md).

## test1

참고용 profile. 자동 삭제하지 않는다. 필요하면 Desktop에서 수동 삭제.
