# Taxonomy 매핑 검증 체크리스트 (PR-TAX-4)

마이그레이션 및 수동 정리 후 아래 항목을 순서대로 확인한다.

---

## 1. 분류 축별 정리 여부

- [ ] **지역성 항목**이 `taxonomy_type = 'destination'`으로만 정리되었는가  
  - 예: 일본, 태국, 호주, 제주도, 베트남, 동남아, 유럽 등
- [ ] **테마성 항목**이 `taxonomy_type = 'theme'`으로만 정리되었는가  
  - 예: 가족여행, 럭셔리, 휴양, 벚꽃여행, 제철 등
- [ ] **상품군 항목**이 `taxonomy_type = 'product_line'`으로만 정리되었는가  
  - 예: 골프투어, 파크골프투어, 액티비티 등
- [ ] **운영 강조/기획 항목**이 `taxonomy_type = 'campaign'`으로만 정리되었는가  
  - 예: 마감임박, 추천, 시즌특가, 인기 등

---

## 2. 데이터 무결성

- [ ] **slug 중복**이 없는가  
  - 동일 `taxonomy_type` 내에서 동일한 slug를 쓰는 행이 없어야 함.  
  - `scripts/verify-taxonomy-mapping.ts`의 “중복 slug” 리포트 확인.
- [ ] **name 중복**이 의도된 것이 아닌 한 없는가  
  - 같은 `taxonomy_type`에 동일 name이 있으면 관리자 추가 시 409가 나올 수 있음.  
  - 검증 스크립트 “중복 name” 확인.
- [ ] **type / category_type**와 **taxonomy_type**이 충돌하는 항목이 없는가  
  - 예: `type='theme'`인데 `taxonomy_type='destination'`이면 안 됨.  
  - 검증 스크립트 “type vs taxonomy_type 불일치” 리포트 확인.

---

## 3. 노출 설정

- [ ] **허브 노출**(`is_hub_visible`)이 의도대로인가  
  - 지역 허브/헤더에 나와야 할 destination만 `is_hub_visible = true`  
  - 테마 허브/헤더에 나와야 할 theme만 `is_hub_visible = true`  
  - product_line / campaign은 허브에 안 나오는 것이 일반적(필요 시 예외 확인).
- [ ] **랜딩 공개**(`is_landing_enabled`)가 의도대로인가  
  - 상세 랜딩 페이지를 공개할 destination/theme만 `true`.  
  - 검증 스크립트 “랜딩 공개 대상 개수” 확인.

---

## 4. 허브·헤더 동작

- [ ] **`/destinations`** 에는 **destination**만 노출되는가  
  - 골프투어, 마감임박 등이 지역 허브에 뜨지 않아야 함.
- [ ] **`/themes`** 에는 **theme**만 노출되는가  
  - 일본, 태국 등 지역이 테마 허브에 뜨지 않아야 함.
- [ ] **헤더 hover(드롭다운)** 에서  
  - 지역 메뉴 = destination만  
  - 테마 메뉴 = theme만  
  인가?

---

## 5. 관리자 UI

- [ ] 관리자 **4탭**(지역/테마/상품군/기획·추천)에서  
  - 각 탭이 해당 `taxonomy_type`만 조회·표시하는가  
- [ ] 탭별로 **추가** 시 해당 `taxonomy_type`으로만 생성되는가  
- [ ] **랜딩 보기** 링크가 destination/theme에만 노출되고, product_line/campaign은 상품 보기만 노출되는가  

---

## 6. 검증 스크립트 실행

- [ ] `npm run taxonomy:verify` (또는 `npx tsx scripts/verify-taxonomy-mapping.ts`) 실행  
- [ ] **destination/theme/product_line/campaign 별 개수**가 예상과 맞는가  
- [ ] **중복 slug/name**, **type vs taxonomy_type 불일치** 항목이 0건이거나 모두 해소되었는가  

---

## 7. 문서

- [ ] `docs/taxonomy-migration-guide.md`를 기준으로 이후 운영자가 **분류 기준**을 이해할 수 있는가  
- [ ] 애매한 항목은 가이드의 “매핑 예시” 또는 “manual review” 결과를 반영해 문서에 추가했는가  
