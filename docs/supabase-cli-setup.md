# Supabase CLI 사용 가이드

Supabase CLI로 **원격(호스팅) 프로젝트**에 마이그레이션을 적용하는 절차입니다.

---

## 1. 설치

### Windows (Scoop)

```powershell
scoop bucket add supabase https://github.com/supabase/scoop-bucket.git
scoop install supabase
```

### npm (Windows/macOS/Linux 공통)

Node.js 20 이상 필요합니다.

```bash
npm install supabase --save-dev
```

이후 명령은 `npx supabase ...` 로 실행합니다.

### macOS (Homebrew)

```bash
brew install supabase/tap/supabase
```

---

## 2. 로그인

Supabase 대시보드 계정으로 로그인합니다.

```bash
npx supabase login
```

브라우저가 열리면 로그인/토큰 허용 후 터미널로 돌아옵니다.

---

## 3. 프로젝트 연결(link)

로컬 `supabase` 폴더를 **원격 Supabase 프로젝트**와 연결합니다.

### project-ref 확인

- [Supabase Dashboard](https://supabase.com/dashboard) 접속 → 사용할 프로젝트 선택
- 주소창 URL: `https://supabase.com/dashboard/project/여기부분이-project-ref`
- 예: `https://supabase.com/dashboard/project/qmswixmwquuazrhfyils` → project-ref는 `qmswixmwquuazrhfyils`

### config.toml이 없을 때 (최초 1회)

이미 `supabase` 폴더와 `supabase/migrations`가 있다면, **config만 추가**하려면:

```bash
cd c:\Users\aeeni\Desktop\thealltour-1
npx supabase init
```

기존 `supabase` 폴더가 있으면 `config.toml` 등만 생성되고, 기존 `migrations` 폴더는 유지됩니다.

### 연결 실행

```bash
npx supabase link --project-ref <project-ref>
```

예:

```bash
npx supabase link --project-ref qmswixmwquuazrhfyils
```

DB 비밀번호를 물어보면, Supabase Dashboard **Settings → Database** 에서 확인한 **Database password**를 입력합니다. (처음 프로젝트 생성 시 설정한 비밀번호)

---

## 4. 마이그레이션 적용 (db push)

연결이 끝났으면, 로컬 `supabase/migrations/` 안의 SQL을 **타임스탬프 순**으로 원격 DB에 적용합니다.

```bash
npx supabase db push
```

- **이미 적용된 migration은 자동으로 건너뜁니다.** (원격의 `supabase_migrations.schema_migrations` 테이블로 판단)
- 처음 실행 시 이 테이블이 생성되고, 적용된 migration 목록이 기록됩니다.

---

## 5. 주의사항

### db push가 적용하는 것

- **`supabase/migrations/*.sql`** 만 적용됩니다.
- **루트 SQL**(`supabase/product_taxonomies.sql`, `supabase/product_taxonomies_slug_migration.sql` 등)은 **migrations에 없으므로** `db push`로는 적용되지 않습니다.

### 원격 DB가 비어 있는 경우

- 이 프로젝트는 **baseline** + **migrations** 순서를 권장합니다. (`docs/supabase-reset-guide.md` 참고)
- 원격에 테이블이 전혀 없다면, 먼저 **Supabase Dashboard → SQL Editor**에서 `supabase/schema/baseline.sql`을 실행한 뒤 `db push`를 실행하세요.
- **product_taxonomies만** 필요하면 `docs/product-taxonomies-sql-setup.md` §2의 1·2번(루트 SQL)을 SQL Editor로 실행한 뒤 `db push` 하면, migrations에 있는 taxonomy 관련 마이그레이션이 적용됩니다.

### 요약

| 목적 | 방법 |
|------|------|
| migrations 폴더 전체를 원격에 반영 | `npx supabase link` 후 `npx supabase db push` |
| product_taxonomies 테이블·컬럼만 맞추기 | 루트 SQL 2개 수동 실행 후 `db push` (또는 §2 4개 전부 수동) |

---

## 6. 자주 쓰는 명령

| 명령 | 설명 |
|------|------|
| `npx supabase login` | 대시보드 계정 로그인 |
| `npx supabase link --project-ref <ref>` | 원격 프로젝트 연결 |
| `npx supabase db push` | 로컬 migrations를 원격에 적용 |
| `npx supabase db pull` | 원격 스키마를 로컬로 가져오기 (migration 파일 생성) |
| `npx supabase status` | 연결된 프로젝트 정보 확인 |

연결 정보는 `supabase/.temp/` 등에 저장되며, 팀원은 각자 `supabase link`를 한 번씩 실행하면 됩니다.
