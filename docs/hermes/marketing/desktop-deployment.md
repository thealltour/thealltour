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

v0.20.4 지원:

- Bot Chat teammate DM: `hermes -p <agent> chat -c "Bot Chat" --create-if-missing`
- Kanban이 profile에 작업을 배정
- `delegate_task`는 **같은 프로세스 subagent**이지 다른 profile이 아님

자동 부서 라우팅 DB는 없다. v1 live 검증은 Manager가 자신의 MCP 도구로 orchestration하는 방식이다.

## Cron

이 문서 범위에서 마케팅 Cron을 만들지 않는다. 계획은 [cron-plan.md](./cron-plan.md).

## test1

참고용 profile. 자동 삭제하지 않는다. 필요하면 Desktop에서 수동 삭제.
