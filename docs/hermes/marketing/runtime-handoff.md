# Runtime handoff — Hermes v0.20.5

조사 결과 (설치된 CLI/source 기준, 추측 아님):

| Primitive | 역할 | 이번 STEP |
|---|---|---|
| `hermes -p <profile> -z` / `chat -q/--query-file` | 같은 머신의 named profile 실행 | **사용** (`HermesAgentRuntime`) |
| Bot Chat `-c "Bot Chat" --create-if-missing` | Desktop teammate DM | 지원됨, 오케스트레이터는 oneshot 사용 (session merge 없음) |
| `hermes kanban assign` | profile에 비동기 작업 배정, dispatch daemon 필요 | 미사용 |
| `hermes peer dm` | **다른 머신** gateway | 미사용 |
| `delegate_task` | 같은 프로세스 subagent | 다른 marketing profile이 아님 |
| `message_agent` | canonical Bot Chat 전용 | Telegram ingress에서는 사용하지 않음 |

**분류: application-level orchestration.** native profile-to-profile RPC는 없다.

- Content 파이프라인: `runDepartmentPipeline()` (`pipeline.ts`)
- Ingress-agnostic 부서 작업: `orchestrateDepartmentTask()` → MCP `run_department_orchestration`
- Profile 실행 어댑터: `HermesAgentRuntime` (`hermesRuntime.ts`), allowlist만, shell interpolation 없음

Telegram/Desktop은 ingress일 뿐이며 TheAllTour 마케팅 정책을 복제하지 않는다.

live:

```bash
npx tsx scripts/test-marketing-department-handoff.ts
```
