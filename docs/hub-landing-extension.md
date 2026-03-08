# 허브 랜딩 확장 가이드 (PR-4)

`/destinations`, `/themes`, `/recommended` 1depth 허브 페이지에서  
`/destinations/[slug]`, `/themes/[slug]`, `/recommended/[slug]` 상세 랜딩으로 확장할 때 사용하는 구조와 확장 포인트 정리.

---

## 1. 링크 생성 규칙

**파일:** `src/lib/hubLandingLinks.ts`

허브 카드/칩 클릭 시 **반드시** 아래 유틸을 사용해 href를 만든다. 직접 `/products?...` 를 하드코딩하지 않는다.

| 함수 | 용도 | 상세 랜딩 시 | fallback |
|------|------|----------------|----------|
| `getDestinationLandingHref(item)` | 지역 카드 | `is_landing_enabled && slug` → `/destinations/[slug]` | `/products/region/[slug]` 또는 `/products?region=...` |
| `getThemeLandingHref(item)` | 테마 카드 | `is_landing_enabled && slug` → `/themes/[slug]` | `/products/theme/[slug]` 또는 `/products?theme=...` |
| `getRecommendedLandingHref(section)` | 추천 섹션 | `landing_enabled && slug` → `/recommended/[slug]` | `/recommended` |

- 상세 랜딩을 “켜는” 것은 DB의 `is_landing_enabled` / `landing_enabled` 플래그만 바꾸면 되고, 허브 페이지 코드 수정은 필요 없다.

---

## 2. 공개 조건 분리

**파일:** `src/lib/hubVisibility.ts`

- **허브 노출:** `is_active && is_hub_visible`  
  - 1depth 허브 목록/카드에 보여줄지.
- **상세 랜딩 공개:** `is_active && is_landing_enabled` (지역/테마), `landing_enabled` (추천 섹션)  
  - `/[hub]/[slug]` 상세 페이지를 공개할지.

| 함수 | 의미 |
|------|------|
| `isHubVisible(item)` | 허브에 카드 노출 여부 (taxonomy) |
| `isLandingEnabled(item)` | 상세 랜딩 공개 여부 (taxonomy) |
| `isRecommendedLandingEnabled(section)` | 추천 섹션 상세 랜딩 공개 여부 |
| `hasValidSlug(slug)` | URL에 쓸 수 있는 slug인지 |

---

## 3. slug 기반 조회

상세 랜딩 페이지에서 “이 slug의 1건”을 가져올 때 사용.

### 지역 (destination)

**파일:** `src/lib/productTaxonomies.ts`

| 함수 | 반환 | 비고 |
|------|------|------|
| `getDestinationBySlug(slug)` | `ProductTaxonomy \| null` | 활성 + slug 일치. 공개 여부는 호출 측에서 `is_landing_enabled` 확인 |
| `getDestinationBySlugForPublicLanding(slug)` | `ProductTaxonomy \| null` | **상세 공개용.** `is_landing_enabled === true` 인 경우만 반환. `[slug]` 페이지에서 사용 |

### 테마 (theme)

| 함수 | 반환 | 비고 |
|------|------|------|
| `getThemeBySlug(slug)` | `ProductTaxonomy \| null` | 활성 + slug 일치 |
| `getThemeBySlugForPublicLanding(slug)` | `ProductTaxonomy \| null` | **상세 공개용.** `is_landing_enabled === true` 인 경우만 반환 |

### 추천 섹션 (recommended)

**파일:** `src/lib/homeCurated.ts`

| 함수 | 반환 | 비고 |
|------|------|------|
| `getRecommendedSectionBySlug(slug)` | `HomeCuratedSectionWithProducts \| null` | slug 일치 섹션(상품 포함). 공개 여부는 `landing_enabled` 확인 |
| `getRecommendedSectionBySlugForPublicLanding(slug)` | `HomeCuratedSectionWithProducts \| null` | **상세 공개용.** `landing_enabled === true` 인 경우만 반환 |

---

## 4. 메타/히어로 fallback

**파일:** `src/lib/landingMetadata.ts`

`[slug]` 상세 페이지의 `metadata` / Hero 이미지를 만들 때 우선순위대로 사용.

### 지역·테마 (ProductTaxonomy)

- **메타:** `getTaxonomyMetadataFallback(item)`  
  - title: `seo_title` → `landing_title` → `name`  
  - description: `seo_description` → `landing_description` → `card_description`
- **히어로 이미지:** `getTaxonomyHeroImageFallback(item)`  
  - `hero_image_url` → `card_image_url` → null (null이면 `LANDING_HERO_FALLBACK_IMAGE` 사용)

### 추천 섹션 (HomeCuratedSection)

- **메타:** `getRecommendedSectionMetadataFallback(section)`  
  - 현재: `title`, `description` (추후 seo/landing 필드 확장 가능)

---

## 5. 동적 라우트 확장 시 구현 순서

실제 상세 페이지를 열 때는 아래만 추가하면 된다.

1. **라우트 파일 추가**
   - `src/app/destinations/[slug]/page.tsx`
   - `src/app/themes/[slug]/page.tsx`
   - `src/app/recommended/[slug]/page.tsx`

2. **페이지 내부**
   - `getDestinationBySlugForPublicLanding(slug)` / `getThemeBySlugForPublicLanding(slug)` / `getRecommendedSectionBySlugForPublicLanding(slug)` 로 1건 조회.
   - `null`이면 `redirect(getDestinationLandingHref(...))` 등으로 fallback URL로 보내거나, `notFound()`.
   - 메타: `getTaxonomyMetadataFallback(item)` / `getRecommendedSectionMetadataFallback(section)` 사용.
   - Hero 이미지: `getTaxonomyHeroImageFallback(item)` 또는 `LANDING_HERO_FALLBACK_IMAGE`.

3. **허브 페이지**
   - 이미 링크 유틸만 사용 중이므로 수정 없이, DB에서 `is_landing_enabled` / `landing_enabled` 만 켜면 `/destinations/[slug]` 등으로 이동하게 된다.

---

## 6. 검증 포인트

- [ ] 허브 카드/칩 링크가 전부 `getDestinationLandingHref` / `getThemeLandingHref` / `getRecommendedLandingHref` 로만 생성되는지
- [ ] `is_hub_visible`(허브 노출)과 `is_landing_enabled`(상세 공개)가 코드상 분리되어 있는지
- [ ] slug 조회는 상세 공개용으로 `*ForPublicLanding` 사용 시 재작업 없이 [slug] 페이지에 붙일 수 있는지
- [ ] 메타/히어로는 `landingMetadata` 유틸 우선순위만 따르면 되는지
