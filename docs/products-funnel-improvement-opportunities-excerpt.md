# 상품 퍼널·랜딩 코드 — 개선 여지 발췌

> 커밋 기준(상품 내비·캠페인 배지·랜딩·마이그레이션 반영 시점) 코드를 페이지·모듈 단위로 훑은 요약. 전 파일 인용 없이 구조 관찰만 반영.

---

## `/products` (`src/app/products/page.tsx`)

- **데이터**: `getProducts()`로 전량 로드 후 클라이언트에서 필터·정렬하는 패턴이라, 상품 수가 커지면 **TTFB·메모리·JS 번들**이 한꺼번에 부담될 수 있음. 검색/페이지네이션·서버 필터 API로 쪼개는 것이 장기적으로 안전함.
- **허브 데이터**: `getHubDestinations`, `getHubThemes`, `getProductTaxonomyOptions` 등을 **지역·테마 랜딩과 동일하게** 여러 번 부르는 구조라, 공통 `loadProductsListingContext()` 같은 서버 헬퍼로 묶으면 실수·불일치가 줄어듦.

---

## `/products/region/[slug]`, `/products/theme/[slug]` (랜딩 분기)

- **중복 로직**: `buildDestinationFallbackImageMap`이 `destinations/[slug]/page.tsx`와 거의 동일하게 **각각 정의**되어 있음. 한 모듈(`@/lib/productTaxonomies` 또는 `landing` 유틸)로 빼면 유지보수가 쉬워짐.
- **분기 복잡도**: `getProductLandingData` 성공 시 랜딩 UI, 실패 시 리다이렉트 등 **한 파일에 메타·데이터·분기**가 많음. `generateMetadata`와 본문용 데이터 로더를 분리하면 읽기와 테스트가 좋아짐.

---

## `/destinations/[slug]` (`src/app/destinations/[slug]/page.tsx`)

- **대형 서버 페이지**: 허브·가이드·리뷰·큐레이션·`ProductsPageContent`까지 한 번에 묶여 있어, **부분 캐시/스트리밍(Suspense)** 또는 섹션별 데이터 페치 분리 여지가 있음.
- **공통화**: 위와 같이 **fallback 이미지 맵** 등은 `/products/region` 쪽과 공통화하는 편이 좋음.

---

## `ProductsPageContent` (클라이언트)

- **`filters` useMemo**: URL에 `destination`/`city`/`theme`가 있으면 서버 초기값을 고정하고, 그 외에는 `parseProductFiltersFromSearchParams`로 가는 **이중 규칙**이라, 엣지케이스(랜딩에서 쿼리만 바꿔 진입 등)는 주석·테스트로 고정해 두는 것이 좋음.
- **props 수**: `initialRegionDescendants`, `themeTaxonomies`, `cardLayout` 등 옵션이 많아, “목록 퍼널 설정” 객체 하나로 묶으면 호출부(`page.tsx`들)가 단순해짐.

---

## `ProductCatalogSection` · `ProductLandingPage`

- **클라 컴포넌트 비대화**: 히어로·그리드·트래킹까지 한 덩어리면 **번들·하이드레이션** 비용이 큼. 정적인 히어로/카피는 서버 컴포넌트로 두고, 그리드·탭만 클라로 두는 식의 분리 여지가 있음.
- **검색 일치**: `matchesKeyword`가 카탈로그 안에 로컬로 있어, `searchProducts` 등과 **토큰 규칙이 어긋나면** “목록 검색 vs 전역 검색” 결과가 달라질 수 있음. 규칙을 한곳으로 모으는 편이 안전함.

---

## 상품 카드 / 캠페인 배지 (`productCampaignBadges.ts` 등)

- **레거시와 CMS 병행**: `getCampaignBadgePriority` 등 deprecated 경로가 남아 있어, 기간을 정하고 **taxonomy만 쓰는 경로로 수렴**하면 분기와 테스트가 줄어듦.
- **표면 일관성**: 리스트·랜딩·홈 카드마다 `campaignBadgeMax`·`surface` 옵션을 어디서 줄지 표준화하지 않으면 **노출 개수/스타일이 페이지마다 달라질** 수 있음. (설계 문서·단일 정책 객체 권장.)

---

## 내비게이션 (`productsNavigationPolicy.ts`, `breadcrumb-config.ts`, `getFallbackPath`)

- **경로 파싱 이중화**: `showProductsNavigationContext` / `getProductsNavPathKind`와 브레드크럼 빌더가 **각각 pathname 규칙**을 갖고 있어, 새 세그먼트 추가 시 한쪽만 고치는 실수가 나기 쉬움. 단일 “경로 → 종류” 맵을 소스로 두는 편이 좋음.

---

## 관리자·API (상품 분류 CMS)

- `product-taxonomies` 라우트에 **badge_tone, priority** 등이 들어간 경우, **값 검증(enum)·권한·감사 로그**를 한 번 더 정리해 두면 운영 단계에서 안전함. (해당 라우트 전문은 별도 감사 시 보완.)

---

## 한 줄 요약

1. **대형 서버 페이지·중복 헬퍼 통합**  
2. **전 상품 in-memory 로드의 확장 한계** 대비  
3. **pathname / 필터 규칙의 단일 소스화**  
4. **클라이언트 덩어리 컴포넌트 분할**  

위 네 축이 체감 이득이 큼.
