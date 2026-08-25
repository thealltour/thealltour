# Cron plan — STEP 2-4.8B (activated)

Hermes Agent **v0.20.4** 기준. Cron은 **분석 및 작업 준비 전용**이다. **SNS에 게시하지 않는다.**

## Timezone

| 항목 | 값 |
|---|---|
| system | `Asia/Seoul` (KST, +0900) |
| `hermes config timezone` | 비어 있음 → **server-local** = Asia/Seoul |
| schedule | `30 8 * * *` / `0 9 * * *` → **08:30 / 09:00 KST** (UTC로 등록하지 않음) |

## Jobs

### 1) AI Marketing - Daily Performance

| 필드 | 값 |
|---|---|
| profile pin | `hermes -p performance-analyst cron create ...` (CLI create 서브커맨드에 `--profile` 플래그 없음; **글로벌 `-p`로 profile HERMES_HOME에 저장**) |
| schedule | `30 8 * * *` |
| deliver | `local` |
| mode | `--no-agent --script daily-performance-brief.sh` |
| purpose | 전날(Asia/Seoul) 확인 가능한 DB 성과만 brief로 저장 |

Prompt/script 안전 규칙 (스크립트 주석 + 출력 계약):

- DO NOT: publish / post / send SNS / delete / archive / auto approve / override governance / invent metrics / modify production DB / create additional cron jobs
- SNS side effect = 0
- `ai_memory` INSERT 없음

### 2) AI Marketing - Daily Plan

| 필드 | 값 |
|---|---|
| profile pin | `hermes -p marketing-manager cron create ...` |
| schedule | `0 9 * * *` |
| deliver | `local` |
| mode | `--no-agent --script daily-marketing-plan.sh` |
| purpose | latest Performance Brief + `runDepartmentPipeline()` → draft + governance → Human Owner용 결과 |

최종 상태:

- ALLOW → `publish_ready` (게시 없음)
- REVIEW → `approval_pending`
- BLOCK → `revision_required`

## Performance handoff (08:30 → 09:00)

| 방식 | 사용 |
|---|---|
| 로컬 artifact (atomic JSON, 최신 1건) | **사용** — `data/marketing/cron/latest-performance-brief.json` |
| Hermes cron notepad | 미사용 (cross-job + cross-profile에 부적합) |
| `context_from` | CLI create에 플래그 없음 → 미사용 |
| `ai_memory` INSERT | **금지** |
| DB migration | **금지** |

Manager fallback: artifact 없거나 `dataAvailability=unavailable`이면 **상품/Context/Memory 근거 중심**으로 pipeline 계속. Job 자체는 실패하지 않는다.

## Tool scope

| Job | 방식 |
|---|---|
| Performance | `--no-agent` 스크립트가 read-only DB path만 사용 (LLM/toolset 없음). MCP publish 없음 |
| Manager | `--no-agent` + `runDepartmentPipeline` + `hermes -p content-strategist|governance-auditor`. per-job `enabled_toolsets`는 **CLI create에 없음** → 가짜 설정 추가하지 않음 |

## Human Owner delivery

- delivery: **local** (이번 STEP에서 Telegram 신규 연결 없음)
- 확인: `hermes -p <profile> cron list|status|runs <job_id>`
- Desktop: 해당 profile의 cron/history (gateway local output)
- 실제 SNS 게시 버튼/동작 없음

## Manual run

```bash
hermes -p performance-analyst cron run <job_id>
hermes -p marketing-manager cron run <job_id>
```

또는 repo에서:

```bash
npx tsx scripts/cron-daily-performance-brief.ts
npx tsx scripts/cron-daily-marketing-plan.ts
```

## Pause / resume / remove

```bash
hermes -p performance-analyst cron pause <job_id>
hermes -p performance-analyst cron resume <job_id>
hermes -p performance-analyst cron remove <job_id>
# Manager 동일: hermes -p marketing-manager ...
```

기존 다른 Cron을 임의 삭제/수정하지 말 것. 동일 이름 job이 있으면 새로 만들지 말 것.

## Runtime scripts (Hermes home)

- `~/.hermes/profiles/performance-analyst/scripts/daily-performance-brief.sh`
- `~/.hermes/profiles/marketing-manager/scripts/daily-marketing-plan.sh`

→ `/home/ysh/thealltour`에서 `npx tsx scripts/cron-daily-*.ts` 실행.

## Auto-fire 주의 (multiplex)

Jobs는 **profile-local** `jobs.json`에 저장된다. 기본 `hermes.service` gateway는 기본적으로 **default profile cron만** tick한다.

자동 스케줄 실행을 위해 default `~/.hermes/config.yaml`에 다음이 설정됐다:

```yaml
gateway:
  multiplex_profiles: true
```

**gateway 프로세스가 이 설정을 로드하려면 `hermes.service` 재시작이 필요하다.**  
이 환경에서는 sudo 비밀번호가 없어 재시작을 완료하지 못했다. Human Owner가 한 번 실행:

```bash
sudo systemctl restart hermes.service
hermes -p performance-analyst cron status
hermes -p marketing-manager cron status
```

재시작 전에는 `hermes -p <profile> cron run <job_id>` 수동 실행은 정상 동작한다.

## Related

- [performance-collection.md](./performance-collection.md)
- [runtime-handoff.md](./runtime-handoff.md)
- [human-approval.md](./human-approval.md)
