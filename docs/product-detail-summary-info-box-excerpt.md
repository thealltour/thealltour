# 상품 상세 페이지 상단·정보 박스 코드 발췌

상품상세페이지 상단 섹션과 하단 정보 박스(여행기간/출발지역/숙소/여행스타일/가격) 관련 코드를 진입 파일 → 상단 섹션 → 정보 박스 컴포넌트 순으로 정리한 발췌본입니다.

---

## 1. 진입: 상품 상세 페이지 (ProductDetailV2 호출)

**파일 경로:** `src/app/products/[id]/page.tsx`

**관련 부분:** 상단 레이아웃과 `ProductDetailV2` 렌더 구간

```tsx
        <div className="min-h-screen bg-gradient-to-b from-[#f3f8ff] to-white py-6 sm:py-10 md:py-14">
        <PageContainer size="wide">
          <main className="w-full">
            <div className="mb-6 md:hidden">
              <Link
                href="/products"
                className="inline-flex items-center gap-1 rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700 transition hover:bg-slate-50"
              >
                ← 상품 목록으로
              </Link>
            </div>

            <div className="flex gap-8 xl:gap-10 lg:items-start">
            <div className="min-w-0 flex-1 space-y-8 pb-[calc(5.5rem+env(safe-area-inset-bottom,0px))] md:pb-0">
              <section className="rounded-none bg-transparent shadow-none ring-0 sm:rounded-3xl sm:bg-white sm:shadow-md sm:ring-1 sm:ring-[#dbeafe]">
                <script
                  type="application/ld+json"
                  dangerouslySetInnerHTML={{ __html: JSON.stringify(productJsonLd) }}
                />
                <div className="p-0 sm:p-6 md:p-8">
                  <ProductDetailV2
                    title={product.title}
                    region={product.theme}
                    category={product.category}
                    statusTag={statusV2}
                    oneLiner={oneLiner}
                    priceFormatted={formattedPrice}
                    duration={product.duration}
                    priceMeta={product.price_meta || "1인 기준"}
                    fuelIncluded={product.fuel_included}
                    includedItems={resolvedIncludedItems ?? ""}
                    excludedItems={resolvedExcludedItems ?? ""}
                    detailedSchedule={product.detailed_schedule ?? product.itinerary ?? ""}
                    optionalTours={resolvedOptionalTours ?? ""}
                    minDeparturePeople={product.min_departure_people ?? ""}
                    termsAndNotes={resolvedTermsAndNotes ?? ""}
                    consultHref={`/quote?productId=${encodeURIComponent(product.id)}`}
                    productId={product.id}
                    productTitle={product.title}
                    sourcePath={sourcePath}
                    kakaoHref={kakaoHref}
                    trust={product.trust}
                    options={product.options}
                    basePrice={product.price}
                    product={product}
                    overviewFallbackUrl={product.image_url}
                    reviewSummary={productReviewStats.reviewCount > 0 ? { averageRating: productReviewStats.averageRating, reviewCount: productReviewStats.reviewCount } : undefined}
                  />
                </div>
              </section>
```

- 상단 히어로/요약은 `ProductDetailV2` 내부에서 렌더됩니다.
- 박스 레이아웃·spacing은 위 `section` / `div`(p-0 sm:p-6 md:p-8)와 `ProductDetailV2`·`ProductSummaryInfo` 내부 클래스에 의해 결정됩니다.

---

## 2. 상단 히어로·요약 섹션 + 정보 박스 호출

**파일 경로:** `src/components/products/ProductDetailV2.tsx`

**관련 함수/변수:**
- `hasSummaryData` (useMemo)
- 기본 export 컴포넌트 `ProductDetailV2`의 상단 섹션(히어로~캐러셀~정보 박스)

### 표시 여부 로직 (정보 박스 렌더 조건)

```tsx
  /** PR40: 상품 요약 블록 표시 여부 (값이 하나라도 있을 때만) */
  const hasSummaryData = useMemo(() => {
    const d = product?.duration ?? duration;
    const dep = product?.departure ?? product?.overview_region ?? product?.theme;
    const air = product?.airline ?? product?.departure_flight_name;
    const hot = product?.hotel ?? product?.overview_accommodation;
    const style = product?.travelStyle ?? product?.theme;
    const pr = typeof product?.price === "number" && product.price > 0 ? product.price : undefined;
    return Boolean(d || dep || air || hot || style || pr);
  }, [product, duration]);
```

### 상단 섹션(히어로 ~ 캐러셀 ~ 정보 박스) 전체 발췌

```tsx
  return (
    <div className="space-y-8">
      {/* DetailHero */}
      <section className="space-y-5">
        {/* TagRow: 상태 우선, 그 다음 지역/카테고리 */}
        <div className="flex flex-wrap items-center gap-2">
          {statusTag != null && (
            <Tag variant={statusTag === "AVAILABLE" ? "accent" : statusTag === "LIMITED" ? "gold" : "muted"} size="sm">
              {STATUS_LABELS[statusTag]}
            </Tag>
          )}
          {region ? (
            <Tag variant="accent" size="sm">
              {region}
            </Tag>
          ) : null}
          {category ? (
            <Tag variant="accent" size="sm">
              {category}
            </Tag>
          ) : null}
        </div>

        <h1 className="font-card-title text-2xl font-bold leading-tight text-[#0f172a] md:text-3xl">
          {title || "상품명"}
        </h1>

        {reviewSummary && reviewSummary.reviewCount > 0 && (
          <a
            href="#reviews"
            className="mt-2 inline-flex items-center gap-1.5 rounded-full bg-amber-50 px-3 py-1.5 text-sm font-medium text-amber-800 transition hover:bg-amber-100"
          >
            <span className="text-amber-500">★</span>
            <span>{reviewSummary.averageRating.toFixed(1)}</span>
            <span className="text-slate-500">(후기 {reviewSummary.reviewCount})</span>
          </a>
        )}

        {oneLiner ? (
          <p className="mt-2 whitespace-pre-wrap text-sm leading-6 text-slate-600 md:text-[15px]">{oneLiner}</p>
        ) : null}

        {/* Price Summary Card: 모바일에서만, 캐러셀 위에 배치해 첫 화면에서 가격 노출 */}
        <Card
          variant="default"
          className="mt-4 border-[#dbeafe] bg-[#f8fbff] p-5 ring-[#dbeafe] md:hidden"
        >
          ...
        </Card>

        <div className="mt-5">
          <ProductImageCarousel images={galleryImages} showPlaceholderWhenEmpty />
        </div>

        {/* PR40: 상품 핵심 요약 정보 블록 (Hero 바로 아래) */}
        {hasSummaryData && (
          <div className="mt-6">
            <ProductSummaryInfo
              duration={product?.duration ?? duration}
              departure={product?.departure ?? product?.overview_region ?? product?.theme}
              airline={product?.airline ?? product?.departure_flight_name}
              hotel={product?.hotel ?? product?.overview_accommodation}
              travelStyle={product?.travelStyle ?? product?.theme}
              price={product?.price}
            />
          </div>
        )}
        ...
```

- **레이아웃:** 상단 섹션은 `section className="space-y-5"`, 정보 박스는 `mt-6`으로 캐러셀 바로 아래 배치.
- **반응형:** 제목만 `text-2xl` / `md:text-3xl`, 가격 카드는 `md:hidden`. 정보 박스 자체에는 별도 breakpoint 클래스 없음.

---

## 3. 정보 박스 컴포넌트 (라벨·값·가격·스타일 전부)

**파일 경로:** `src/components/products/ProductSummaryInfo.tsx`

**컴포넌트명:** `ProductSummaryInfo` (default export)

### 전체 코드 (복사용)

```tsx
type ProductSummaryInfoProps = {
  duration?: string;
  departure?: string;
  airline?: string;
  hotel?: string;
  travelStyle?: string;
  price?: number;
};

export default function ProductSummaryInfo({
  duration,
  departure,
  airline,
  hotel,
  travelStyle,
  price,
}: ProductSummaryInfoProps) {
  const hasAny = duration || departure || airline || hotel || travelStyle || (typeof price === "number" && price > 0);
  if (!hasAny) return null;

  return (
    <section
      className="rounded-xl border border-slate-200 bg-white p-4 space-y-4"
      aria-label="상품 핵심 요약"
    >
      <div className="grid grid-cols-2 gap-y-3 gap-x-4 text-sm">
        {duration && (
          <>
            <span className="text-slate-500">여행기간</span>
            <span className="text-slate-900">{duration}</span>
          </>
        )}

        {departure && (
          <>
            <span className="text-slate-500">출발지역</span>
            <span className="text-slate-900">{departure}</span>
          </>
        )}

        {airline && (
          <>
            <span className="text-slate-500">항공</span>
            <span className="text-slate-900">{airline}</span>
          </>
        )}

        {hotel && (
          <>
            <span className="text-slate-500">숙소</span>
            <span className="text-slate-900">{hotel}</span>
          </>
        )}

        {travelStyle && (
          <>
            <span className="text-slate-500">여행스타일</span>
            <span className="text-slate-900">{travelStyle}</span>
          </>
        )}
      </div>

      {typeof price === "number" && price > 0 && (
        <div className="pt-3 border-t border-slate-200 flex items-center justify-between">
          <span className="text-sm text-slate-500">가격</span>
          <span className="text-lg font-semibold text-slate-900">
            {price.toLocaleString()}원~
          </span>
        </div>
      )}
    </section>
  );
}
```

### 레이아웃·spacing·타이포 요약

| 구분 | 클래스 | 역할 |
|------|--------|------|
| 섹션 | `rounded-xl border border-slate-200 bg-white p-4 space-y-4` | 박스 컨테이너, 패딩, 블록 간 간격 |
| 정보 그리드 | `grid grid-cols-2 gap-y-3 gap-x-4 text-sm` | 2열 그리드, **가로 간격 gap-x-4(1rem)** → 라벨과 값이 멀어 보이는 주된 원인 |
| 라벨 | `text-slate-500` | 여행기간/출발지역/숙소/여행스타일/가격 라벨 |
| 값 | `text-slate-900` | 값 텍스트 |
| 가격 영역 | `pt-3 border-t border-slate-200 flex items-center justify-between` | 상단 구분선, 가격 라벨·금액 가로 배치 |
| 가격 라벨 | `text-sm text-slate-500` | "가격" |
| 가격 값 | `text-lg font-semibold text-slate-900` | "N원~" |

**반응형:** 이 컴포넌트에는 `sm:`, `md:`, `lg:` 등 breakpoint 클래스가 없습니다. 모든 해상도에서 동일한 `grid-cols-2`, `gap-x-4`가 적용됩니다.

---

## 4. 정리

- **진입:** `src/app/products/[id]/page.tsx` → `ProductDetailV2`를 `p-0 sm:p-6 md:p-8` 컨테이너 안에서 렌더.
- **상단 섹션·정보 박스 호출:** `src/components/products/ProductDetailV2.tsx`의 `hasSummaryData`와 `section` + `mt-6` 래퍼에서 `ProductSummaryInfo` 호출.
- **정보 박스 구현:** `src/components/products/ProductSummaryInfo.tsx` 한 파일에 여행기간/출발지역/숙소/여행스타일/가격 전부 포함. 가독성 개선 시 수정할 핵심은 **`ProductSummaryInfo.tsx`의 `grid grid-cols-2 gap-x-4`**입니다. `gap-x-4` 축소 또는 라벨·값을 한 셀에 묶는 구조로 바꾸면 라벨과 값 사이 거리를 줄일 수 있습니다.
