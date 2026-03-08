# Supabase SQL Archive

**목적:** 활성 source of truth 경로(`supabase/schema/baseline.sql` + `supabase/migrations/`) 밖으로 이동한 과거 SQL을 **이력·참조용**으로 보관하는 디렉터리입니다.

- **이 디렉터리의 SQL 파일은 실행 대상이 아닙니다.** reset/reapply 시 실행하지 마세요.
- **실제 적용 기준:** `supabase/schema/baseline.sql` → (선택) optional schema → `supabase/migrations/` 타임스탬프 순.
- 상세 분류·이유는 `docs/supabase-sql-inventory.md` § Archive 섹션을 참고하세요.

## 여기로 이동된 파일 (PR9 기준)

| 파일 | archive 이유 |
|------|--------------|
| `members_points_rewards.sql` | point_ledger(member_id/kind), reward_redemption(단수), pending_points 등 레거시 정의. baseline + migrations(Phase 2 정리)로 운영 기준에서 벗어남. |
| `reviews_rating_upgrade.sql` | reviews rating 컬럼 정의. baseline 및 reviews 관련 migration에 흡수됨. |
| `reviews_image_upgrade.sql` | reviews image_url/image_urls·storage bucket·정책. baseline 및 reviews migration에 흡수됨. |
| `products_featured_home.sql` | 이미 deprecated(주석 처리). 메인 추천은 home_curated 구조로 이전됨. |

## 주의

- **source of truth가 아닙니다.** 새 환경 구성 시 이 디렉터리의 SQL을 실행하지 마세요.
- 필요 시 **이력 추적·과거 스키마 참고**용으로만 사용하세요.
