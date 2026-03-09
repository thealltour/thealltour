# Supabase 연계 + 관리자 + 카테고리/테마 구조 — 전체 복사 가능 발췌본

**목적:** migration 기반 최소 변경 설계를 위한 현재 구조 정확 파악.  
**규칙:** 파일 경로 명시 → 역할 1~2줄 요약 → 코드블록 발췌(끊김 없이).

---

## 1. 상품 타입 / taxonomy 타입 정의

### 1.1 `src/types/product.ts`

**역할:** 상품 도메인 타입. category/theme/destination_id/product_line_id/campaigns/tags 등 분류·기획 필드 정의. 관리자 저장 payload와 연결되는 타입.

```ts
// 발췌: Product 타입 및 분류 관련 필드
export type Product = {
  id: string;
  title: string;
  description: string;
  image_url: string;
  images_json?: string[];
  /**
   * @deprecated legacy. destination_id / product_line_id 비어 있을 때만 fallback 사용.
   */
  category: string;
  /**
   * @deprecated legacy. 테마 이름 토큰 문자열(쉼표/구분자).
   */
  theme?: string;
  /** 지역 1개 (product_taxonomies.id, taxonomy_type=destination). 비어 있으면 category fallback */
  destination_id?: string | null;
  /** 상품군 1개 (product_taxonomies.id, taxonomy_type=product_line). 비어 있으면 category fallback */
  product_line_id?: string | null;
  /** 기획/강조 항목. taxonomy 이름 배열 또는 id 배열. 선택 */
  campaigns?: string[] | null;
  campaigns_json?: string[] | null;
  /** 태그 이름 배열. 선택 */
  tags?: string[] | null;
  price?: number;
  // ... duration, itinerary, is_active, sort_order, status, overview_json, itinerary_v2_json 등
};
```

### 1.2 `src/types/productTaxonomy.ts`

**역할:** 분류 축(destination/theme/product_line/campaign/tag) 타입, 트리용 parent_id, 허브/랜딩 노출 플래그, 카드·히어로 메타. 관리자 taxonomy 저장과 연결.

```ts
export type TaxonomyType =
  | "destination"
  | "theme"
  | "product_line"
  | "campaign"
  | "tag";

export type ProductTaxonomy = {
  id: string;
  taxonomy_type: TaxonomyType;
  type?: ProductTaxonomyType; // deprecated
  name: string;
  slug: string | null;
  is_active: boolean;
  sort_order: number | null;
  created_at: string | null;
  parent_id?: string | null;
  category_type?: ProductCategoryType | null; // deprecated
  is_hub_visible: boolean;
  is_landing_enabled: boolean;
  card_title?: string | null;
  card_description?: string | null;
  card_image_url?: string | null;
  landing_title?: string | null;
  landing_description?: string | null;
  hero_image_url?: string | null;
  seo_title?: string | null;
  seo_description?: string | null;
};

export type ProductTaxonomyWithUsage = ProductTaxonomy & {
  usageCount: number;
  headerClickCount?: number;
  searchInboundCount?: number;
  landingViewCount?: number;
  landingCtr?: number | null;
};

/** 상품 필터 지역 트리 노드 (대분류 > 중분류 > 소분류). */
export type RegionTreeNode = {
  id: string;
  name: string;
  children?: RegionTreeNode[];
};
```

### 1.3 `src/types/productLine.ts`

**역할:** 없음. 프로젝트에 `productLine.ts` 타입 파일은 없음. product_line은 `productTaxonomy.ts`의 taxonomy_type='product_line' 및 Product.product_line_id로 처리.

### 1.4 `src/types/review.ts` / `src/types/guide.ts`

**역할:**  
- **review.ts:** 리뷰 도메인 타입(Review, ReviewStatus, PublicReviewItem, MyPageWritableReviewItem 등). product와 eligibility_id/booking_id/product_id로 연결. taxonomy와 직접 연결되는 필드는 없음.  
- **guide.ts:** 가이드 도메인 타입. 상품 taxonomy와 직접 연결되는 필드는 없음.  
(상품·taxonomy 분석 목적상 타입 정의 전체 발췌는 생략.)

---

## 2. 상품 데이터 로딩 / 저장 로직

### 2.1 `src/lib/products.ts`

**역할:** Supabase products 조회, normalizeProduct로 row → Product 매핑. **주의:** normalizeProduct는 destination_id, product_line_id, campaigns_json, tags를 row에서 매핑하지 않음(타입에는 있으나 정규화 단계에서 누락).

**getProducts / getProductById (캐시 래퍼):**

```ts
export async function getProducts() {
  return getProductsCached();
}

const getProductsCached = unstable_cache(
  async () => {
    const advancedQuery = await supabase
      .from("products")
      .select("*")
      .eq("is_active", true)
      .order("sort_order", { ascending: true, nullsFirst: false })
      .order("created_at", { ascending: false, nullsFirst: false });

    if (!advancedQuery.error) {
      return (advancedQuery.data ?? []).map((row) => normalizeProduct(row as Record<string, unknown>));
    }
    const fallbackQuery = await supabase.from("products").select("*");
    if (fallbackQuery.error) return [] as Product[];
    return (fallbackQuery.data ?? []).map((row) => normalizeProduct(row as Record<string, unknown>));
  },
  ["products:list"],
  { revalidate: 60, tags: [CACHE_TAGS.PRODUCTS] },
);
```

**normalizeProduct (분류 필드만 발췌):** category, theme만 row에서 설정. destination_id/product_line_id/campaigns/tags 미설정.

```ts
return {
  // ...
  category: String(row.category ?? row.type ?? "여행상품"),
  theme: typeof row.theme === "string" ? row.theme : undefined,
  // destination_id, product_line_id, campaigns, campaigns_json, tags 는 여기서 설정하지 않음
  // ...
};
```

### 2.2 `src/lib/productTaxonomies.ts`

**역할:** product_taxonomies 조회, 허브/필터용 destination·theme 목록, 트리 생성, slug 조회. Supabase select만 사용(insert/update는 API 경로에서).

**getProductTaxonomyOptions (전체):**

```ts
export async function getProductTaxonomyOptions(productsFallback: Product[] = []): Promise<{
  categories: string[];
  themes: string[];
  productLines: string[];
}> {
  const taxonomies = await getActiveTaxonomiesCached();
  if (taxonomies === null) {
    const fallback = toFallbackTaxonomies(productsFallback);
    return { categories: fallback.categories, themes: fallback.themes, productLines: [] };
  }
  if (productsFallback.length > 0) {
    const fallback = toFallbackTaxonomies(productsFallback);
    return { categories: fallback.categories, themes: fallback.themes, productLines: [] };
  }
  const mapped = taxonomies.map((row) => mapTaxonomy(row));
  const categories = mapped.filter((item) => item.taxonomy_type === "destination").map((item) => item.name);
  const themes = mapped.filter((item) => item.taxonomy_type === "theme").map((item) => item.name);
  const productLines = mapped.filter((item) => item.taxonomy_type === "product_line").map((item) => item.name);
  return { categories, themes, productLines };
}
```

**getHubDestinations / getHubThemes:**

```ts
const getHubDestinationsCached = unstable_cache(
  async (): Promise<ProductTaxonomy[]> => {
    const result = await supabase
      .from("product_taxonomies")
      .select("*")
      .eq("taxonomy_type", "destination")
      .eq("is_active", true)
      .eq("is_hub_visible", true)
      .order("sort_order", { ascending: true, nullsFirst: false })
      .order("name", { ascending: true });
    if (result.error) return [];
    return (result.data ?? []).map((r) => mapTaxonomy(r as Record<string, unknown>));
  },
  ["product-taxonomies:hub-destinations"],
  { revalidate: 300, tags: [CACHE_TAGS.TAXONOMY, CACHE_TAGS.HEADER_NAV] },
);

export async function getHubDestinations(): Promise<ProductTaxonomy[]> {
  return getHubDestinationsCached();
}
// getHubThemes: taxonomy_type='theme' 기준 동일 패턴
```

**buildRegionTree / buildThemeTree:**

```ts
export function buildRegionTree(destinations: ProductTaxonomy[]): RegionTreeNode[] {
  const sortByOrderThenName = (a: ProductTaxonomy, b: ProductTaxonomy) => {
    const sa = a.sort_order ?? 9999;
    const sb = b.sort_order ?? 9999;
    if (sa !== sb) return sa - sb;
    return (a.name ?? "").localeCompare(b.name ?? "", "ko");
  };
  const byParent = new Map<string, ProductTaxonomy[]>();
  for (const d of destinations) {
    const pid = (d.parent_id ?? "").trim() || "_root";
    if (!byParent.has(pid)) byParent.set(pid, []);
    byParent.get(pid)!.push(d);
  }
  for (const arr of byParent.values()) arr.sort(sortByOrderThenName);
  function toNode(d: ProductTaxonomy): RegionTreeNode {
    const children = byParent.get(d.id);
    const sorted = children ? [...children].sort(sortByOrderThenName) : [];
    return { id: d.id, name: d.name ?? "", children: sorted.length > 0 ? sorted.map(toNode) : undefined };
  }
  const roots = byParent.get("_root") ?? [];
  roots.sort(sortByOrderThenName);
  return roots.map(toNode);
}

export function buildThemeTree(themes: ProductTaxonomy[]): RegionTreeNode[] {
  return buildRegionTree(themes);
}
```

### 2.3 `src/lib/productFilters.ts`

**역할:** query param 기반 필터 파싱(region, theme, product_line, sort, q). applyProductFilters는 **category/theme 문자열 매칭**만 사용(destination_id/product_line_id FK 미사용).

- `parseProductFiltersFromSearchParams`: searchParams → ProductFiltersState  
- `buildProductsSearchParams`: state → query string  
- `buildProductsFilterHref`: destination/city/theme/region/product_line/q/sort → `/products?…`  
- `mergeFiltersIntoSearchParams`: 현재 params에 필터 반영, destination/city 제거해 canonical 유지  
- `applyProductFilters`: products 배열에 region/theme/product_line/q/sort 적용 (category/theme 문자열 비교)

### 2.4 `src/lib/productFiltersLanding.ts`

**역할:** /products 진입 시 destination, city, theme 쿼리를 slug/이름 조회로 해석해 region/theme/q로 변환.

**resolveLandingParams / hasLandingParams (전체):**

```ts
export async function resolveLandingParams(
  query: Record<string, string | string[] | undefined>,
): Promise<ResolvedLandingFilters | null> {
  const destination = typeof query.destination === "string" ? query.destination.trim() : "";
  const city = typeof query.city === "string" ? query.city.trim() : "";
  const themeParam = typeof query.theme === "string" ? query.theme.trim() : "";
  const q = typeof query.q === "string" ? query.q.trim() : "";
  const sort = typeof query.sort === "string" ? query.sort.trim() : "";
  if (!destination && !city && !themeParam) return null;

  let region: string | null = null;
  let theme: string | null = null;
  if (destination) {
    const dest = await getDestinationBySlug(destination);
    if (dest) region = dest.name.trim() || null;
    else region = await getTaxonomyNameBySlug("category", destination);
  }
  if (themeParam) {
    const bySlug = await getThemeBySlug(themeParam);
    if (bySlug) theme = bySlug.name.trim() || null;
    else {
      const byName = await getTaxonomyNameBySlug("theme", themeParam);
      theme = byName ?? themeParam;
    }
  }
  const keyword = q || city || "";
  const sortId = sort === "popular" || sort === "latest" || sort === "new" ? sort : "";
  return {
    initialFilters: { region, theme, product_line: null, q: keyword || null, sort: sortId },
    initialKeyword: keyword,
  };
}

export function hasLandingParams(
  query: Record<string, string | string[] | undefined>,
): boolean {
  const d = typeof query.destination === "string" && query.destination.trim();
  const c = typeof query.city === "string" && query.city.trim();
  const t = typeof query.theme === "string" && query.theme.trim();
  return Boolean(d || c || t);
}
```

### 2.5 `src/lib/hubLandingLinks.ts`

**역할:** 허브/상세 랜딩 URL 생성. is_landing_enabled && slug 있으면 /destinations/[slug], /themes/[slug], 아니면 /products?region=… 등.

- `getDestinationLandingHref(d)`: `/destinations/[slug]` 또는 `/products?region=…`  
- `getThemeLandingHref(t)`: `/themes/[slug]` 또는 `/products?theme=…`  
- `getProductLineLandingHref(t)`: `/products?product_line=…`

### 2.6 `src/lib/landingMetadata.ts`

**역할:** [slug] 상세 랜딩 메타/히어로 fallback, 허브별 LandingHero 설정.

- `getTaxonomyMetadataFallback(item)`: seo_title/landing_title/name 순  
- `getTaxonomyHeroImageFallback(item)`: hero_image_url → card_image_url  
- `getHubHeroConfig(hub: "destinations"|"themes")`: 이미지/eyebrow/title/description/cta

---

## 3. Supabase client / server 연동 구조

### 3.1 `src/lib/supabase.ts`

**역할:** 브라우저·서버 공용 anon key 클라이언트. 읽기/쓰기 모두 이 클라이언트로 가능(RLS 적용).

```ts
import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error("Supabase 환경변수(NEXT_PUBLIC_SUPABASE_URL, NEXT_PUBLIC_SUPABASE_ANON_KEY)가 필요합니다.");
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey);
```

### 3.2 `src/lib/supabaseAdmin.ts`

**역할:** 서버 전용 service_role 클라이언트. RLS 우회. API·관리자 저장 시 사용. `supabaseClient.ts` / `supabaseServer.ts` 파일은 없음.

```ts
import "server-only";
import { createClient } from "@supabase/supabase-js";

export const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  { auth: { autoRefreshToken: false, persistSession: false } }
);
```

**현재 사용:** 관리자 상품 API(`/api/admin/products`)는 `supabase`(anon) 사용. taxonomy API(`/api/admin/product-taxonomies`)도 `supabase` 사용. 서버에서 RLS를 통과하는 구조.

---

## 4. 상품 관리자 구조

### 4.0 상품 관리자 컴포넌트 경로 및 역할

- **src/components/AdminProductManager.tsx** — 상품 생성/수정 통합 컨테이너. 폼 상태·저장·미리보기·탭(목록/편집/분류). serializeAdminProductForm / deserializeAdminProductToForm 사용.
- **src/components/admin/products/AdminProductEditorView.tsx** — 편집 영역 래퍼(children만 감쌀 뿐).
- **src/app/admin/products/page.tsx** — 관리자 상품 페이지. AdminProductManager 렌더.
- **src/components/admin/ProductFormSectionNav.tsx** — 폼 섹션 네비( basic/taxonomy/price/description 등).
- **src/components/admin/ProductFormActionBar.tsx** — 저장/취소/미리보기 등 액션 바.
- **src/components/admin/products/editor/adminProductForm.defaults.ts** — createEmptyAdminProductFormState (types 쪽 createEmptyProductFormState re-export).
- **src/components/admin/products/editor/adminProductForm.validation.ts** — collectFormIssues / collectAllRequiredIssues.
- **src/components/admin/products/editor/adminProductPreview.mapper.ts** — mapAdminProductFormToPreviewProduct (미리보기용 Product 변환).
- **src/lib/admin/buildProductPayload.ts** — buildProductCreateBody (serializeAdminProductForm 래퍼).
- **src/components/admin/modetour/ModetourNewProductPage.tsx** — 모드투어 연동 신규 상품 페이지. 동일 serializer 사용.

상품 저장/수정은 AdminProductManager → serializeAdminProductForm → POST /api/admin/products 또는 PATCH /api/admin/products/[id] 경로로 이어짐.

### 4.1 `src/types/adminProductForm.ts`

**역할:** 관리자 상품 폼 상태. category(문자열), theme(문자열), product_line_id(uuid 문자열), campaigns(쉼표 구분 문자열). **destination_id 필드 없음.**

```ts
export type ProductFormState = {
  // ...
  category: string;
  theme: string;
  product_line_id: string;  // 상품군 1개 (product_taxonomies.id). 빈 문자열 = 미선택
  campaigns: string;        // 기획/추천 다중. 쉼표 등으로 구분된 이름 문자열
  // ...
};
```

### 4.2 `src/components/admin/products/editor/adminProductForm.serializer.ts`

**역할:** 폼 상태 → API 저장 payload. category, theme, product_line_id, campaigns 포함. **destination_id 없음.**

```ts
// payload 필드 중 분류 관련만
category: form.category,
theme: form.theme.trim() === "" ? null : form.theme,
product_line_id: form.product_line_id.trim() === "" ? null : form.product_line_id.trim(),
campaigns: (() => {
  const s = form.campaigns.trim();
  if (!s) return null;
  const arr = s.split(/[,\s]+/).map((v) => v.trim()).filter(Boolean);
  return arr.length > 0 ? arr : null;
})(),
```

### 4.3 `src/components/admin/products/editor/adminProductForm.deserializer.ts`

**역할:** API/Product → 폼 상태. category, theme, product_line_id, campaigns(campaigns_json) 주입.

```ts
category: product.category ?? "여행상품",
theme: product.theme ?? "",
product_line_id: (product.product_line_id ?? "").toString().trim(),
campaigns: ((): string => {
  const arr = product.campaigns ?? (product as { campaigns_json?: string[] }).campaigns_json ?? [];
  return Array.isArray(arr) ? arr.filter((v): v is string => typeof v === "string").join(",") : "";
})(),
```

### 4.4 `src/app/api/admin/products/route.ts`

**역할:** GET 목록(페이지/정렬/키워드/is_active/status), POST 생성. POST body에 category, theme, product_line_id, campaigns_json 저장. **destination_id 미수신·미저장.**

- GET: supabase.from("products").select("*").order().range() + keyword/or 필터  
- POST: insertPayload에 category, theme, product_line_id, campaigns_json 포함. slug 없음(상품 상세는 id 기준 `/products/[id]`).

**정리:** 상품 생성/수정 시 **지역은 category 문자열**로만 저장됨. destination_id FK는 관리자 폼·API에 없음. 추천/기획은 campaigns(campaigns_json). 공개 여부 is_active, 정렬 sort_order, status(AVAILABLE/LIMITED/SOLD_OUT/CONSULT_REQUIRED) 있음.

---

## 5. 카테고리 / 테마 / 분류 관리자 구조

### 5.1 `src/components/admin/products/AdminProductTaxonomyView.tsx`

**역할:** 지역/테마/상품군/기획/태그 통합 관리 UI. 탭별 CRUD, parent_id(대분류), slug, sort_order, is_active, is_hub_visible, is_landing_enabled, 카드/히어로 메타 편집. 허브·랜딩 링크 생성은 `buildLandingHref` / `buildFilteredProductsHref`로 destination/theme → `/destinations/[slug]`, `/themes/[slug]`, `/products?region=…` 등.

- **대분류/중분류:** destination·theme 탭에서 parent_id 선택 가능. `buildTaxonomyTreeOrder`, `buildParentSelectOptions`로 트리 순서·부모 옵션 생성.  
- **정렬/노출/활성화:** sort_order, is_active, is_hub_visible, is_landing_enabled 테이블에서 편집.  
- **허브 연결:** is_hub_visible=true인 항목이 getHubDestinations/getHubThemes로 노출, getDestinationLandingHref/getThemeLandingHref로 링크.

별도 경로 `src/components/admin/taxonomy` 또는 `category` / `theme` / `product-line` 전용 폴더는 없음. 분류 관리는 product-taxonomies API + AdminProductTaxonomyView로만 처리.

### 5.2 `src/app/api/admin/product-taxonomies/route.ts`

**역할:** GET ?taxonomy_type= 필터, POST 생성. taxonomy_type, name, slug, parent_id, is_hub_visible, is_landing_enabled, card_*, landing_*, hero_image_url 저장. slug 검증(영문 소문자/숫자/하이픈), 동일 taxonomy_type 내 name/slug 중복 방지.

- GET: product_taxonomies 전체 + products에서 usageCount 계산 + analytics 메트릭(headerClickCount 등) 병합.  
- POST: taxonomy_type → legacy type/category_type 변환 후 insert.

---

## 6. 유저 홈 / 허브 / 리스트 페이지 구조

### 6.1 `src/app/page.tsx`

**역할:** 홈. getHomeCuratedData, getHomeBanners, getHeroContent. 히어로 + HomeHeroSearch + 추천(CuratedBlock) + 신뢰 섹션 + **메인 카테고리 섹션(골프 등)**. 카테고리 링크는 **하드코딩** `/products?category=해외 골프 투어`, `/products?category=국내 골프 투어`, `/products?category=파크골프 전용 투어`, `/products`. taxonomy 테이블과 직접 연동되는 구조 없음. home_sections / featured_collections 같은 DB 구조는 home_curated_sections + home_curated_settings로 이미 존재.

### 6.2 `src/app/products/page.tsx`

**역할:** 상품 목록. getProducts, getProductTaxonomyOptions, getHubDestinations, getHubThemes, buildRegionTree, buildThemeTree, resolveLandingParams/hasLandingParams. ProductsHero + ProductsPageContent에 products, regionOptions, regionTree, themeOptions, themeTree, productLineOptions, initialFiltersFromServer 전달. **데이터 단위:** Product[], RegionTreeNode[], 필터용 name 배열.

### 6.3 `src/app/destinations/page.tsx`

**역할:** 지역 허브. getHubDestinations, getProducts, getProductTaxonomyOptions, getHubThemes, buildRegionTree, buildThemeTree. LandingHero(getHubHeroConfig("destinations")) + HubFilterSidebar + StickySectionNav + 대표 지역 카드(HubBrowseCard, getDestinationLandingHref) + CuratedBlock(지역별 상품 미리보기). **지역–상품 매칭:** `p.category?.trim().toLowerCase() === d.name.trim().toLowerCase()` (category 문자열 기준).

### 6.4 `src/app/themes/page.tsx`

**역할:** 테마 허브. getHubThemes, getProducts, getProductTaxonomyOptions, getHubDestinations, buildRegionTree, buildThemeTree. LandingHero("themes") + HubFilterSidebar + StickySectionNav + 대표 테마 카드(HubBrowseCard, getThemeLandingHref) + CuratedBlock(테마별 상품 미리보기). **테마–상품 매칭:** parseThemeTokens(p.theme)와 theme name 비교.

### 6.5 `src/components/landing/LandingHero.tsx` / `HubBrowseCard.tsx`

**역할:** 허브 상단 히어로 블록 / 카드. HubHeroConfig 또는 taxonomy item + href.  
### 6.6 `src/components/home/CuratedBlock.tsx`

**역할:** 제목/설명 + 상품 리스트. 홈·허브 추천 블록.  
### 6.7 `src/components/ProductsHero.tsx` / `ProductCatalogSection.tsx`

**역할:** 상품 목록 상단 히어로 / 카탈로그 그리드.  
### 6.8 `src/components/hub/HubFilterSidebar.tsx` / `src/components/navigation/StickySectionNav.tsx`

**역할:** 좌측 필터(regionTree, themeTree, productLineOptions) + 섹션 앵커 네비.

**정리:** 홈 구조와 taxonomy 연결은 “홈 카테고리 링크를 taxonomy/slug 기반으로 바꾸기” 수준에서 확장 가능. 허브/리스트는 이미 destination/theme name + category/theme 문자열 매칭으로 동작. home_sections/featured_collections는 home_curated_* 로 구현됨.

---

## 7. 공통 레이아웃 / 헤더 / 푸터

### 7.1 `src/app/layout.tsx`

**역할:** 루트 레이아웃. metadata, viewport, body 안에 children + KakaoFloatingButton + GlobalSiteFooter. **헤더 없음.** (각 페이지에서 SiteHeader 호출.)

```tsx
export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ko">
      <head>...</head>
      <body>
        <ConsultModalProvider>
          <div className="flex-1">{children}</div>
          <KakaoFloatingButton />
          <GlobalSiteFooter />
        </ConsultModalProvider>
      </body>
    </html>
  );
}
```

### 7.2 `src/components/SiteHeader.tsx`

**역할:** 서버 컴포넌트. 쿠키 세션, members.points, getHeaderNavigationData() 호출 후 SiteHeaderUI에 전달. 헤더 네비는 taxonomy + homeCurated 기반(headerNavigation).

### 7.3 `src/lib/headerNavigation.ts`

**역할:** getHeaderNavigationData() → primaryNav(추천/지역별/테마별/맞춤문의/가이드/고객센터). 지역/테마 그룹은 getHubDestinations, getHubThemes로 buildRegionGroupsFromTaxonomy, buildThemeGroupsFromTaxonomy. 링크는 getDestinationLandingHref, getThemeLandingHref.

### 7.4 `src/components/layout/PageContainer.tsx`

**역할:** 유저 페이지 공통 폭·패딩. size: reading(1040px)/default(1280px)/wide(1600px)/full.

### 7.5 `src/components/layout/SectionBlock.tsx` / `SectionHeader.tsx`

**역할:** 섹션 블록(surface/padding) + 섹션 헤더(eyebrow/title/description/action, titleId for aria-labelledby).

### 7.6 `src/app/(site)/layout.tsx`

**역할:** 없음. (site) route group 레이아웃 파일 없음. 공개 상품 상세는 `/products/[id]` 단일 페이지에서 SiteHeader + 본문 구성. 공용 유저 레이아웃 사용.

---

## 8. migration 파일 구조

**폴더:** `supabase/migrations/`. **최신순 파일명 + 목적 한 줄.**

| 파일명 | 목적 한 줄 |
|--------|------------|
| 20260321000000_product_taxonomies_card_meta.sql | product_taxonomies 카드/랜딩/히어로 메타 컬럼 추가 |
| 20260320000000_product_taxonomies_parent_id.sql | product_taxonomies.parent_id (계층) 추가 |
| 20260319000000_products_taxonomy_axes.sql | products.destination_id, product_line_id, campaigns_json, tags_json 추가 |
| 20260317000000_landing_subnodes.sql | landing_subnodes 테이블 |
| 20260316000000_pr1_hub_landing_taxonomy.sql | category_type, is_hub_visible, is_landing_enabled, slug backfill |
| 20260314100000_review_system_notifications.sql | 리뷰 시스템 알림 |
| 20260313100000_review_conversion_session_key.sql | 리뷰 전환 세션 키 |
| 20260312100000_review_experiment_events.sql | 리뷰 실험 이벤트 |
| 20260311100000_review_moderation_history.sql | 리뷰 검토 이력 |
| 20260310100000_review_moderation_columns.sql | 리뷰 검토 컬럼 |
| 20260309110000_product_review_summaries.sql | 상품 리뷰 요약 |
| 20260309100000_review_reminders.sql | 리뷰 리마인더 |
| 20260308190000_normalize_products_rls.sql | products RLS 정규화 |
| 20260308220000_review_rewards.sql | 리뷰 보상 |
| 20260308210000_review_reports.sql | 리뷰 신고 |
| 20260308200000_review_votes.sql | 리뷰 투표 |
| 20260308180000_normalize_products_extended_columns.sql | products 확장 컬럼 정규화 |
| 20260308160000_normalize_rls_policies.sql | RLS 정책 정규화 |
| 20260308150000_cleanup_reward_redemption_legacy_table.sql | 보상 리디렉션 레거시 정리 |
| 20260308140000_cleanup_point_ledger_legacy_columns.sql | 포인트 원장 레거시 컬럼 정리 |
| 20260308130000_fix_travel_bookings_inquiry_id.sql | travel_bookings inquiry_id 수정 |
| 20260308120000_reconcile_reviews_columns.sql | reviews 컬럼 정리 |
| 20260308110000_normalize_reward_redemptions.sql | 보상 리디렉션 정규화 |
| 20260308100000_normalize_point_ledger.sql | 포인트 원장 정규화 |
| 20260307130000_reviews_draft_fields.sql | 리뷰 초안 필드 |
| 20260307120000_review_claim_token.sql | 리뷰 인증 토큰 |
| 20260307100000_reviews_eligibility_columns.sql | 리뷰 자격 컬럼 |
| 20260305110000_pr1_schema_rls_fix.sql | 스키마/RLS 수정 |
| 20260305100000_customer_profiles_and_eligibility.sql | 고객 프로필/자격 |
| 20260304070000_point_earn_requests_step3.sql | 포인트 적립 요청 step3 |
| 20250304000000_points_rewards_v2.sql | 포인트/리워드 v2 |

**products / taxonomy 관련 migration 내용 발췌:**

**20260319000000_products_taxonomy_axes.sql:**

```sql
-- destination_id, product_line_id, campaigns_json, tags_json 추가
alter table public.products add column destination_id uuid references public.product_taxonomies(id) on delete set null;
alter table public.products add column product_line_id uuid references public.product_taxonomies(id) on delete set null;
alter table public.products add column campaigns_json jsonb;
alter table public.products add column tags_json jsonb;
create index if not exists idx_products_destination_id on public.products(destination_id) where destination_id is not null;
create index if not exists idx_products_product_line_id on public.products(product_line_id) where product_line_id is not null;
```

**20260316000000_pr1_hub_landing_taxonomy.sql:**

```sql
-- product_taxonomies: category_type, is_hub_visible, is_landing_enabled 추가
-- slug backfill, type+slug unique, hub_visible 인덱스
-- home_curated_sections: slug, landing_enabled 추가
```

**20260320000000_product_taxonomies_parent_id.sql:**

```sql
alter table public.product_taxonomies
  add column parent_id uuid references public.product_taxonomies(id) on delete set null;
create index if not exists idx_product_taxonomies_parent_id on public.product_taxonomies(parent_id) where parent_id is not null;
```

---

## 9. 검색/라우팅/필터 연결 구조

### 9.1 파라미 키 (productFilters.ts)

- **PRODUCT_FILTER_KEYS:** region, theme, product_line, sort, q, tourType, destination, city.  
- **parseProductFiltersFromSearchParams:** params → { region, theme, product_line, sort, q }.  
- **buildProductsFilterHref:** destination/city/theme/region/product_line/q/sort → `/products?…`.  
- **mergeFiltersIntoSearchParams:** 현재 URLSearchParams에 필터 반영 시 destination/city 제거해 canonical 유지.

### 9.2 router.push(`/products?...`) 사용처

- **HeaderProductSearch.tsx:** `router.push(\`/products?q=${encodeURIComponent(trimmed)}\`)`  
- **HomeHeroSearch.tsx:** `router.push(\`/products?q=${encodeURIComponent(trimmed)}\`)`  
- **ProductCatalogSection.tsx / DevProductCardV2Grid.tsx:** 상세 이동 `router.push(\`/products/${product.id}\`)` (필터 아님)

### 9.3 ProductsPageContent (searchParams → 필터)

- **useSearchParams** + **initialFiltersFromServer:** destination/city/theme 있으면 resolveLandingParams 결과 사용, 없으면 parseProductFiltersFromSearchParams.  
- **handleFilterChange:** mergeFiltersIntoSearchParams 후 `router.push(\`/products?${qs}\`)`.

**정리:** 히어로 검색/빠른 탐색은 q 파라미로 `/products?q=…`. 핵심 여행 유형(지역/테마)은 `/destinations`, `/themes` 또는 `/products?region=…`, `/products?theme=…`. destination/theme/product_line 중심 탐색 재설계는 resolveLandingParams + buildProductsFilterHref + 필터 키 확장으로 가능.

---

## 10. 최종 정리

### 10.1 현재 taxonomy 구조 요약

- **지역:** product_taxonomies.taxonomy_type='destination'. parent_id로 대분류(해외/국내)→중분류→소분류. slug, is_hub_visible, is_landing_enabled, card_*, landing_*, hero_image_url.
- **테마:** taxonomy_type='theme'. 동일하게 parent_id, slug, 허브/랜딩 플래그.
- **상품군:** taxonomy_type='product_line'. 상세 랜딩 없음. `/products?product_line=…` 필터만.
- **기타:** campaign(기획/추천), tag. 상품은 campaigns_json/tags_json 또는 레거시 category/theme 문자열.

### 10.2 현재 관리자 구조 요약

- **상품 관리:** AdminProductManager → ProductForm(editor). 저장 시 category(문자열), theme(문자열), product_line_id(uuid), campaigns(이름 배열). **destination_id 미저장.** slug 없음(상품은 id 기반 URL).
- **분류 관리:** AdminProductTaxonomyView 한 화면에서 destination/theme/product_line/campaign/tag 탭. product-taxonomies API로 CRUD. parent_id, slug, is_hub_visible, is_landing_enabled, 카드/히어로 메타 편집.
- **홈 편성:** home_curated_settings + home_curated_sections + home_curated_section_products. 별도 “홈 섹션 편집” UI 존재. 홈 카테고리 카드 링크는 하드코딩(`/products?category=…`).

### 10.3 현재 Supabase 연동 요약

- **읽기:** supabase(anon) 사용. getProducts, getProductTaxonomyOptions, getHubDestinations, getHubThemes, getDestinationBySlug, getThemeBySlug 등. unstable_cache + CACHE_TAGS.
- **쓰기:** 관리자 API에서 supabase(anon) insert/update. supabaseAdmin(service_role)은 정의만 있고 상품/ taxonomy API에서는 미사용.
- **migration:** supabase/migrations에 products/taxonomy/reviews/guides/points 등 순차 적용. 직접 SQL 추가 최소화 시 기존 migration 패턴 따르면 됨.

### 10.4 확장 시 걸릴 가능성이 높은 구조적 제약 5개

1. **normalizeProduct가 destination_id/product_line_id/campaigns/tags를 채우지 않음** — 타입·DB에는 있으나 앱에서 사용하려면 정규화 단계에 매핑 추가 필요.  
2. **상품 “지역”이 관리자에서 category 문자열만 저장** — destination_id FK 미사용. 지역 기반 필터/허브는 여전히 category name 매칭. migration으로 destination_id 채우고 관리자에서 저장하도록 바꾸면 일관성 확보 가능.  
3. **홈 메인 카테고리 카드가 하드코딩** — `/products?category=해외 골프 투어` 등. taxonomy 또는 home_sections 기반으로 바꾸면 slug/region 통일 가능.  
4. **applyProductFilters가 category/theme 문자열만 사용** — destination_id/product_line_id FK 기반 필터로 바꾸면 taxonomy 변경 시 재매핑 없이 동작.  
5. **허브·목록이 “name 기준” 매칭** — destinations 페이지는 `p.category === d.name`, themes는 parseThemeTokens(p.theme). destination_id/theme_id FK로 통일하면 slug/다국어 확장 시 유리.

---

*문서 끝. 실제 DB·코드와 차이 있으면 Supabase 대시보드·소스 우선.*
