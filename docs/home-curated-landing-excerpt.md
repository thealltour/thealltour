# 홈 추천 / 랜딩 — 발췌 (전체 복사용)

아래는 홈 메인 추천 섹션, home curated 데이터 로더/타입, region·theme 랜딩 페이지, landing 데이터 조회, CTA 렌더 위치, getHeaderNavigationData, taxonomy 메타 구조, 공용 ProductCard 계열을 발췌한 텍스트입니다.

---

## 1. 홈 메인 추천 섹션 렌더 진입점

### 1.1 홈 페이지 (진입점)

**파일: src/app/page.tsx**

- `getHomeCuratedData()`, `getHomeBanners()` 병렬 호출.
- `curatedSettings?.is_active === true && curatedSections.length > 0`일 때만 추천 섹션 렌더.
- **섹션/블록 구조**: `curatedSections.map(sec => <CuratedBlock key={sec.id} title={sec.title} description={sec.description} products={sec.products} />)`.
- **전체보기 CTA**: `curatedSettings.catalog_button_label` / `curatedSettings.catalog_button_href` → `Link` 한 개.
- **revalidate**: 페이지 자체는 별도 revalidate 없음. curated API에서 `revalidateTag(HOME_CURATED)` + `revalidatePath("/")` 시 홈 갱신.

```tsx
import Link from "next/link";
import Image from "next/image";
import SiteHeader from "@/components/SiteHeader";
import { getHomeCuratedData } from "@/lib/homeCurated";
import { getHomeBanners } from "@/lib/homeBanners";
import CuratedBlock from "@/components/home/CuratedBlock";

export default async function Home() {
  const [homeCurated, topBanners] = await Promise.all([getHomeCuratedData(), getHomeBanners()]);
  const curatedSettings = homeCurated.settings;
  const curatedSections = homeCurated.sections;
  const primaryBanner = topBanners[0] ?? null;

  return (
    <div className="min-h-screen bg-[var(--theall-page-bg)] text-[var(--foreground)]">
      <SiteHeader />
      <main className="page-content flex w-full flex-col gap-16 px-3 py-8 ...">
        {/* 추천여행 (home curated) - 최상단 배치 */}
        <section className="space-y-8 rounded-none ...">
          {curatedSettings?.is_active === true && curatedSections.length > 0 ? (
            <>
              <div className="space-y-2">
                <p className="...">{curatedSettings.section_label}</p>
                <h3 className="...">{curatedSettings.section_title}</h3>
                <p className="...">{curatedSettings.section_description}</p>
              </div>
              <div className="space-y-8">
                {curatedSections.map((sec) => (
                  <CuratedBlock
                    key={sec.id}
                    title={sec.title}
                    description={sec.description}
                    products={sec.products}
                  />
                ))}
                <div className="pt-2">
                  <Link
                    href={curatedSettings.catalog_button_href}
                    className="type-btn inline-flex rounded-xl border ..."
                  >
                    {curatedSettings.catalog_button_label}
                  </Link>
                </div>
              </div>
            </>
          ) : (
            <div className="... type-small text-[var(--text-muted)]">
              메인 추천 상품이 없습니다. 관리자 페이지에서 추천 상품을 체크해 주세요.
            </div>
          )}
        </section>
        {/* 이후: 히어로 배너, 신뢰 섹션, 메인 카테고리, 연락 섹션 등 */}
      </main>
    </div>
  );
}
```

### 1.2 CuratedBlock (섹션 상위 컴포넌트)

**파일: src/components/home/CuratedBlock.tsx**

- **section/block 타입**: `CuratedBlockProps` = `{ title, description, products: Product[] }`. products 없거나 길이 0이면 `null` 반환.
- **CTA**: 블록 내부에는 별도 “더보기” 없음. 상품 카드는 `CuratedProductCard`에서 `href={`/products/${product.id}`}`로 상세 이동.

```tsx
import type { Product } from "@/types/product";
import CuratedProductCard from "@/components/home/CuratedProductCard";

export type CuratedBlockProps = {
  title: string;
  description: string;
  products: Product[];
};

export default function CuratedBlock({ title, description, products }: CuratedBlockProps) {
  if (!products || products.length === 0) return null;

  return (
    <section className="space-y-4 rounded-none ...">
      <div className="flex flex-col gap-2 md:flex-row md:items-baseline md:justify-between">
        <div>
          <h4 className="font-card-title type-h3 ...">{title}</h4>
          <p className="mt-1 type-caption ...">{description}</p>
        </div>
      </div>
      <div className="flex flex-col space-y-3 md:grid md:grid-cols-3 md:gap-4">
        {products.map((product) => (
          <CuratedProductCard key={product.id} product={product} />
        ))}
      </div>
    </section>
  );
}
```

---

## 2. Home curated 데이터 로더 / 매퍼 / 타입

### 2.1 타입 정의

**파일: src/types/homeCurated.ts**

```ts
import type { Product } from "@/types/product";

export type HomeCuratedSettings = {
  id: string;
  setting_key: string;
  section_label: string;
  section_title: string;
  section_description: string;
  catalog_button_label: string;
  catalog_button_href: string;
  is_active: boolean;
  created_at?: string;
  updated_at?: string;
};

export type HomeCuratedSection = {
  id: string;
  setting_id: string;
  title: string;
  description: string;
  sort_order: number;
  max_items: number;
  is_active: boolean;
  created_at?: string;
};

export type HomeCuratedSectionWithCount = HomeCuratedSection & {
  product_count: number;
};

export type HomeCuratedSectionProduct = {
  id: string;
  section_id: string;
  product_id: string;
  sort_order: number;
  is_active: boolean;
  created_at?: string;
};

export type SectionProductMappingRow = HomeCuratedSectionProduct & {
  product: Product | null;
};

export type HomeCuratedSectionWithProducts = HomeCuratedSection & {
  products: Product[];
};

export type HomeCuratedData = {
  settings: HomeCuratedSettings | null;
  sections: HomeCuratedSectionWithProducts[];
};
```

### 2.2 데이터 로더 (fetch / normalize / mapper)

**파일: src/lib/homeCurated.ts**

- **fetch**: `home_curated_settings` (setting_key = 'home_curated') → `home_curated_sections` (setting_id, is_active, sort_order) → `home_curated_section_products` → `products` (id in productIds, is_active).
- **normalize**: `normalizeSettings(row)`, `normalizeSection(row)`.
- **mapper**: 섹션별 매핑 순서 유지해 `sectionsWithProducts` 구성. `sec.max_items`까지 slice.
- **캐시**: `unstable_cache(..., ["home-curated-data"], { revalidate: 60, tags: [CACHE_TAGS.HOME_CURATED] })`.

```ts
import { supabase } from "@/lib/supabase";
import { unstable_cache } from "next/cache";
import { CACHE_TAGS } from "@/lib/cacheTags";
import { normalizeProduct } from "@/lib/products";
import type {
  HomeCuratedSettings,
  HomeCuratedSection,
  HomeCuratedSectionWithProducts,
  HomeCuratedData,
} from "@/types/homeCurated";

function normalizeSettings(row: Record<string, unknown>): HomeCuratedSettings {
  return {
    id: String(row.id ?? ""),
    setting_key: String(row.setting_key ?? ""),
    section_label: String(row.section_label ?? ""),
    section_title: String(row.section_title ?? ""),
    section_description: String(row.section_description ?? ""),
    catalog_button_label: String(row.catalog_button_label ?? ""),
    catalog_button_href: String(row.catalog_button_href ?? "/products"),
    is_active: row.is_active === true,
    created_at: typeof row.created_at === "string" ? row.created_at : undefined,
    updated_at: typeof row.updated_at === "string" ? row.updated_at : undefined,
  };
}

function normalizeSection(row: Record<string, unknown>): HomeCuratedSection {
  return {
    id: String(row.id ?? ""),
    setting_id: String(row.setting_id ?? ""),
    title: String(row.title ?? ""),
    description: String(row.description ?? ""),
    sort_order: typeof row.sort_order === "number" ? row.sort_order : 0,
    max_items: typeof row.max_items === "number" ? Math.max(0, row.max_items) : 8,
    is_active: row.is_active === true,
    created_at: typeof row.created_at === "string" ? row.created_at : undefined,
  };
}

async function getHomeCuratedDataUncached(): Promise<HomeCuratedData> {
  // 1) home_curated_settings 조회 (setting_key = 'home_curated')
  // 2) is_active false면 { settings, sections: [] } 반환
  // 3) home_curated_sections 조회 (setting_id, is_active=true, order sort_order, created_at)
  // 4) home_curated_section_products 조회 (section_id in sectionIds, is_active=true, order sort_order, created_at)
  // 5) productIds로 products 테이블 조회 (is_active=true), normalizeProduct
  // 6) sectionProductsBySection 맵으로 섹션별 순서 유지, productMap에서 상품 채워 sectionsWithProducts 생성 (slice(0, sec.max_items))
  return { settings, sections: sectionsWithProducts };
}

export async function getHomeCuratedData(): Promise<HomeCuratedData> {
  return unstable_cache(getHomeCuratedDataUncached, ["home-curated-data"], {
    revalidate: 60,
    tags: [CACHE_TAGS.HOME_CURATED],
  })();
}
```

### 2.3 관리자 저장 타입 (API body)

**설정 PATCH — 파일: src/app/api/admin/home-curated/settings/route.ts**

```ts
type SettingsBody = {
  section_label?: string;
  section_title?: string;
  section_description?: string;
  catalog_button_label?: string;
  catalog_button_href?: string;
  is_active?: boolean;
};
```

**섹션 POST — 파일: src/app/api/admin/home-curated/sections/route.ts**

```ts
type SectionBody = {
  title?: string;
  description?: string;
  max_items?: number;
  sort_order?: number;
  is_active?: boolean;
};
```

저장 후: `revalidateTag(CACHE_TAGS.HOME_CURATED, REVALIDATE_MAX)` + `revalidatePath("/")`.

---

## 3. Region / Theme 랜딩 페이지

### 3.1 지역 랜딩

**파일: src/app/products/region/[slug]/page.tsx**

- **동작**: `getTaxonomyNameBySlug("category", slug)` → name 없으면 `redirect("/products")`, 있으면 `redirect(\`/products?region=${encodeURIComponent(name)}\`)`.
- **generateMetadata**: 없음 (리다이렉트 전용 페이지).

```tsx
import { redirect } from "next/navigation";
import { getTaxonomyNameBySlug } from "@/lib/productTaxonomies";

type RegionLandingProps = {
  params: Promise<{ slug: string }>;
};

export default async function ProductsRegionSlugPage({ params }: RegionLandingProps) {
  const { slug } = await params;
  const name = await getTaxonomyNameBySlug("category", slug);

  if (!name) {
    redirect("/products");
  }

  redirect(`/products?region=${encodeURIComponent(name)}`);
}
```

### 3.2 테마 랜딩

**파일: src/app/products/theme/[slug]/page.tsx**

- **동작**: `getTaxonomyNameBySlug("theme", slug)` → name 없으면 `redirect("/products")`, 있으면 `redirect(\`/products?theme=${encodeURIComponent(name)}\`)`.
- **generateMetadata**: 없음.

```tsx
import { redirect } from "next/navigation";
import { getTaxonomyNameBySlug } from "@/lib/productTaxonomies";

type ThemeLandingProps = {
  params: Promise<{ slug: string }>;
};

export default async function ProductsThemeSlugPage({ params }: ThemeLandingProps) {
  const { slug } = await params;
  const name = await getTaxonomyNameBySlug("theme", slug);

  if (!name) {
    redirect("/products");
  }

  redirect(`/products?theme=${encodeURIComponent(name)}`);
}
```

---

## 4. Landing 데이터 조회 로직

### 4.1 slug 기준 taxonomy 조회

**파일: src/lib/productTaxonomies.ts**

- **getTaxonomyNameBySlug(type, slug)**: slug 정규화 후 `getActiveTaxonomiesCached()`에서 type+slug 일치 항목 찾아 `name` 반환. 없으면 폴백 맵 사용.
- **폴백 맵**: `SLUG_TO_REGION_NAME`, `SLUG_TO_THEME_NAME` (japan→일본, golf→골프 등).

```ts
const SLUG_TO_REGION_NAME: Record<string, string> = {
  japan: "일본",
  "south-america": "남미",
  sea: "동남아",
  asia: "동남아",
  indonesia: "인도네시아",
  europe: "유럽",
  americas: "미국·남미",
  // ...
};
const SLUG_TO_THEME_NAME: Record<string, string> = {
  golf: "골프",
  "park-golf": "파크골프",
  premium: "프리미엄",
  group: "단체/동호회",
  honeymoon: "허니문",
  // ...
};

export async function getTaxonomyNameBySlug(
  type: "category" | "theme",
  slug: string,
): Promise<string | null> {
  const normalizedSlug = slug.trim().toLowerCase().replace(/\s+/g, "-");
  if (!normalizedSlug) return null;

  const rows = await getActiveTaxonomiesCached();
  if (rows) {
    const match = rows.find(
      (r) =>
        r.type === type &&
        typeof r.slug === "string" &&
        r.slug.trim().toLowerCase().replace(/\s+/g, "-") === normalizedSlug,
    );
    if (match) return String((match as Record<string, unknown>).name ?? "");
  }

  const fallback = type === "category" ? SLUG_TO_REGION_NAME : SLUG_TO_THEME_NAME;
  return fallback[normalizedSlug] ?? null;
}
```

### 4.2 Landing용 상품 조회

- **Region/theme 랜딩은 리다이렉트만 수행.** 실제 상품 목록은 `/products` 페이지에서 `getProducts()` + `getProductTaxonomyOptions(products)`로 조회하고, URL 쿼리 `region`/`theme`로 필터링 (`ProductsPageContent` → `ProductCatalogSection`).

### 4.3 getHeaderNavigationData() (taxonomy + home-curated 연결)

**파일: src/lib/headerNavigation.ts**

- **데이터 소스**: `getActiveTaxonomiesForHeader()` (taxonomy), `getHomeCuratedData()` (curated).
- **구성**: categories/themes → `regionGroupsFromTaxonomy`, `themeGroupsFromTaxonomy`. curated sections → `recommendedGroupsFromCurated`. 각 그룹의 leaf `href`는 `buildProductsHref("region"|"theme", name, slug)`로 생성 (slug 있으면 `/products/region/{slug}` 또는 `/products/theme/{slug}`).

```ts
import { unstable_cache } from "next/cache";
import { CACHE_TAGS } from "@/lib/cacheTags";
import type { HeaderNavigationData, HeaderNavGroup, HeaderNavLeafItem, HeaderPrimaryNavItem } from "@/components/header/headerNav.types";
import type { ProductTaxonomy } from "@/types/productTaxonomy";
import { getActiveTaxonomiesForHeader } from "@/lib/productTaxonomies";
import { getHomeCuratedData } from "@/lib/homeCurated";

function buildProductsHref(param: "region" | "theme", name: string, slug: string | null): string {
  const path = param === "region" ? "region" : "theme";
  if (slug && slug.trim()) {
    const normalized = slug.trim().toLowerCase().replace(/\s+/g, "-");
    return `/products/${path}/${encodeURIComponent(normalized)}`;
  }
  return `/products?${param}=${encodeURIComponent(name)}`;
}

function recommendedGroupsFromCurated(sections: { id: string; title: string }[]): HeaderNavGroup[] {
  // "이번 달 추천" + sections.slice(0,4) "보기" → /#section-{id}, "인기 상품" /products?sort=popular, "신규 상품" /products?sort=new
}

function regionGroupsFromTaxonomy(categories: ProductTaxonomy[]): HeaderNavGroup[] {
  const items: HeaderNavLeafItem[] = categories.map((c) => ({
    key: `region-${c.id}`,
    label: c.name,
    href: buildProductsHref("region", c.name, c.slug),
  }));
  return [{ key: "region-group", label: "지역별", items }];
}

function themeGroupsFromTaxonomy(themes: ProductTaxonomy[]): HeaderNavGroup[] {
  const items = themes.map((t) => ({
    key: `theme-${t.id}`,
    label: t.name,
    href: buildProductsHref("theme", t.name, t.slug),
  }));
  return [{ key: "theme-group", label: "테마별", items }];
}

async function getHeaderNavigationDataUncached(): Promise<HeaderNavigationData> {
  const [taxonomies, curated] = await Promise.all([
    getActiveTaxonomiesForHeader(),
    getHomeCuratedData(),
  ]);
  const categories = taxonomies.filter((t) => t.type === "category");
  const themes = taxonomies.filter((t) => t.type === "theme");
  const recommendedGroups = recommendedGroupsFromCurated(curated.sections.map((s) => ({ id: s.id, title: s.title })));
  const regionGroups = regionGroupsFromTaxonomy(categories);
  const themeGroups = themeGroupsFromTaxonomy(themes);

  const primaryNav: HeaderPrimaryNavItem[] = [
    { key: "recommended", label: "추천여행", groups: recommendedGroups.length > 0 ? recommendedGroups : [...] },
    { key: "region", label: "지역별 여행", groups: regionGroups },
    { key: "theme", label: "테마별 여행", groups: themeGroups },
    { key: "inquiry", label: "맞춤/단체문의", href: "/quote" },
    { key: "guides", label: "여행가이드", href: "/guides" },
    { key: "support", label: "고객센터", href: "/support" },
  ];
  return { primaryNav };
}

export async function getHeaderNavigationData(): Promise<HeaderNavigationData> {
  return unstable_cache(getHeaderNavigationDataUncached, ["header-navigation"], {
    revalidate: 60,
    tags: [CACHE_TAGS.HEADER_NAV, CACHE_TAGS.TAXONOMY, CACHE_TAGS.HOME_CURATED],
  })();
}
```

---

## 5. 홈/랜딩 CTA 실제 렌더 위치

### 5.1 홈 추천 상품 카드 (CuratedProductCard)

**파일: src/components/home/CuratedProductCard.tsx**

- **CTA**: 카드 전체가 `Link href={\`/products/${product.id}\`}`. 별도 버튼 텍스트 없음. 카드 클릭 = 상세 이동.
- **표시**: category 뱃지, getProductBadges(product), title, theme, description, price.

```tsx
import Link from "next/link";
import Image from "next/image";
import type { Product } from "@/types/product";
import { getProductBadges } from "@/lib/productCategory";

export default function CuratedProductCard({ product }: CuratedProductCardProps) {
  const badges = getProductBadges(product);
  return (
    <Link href={`/products/${product.id}`} className="group relative flex h-full flex-col ...">
      <div className="relative h-40 w-full ...">
        <Image src={product.image_url ?? ""} alt={...} fill sizes="..." className="object-cover" />
        ...
      </div>
      <div className="relative flex flex-1 flex-col gap-2 p-4">
        {/* category, badges, title, theme, description, price */}
      </div>
    </Link>
  );
}
```

### 5.2 섹션 “더보기/전체보기” CTA

- **위치**: `src/app/page.tsx` 추천 섹션 하단.
- **소스**: `curatedSettings.catalog_button_label`, `curatedSettings.catalog_button_href` (기본 "전체 상품 카탈로그 보기", "/products").
- **렌더**: `<Link href={curatedSettings.catalog_button_href}>{curatedSettings.catalog_button_label}</Link>`.

### 5.3 랜딩 Hero CTA

- **Region/theme 랜딩 페이지는 컴포넌트 없이 redirect만 하므로 별도 히어로/CTA 없음.**  
  실제 노출은 `/products`의 `ProductsHero` + 필터(region/theme) 적용.

### 5.4 랜딩 상품 카드/그리드

- **위치**: `src/app/products/page.tsx` → `ProductsPageContent` → `ProductCatalogSection`.
- **카드**: feature flag `ENABLE_NEW_PRODUCT_UI`이면 `ProductCardV2` (hrefDetail=`/products/${product.id}`, onClickConsult). 아니면 인라인 `Link` + article + “상세 보기” 텍스트.
- **CTA label**: ProductCardV2는 별도 ctaLabel 없음(카드 전체 링크 + “상담 문의” 칩). 구 UI는 “상세 보기”.

---

## 6. 공용 ProductCard 컴포넌트

### 6.1 ProductCard (기본)

**파일: src/components/ProductCard.tsx**

- **Props**: href, imageUrl, imageAlt, tags, title, description, price, duration, priceMeta, fuelSurchargeIncluded, hashtags, ctaLabel(기본 "상세 보기"), onCompareAdd, onBookmark, showCompareButton, showBookmarkButton.
- **CTA**: `<span className="...">{ctaLabel}</span>` (버튼 역할, Link 내부).

### 6.2 ProductCardV2 (목록/랜딩용)

**파일: src/components/products/ProductCardV2.tsx**

- **Props**: title, price, duration, region, categories, tags, status, badges, thumbnailUrl, hrefDetail, onClickDetail, onClickConsult, priceMeta, metaInfo.
- **CTA**: `hrefDetail` 있으면 카드 전체가 `Link href={hrefDetail}`. 없으면 `Card`에 onClick/onKeyDown. “상담 문의”/“대기 문의”는 `onClickConsult` 연동.

---

## 7. Taxonomy 메타 필드 / DB 구조

### 7.1 타입 (랜딩/헤더 연결)

**파일: src/types/productTaxonomy.ts**

```ts
export type ProductTaxonomyType = "category" | "theme";

export type ProductTaxonomy = {
  id: string;
  type: ProductTaxonomyType;
  name: string;
  slug: string | null;  // URL/헤더용. 비어 있으면 name 기반 쿼리
  is_active: boolean;
  sort_order: number | null;
  created_at: string | null;
};

export type ProductTaxonomyWithUsage = ProductTaxonomy & { usageCount: number; };
```

### 7.2 DB (product_taxonomies)

**파일: supabase/product_taxonomies.sql**

- **컬럼**: id (uuid), type (category|theme), name, slug (nullable), is_active (default true), sort_order (nullable), created_at.
- **제약**: unique (type, name). RLS 정책으로 anon select/insert/update/delete 허용.

---

## 8. Home curated DB (관리자 저장 구조)

**파일: supabase/home_curated.sql**

- **home_curated_settings**: setting_key(unique), section_label, section_title, section_description, catalog_button_label, catalog_button_href, is_active, created_at, updated_at.
- **home_curated_sections**: setting_id(FK), title, description, sort_order, max_items, is_active, created_at.
- **home_curated_section_products**: section_id(FK), product_id(FK), sort_order, is_active, created_at, unique(section_id, product_id).
- **기본 설정**: setting_key = 'home_curated', catalog_button_label = '전체 상품 카탈로그 보기', catalog_button_href = '/products'.

---

## 9. 요약: section/block/item 타입 구조

| 레이어 | 타입 | 비고 |
|--------|------|------|
| 설정 | HomeCuratedSettings | section_label, section_title, section_description, catalog_button_* |
| 섹션 | HomeCuratedSection | title, description, sort_order, max_items, is_active |
| 섹션+상품 | HomeCuratedSectionWithProducts | Section & { products: Product[] } |
| 블록(UI) | CuratedBlockProps | title, description, products |

---

## 10. 요약: CTA label/href/source 생성 위치

| CTA | label/href 소스 | 생성 위치 |
|-----|------------------|-----------|
| 홈 추천 전체보기 | catalog_button_label, catalog_button_href | home_curated_settings (DB) → page.tsx |
| 홈 추천 상품 카드 | 고정 `/products/${id}` | CuratedProductCard.tsx |
| 헤더 region/theme 링크 | buildProductsHref("region"\|"theme", name, slug) | headerNavigation.ts |
| 랜딩(리다이렉트) | `/products?region=` or `?theme=` | region/[slug], theme/[slug] page |
| 목록 상품 카드 | hrefDetail=`/products/${id}` | ProductCatalogSection → ProductCardV2 |

---

## 11. 요약: region/theme slug 연결 방식

- **헤더**: taxonomy의 `slug` 있으면 `buildProductsHref` → `/products/region/{slug}` 또는 `/products/theme/{slug}`. 없으면 `/products?region={name}` 또는 `?theme={name}`.
- **랜딩 페이지**: `/products/region/[slug]`, `/products/theme/[slug]`에서 `getTaxonomyNameBySlug(type, slug)`로 name 조회 후 `/products?region=...` 또는 `?theme=...`로 redirect.
- **published/visibility**: taxonomy는 `is_active`, section은 `is_active`, section_products는 `is_active`. order: taxonomy `sort_order`, sections `sort_order`+`created_at`, section_products `sort_order`+`created_at`. revalidate: HOME_CURATED 태그 + revalidatePath("/") (curated 저장 시).
