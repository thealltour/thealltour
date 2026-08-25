# Cron plan (design only)

**실제 등록하지 않는다.** Hermes Desktop Routines / `hermes cron`에 넣지 말 것.

## 원칙

Cron은 publish하지 않는다.

흐름: task 생성 → draft → governance → `publish_ready` 또는 `approval_pending`에서 정지.

REVIEW/BLOCK 우회 금지. `autoPublishAllowed = false`.

## 후보

| Agent | 후보 시각 | 하는 일 | 하지 않는 일 |
|---|---|---|---|
| Performance Analyst | 매일 08:30 | 전날 확인 가능한 성과 요약 → Manager | 게시, 승인 |
| Marketing Manager | 매일 09:00 | 오늘의 마케팅 작업 후보 생성 | 게시 |
| Content Strategist | 없음 | Manager task 기반 실행 | 독립 Cron |
| Governance Auditor | 없음 | event/task 기반 실행 | 독립 Cron |

## 활성화 전 체크리스트 (미래)

1. thealltour 상시 runtime
2. MCP tools/list에 publish 없음
3. Desktop Agent 4개가 prompt/skill matrix대로 생성됨
4. Human Approval 경로가 사람 눈에 보임
5. Cron prompt에 “게시 금지”가 명시됨
6. 이 문서를 읽은 사람이 수동으로만 등록
