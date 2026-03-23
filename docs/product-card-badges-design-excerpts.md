# 상품 카드 배지 설계 검토용 코드 발췌

설명 최소 · 경로·함수·핵심 코드 위주. `신규/추천/인기` UI 설계 전 현재 구조·데이터 경로·관리 화면 분기 확인용.

---

## 1) 상품 카드 컴포넌트

### `src/components/products/ProductCard.tsx`

**한 줄:** 메인 카드 UI, `layout`·`badges`·이미지·칩·related 전용 오버레이 정의.

**관련:** `ProductCard`, `ProductCardProps`, `ProductCardLayout`, `ProductCardBadge`, `pickDisplayChips`, `displayChipSurfaceClass`

```tsx
export type ProductCardLayout = "grid" | "list" | "related" | "stack";

export type ProductCardProps = {
  // ...
  tags?: string[];
  status?: ProductCardStatus;
  badges?: ProductCardBadge[];
  /** grid | list: 가로 split. related: 상세 하단 세로형 */
  layout?: ProductCardLayout;
  maxTags?: number;
  /** related 레이아웃: 이미지 좌상단 강조 배지 (가이드 브리지 1순위 등) */
  topPickLabel?: string;
  /** related 레이아웃: 가격 아래 경험/구성 한 줄 */
  experienceSummary?: string;
  /** related + 가이드 브리지: 가격 아래 선택 이유 1줄(✔ 포함 권장). 없으면 미표시 */
  selectionHighlightLine?: string;
};

  const sortedBadges = [...badges].sort(
    (a, b) => (b.priority ?? 0) - (a.priority ?? 0),
  );
  const activeBadges = sortedBadges.filter((b) => b.isActive !== false);
  const displayChips = pickDisplayChips(status, activeBadges);

  const isListLayout = layout === "list";
  const isRelatedLayout = layout === "related";
```

**이미지 + related 상단 배지/칩 오버레이**

```tsx
  const relatedCardContent = (
    <div className="flex h-full flex-col">
      <div className="relative aspect-[4/3] w-full shrink-0 overflow-hidden bg-[var(--surface-muted)]">
        {(topPick || displayChips.length > 0) && (
          <div className="absolute left-2 top-2 z-10 flex max-w-[calc(100%-1rem)] flex-wrap items-start gap-1">
            {topPick ? (
              <span className="inline-flex max-w-[min(100%,10rem)] shrink-0 truncate rounded bg-[var(--primary)]/92 ...">
                {topPick}
              </span>
            ) : null}
            {displayChips.map((chip) => (
              <span key={`${chip.variant}-${chip.label}`} className={cn("inline-flex ...", displayChipSurfaceClass(chip.variant))}>
                {chip.label}
              </span>
            ))}
          </div>
        )}
        {thumbnailUrl ? (
          <Image src={normalizeProductImageUrl(thumbnailUrl)} alt={title || "상품 이미지"} fill ... />
        ) : ( ... )}
```

**grid/list: 좌측 이미지 + 우측 칩/제목/메타/태그**

```tsx
  const gridListCardContent = (
    <div className="flex min-h-[140px] w-full items-stretch">
      <div className={cn("relative shrink-0 ...", isListLayout ? "w-[38%] ..." : "w-[42%] ...")}>
        {thumbnailUrl ? <Image ... /> : ...}
      </div>
      <div className="flex min-w-0 flex-1 flex-col overflow-hidden p-4">
        <div className="flex items-start justify-between gap-2">
          {chipRow(false)}
          <CardRatingBlock ratingAvg={ratingAvg} reviewCount={reviewCount} className="pt-0.5" />
        </div>
        <div className="mt-1.5 min-w-0">{titleBlock(2, "sm")}</div>
        {oneLine ? <p className="mt-1 line-clamp-2 text-[11px] ...">{oneLine}</p> : null}
        {metaLine ? <p className={cn("line-clamp-1 text-[11px] ...")}>{metaLine}</p> : null}
        <div className="mt-2">{priceBlock}</div>
        <div className="mt-auto flex flex-col gap-2 pt-3">
          {tags.length > 0 ? (
            <div className="relative flex overflow-hidden">
              {tags.slice(0, maxTags).map((tag) => (
                <span key={tag} className="inline-flex ... rounded-full ...">#{tag}</span>
              ))}
```

```tsx
  const cardContent: ReactNode = isRelatedLayout ? relatedCardContent : gridListCardContent;
```

---

### `src/lib/productCardSignals.ts`

**한 줄:** `status` + `badges` → 최대 2개 칩(`pickDisplayChips`), 라벨/타입별 색 variant.

**관련:** `pickDisplayChips`, `badgeTypeToTagVariant`, `DisplayChip`

```ts
export function pickDisplayChips(
  status: ProductCardStatus | undefined,
  activeBadges: ProductCardBadge[],
): DisplayChip[] {
  const chips: DisplayChip[] = [];
  if (status === "SOLD_OUT") {
    chips.push({ label: "마감", variant: "muted" });
  } else if (status === "LIMITED") {
    chips.push({ label: "마감임박", variant: "gold" });
  } else if (status === "CONSULT_REQUIRED") {
    chips.push({ label: "상담 후 안내", variant: "muted" });
  }
  const rank = (b: ProductCardBadge): number => {
    const L = b.label.toLowerCase();
    if (L.includes("인기")) return 1;
    if (L.includes("추천")) return 2;
    // ...
  };
  // ...
  return chips.slice(0, 2);
}
```

---

### `src/components/product-detail/ProductCatalogSection.tsx`

**한 줄:** 목록 페이지에서 `ProductCard`(`layout="related"`) 또는 `ProductListCard`/`ProductListCardMobile`로 분기, `productToProductCardProps` 사용.

**관련:** `ProductCatalogSection`, `productToProductCardProps`, `cardLayout`

```tsx
import ProductCard from "@/components/products/ProductCard";
import { ProductCardGridSection } from "@/components/products/ProductCardGridSection";
import { productToProductCardProps } from "@/lib/productCardProps";

type ProductCatalogSectionProps = {
  products: Product[];
  // ...
  cardLayout?: "list" | "related";
};
```

```tsx
              {cardLayout === "related" ? (
                <ProductCardGridSection desktopGridCols={2} className="w-full max-w-[1344px]">
                  {group.products.map((product) => (
                    <ProductCard
                      key={product.id}
                      {...productToProductCardProps(product, {
                        layout: "related",
                        analyticsSource: "landing",
                        analyticsSection: "landing_catalog",
                      })}
                    />
                  ))}
                </ProductCardGridSection>
              ) : (
                <div className="flex w-full max-w-[1344px] flex-col gap-4 md:gap-5">
                  {group.products.map((product) => {
                    const cardProps = productToProductCardProps(product, {
                      analyticsSource: "product_list",
                      analyticsSection: "catalog",
                      onClickDetail: () => router.push(`/products/${product.id}`),
                      onClickConsult: () => handleProductConsult(product),
                    });
                    return (
                      <div key={product.id} className="w-full">
                        <div className="hidden md:block">
                          <ProductListCard {...cardProps} />
                        </div>
                        <div className="md:hidden">
                          <ProductListCardMobile {...cardProps} />
                        </div>
                      </div>
                    );
                  })}
```

---

### `src/components/products/ProductCardGridSection.tsx`

**한 줄:** 카드 그리드/모바일 레일 래퍼, `desktopGridCols`, `hubLandingLayout` 등 레이아웃 플래그.

**관련:** `ProductCardGridSection`, `desktopGridCols`, `hubLandingLayout`

```tsx
export type ProductCardGridSectionProps = {
  children: React.ReactNode;
  desktopGridCols?: 2 | 3 | 4;
  homeCuratedMobileCompact?: boolean;
  hubLandingLayout?: boolean;
  guideBridgeTopPicksLayout?: boolean;
  // ...
};
```

---

### `src/components/products/ProductListCard.tsx` (일부)

**한 줄:** `ProductCardProps` 재사용, 리스트 전용 레이아웃에서 동일 `pickDisplayChips` 패턴.

```tsx
import type { ProductCardProps } from "@/components/products/ProductCard";
import { displayChipSurfaceClass, pickDisplayChips } from "@/lib/productCardSignals";

export type ProductListCardProps = ProductCardProps;
```

---

## 2) 상품 데이터 전달 구조

### `src/types/product.ts`

**한 줄:** `Product` 도메인 타입, 플래그·taxonomy·캠페인 필드 위치.

**관련:** `Product`, `campaigns`, `is_recommend`, `is_popular`, `tags`, `theme`, `destination_id`

```ts
export type Product = {
  id: string;
  title: string;
  // ...
  destination_id?: string | null;
  product_line_id?: string | null;
  campaigns?: string[] | null;
  campaigns_json?: string[] | null;
  tags?: string[] | null;
  highlights?: string[] | null;
  // ...
  is_recommend?: boolean;
  is_popular?: boolean;
  sort_order?: number;
  created_at?: string;
  status?: "AVAILABLE" | "LIMITED" | "SOLD_OUT" | "CONSULT_REQUIRED";
  meta_title?: string;
  one_liner?: string;
  trust?: ProductTrust;
};
```

---

### `src/lib/products.ts` — `normalizeProduct` / 목록 조회

**한 줄:** Supabase row → `Product`; `is_recommend`/`is_popular` boolean 매핑.

```ts
    is_recommend: typeof row.is_recommend === "boolean" ? row.is_recommend : undefined,
    is_popular: typeof row.is_popular === "boolean" ? row.is_popular : undefined,
```

```ts
/** 패키지상품 목록용: is_active인 전체 상품 (추천 여부 무관) */
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
  // ...
  return (advancedQuery.data ?? []).map((row) => normalizeProduct(row as Record<string, unknown>));
  },
  ["products:list"],
  { revalidate: 60, tags: [CACHE_TAGS.PRODUCTS] },
);
```

---

### `src/lib/productCategory.ts`

**한 줄:** 카드 배지용 문자열은 **`product.theme` 토큰**에서 `제철`/`인기`/`마감임박` 우선 추출 (DB 플래그와 별개).

```ts
const PRIMARY_BADGE_ORDER = ["제철", "인기", "마감임박"];

export function getProductBadges(product: Product) {
  const values = splitTheme(product.theme);
  const unique = Array.from(new Set(values));
  const prioritized = PRIMARY_BADGE_ORDER.filter((badge) => unique.includes(badge));
  const rest = unique.filter((badge) => !PRIMARY_BADGE_ORDER.includes(badge));
  return [...prioritized, ...rest].slice(0, 3);
}
```

---

### `src/lib/productCardProps.ts`

**한 줄:** `Product` → `ProductCard` props; **테마 배지 + `is_popular`/`is_recommend`를 `badges` 배열로 합성**; 태그는 `meta_title` 파싱.

**관련:** `productToProductCardProps`, `buildProductCardBadges`, `getProductBadges`

```ts
export function buildProductCardBadges(product: Product): ProductCardBadge[] {
  const themeBadges = getProductBadges(product);
  return themeBadges.map((label) => ({
    type: PRIORITY_BADGES.includes(label) ? "gold" : "muted",
    label,
    priority: PRIORITY_BADGES.includes(label) ? 5 : 0,
    isActive: true,
  }));
}

export function productToProductCardProps(
  product: Product,
  overrides?: ProductToProductCardOverrides,
): Omit<ProductCardProps, "onClickDetail" | "onClickConsult"> & ProductToProductCardOverrides {
  const status: ProductCardStatus = (product.status ?? "AVAILABLE") as ProductCardStatus;
  const baseBadges: ProductCardBadge[] = [
    ...buildProductCardBadges(product),
    ...(product.is_popular ? [{ type: "accent", label: "인기", priority: 10, isActive: true }] : []),
    ...(product.is_recommend ? [{ type: "accent", label: "추천", priority: 9, isActive: true }] : []),
  ];
  return {
    title: product.title,
    // ...
    tags: parseMetaTitleAsHashtags(product.meta_title),
    status,
    badges: baseBadges,
    thumbnailUrl: getPrimaryImageUrl(product),
    oneLiner: product.one_liner?.trim() || undefined,
    ratingAvg: product.trust?.ratingAvg,
    reviewCount: product.trust?.reviewCount,
    hrefDetail: `/products/${product.id}`,
    productId: product.id,
    layout: "grid",
    ...overrides,
  };
}
```

**랜딩용 한 줄 카피 (`is_popular` 폴백)**

```ts
export function getFeaturedHighlightLine(product: Product): string | undefined {
  // ... duration, stay, meta, theme, category, tags ...
  if (product.is_popular) return "✔ 인기 일정";
  return undefined;
}
```

---

### `src/components/products/HomeProductCard.tsx` (참고)

**한 줄:** 홈 큐레이션 카드에서도 `is_popular`/`is_recommend`를 badges에 직접 추가 (ProductCard와 유사 패턴).

```tsx
    ...(product.is_popular ? [{ type: "accent", label: "인기", priority: 10, isActive: true }] : []),
    ...(product.is_recommend ? [{ type: "accent", label: "추천", priority: 9, isActive: true }] : []),
```

---

### `src/lib/productFilters.ts` (컬렉션 필터)

**한 줄:** URL `collection`으로 `is_recommend` / `is_popular` 필터 (목록 데이터는 동일 `getProducts`).

```ts
    if (c === "recommend") {
      list = list.filter((p) => p.is_recommend === true);
    }
    if (c === "popular") {
      list = list.filter((p) => p.is_popular === true);
    }
```

---

## 3) `/theall_manager_only/products?view=taxonomy`

### 엔트리

- `src/app/theall_manager_only/products/page.tsx` → `export { default } from "@/app/admin/products/page";`
- `src/app/admin/products/page.tsx` → `<AdminProductManager />`

### `src/components/admin/products/AdminProductManager.tsx`

**한 줄:** `view=taxonomy`일 때 `AdminProductTaxonomyView`만 렌더; 상품 폼의 **기획/추천**은 taxonomy **campaign 옵션**을 토글해 `form.campaigns`에 반영.

**관련:** `isTaxonomyView`, `ADMIN_PRODUCTS_VIEW.TAXONOMY`, `toggleCampaign`, `AdminProductTaxonomyView`

```tsx
  const viewParam = searchParams.get(ADMIN_PRODUCTS_QUERY_KEYS.VIEW);
  const isTaxonomyView = viewParam === ADMIN_PRODUCTS_VIEW.TAXONOMY;
```

```tsx
      {isTaxonomyView && (
        <AdminProductTaxonomyView
          activeTab={taxonomyController.activeTab}
          // ...
          onUpdateTaxonomy={taxonomyController.handleUpdateTaxonomy}
        />
      )}
```

```tsx
  function toggleCampaign(name: string) {
    setForm((prev) => {
      const current = parseCampaignsList(prev.campaigns);
      const next = current.includes(name)
        ? current.filter((item) => item !== name)
        : [...current, name];
      return { ...prev, campaigns: stringifyCampaignsList(next) };
    });
  }
```

**상품 폼 — 기획/추천 UI (taxonomy의 campaign 목록과 연동)**

```tsx
          <div className="space-y-2">
            <p className="text-xs font-semibold text-[var(--text-primary)]">기획/추천</p>
            <div className="flex flex-wrap gap-2">
              {activeCampaignOptions.length === 0 ? (
                <span className="...">기획 항목을 먼저 추가해 주세요 (지역·테마 관리)</span>
              ) : (
                activeCampaignOptions.map((item) => {
                  const selected = selectedCampaigns.includes(item.name);
                  return (
                    <button type="button" key={item.id} onClick={() => toggleCampaign(item.name)} ...>
                      {item.name}
                    </button>
                  );
                })
              )}
            </div>
            <p className="text-xs text-[var(--text-muted)]">선택된 기획/추천: {selectedCampaigns.join(", ") || "-"}</p>
          </div>
```

---

### `src/components/admin/products/AdminProductTaxonomyView.tsx`

**한 줄:** 탭에 `campaign` = **「기획/추천 관리」**; 지역/테마/상품군/기획/태그 taxonomy CRUD UI.

```tsx
const TAB_LABELS: Record<TaxonomyType, string> = {
  destination: "지역 관리",
  theme: "테마 관리",
  product_line: "상품군 관리",
  campaign: "기획/추천 관리",
  tag: "태그",
};
```

---

### `src/components/admin/products/hooks/useAdminProductTaxonomyController.ts`

**한 줄:** 저장 시 `updateAdminProductTaxonomy(id, payload)` 호출.

```ts
  async function handleUpdateTaxonomy(
    item: ProductTaxonomyWithUsage,
    payload: UpdateAdminTaxonomyPayload,
  ) {
    // ...
    await updateAdminProductTaxonomy(item.id, payload);
    await loadTaxonomies(activeTab);
  }
```

---

### `src/components/admin/products/api/adminProductTaxonomy.client.ts`

**한 줄:** taxonomy PATCH payload 타입·`fetch` 호출.

```ts
export async function updateAdminProductTaxonomy(
  id: string,
  payload: UpdateAdminTaxonomyPayload,
): Promise<void> {
  const response = await fetch(`${BASE}/${id}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  // ...
}
```

---

### `src/components/admin/products/editor/adminProductForm.serializer.ts`

**한 줄:** 상품 저장 시 `campaigns` → 문자열 배열로 직렬화 (DB `campaigns`/`campaigns_json` 계열).

```ts
    campaigns: ((): string[] | null => {
      const s = form.campaigns.trim();
      if (!s) return null;
      const arr = s.split(/[,\s]+/).map((v) => v.trim()).filter(Boolean);
      return arr.length > 0 ? arr : null;
    })(),
```

---

### `src/app/api/admin/products/[id]/route.ts`

**한 줄:** PATCH 시 `campaigns` → `campaigns_json` 갱신. (**본 발췌 범위에서 `is_recommend` / `is_popular` 필드는 ProductBody·updates에 없음**.)

```ts
  if (body.campaigns !== undefined) {
    updates.campaigns_json =
      Array.isArray(body.campaigns) && body.campaigns.length > 0
        ? body.campaigns.filter((v): v is string => typeof v === "string").map((v) => v.trim()).filter(Boolean)
        : null;
  }
```

---

## 4) 관리자 저장 → 사용자 카드 반영 경로 (요약)

1. **목록 공통:** `getProducts()` → `supabase.from("products").select("*")` → `normalizeProduct` → `Product[]`.
2. **카드 매핑:** `productToProductCardProps(product)` (`src/lib/productCardProps.ts`)에서 `badges`/`tags`/`oneLiner` 등 조합.
3. **칩 상한:** `pickDisplayChips`로 **최대 2개** (`src/lib/productCardSignals.ts`).
4. **인기/추천 배지:** `product.is_popular` / `product.is_recommend` → `ProductCardBadge`로 합류 (**현재 관리자 serializer/API PATCH에 해당 필드 없음 → DB에만 있거나 별도 경로로만 세팅되는 상태일 수 있음**).
5. **기획 taxonomy:** `view=taxonomy`의 **campaign**은 **상품의 `campaigns` 문자열 배열**과 상품 폼 토글로 연결; 카드로 직접 노출하는 전용 배지 파이프는 **별도 설계 필요** (`Product`의 `campaigns`는 타입에 있으나 `productToProductCardProps` 기본 출력에는 badge 합성 없음).

---

## badge UI 설계 시 수정이 필요해 보이는 파일

| 파일 | 이유 |
|------|------|
| `src/components/products/ProductCard.tsx` | 칩/오버레이/related·grid 레이아웃 |
| `src/lib/productCardSignals.ts` | 칩 개수·우선순위·variant 규칙 |
| `src/lib/productCardProps.ts` | `Product` → `badges`/`tags` 조합 단일 진입점 |
| `src/lib/productCategory.ts` | 테마 문자열 기반 `getProductBadges`와 DB 플래그 중복·충돌 정리 |
| `src/components/products/ProductListCard.tsx` / `ProductListCardMobile.tsx` | 리스트 변형 동기화 |
| `src/components/products/HomeProductCard.tsx` | 홈 전용 배지 로직 중복 시 통합 |
| `src/components/admin/products/editor/adminProductForm.serializer.ts` + `src/app/api/admin/products/[id]/route.ts` | 신규 플래그/문구 필드 저장 시 |
| `src/types/product.ts` | 스키마·타입 |

---

## reason text override(카드별 문구)까지 붙이려면 추가로 볼 지점

| 지점 | 내용 |
|------|------|
| `Product` 타입 + `normalizeProduct` | override 필드(예: `card_badge_reason`) 추가 시 매핑 |
| 관리자 폼 + serializer + PATCH route | 입력·저장·검증 |
| `productToProductCardProps` | 새 필드를 `badges[].label` 또는 전용 prop(예: `selectionHighlightLine`/`oneLiner` 오버라이드)으로 전달 |
| `ProductCard` | related/grid 각각에서 문구 슬롯이 이미 있음 (`selectionHighlightLine`, `oneLiner`, `experienceSummary`) — **어느 슬롯에 넣을지 정책**만 맞추면 됨 |
| `getFeaturedHighlightLine` / `buildGuideBridgeSelectionLine` | 랜딩·브리지용 자동 문구와 **수동 override 우선순위** 정의 |

---

## 검토 시 주의 (코드 기준 사실)

- **`view=taxonomy`는 상품 row의 `is_recommend`/`is_popular` 토글 UI가 아님** — taxonomy(지역·테마·**기획 campaign**·태그) 관리 + 상품 폼에서 campaign 이름 다중 선택.
- **`신규` 카드 배지:** `created_at` 기반 노출은 현재 `productToProductCardProps` / `ProductCard` 기본 경로에 **없음** (`collection=new`는 정렬 성격).
- **`is_recommend`/`is_popular`:** 읽기 경로(`normalizeProduct`)와 카드 합성에는 있으나, **본 발췌 기준 admin PATCH payload 타입에 필드 부재** — 운영에서 어떻게 켜지는지 DB/다른 API와 대조 필요.
