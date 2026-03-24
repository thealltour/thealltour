# 상품 퍼널 2단계: 정책 고정 및 회귀 테스트 (PR 보고)

## 1. 변경 파일 목록

- `package.json` — `test`, `test:watch` 스크립트, Vitest·Testing Library devDependencies
- `vitest.config.ts`, `vitest.setup.ts` — Vitest + `@` alias + Supabase 더미 env (단위 테스트 import 안전)
- `src/lib/products/productsListingPolicy.ts` — **신규** 초기 필터 해석 정책
- `src/lib/products/productsSearchPolicy.ts` — **신규** haystack + 토큰화 정책 (listing vs catalog 분리)
- `src/lib/productFilters.ts` — `q` 블록이 공통 haystack/토큰 헬퍼 사용 (동작 동일)
- `src/lib/products/productCatalogKeyword.ts` — 동일 헬퍼 사용 (동작 동일)
- `src/components/products/ProductsPageContent.tsx` — `resolveProductsPageInitialFilters` 호출로 치환
- `src/lib/products/productsPageContentConfig.ts` — 정책적 의미 주석 보강
- `src/app/api/admin/product-taxonomies/route.ts` — POST `badge_tone` TODO (동작 변경 없음)
- `src/app/api/admin/product-taxonomies/[id]/route.ts` — PATCH vs POST 차이 문서 참조 주석
- `src/lib/products/__tests__/productsListingPolicy.test.ts` — **신규**
- `src/lib/products/__tests__/productsSearchPolicy.test.ts` — **신규**
- `src/lib/routing/__tests__/productsFunnelRouting.policy.test.ts` — **신규**
- `src/components/navigation/__tests__/productsBreadcrumb.policy.test.ts` — **신규**
- `src/lib/__tests__/productCampaignBadges.policy.test.ts` — **신규**
- `src/components/product-detail/__tests__/ProductCatalogSection.policy.test.tsx` — **신규**

## 2. 추가한 정책 함수 목록

### `productsListingPolicy.ts`

- `hasLandingEntryParams` — `destination` / `city` / `theme` 진입 쿼리 존재
- `hasCanonicalListingFilterParams` — `region` / `theme` / `product_line` / `sort` / `q` ( **`collection`·`tourType` 제외** )
- `shouldPreferServerInitialFilters` — 서버 초기 필터를 쓸지. URL에 `region`·`product_line`이 있으면 무조건 파싱; `destination`/`city` 없이 `sort`·`q`만 있으면 파싱(랜딩 `destination`+`q`는 서버 해석 유지).
- `resolveProductsPageInitialFilters` — `ProductsPageContent` 초기 `filters` 단일 진입점

### `productsSearchPolicy.ts`

- `buildProductsKeywordHaystack` — 목록 `q`·카탈로그 키워드 공통 haystack
- `tokenizeListingQueryKeyword` — 목록 `q`: 공백 split
- `tokenizeCatalogKeyword` — 카탈로그: 쉼표·공백 복합 split

## 3. 추가한 테스트 목록

| 파일 | 내용 |
|------|------|
| `productsListingPolicy.test.ts` | 랜딩/canonical/collection·tourType 제외, 서버 우선 분기 |
| `productsSearchPolicy.test.ts` | haystack·토큰화·`applyProductFilters`·`productCatalogMatchesKeyword` 회귀 |
| `productsFunnelRouting.policy.test.ts` | `getProductsFunnelPathKind`, `showProductsNavigationContext`, `getProductsNavPathKind`, `getFallbackPath` |
| `productsBreadcrumb.policy.test.ts` | `buildProductsBreadcrumbItems` (index / region / theme / product_detail) |
| `productCampaignBadges.policy.test.ts` | meta 우선·전부 비노출·레거시·우선순위·max·`productToProductCardProps` |
| `ProductCatalogSection.policy.test.tsx` | URL-controlled vs 내부 탭·keyword·empty CTA·list `campaignBadgeMax: 2`·related 분기 |

## 4. 현재 동작을 유지하기 위해 의도적으로 남긴 차이점

1. **listing `q` vs catalog keyword**  
   - 동일 haystack(`title`, `description`, `category`, `theme`)이지만 토큰화만 다름: 목록은 공백, 카탈로그는 쉼표+공백. OR 매칭(`tokens.some`)은 기존과 동일.

2. **POST vs PATCH `badge_tone`**  
   - **POST** (`product-taxonomies/route.ts`): `trim` 후 저장, enum 강제 없음.  
   - **PATCH** (`[id]/route.ts`): `normalizeBadgeTone`으로 `primary` / `highlight` / `neutral` 검증.  
   - 3단계에서 write path 정합화 예정.

3. **`theme` 쿼리 vs 서버 초기값** — 테마 선택 후 URL에 `theme=`이 있어도, URL에 `region=`이 생기면 목록 상태는 쿼리스트링을 따른다(지역+테마 동시 필터).

4. **`mergeFiltersIntoSearchParams`** — `region`/`theme` 등이 `null`일 때 해당 쿼리 키를 삭제해 사이드바·URL 불일치를 막는다.

5. **`products_other` 경로**  
   - `/products/region/.../extra` 등 중첩 세그먼트는 `getProductsFunnelPathKind` → `products_other`, 내비 컨텍스트 비노출, `getFallbackPath` → `/products` 등 **기존 정책 유지**.

## 5. 이번 PR에서 일부러 하지 않은 것

- 검색 규칙 단일 함수 통합, OR/AND 의미 변경
- `getCampaignBadgePriority` 제거·taxonomy-only 전환
- 관리자 API validation 통일·payload 변경
- 서버 필터·페이지네이션·캐시·Suspense 등 성능 작업
- breadcrumb 문구·fallback URL 변경

## 6. 3단계로 넘길 변경 후보

- `badge_tone` POST/PATCH 검증 일치 및 잘못된 값 거절
- listing `q`와 catalog keyword 토큰화·의미 통합 여부 결정 (제품/SEO 요구와 함께)
- `products_other`를 상세·허브 중 어디로 보낼지 UX 정리
- 서버 측 필터·페이지네이션으로 목록 이전

---

## 관리자 API: `badge_tone` (2단계 문서용 요약)

| 메서드 | 경로 | `badge_tone` 처리 |
|--------|------|---------------------|
| POST | `/api/admin/product-taxonomies` | 문자열이면 `trim`, 빈 문자열은 `null`. enum 검증 **없음**. |
| PATCH | `/api/admin/product-taxonomies/[id]` | `normalizeBadgeTone` — 허용 값만 저장, 그 외 400. |

2단계 목적은 **읽기 경로·렌더링 정책**을 테스트로 고정하는 것이며, write 경로 수정은 3단계에서 수행한다.
