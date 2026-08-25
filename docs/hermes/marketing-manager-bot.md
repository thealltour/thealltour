# Marketing Manager Bot — Hermes 적용 미리보기 (STEP 2-3)

이 문서는 STEP 2-3 MCP 미리보다. 조직 source of truth는 [marketing/README.md](./marketing/README.md)다.

이 문서는 **적용하지 않은** 미리보기입니다. Hermes Gateway를 재시작하거나 Bot을 enable 하지 마세요.

확인된 실행 환경 (Raspberry Pi, 2026-08-25):

- Hermes Agent v0.20.4
- `HERMES_HOME=/home/ysh/.hermes`
- 활성 config: `/home/ysh/.hermes/config.yaml`
- systemd: `/etc/systemd/system/hermes.service` (Telegram gateway + dashboard 9119)
- 이 설치에는 `bots/` 레지스트리와 `hermes bot` CLI가 **없음**
- 외부 함수 등록의 정식 경로는 **MCP** (`hermes mcp add` / `config.yaml` `mcp_servers`)
- MCP `thealltour-marketing`은 STEP 2-4에서 수동 등록됨 (이 STEP에서는 config를 다시 건드리지 않음)
- Native Python tool / Hermes core 수정은 하지 않음

thealltour 쪽 구현:

- server-only tool: `src/lib/marketing/bot/`
- 내부 HTTP (Bearer `MARKETING_BOT_INTERNAL_TOKEN`, `NEXT_PUBLIC` 아님)
  - `POST /api/internal/marketing/context`
  - `POST /api/internal/marketing/memory/search`
  - `POST /api/internal/marketing/brief`
  - `POST /api/internal/marketing/governance`
  - `POST /api/internal/marketing/prepare`
  - `POST /api/internal/marketing/review`
  - `POST /api/internal/marketing/mcp` (JSON-RPC, `readOnlyHint: true`, publish tool 없음)
- role contract: `src/lib/marketing/bot/contracts/`

## 적용 전 체크리스트

1. Next.js가 Pi에서 내부 요청을 받을 수 있는지 확인 (로컬/Tailscale). 공개 인터넷에 내부 라우트를 열지 말 것.
2. `.env.local`에 `MARKETING_BOT_INTERNAL_TOKEN` 설정. `NEXT_PUBLIC_*`로 넣지 말 것.
3. Hermes `.env`에도 같은 토큰을 넣고, MCP header에서 `${MARKETING_BOT_INTERNAL_TOKEN}`로 참조.
4. 실제 SNS 게시 tool이 없는지 MCP `tools/list`로 확인.
5. `prepare` → (Hermes가 초안 작성) → `review` 순서를 어기지 말 것.
6. Gateway restart / `/reload-mcp`는 사용자가 수동으로 수행.

## STEP 2-4에서 수동 등록할 명령 (지금은 실행하지 않음)

Next.js origin 예: `http://127.0.0.1:3000`

```bash
hermes mcp add thealltour-marketing \
  --url http://127.0.0.1:3000/api/internal/marketing/mcp \
  --auth header
```

또는 `~/.hermes/config.yaml`에 `docs/hermes/examples/config.mcp.thealltour-marketing.yaml` 내용을 붙인다.

`skip_preflight: true` 를 권장한다. 이 MCP는 Streamable HTTP SSE가 아니라 JSON-RPC POST다.

등록 후:

```bash
# 사용자가 필요하면
# hermes gateway restart
# 또는 세션에서 /reload-mcp
```

Marketing Manager 페르소나:

- 가벼운 방법: `agent.personalities.marketing_manager`에 `docs/hermes/marketing/prompts/marketing-manager.md` 내용을 넣는다.
- 전역 SOUL.md를 바꾸지 않는 것을 권장한다.
- 부서 4역할: [marketing/README.md](./marketing/README.md). Desktop New Agent는 아직 생성하지 않는다.

Content Strategist / Governance Auditor / Performance Analyst contract는 `src/lib/marketing/bot/contracts/`에 있다. 별도 Hermes Bot 등록은 하지 않는다.

## 운영 Bot enable 금지

이번 STEP에서 Telegram/SOUL/MCP를 자동 변경하지 않았다.
