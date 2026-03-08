# Taxonomy 데이터 마이그레이션 가이드 (PR-TAX-4)

## 1. 목적

- 기존 `type`(category/theme) + `category_type`으로 뒤섞여 있던 taxonomy 데이터를 **새 분류 축**(`taxonomy_type`: destination / theme / product_line / campaign)에 맞게 정리한다.
- **지역 탭에 상품군이 들어가 있거나, 테마 탭에 지역이 들어가 있는** 혼재를 해소한다.
- 이 문서는 “구조 개편”이 아니라 **실데이터 정리**에 초점을 둔다.

---

## 2. 분류 축 정의 및 매핑 기준

| taxonomy_type   | 의미                 | 매핑 기준 예시 |
|-----------------|----------------------|--------------------------------|
| **destination** | 지역/국가/권역       | 일본, 태국, 호주, 제주도, 베트남, 동남아, 유럽, 미국·남미 등 **지리적 목적지** |
| **theme**       | 여행 스타일/목적     | 가족여행, 럭셔리, 휴양, 벚꽃여행, 허니문, 프리미엄, 제철 등 **여행 목적·스타일** |
| **product_line**| 상품군/서비스 라인   | 골프투어, 파크골프투어, 액티비티 등 **상품 유형·라인** |
| **campaign**    | 운영 강조/기획전     | 마감임박, 추천, 시즌특가, 인기 등 **운영용 강조·기획** |
| **tag**         | 보조 메타(선택)      | 기타 자유 태그. 현재 운영에서 잘 쓰이지 않으면 비워 둠 |

### 2.1 판단 시 체크 포인트

- **destination**: “어디로 가는 상품인가?” → 국가·지역명이면 destination.
- **theme**: “어떤 목적/스타일인가?” → 가족, 럭셔리, 휴양, 제철 등 목적지가 아닌 개념이면 theme.
- **product_line**: “어떤 상품 유형인가?” → 골프투어, 액티비티처럼 상품군 이름이면 product_line.
- **campaign**: “운영자가 강조/기획용으로 쓰는가?” → 마감임박, 추천, 인기, 시즌특가 등이면 campaign.

---

## 3. 매핑 예시

### 3.1 destination (지역)

- **일본**, **태국**, **호주**, **제주도**, **베트남**, **동남아**, **유럽**, **미국·남미**, **인도네시아**, **남미** 등  
  → 모두 **destination**
- 시드/기존 데이터 예: `지역별`은 **범주 레이블**에 가깝이므로, 실제 “지역” 항목이 아니면 **삭제 또는 campaign/tag로 재분류** 검토.

### 3.2 theme (테마)

- **가족여행**, **럭셔리**, **휴양**, **벚꽃여행**, **허니문**, **프리미엄**, **단체/동호회**, **제철** 등  
  → **theme**
- 시드 예: `제철`, `인기`  
  - `제철` → **theme** (제철 여행 스타일)  
  - `인기` → **campaign** (운영 강조용)

### 3.3 product_line (상품군)

- **골프투어**, **파크골프투어**, **액티비티** 등  
  → **product_line**
- 시드 예: `액티비티`, `제철여행지`  
  - `액티비티` → **product_line**  
  - `제철여행지` → **theme** 또는 **campaign** 중 운영 의도에 맞게 선택 (제철 “여행지”는 지역처럼 보이지만, 실제로는 “제철 테마”에 가까우면 theme).

### 3.4 campaign (기획/추천)

- **마감임박**, **추천**, **시즌특가**, **인기** 등  
  → **campaign**
- 시드 예: `마감임박` → **campaign**

---

## 4. 현재 시드/관리자 데이터 기준 정리 예시

초기 시드(`product_taxonomies.sql`) 및 마이그레이션 전 관리자 화면 기준 예시는 아래와 같이 정리할 수 있다.

| 기존 name     | 기존 type   | 제안 taxonomy_type | 비고 |
|---------------|-------------|--------------------|------|
| 지역별        | category    | (삭제 또는 campaign) | 범주 레이블. 실제 지역이 아니면 정리 대상 |
| 액티비티      | category    | **product_line**   | 상품군 |
| 제철여행지    | category    | **theme** 또는 campaign | 제철 테마에 가깝다면 theme |
| 제철          | theme       | **theme**          | 여행 스타일 |
| 인기          | theme       | **campaign**       | 운영 강조 |
| 마감임박      | theme       | **campaign**       | 운영 강조 |
| 일본, 태국 등 | category    | **destination**    | 지역 |
| 골프투어 등   | category    | **product_line**   | 상품군 |
| 가족여행 등   | theme       | **theme**          | 테마 |

실제 운영 DB에 따라 이름이 다를 수 있으므로, **관리자 화면 스크린샷 또는 DB 조회 결과를 기준으로** 위 표를 확장해 사용하는 것을 권장한다.

---

## 5. 마이그레이션 스크립트 사용

### 5.1 자동 재분류 (명확한 항목)

- `scripts/migrate-taxonomies.ts`  
  - **이름 기반**으로 명확한 항목을 자동 매핑한다.  
  - 예: `골프투어`, `파크골프투어`, `액티비티` → product_line, `마감임박` → campaign, `일본`, `태국`, `제주도`, `호주`, `베트남` → destination.  
  - **기본은 dry-run**이다. 실제 DB 반영 시에는 `--apply` 옵션 사용.

### 5.2 애매한 항목 (manual review)

- 스크립트가 자동 매핑하지 못한 항목은 **콘솔에 “manual review” 리스트**로 출력한다.  
- 해당 항목은 `docs/taxonomy-mapping-checklist.md`와 이 가이드의 매핑 기준을 보고 관리자 UI 또는 SQL로 수동 재분류한다.

### 5.3 실행 방법

- 환경 변수: `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY` (또는 서버용 `SUPABASE_SERVICE_ROLE_KEY`) 필요.  
- npm 스크립트 (권장):
  - **검증**: `npm run taxonomy:verify`
  - **마이그레이션 dry-run**: `npm run taxonomy:migrate`
  - **마이그레이션 적용**: `npm run taxonomy:migrate:apply`
- 또는 직접: `npx tsx scripts/migrate-taxonomies.ts` (dry-run), `npx tsx scripts/migrate-taxonomies.ts --apply` (실제 반영).

---

## 6. 검증 스크립트

- `scripts/verify-taxonomy-mapping.ts`  
  - **destination / theme / product_line / campaign** 별 개수  
  - **slug·name 중복** (타입 내)  
  - **허브 노출·랜딩 공개** 대상 개수  
  - **type·category_type vs taxonomy_type** 불일치 리포트  

실행 예: `npm run taxonomy:verify` 또는 `npx tsx scripts/verify-taxonomy-mapping.ts`

---

## 7. 운영 데이터 정리 후 허브 페이지 재검증

- **`/destinations`**: `taxonomy_type = 'destination'` 항목만 노출되는지 확인.  
  - “골프투어” 같은 상품군이 지역 허브에 뜨지 않아야 한다.
- **`/themes`**: `taxonomy_type = 'theme'` 항목만 노출되는지 확인.  
  - “일본”, “태국” 같은 지역이 테마 허브에 뜨지 않아야 한다.
- **헤더 hover(드롭다운)**: 지역 메뉴에는 destination만, 테마 메뉴에는 theme만 나오는지 확인.

이 검증은 `docs/taxonomy-mapping-checklist.md`의 “허브 페이지 재검증” 섹션과 함께 점검하면 된다.
