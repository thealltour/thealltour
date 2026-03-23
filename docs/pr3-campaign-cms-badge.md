# PR3: Campaign taxonomy CMS — 상품 카드 대표 배지

## 요약

`product_taxonomies` 중 `taxonomy_type = 'campaign'` 항목을 **운영 주도형 배지 CMS**로 확장했습니다. 상품의 `campaigns`(문자열 토큰 배열)은 유지하고, 서버에서 taxonomy와 조합해 `campaign_card_meta`를 붙인 뒤 카드 배지·피치를 결정합니다.

## 추가·사용 필드 (DB / 타입)

| 필드 | 용도 |
|------|------|
| `display_label` | 카드 라벨 (비우면 `name`) |
| `badge_priority` | 대표 배지 정렬, 낮을수록 우선 (기본 100) |
| `badge_visible` | 카드 대표 배지 후보 여부 (`true`만 후보) |
| `badge_tone` | `primary` \| `highlight` \| `neutral` → 스타일 매핑 |
| `badge_description` | 카드 피치 1줄 (비우면 라벨 기반 기본 문구 fallback) |

## 프론트 로직

- **`src/lib/productCampaignResolve.ts`**: 토큰(UUID/이름) → `ProductCampaignCardMeta[]`
- **`src/lib/productCampaignBadges.ts`**: `badge_visible === true`만 필터 → `badge_priority` 오름차순 → 최대 2개. 해석된 메타가 있는데 모두 비노출이면 **배지 없음**(레거시 폴백 안 함).
- **`src/lib/productCampaignPresentation.ts`**: `badge_tone` → 시각 톤, 피치는 대표(우선순위 1위)의 `description` 우선.
- **`ProductCampaignBadge`**: `badgeTone` 있으면 라벨 기반 톤 추론 생략.

## 데이터 보급 (hydrate)

다음 경로에서 `getCampaignTaxonomiesForCard()` + `hydrateProductsWithCampaignCardMeta`로 `campaign_card_meta`를 채웁니다.

- `getProductsCached`, `getProductByIdCached`, `getProductByIdFresh`
- 검색 `searchProductsByParams`
- 홈 큐레이션 `homeCurated`
- 검색 추천 `getSearchRecommendations`
- 관리자 미리보기 API `/api/admin/products/preview`

## 관리자

- **기획/추천 관리** 탭: 테이블에 카드 라벨·배지 노출·순위 요약, 수정 시 확장 패널에서 표시 라벨·노출·우선순위·톤·피치 편집.
- **API**: `GET/POST /api/admin/product-taxonomies`, `PATCH /api/admin/product-taxonomies/[id]`에 위 필드 반영, 성공 시 `PRODUCTS` 태그 revalidate.

## 하위 호환

- `campaigns`는 계속 **문자열 배열**; taxonomy 없는 토큰은 `legacyCampaignTokenToMeta`로 이름·추천/인기/신규 기본 priority·tone 부여.
- 마이그레이션 없는 환경에서는 컬럼 부재 시 `mapTaxonomy` 기본값으로 동작하도록 설계 (운영 DB에는 마이그레이션 적용 필요).

## QA 체크리스트

1. `badge_visible=false` → 해당 캠페인은 대표 배지 후보에서 제외 (전부 false면 배지 없음).
2. `badge_priority` 변경 → 정렬 반영 (캐시 revalidate 후).
3. `display_label` → 카드 라벨 반영.
4. `badge_description` → 피치 1줄 반영 (grid는 기존 정책대로 피치 생략).
5. `badge_tone` → 색상 톤 변경.
6. 기존 데이터만 있는 상품 → 레거시/기본값 폴백.
