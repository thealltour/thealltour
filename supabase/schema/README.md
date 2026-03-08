# Supabase Schema (Baseline)

이 디렉터리는 **앱이 기대하는 최종 스키마**를 “기준본(제안)”으로 두기 위한 파일들을 담습니다.  
기존 `supabase/*.sql` 루트 파일 및 `supabase/migrations/*.sql` 을 대체하지 않으며, **source of truth 제안본** 역할만 합니다.

---

## 1. baseline.sql 의 목적

- **새 환경에서 DB를 0부터 재현**할 때 참고하는 단일 스키마 정의 파일입니다.
- 앱이 사용하는 테이블·컬럼·인덱스·RLS·trigger 등을 **최종 목표 상태**로 한 번에 표현합니다.
- **destructive 변경(drop table / drop column 등)은 포함하지 않습니다.**  
  기존 DB에 적용할 때는 PR4에서 신규 migration으로 정합성만 보정합니다.

---

## 2. baseline.sql 과 기존 루트 SQL / migration의 관계

- **기존 파일을 대체하지 않습니다.**  
  루트 SQL(`supabase/*.sql`)과 `supabase/migrations/*.sql` 은 그대로 두고, 이 baseline은 “이렇게 있으면 좋다”는 제안본입니다.
- **적용 순서:**
  - **신규 프로젝트/빈 DB:** baseline.sql 적용 후, 필요 시 기존 migrations를 순서대로 적용하거나, baseline만으로 동작 검증.
  - **이미 루트 SQL + migrations로 구성된 환경:** 기존 흐름을 그대로 따르고, baseline은 “목표 스키마 참고용”으로만 사용.
- RLS 정책명·정책 내용이 기존 루트 SQL 또는 migration과 완전히 같지 않을 수 있습니다.  
  기존 정책이 있다면 해당 정책을 우선하도록 하고, baseline의 정책은 “최소 동작용” 참고로만 사용하세요.

---

## 3. optional_recommended_search_keywords.sql 의 목적

- **repo 밖에서 생성되었을 가능성이 있는** `public.recommended_search_keywords` 테이블을 source of truth 범위 안으로 넣기 위한 **선택 적용** 스키마 파일입니다.
- baseline 본문에는 넣지 않고, 이 파일만 별도로 두었습니다.  
  적용 여부는 팀/환경에 따라 선택하며, reset-guide에서 “선택 적용”으로 안내합니다.

---

## 4. 어떤 경우 baseline을 사용하고, 어떤 경우 기존 migration 흐름을 따를지

| 상황 | 권장 |
|------|------|
| 새 Supabase 프로젝트를 만들고 스키마를 한 번에 세우고 싶을 때 | `baseline.sql` 적용 후, 필요 시 기존 migrations 중 “이미 반영된 부분”을 제외하고 나머지만 적용. 또는 baseline만 적용 후 앱 동작 검증. |
| 이미 루트 SQL + migrations로 운영 중인 환경 | **기존 migration 흐름 유지.** baseline은 수정하지 않고 “목표 스키마 문서”로만 참고. |
| 로컬에서 완전 reset 후 재적용 | `docs/supabase-reset-guide.md` 참고. baseline 적용 순서와 migration 적용 순서를 따름. |

---

## 5. PR4에서 정합성 migration이 필요한 이유

- baseline은 **“목표 상태”**만 정의합니다.  
  이미 존재하는 DB에는 **member_id만 있는 point_ledger**, **reward_redemption 단수 테이블만 있는 경우** 등이 있을 수 있어, baseline을 그대로 실행해도 기존 데이터/스키마와 충돌할 수 있습니다.
- PR4에서는 **기존 테이블을 drop하지 않고**,  
  `add column user_id`, `update ... set user_id = member_id`,  
  reward_redemptions로의 데이터 이전 또는 `create view reward_redemption as select ... from reward_redemptions` 등  
  **비파괴적 정합성 보정**만 수행합니다.  
  drop column / drop table 은 Phase 2에서만 검토합니다.

---

## 6. destructive change는 포함하지 않았다는 점

- baseline.sql 안에는 **drop table**, **drop column**, **alter table ... drop** 등 **파괴적 SQL이 없습니다.**
- `drop policy if exists ... create policy ...` 는 정책 교체를 위한 것이며, 테이블/컬럼 삭제가 아닙니다.

---

## 7. 아직 확인이 필요한 객체 목록

- **public.products**  
  루트에 `products_safe_upgrade.sql` 외 다수의 `products_*_upgrade.sql` 이 있어, 실제 운영 DB에는 컬럼이 더 많을 수 있습니다.  
  baseline에는 최소 필수 컬럼만 넣었습니다. 나머지 컬럼은 기존 migration/루트 SQL 적용 이력에 따릅니다.
- **public.members**  
  `members_points_upgrade.sql`, `members_reviews_admin_policies.sql` 등으로 확장될 수 있습니다.  
  baseline에는 point_balance, point_pending, grade_id, marketing_opt_in, points 까지 포함했습니다.
- **RLS 정책명**  
  기존 루트 SQL·migration과 정책명이 다를 수 있습니다.  
  동일 정책명이 필수인 배포 스크립트가 있다면, baseline 적용 후 해당 정책을 추가로 적용하거나 README/배포 문서에 정리해 두세요.
- **public.pending_points**  
  레거시 보류. baseline 본문에 포함하지 않았습니다.  
  migration 20250304에서 drop 대상이지만, members_points_rewards만 적용된 환경에서는 여전히 존재할 수 있으므로, 필요 시 별도 확인 후 처리합니다.
