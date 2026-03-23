# Products 탐색 퍼널 — 공통 Navigation 레이어 (1차)

## 추가·수정된 공통 레이어

| 구분 | 경로 | 역할 |
|------|------|------|
| 정책 | `src/lib/navigation/productsNavigationPolicy.ts` | `showProductsNavigationContext`, pathname→fallback, page kind |
| 설정 | `src/components/navigation/breadcrumb-config.ts` | `ProductsNavKind`별 label/href 트레일, `getProductsNavFallbackHref` |
| 훅 | `src/components/navigation/useBackNavigation.ts` | `history.length > 1` → `router.back()`, 아니면 `push(fallback)` |
| UI | `src/components/navigation/Breadcrumb.tsx` | `variant: full \| compact`, `aria-label`, `nav`/`ol`/`li` |
| UI | `src/components/navigation/MobileBackHeader.tsx` | 모바일 전용 뒤로(44px) + 제목 + 선택 1단 `subNav` |
| 조합 | `src/components/navigation/NavigationContextHeader.tsx` | 데스크톱: Breadcrumb / 모바일: MobileBackHeader, 경로 정책 게이트 |
| 배럴 | `src/components/navigation/index.ts` | 위 모듈 re-export |

## 1차 적용 페이지

- `src/app/products/page.tsx` — 목록
- `src/app/products/[id]/page.tsx` — 상품 상세
- `src/app/products/region/[slug]/page.tsx` — 지역 랜딩 (`ProductLandingPage`에 `navigationContext` 전달)
- `src/app/products/theme/[slug]/page.tsx` — 테마 랜딩 (동일)

## 전역 브레드크럼 정책과의 관계

- `src/lib/navigation/breadcrumbPolicy.ts`의 `shouldShowBreadcrumb`에서 **`/products` 전 구간 제외**
- 상품 퍼널은 `NavigationContextHeader`만 사용 → 가이드/허브 등 기존 `BreadcrumbWrapper`와 중복 없음

## Fallback 규칙

- `useBackNavigation`: `typeof window !== "undefined" && history.length > 1`이면 `router.back()`, 아니면 `router.push(fallback)`.
- **`getFallbackPath(pathname)`** (`src/lib/navigation/getFallbackPath.ts`, `components/navigation/getFallbackPath.ts` re-export): 슬러그·허브 단계별 상위 경로.
  - `/products/region/...` → `/products/region` (허브는 현재 `/products`로 리다이렉트)
  - `/products/theme/...` → `/products/theme`
  - `/products/[id]` → `/products`
  - `/products` → `/`
- `MobileBackHeader`는 `fallbackHref` 미전달 시 `getFallbackPath(usePathname())` 사용.
- `getProductsBackFallbackFromPathname`는 위 `getFallbackPath`에 위임.

## 모바일 Back 헤더

- 아이콘+타이틀 **단일 버튼**, 보조 `subNav` 제거(필요 시 `hint`만 저대비).
- `sticky` + `top: var(--products-mobile-stack-top)` (globals.css) 로 SiteHeader(탑바+검색) 바로 아래 고정.

## 상품 리스트 툴바 (`ProductListToolbar`)

- 모바일: 필터·정렬 버튼 **sticky**, `top`은 `mobileListToolbarBelowBackHeader`에 따라 `--products-mobile-toolbar-top` 또는 `--products-mobile-stack-top`.
- 데스크톱: 우측 **정렬 `<select>`**, 필터는 기존 사이드바 + `MobileProductFilterDrawer`(바텀시트).
- 정렬 값은 URL `sort` 쿼리와 동기 (`productFilters` 확장: `recommended`, `price_asc`, `price_desc` 등).

## 확장 방법

- 새 page group: `productsNavigationPolicy.ts`에 경로 허용 + `breadcrumb-config.ts`에 `kind`/라벨 추가
- 다른 레이아웃에서 동일 UI: `NavigationContextHeader`에 `items`/`pageTitle`/`fallbackHref`만 넘기고, 필요 시 `showProductsNavigationContext` 대신 별도 게이트 prop 추가 가능

## 파일별 변경 요약 (diff 관점)

1. **신규**: `productsNavigationPolicy.ts`, `useBackNavigation.ts`, `breadcrumb-config.ts`, `MobileBackHeader.tsx`, `NavigationContextHeader.tsx`, `navigation/index.ts`, 본 문서
2. **수정**: `Breadcrumb.tsx` (variant·구조), `breadcrumbPolicy.ts` (products 제외), `ProductLandingPage.tsx` (`navigationContext`), `products/page.tsx`, `products/[id]/page.tsx`, `products/region/[slug]/page.tsx`, `products/theme/[slug]/page.tsx`
