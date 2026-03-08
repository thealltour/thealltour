# product_taxonomies 테이블 — 관리 화면 수정/삭제용 SQL

카테고리/테마 관리 화면에서 **수정 저장**·**삭제**가 500 에러 없이 동작하려면, Supabase에 아래 SQL을 **순서대로** 적용해야 합니다.

## 1. 적용 방법 요약

**아니요, 전부 수동으로 돌릴 필요는 없습니다.**

| 방법 | 설명 |
|------|------|
| **Supabase CLI** | 프로젝트를 `supabase link`로 연결한 뒤 `supabase db push` 한 번이면 **migrations 폴더 전체**가 타임스탬프 순으로 자동 적용됩니다. |
| **수동** | CLI를 쓰지 않으면 **Dashboard SQL Editor**에서 각 파일을 **파일명(타임스탬프) 순서대로** 열어서 실행해야 합니다. |

이 프로젝트에서는 reset 가이드(`docs/supabase-reset-guide.md`)대로 **baseline.sql → (선택) optional → migrations 순**으로 적용하는 것을 권장합니다.  
**product_taxonomies만** 빠져 있어서 500이 나는 경우에는, 아래 §2의 4개만 순서대로 실행하면 됩니다.

---

## 2. product_taxonomies용 최소 적용 순서 (일부만 안 되어 있을 때)

| 순서 | 파일 | 설명 |
|------|------|------|
| 1 | `supabase/product_taxonomies.sql` | 테이블 생성 + RLS 정책(anon select/insert/update/delete) |
| 2 | `supabase/product_taxonomies_slug_migration.sql` | `slug` 컬럼 추가 (없을 때만) |
| 3 | `supabase/migrations/20260316000000_pr1_hub_landing_taxonomy.sql` | `category_type`, `is_hub_visible`, `is_landing_enabled` 추가 |
| 4 | `supabase/migrations/20260318000000_add_taxonomy_type.sql` | `taxonomy_type` 추가 및 인덱스 |

---

## 3. 적용 방법 (상세)

### 옵션 A: Supabase CLI로 migrations 한 번에 적용

자세한 설치·연결 절차는 **`docs/supabase-cli-setup.md`** 를 참고하세요.

```bash
# 프로젝트 루트에서 (최초 1회: 프로젝트 연결)
npx supabase link --project-ref <프로젝트 ref>

# migrations 폴더 전체를 타임스탬프 순으로 원격 DB에 적용
npx supabase db push
```

- `db push`는 **아직 적용되지 않은** migration만 실행합니다.  
- **루트 SQL**(`product_taxonomies.sql`, `product_taxonomies_slug_migration.sql`)은 migrations에 없으므로, 테이블이 아직 없다면 §2의 1·2번을 SQL Editor에서 먼저 실행한 뒤 `db push` 하거나, baseline을 이미 적용했다면 `db push`만 해도 됩니다.

### 옵션 B: 수동 실행 (CLI 미사용 시)

1. **Supabase Dashboard → SQL Editor** 이동.
2. §2 표의 **1번 → 2번 → 3번 → 4번** 순서대로 각 파일 내용을 복사해 붙여 넣고 실행.

또는 **전체 스키마를 처음부터 맞추고 싶다면** `docs/supabase-reset-guide.md`의 §5를 따라 **baseline.sql → optional(필요 시) → migrations 타임스탬프 순**으로 실행하면 됩니다.  
이때 **migrations는 파일명(타임스탬프) 순서대로 전부** 실행해야 하며, CLI를 쓰지 않으면 각 파일을 수동으로 열어서 실행하는 방식입니다.

---

## 4. 누락 시 증상

- **`taxonomy_type` 컬럼 없음** → 목록 조회는 될 수 있으나, 수정 시 **500** (예: `column "taxonomy_type" does not exist`)
- **`is_hub_visible` / `is_landing_enabled` 없음** → 수정 시 500
- **RLS 정책 없음** → anon으로 조회 실패 시 404/500

## 5. 500 에러 시 확인

브라우저 개발자 도구 → **Network** → 해당 PATCH/DELETE 요청 클릭 → **Response** 탭에서 JSON의 `message` 필드를 확인하세요.  
Supabase/Postgres 에러 메시지(예: `column "taxonomy_type" does not exist`)가 그대로 나오면, §2 순서대로 SQL을 적용하면 됩니다.
