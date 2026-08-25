# Performance collection architecture

## Current (STEP 2-4.8B)

Performance Analyst는 **SNS에 직접 로그인/접속해서 metric을 수집하지 않는다.**

```
Existing DB / analytics data
  → PerformanceMemorySource / metric count sources
  → Daily Performance Brief artifact
  → Performance Analyst Cron (08:30) / Manager Cron (09:00)
```

확인에 사용하는 source (존재하는 데이터만):

- `ai_publications`
- `ai_feedback`
- `analytics_events`
- `thread_marketing_posts`
- `inquiries`
- `travel_bookings`
- marketing context / `ai_memory` (read-only; Cron이 임의 INSERT하지 않음)

없는 SNS metric은 추측하지 않는다. 예:

- Instagram impressions 없음 → 데이터 없음
- Threads engagement API 없음 → 데이터 없음
- 문의 3건 확인 → 문의 3건

`dataAvailability`: `available` | `partial` | `unavailable`

브라우저 자동화를 성과 수집 기본 수단으로 쓰지 않는다.

## Future (STEP 3+)

```
Official SNS APIs
  → Performance Collector (별도 adapter / permission)
  → normalized performance storage
  → PerformanceMemorySource
  → Performance Analyst
```

Publication API와 Performance Collection API는 **별도 adapter/permission**으로 설계한다.

- Publishing adapter: 게시 (Human Approval 후, 채널별 가능 여부)
- Performance collector: insights/metrics read

계약 경계(STEP 3-1): [sns-integration-architecture.md](./sns-integration-architecture.md).  
채널별 공식 Publishing / Insights API 가능 여부(STEP 3-2): [sns-capability-matrix.md](./sns-capability-matrix.md).
