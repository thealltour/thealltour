# 모두투어 연동 상품 가격구간(비수기·주말·성수기) 전환 — 사전 코드 발췌

이 문서는 **단일가 → 가격구간형 + 안내문** 설계를 위해 저장소에서 추출한 원문입니다.  
파일은 **요청 우선순위(카드 → 상세 → 타입/포맷터 → 관리자 → modetour import → 페이지 호출부)**에 가깝게 정렬했습니다.

- 검색 키워드 `salePrice`, `originalPrice`, `discountPrice`, `startingPrice` 는 현재 코드베이스에서 **매치 없음**이었습니다. 가격은 주로 `price`, `price_meta`, `options`(JSON), `formatPriceKR` 등으로 다룹니다.
- `ProductCard`의 `layout: "related"` 분기는 예: `productCardProps.ts`(연관 섹션 자동), `ProductCatalogSection.tsx`, `CuratedBlock.tsx`, `guides/[slug]/page.tsx` 등에서 사용됩니다. (문자열 `layout="related"` 속성 형태는 거의 없고, 객체 spread로 전달되는 패턴이 많습니다.)
- 상세 페이지 부가 카드(`ProductFeatureCard`, `ProductHotelCard` 등)는 **목록 가격 노출과 무관**한 UI 블록이 많아, 본 발췌에서는 제외했습니다. 필요 시 별도 요청으로 포함할 수 있습니다.

---



---

## 포함 파일 목록 (본문 순서와 동일)

1. `src/components/products/ProductCard.tsx`
2. `src/components/products/ProductListCard.tsx`
3. `src/components/products/ProductListCardMobile.tsx`
4. `src/components/products/HomeProductCard.tsx`
5. `src/components/product/HomeProductCard.tsx`
6. `src/components/products/ProductCardGridSection.tsx`
7. `src/components/products/ProductCampaignBadge.tsx`
8. `src/lib/productCardProps.ts`
9. `src/lib/productCardSignals.ts`
10. `src/lib/productCampaignBadges.ts`
11. `src/lib/productCampaignPresentation.ts`
12. `src/lib/analytics/trackProductClick.ts`
13. `src/components/dev/DevProductCardV2Grid.tsx`
14. `src/components/products/ProductRelatedProducts.tsx`
15. `src/components/products/RelatedProductsSection.tsx`
16. `src/components/search/RelatedProductsSection.tsx`
17. `src/components/search/SearchResults.tsx`
18. `src/components/home/CuratedBlock.tsx`
19. `src/components/home/CuratedSectionScrollBlock.tsx`
20. `src/components/products/landing/ProductLandingPage.tsx`
21. `src/components/product-detail/ProductCatalogSection.tsx`
22. `src/components/products/ProductsPageContent.tsx`
23. `src/app/products/[id]/page.tsx`
24. `src/components/products/ProductDetailV2.tsx`
25. `src/components/products/ProductDetailStickyV2.tsx`
26. `src/components/products/QuoteSummary.tsx`
27. `src/components/products/ProductQuoteContext.tsx`
28. `src/components/product-detail/ProductDetailTabs.tsx`
29. `src/components/product-detail/ProductsHero.tsx`
30. `src/types/product.ts`
31. `src/types/adminProductForm.ts`
32. `src/types/productLanding.ts`
33. `src/types/productCampaignCard.ts`
34. `src/types/modetourImport.ts`
35. `src/lib/pricing/calcQuote.ts`
36. `src/lib/admin/productPreview.ts`
37. `src/lib/products.ts`
38. `src/lib/products/getRelatedProducts.ts`
39. `src/app/api/admin/products/[id]/route.ts`
40. `src/components/admin/products/AdminProductManager.tsx`
41. `src/components/admin/products/editor/ProductEditorSections.tsx`
42. `src/components/admin/products/editor/sections/BasicInfoSection.tsx`
43. `src/components/admin/products/editor/sections/RemainingAccordionSections.tsx`
44. `src/components/admin/products/editor/adminProductForm.types.ts`
45. `src/components/admin/products/editor/adminProductForm.defaults.ts`
46. `src/components/admin/products/editor/adminProductForm.serializer.ts`
47. `src/components/admin/products/editor/adminProductForm.deserializer.ts`
48. `src/components/admin/products/editor/adminProductForm.validation.ts`
49. `src/components/admin/products/editor/adminProductPreview.mapper.ts`
50. `src/lib/admin/modetourImport/mapToDraft.ts`
51. `src/lib/admin/modetourImport/validate.ts`
52. `src/lib/admin/modetourImport/index.ts`
53. `src/components/admin/modetour/ModetourNewProductPage.tsx`
54. `src/app/admin/products/new-modetour/page.tsx`
55. `src/app/theall_manager_only/products/new-modetour/page.tsx`
56. `src/app/products/page.tsx`
57. `src/app/products/region/[slug]/page.tsx`
58. `src/app/products/theme/[slug]/page.tsx`
59. `src/app/destinations/[slug]/page.tsx`
60. `src/app/themes/[slug]/page.tsx`
61. `src/app/search/page.tsx`
62. `src/app/guides/[slug]/page.tsx`
63. `src/components/admin/AdminInquiryTable.tsx` *(문서 **하단** 보강: 문의 스냅샷 견적 표시의 `formatPrice`)*

---

## File: `src/components/products/ProductCard.tsx`

```tsx
"use client";

import type { ReactNode } from "react";
import Image from "next/image";
import Link from "next/link";
import { useState } from "react";
import { Star } from "lucide-react";
import { Card } from "@/components/ui/Card";
import { normalizeProductImageUrl } from "@/lib/media/normalizeProductImageUrl";
import { buttonVariants } from "@/components/ui/Button";
import { trackProductCardClick } from "@/lib/analytics/trackProductClick";
import { CARD_TRANSITION } from "@/lib/cardTokens";
import { cn } from "@/lib/cn";
import type { CampaignCardKind } from "@/lib/productCampaignPresentation";
import { resolveCampaignCardKind } from "@/lib/productCampaignPresentation";
import { infoDisplayChipSurfaceClass, pickInfoDisplayChips } from "@/lib/productCardSignals";
import { ProductCampaignBadge } from "@/components/products/ProductCampaignBadge";

export type ProductCardStatus =
  | "AVAILABLE"
  | "LIMITED"
  | "SOLD_OUT"
  | "CONSULT_REQUIRED";

export type ProductCardBadge = {
  type: string;
  label: string;
  priority?: number;
  isActive?: boolean;
  /** PR3: taxonomy badge_tone — 있으면 라벨 기반 톤 추론 생략 */
  campaignTone?: "primary" | "highlight" | "neutral";
};

export type ProductCardLayout = "grid" | "list" | "related" | "stack";

export type ProductCardProps = {
  title?: string;
  price?: number | string;
  duration?: string;
  region?: string;
  categories?: string[];
  tags?: string[];
  status?: ProductCardStatus;
  /** 기획/추천(campaign) 대표 배지 — 이미지 오버레이 전용, 최대 2개 권장 */
  badges?: ProductCardBadge[];
  /** 테마·카테고리 등 정보성 배지 — 본문 칩 행 전용 (대표 배지와 분리) */
  infoBadges?: ProductCardBadge[];
  thumbnailUrl?: string;
  /** 상세 페이지 URL. 있으면 카드 전체가 이 주소로 이동하는 링크 영역이 됨 */
  hrefDetail?: string;
  onClickDetail?: () => void;
  onClickConsult?: () => void;
  /** 가격 기준 설명 (예: "1인 기준") */
  priceMeta?: string;
  /** 항공 포함 여부 등 메타 문구 */
  metaInfo?: string;
  /** 한 줄 선택 이유 (제목 아래) */
  oneLiner?: string;
  /** 평균 별점 (trust) */
  ratingAvg?: number;
  reviewCount?: number;
  /** 상품 카드 클릭 계측용 (선택). 설정 시 클릭 시 product_card_click 전송 */
  analyticsSource?: "product_list" | "landing" | "home_curated";
  analyticsSection?: string;
  /** 계측 시 사용할 상품 ID (analyticsSource 설정 시 권장) */
  productId?: string;
  /** grid | list: 가로 split. related: 상세 하단 세로형 */
  layout?: ProductCardLayout;
  /** 태그 최대 노출 개수 (기본 2) */
  maxTags?: number;
  /** 여행 오버뷰: 숙소 (/products 카드용) */
  overviewStay?: string;
  /** 여행 오버뷰: 지역 (/products 카드용) */
  overviewRegion?: string;
  /** 여행 오버뷰: 기간 (/products 카드용) */
  overviewDuration?: string;
  /** Link 래퍼 className (stack·grid 공통) */
  className?: string;
  /** related 레이아웃: 이미지 좌상단 강조 배지 (가이드 브리지 1순위 등) */
  topPickLabel?: string;
  /** related 레이아웃: 가격 아래 경험/구성 한 줄 */
  experienceSummary?: string;
  /** 가이드 브리지: 모바일에서 첫 카드 링·그림자·미세 확대 */
  emphasizeFirstOnMobile?: boolean;
  /** 가이드 브리지: 모바일에서 oneLiner 숨김·경험 요약 2토큰만 */
  guideBridgeNarrowCopy?: boolean;
  /** related + 가이드 브리지: 가격 아래 선택 이유 1줄(✔ 포함 권장). 없으면 미표시 */
  selectionHighlightLine?: string;
  /** 대표 캠페인 1줄 피치 (라벨 매핑). grid에서는 보통 미전달 */
  campaignPitchLine?: string;
  /** 리스트/모바일 등 layout이 grid여도 피치·톤을 맞출 때 */
  campaignPresentationKind?: CampaignCardKind;
};

function formatReviewCount(n: number): string {
  return new Intl.NumberFormat("ko-KR").format(n);
}

/** CTR 정책: 별점은 리뷰 1건 이상일 때만 노출(신뢰 신호 일관화) */
function CardRatingBlock({
  ratingAvg,
  reviewCount,
  className,
}: {
  ratingAvg?: number;
  reviewCount?: number;
  className?: string;
}) {
  const hasRating =
    typeof ratingAvg === "number" && Number.isFinite(ratingAvg) && ratingAvg > 0;
  const rcPositive =
    typeof reviewCount === "number" && Number.isFinite(reviewCount) && reviewCount > 0;
  if (!hasRating || !rcPositive) return null;
  return (
    <p
      className={cn(
        "inline-flex shrink-0 items-center gap-0.5 tabular-nums text-[11px] text-[var(--text-muted)] sm:gap-1 sm:text-xs",
        className,
      )}
    >
      <Star
        className="h-3 w-3 shrink-0 fill-amber-400 text-amber-400 sm:h-3.5 sm:w-3.5"
        strokeWidth={0}
        aria-hidden
      />
      <span>{ratingAvg!.toFixed(1)}</span>
      <span>({formatReviewCount(reviewCount!)})</span>
    </p>
  );
}

export default function ProductCard({
  title = "",
  price,
  duration = "",
  region = "",
  categories = [],
  tags = [],
  status,
  badges = [],
  infoBadges = [],
  thumbnailUrl = "",
  hrefDetail,
  onClickDetail,
  onClickConsult,
  priceMeta = "1인 기준",
  metaInfo = "",
  oneLiner = "",
  ratingAvg,
  reviewCount,
  analyticsSource,
  analyticsSection,
  productId,
  layout = "grid",
  maxTags = 2,
  overviewStay,
  overviewRegion,
  overviewDuration,
  className,
  topPickLabel = "",
  experienceSummary = "",
  emphasizeFirstOnMobile = false,
  guideBridgeNarrowCopy = false,
  selectionHighlightLine = "",
  campaignPitchLine = "",
  campaignPresentationKind,
}: ProductCardProps) {
  const [imageLoaded, setImageLoaded] = useState(false);
  const [consultPressed, setConsultPressed] = useState(false);
  const priceFormatted =
    typeof price === "number"
      ? new Intl.NumberFormat("ko-KR").format(price)
      : typeof price === "string"
        ? price
        : null;

  const infoDisplayChips = pickInfoDisplayChips(status, infoBadges);

  const campaignKind: CampaignCardKind = resolveCampaignCardKind({
    layout,
    analyticsSection: analyticsSection ?? null,
    presentationKind: campaignPresentationKind,
  });

  const visibleCampaignBadges = (() => {
    const sorted = [...badges]
      .filter((b) => b.isActive !== false)
      .sort((a, b) => (b.priority ?? 0) - (a.priority ?? 0));
    if (layout === "list") return sorted.slice(0, 1);
    return sorted.slice(0, 2);
  })();

  const campaignPitch = campaignPitchLine?.trim() ?? "";

  const handleConsult = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (status === "SOLD_OUT" && typeof window !== "undefined") {
      window.alert("마감된 상품입니다. 대기 문의를 남겨 주시면 다음 일정 시 안내드립니다.");
    }
    setConsultPressed(true);
    onClickConsult?.();
  };

  const handleConsultKey = (e: React.KeyboardEvent) => {
    if (e.key !== "Enter" && e.key !== " ") return;
    e.preventDefault();
    e.stopPropagation();
    if (status === "SOLD_OUT" && typeof window !== "undefined") {
      window.alert("마감된 상품입니다. 대기 문의를 남겨 주시면 다음 일정 시 안내드립니다.");
    }
    setConsultPressed(true);
    onClickConsult?.();
  };

  const metaLine = [duration, metaInfo].filter(Boolean).join(" · ");
  const oneLine = oneLiner?.trim() ?? "";

  const isListLayout = layout === "list";
  const isRelatedLayout = layout === "related";

  const durationLabel = overviewDuration?.trim() || duration?.trim() || "";
  const topPick = topPickLabel?.trim() ?? "";
  const expLine = experienceSummary?.trim() ?? "";
  const expParts = expLine.split(/\s*·\s*/).filter(Boolean);
  const expLineMobileTwo =
    guideBridgeNarrowCopy && expParts.length > 0 ? expParts.slice(0, 2).join(" · ") : expLine;

  const selectionLine = selectionHighlightLine?.trim() ?? "";

  const priceBlock = (
    <div className="space-y-0.5">
      {priceFormatted != null ? (
        <>
          <p
            className={cn(
              "font-price-strong font-bold leading-tight text-[var(--primary)] tabular-nums",
              "text-xl md:text-2xl",
              isRelatedLayout &&
                (guideBridgeNarrowCopy ? "text-lg sm:text-xl md:text-2xl" : "text-base md:text-lg"),
            )}
          >
            {isRelatedLayout ? `₩${priceFormatted}~` : `${priceFormatted}원~`}
          </p>
          {priceMeta ? (
            <p className="text-[10px] font-medium text-[var(--text-subtle)] sm:text-[11px]">{priceMeta}</p>
          ) : null}
        </>
      ) : (
        <p className="font-semibold text-sm text-[var(--text-muted)]">상담 후 견적</p>
      )}
    </div>
  );

  const chipRow = (compact?: boolean) => (
    <div className="flex min-w-0 flex-wrap items-center gap-1">
      {infoDisplayChips.map((chip) => (
        <span
          key={`${chip.variant}-${chip.label}`}
          className={cn(
            "inline-flex items-center rounded-full border font-semibold leading-none shadow-sm backdrop-blur",
            compact ? "px-1.5 py-0.5 text-[10px] sm:px-2 sm:py-1 sm:text-[11px]" : "px-2 py-1 text-[11px]",
            infoDisplayChipSurfaceClass(chip.variant),
          )}
        >
          {chip.label}
        </span>
      ))}
    </div>
  );

  const titleBlock = (clamp: 1 | 2, size: "sm" | "md") => (
    <h2
      className={cn(
        "font-card-title font-semibold leading-snug text-[var(--text-primary)] break-words",
        clamp === 2 ? "line-clamp-2" : "line-clamp-1",
        size === "sm" ? "text-sm md:text-base" : "text-[13px] sm:text-sm sm:leading-snug",
      )}
    >
      {title || "상품명"}
    </h2>
  );

  /** 연관 상품 세로 카드 */
  const relatedCardContent = (
    <div className="flex h-full flex-col">
      <div className="relative aspect-[4/3] w-full shrink-0 overflow-hidden bg-[var(--surface-muted)]">
        {(topPick || visibleCampaignBadges.length > 0) && (
          <div className="absolute left-2 top-2 z-10 flex max-w-[calc(100%-1rem)] flex-wrap items-start gap-1">
            {topPick ? (
              <span
                className="inline-flex max-w-[min(100%,10rem)] shrink-0 truncate rounded bg-[var(--primary)]/92 px-1.5 py-[3px] text-[9px] font-semibold leading-tight text-[var(--on-primary)] shadow-sm ring-1 ring-black/5"
                title={topPick}
              >
                {topPick}
              </span>
            ) : null}
            {visibleCampaignBadges.map((b, i) => (
              <ProductCampaignBadge
                key={`${b.label}-${i}`}
                label={b.label}
                isPrimary={i === 0}
                kind={campaignKind}
                badgeTone={b.campaignTone}
                size="md"
                surface="overlay"
              />
            ))}
          </div>
        )}
        {thumbnailUrl ? (
          <Image
            src={normalizeProductImageUrl(thumbnailUrl)}
            alt={title || "상품 이미지"}
            fill
            sizes="(max-width: 768px) 78vw, 320px"
            className={cn("object-cover", CARD_TRANSITION, "group-hover:scale-[1.03]")}
            loading="lazy"
            onLoad={() => setImageLoaded(true)}
            unoptimized
          />
        ) : (
          <div className="flex h-full w-full items-center justify-center text-[var(--text-muted)]" aria-hidden>
            <span className="text-xs font-medium">이미지 없음</span>
          </div>
        )}
        <div
          className={cn(
            "absolute inset-0 bg-[var(--surface-muted)]",
            CARD_TRANSITION,
            thumbnailUrl ? (imageLoaded ? "opacity-0" : "animate-pulse opacity-80") : "opacity-0",
          )}
          aria-hidden
        />
      </div>
      <div
        className={cn(
          "flex min-h-0 flex-1 flex-col p-3",
          emphasizeFirstOnMobile && "max-sm:px-3.5 max-sm:pb-3.5 max-sm:pt-3",
        )}
      >
        {infoDisplayChips.length > 0 ? (
          <div className="mb-1.5 flex min-w-0 flex-wrap items-center gap-1">
            {infoDisplayChips.map((chip) => (
              <span
                key={`info-${chip.variant}-${chip.label}`}
                className={cn(
                  "inline-flex items-center rounded-full border px-1.5 py-0.5 text-[10px] font-semibold leading-none shadow-sm backdrop-blur sm:px-2 sm:py-1 sm:text-[11px]",
                  infoDisplayChipSurfaceClass(chip.variant),
                )}
              >
                {chip.label}
              </span>
            ))}
          </div>
        ) : null}
        {guideBridgeNarrowCopy ? (
          <>
            {titleBlock(2, "sm")}
            {oneLine ? (
              <p className="mt-0.5 hidden text-[10px] leading-snug text-[var(--text-muted)] sm:block sm:line-clamp-1">
                {oneLine}
              </p>
            ) : null}
            <div className="mt-1.5">{priceBlock}</div>
            {campaignPitch ? (
              <p
                className="mt-1 line-clamp-2 text-[10px] font-semibold leading-snug text-[var(--primary)] sm:line-clamp-1 sm:text-[11px]"
                title={campaignPitch}
              >
                {campaignPitch}
              </p>
            ) : null}
            {selectionLine ? (
              <p
                className={cn(
                  "truncate text-[10px] font-medium leading-snug text-[var(--foreground)]/78 sm:text-[11px]",
                  campaignPitch ? "mt-0.5" : "mt-1",
                )}
                title={selectionLine}
              >
                {selectionLine}
              </p>
            ) : null}
            <div className="mt-1 flex min-h-0 items-center justify-between gap-2">
              {durationLabel ? (
                <span className="max-w-[58%] truncate text-[9px] font-normal tracking-wide text-[var(--text-subtle)]/90 sm:max-w-[65%] sm:text-[10px]">
                  {durationLabel}
                </span>
              ) : (
                <span />
              )}
              <CardRatingBlock
                ratingAvg={ratingAvg}
                reviewCount={reviewCount}
                className="text-[10px] text-[var(--text-subtle)] sm:text-[11px]"
              />
            </div>
            {expLine ? (
              <>
                <p className="mt-0.5 line-clamp-2 text-[9px] leading-snug text-[var(--text-subtle)]/75 sm:hidden">
                  {expLineMobileTwo}
                </p>
                <p className="mt-0.5 hidden line-clamp-1 text-[10px] leading-snug text-[var(--text-subtle)]/75 sm:block">
                  {expLine}
                </p>
              </>
            ) : null}
          </>
        ) : (
          <>
            <div className="mb-1 flex items-start justify-between gap-2">
              {durationLabel ? (
                <span className="inline-flex w-fit max-w-[65%] truncate rounded-md bg-slate-100 px-2 py-0.5 text-[11px] font-semibold text-slate-600">
                  {durationLabel}
                </span>
              ) : (
                <span />
              )}
              <CardRatingBlock ratingAvg={ratingAvg} reviewCount={reviewCount} />
            </div>
            {titleBlock(2, "sm")}
            {oneLine ? (
              <p className="mt-1 line-clamp-1 text-[11px] leading-snug text-[var(--text-muted)]">{oneLine}</p>
            ) : null}
            <div className="mt-2">{priceBlock}</div>
            {campaignPitch ? (
              <p
                className="mt-1 line-clamp-2 text-[11px] font-semibold leading-snug text-[var(--primary)] sm:line-clamp-1"
                title={campaignPitch}
              >
                {campaignPitch}
              </p>
            ) : null}
            {expLine ? (
              <p
                className={cn(
                  "line-clamp-2 text-[10px] leading-snug text-[var(--text-muted)] sm:line-clamp-1 sm:text-[11px]",
                  campaignPitch ? "mt-0.5" : "mt-1",
                )}
              >
                {expLine}
              </p>
            ) : null}
          </>
        )}
      </div>
    </div>
  );

  const gridListCardContent = (
    <div className="flex min-h-[140px] w-full items-stretch">
      <div
        className={cn(
          "relative shrink-0 self-stretch overflow-hidden bg-[var(--surface-muted)]",
          isListLayout
            ? "w-[38%] min-w-[180px] max-w-[280px]"
            : "w-[42%] min-w-[140px] max-w-[220px]",
        )}
      >
        {!isListLayout && visibleCampaignBadges.length > 0 ? (
          <div className="pointer-events-none absolute left-2 top-2 z-10 flex max-w-[calc(100%-1rem)] flex-wrap items-start gap-1">
            {visibleCampaignBadges.map((b, i) => (
              <ProductCampaignBadge
                key={`grid-camp-${b.label}-${i}`}
                label={b.label}
                isPrimary={i === 0}
                kind={isListLayout ? "list" : "grid"}
                badgeTone={b.campaignTone}
                size="md"
                surface="overlay"
              />
            ))}
          </div>
        ) : null}
        {thumbnailUrl ? (
          <Image
            src={normalizeProductImageUrl(thumbnailUrl)}
            alt={title || "상품 이미지"}
            fill
            sizes={isListLayout ? "(max-width: 768px) 38vw, 280px" : "(max-width: 768px) 42vw, 220px"}
            className={cn("h-full w-full object-cover", CARD_TRANSITION, "group-hover:scale-[1.03]")}
            loading="lazy"
            onLoad={() => setImageLoaded(true)}
          />
        ) : (
          <div
            className="flex h-full w-full items-center justify-center text-[var(--text-muted)]"
            aria-hidden
          >
            <span className="text-[11px] font-medium">이미지 없음</span>
          </div>
        )}
        <div
          className={cn(
            "absolute inset-0 bg-[var(--surface-muted)]",
            CARD_TRANSITION,
            thumbnailUrl ? (imageLoaded ? "opacity-0" : "animate-pulse opacity-80") : "opacity-0",
          )}
          aria-hidden
        />
      </div>

      <div className="flex min-w-0 flex-1 flex-col overflow-hidden p-4">
        {isListLayout && visibleCampaignBadges.length > 0 ? (
          <div
            className="mb-1.5 flex min-w-0 flex-wrap items-center gap-1.5"
            aria-label="기획 배지"
          >
            {visibleCampaignBadges.map((b, i) => (
              <ProductCampaignBadge
                key={`list-inline-${b.label}-${i}`}
                label={b.label}
                isPrimary={i === 0}
                kind="list"
                badgeTone={b.campaignTone}
                size="sm"
                surface="inline"
              />
            ))}
          </div>
        ) : null}
        <div className="flex items-start justify-between gap-2">
          {chipRow(false)}
          <CardRatingBlock ratingAvg={ratingAvg} reviewCount={reviewCount} className="pt-0.5" />
        </div>

        <div className="mt-1.5 min-w-0">{titleBlock(2, "sm")}</div>

        {oneLine ? (
          <p className="mt-1 line-clamp-2 text-[11px] leading-snug text-[var(--text-secondary)] md:text-xs">
            {oneLine}
          </p>
        ) : null}

        {metaLine ? (
          <p
            className={cn(
              "line-clamp-1 text-[11px] text-[var(--text-muted)]",
              oneLine ? "mt-0.5" : "mt-1",
            )}
          >
            {metaLine}
          </p>
        ) : null}

        <div className="mt-2">{priceBlock}</div>

        <div className="mt-auto flex flex-col gap-2 pt-3">
          {tags.length > 0 ? (
            <div className="relative flex overflow-hidden">
              <div className="flex shrink-0 flex-nowrap gap-1.5 pr-8">
                {tags.slice(0, maxTags).map((tag) => (
                  <span
                    key={tag}
                    className="inline-flex shrink-0 items-center rounded-full border border-[var(--border)] bg-[var(--surface)] px-2.5 py-1 text-[11px] font-semibold text-[var(--text-muted)]"
                  >
                    #{tag}
                  </span>
                ))}
              </div>
              <div
                className="pointer-events-none absolute right-0 top-0 h-full w-12 shrink-0 bg-gradient-to-l from-[var(--surface)] to-transparent"
                aria-hidden
              />
            </div>
          ) : null}
          {onClickConsult ? (
            <span
              role="button"
              tabIndex={0}
              aria-disabled={consultPressed}
              className={cn(
                buttonVariants({ variant: "accent", size: "sm" }),
                "inline-flex w-fit !h-7 !px-2.5 !text-xs",
                consultPressed && "pointer-events-none opacity-60",
              )}
              onClick={handleConsult}
              onKeyDown={(e) => {
                if (e.key === "Enter" || e.key === " ") handleConsultKey(e);
              }}
            >
              {status === "SOLD_OUT" ? "대기 문의" : "상담 문의"}
            </span>
          ) : null}
        </div>
      </div>
    </div>
  );

  const cardContent: ReactNode = isRelatedLayout ? relatedCardContent : gridListCardContent;

  const wrapperClass = cn(
    "group flex h-full w-full overflow-hidden",
    CARD_TRANSITION,
    "hover:shadow-md hover:border-[var(--primary)]/30",
    isListLayout && "max-w-[1344px]",
    isRelatedLayout && "flex-col",
    emphasizeFirstOnMobile &&
      isRelatedLayout &&
      "max-sm:shadow-md max-sm:ring-1 max-sm:ring-[var(--primary)]/20",
  );

  if (hrefDetail) {
    const handleCardClick = () => {
      if (analyticsSource && hrefDetail) {
        const id = productId ?? (hrefDetail.split("/").pop() || "");
        trackProductCardClick({
          productId: id,
          productTitle: title ?? "",
          href: hrefDetail,
          source: analyticsSource,
          section: analyticsSection ?? undefined,
        });
      }
    };
    return (
      <Link
        href={hrefDetail}
        className={cn(
          "block h-full outline-none focus-visible:ring-2 focus-visible:ring-[var(--primary)] focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--surface)]",
          className,
        )}
        onClick={handleCardClick}
      >
        <Card variant="interactive" className={wrapperClass}>
          {cardContent}
        </Card>
      </Link>
    );
  }

  return (
    <Card
      variant="interactive"
      className={cn(
        wrapperClass,
        "outline-none focus-visible:ring-2 focus-visible:ring-[var(--primary)] focus-visible:ring-offset-2",
        className,
      )}
      role="button"
      tabIndex={0}
      onClick={onClickDetail}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          onClickDetail?.();
        }
      }}
    >
      {cardContent}
    </Card>
  );
}

```


---

## File: `src/components/products/ProductListCard.tsx`

```tsx
"use client";

import Image from "next/image";
import Link from "next/link";
import { useState } from "react";
import { buttonVariants } from "@/components/ui/Button";
import { normalizeProductImageUrl } from "@/lib/media/normalizeProductImageUrl";
import { trackProductCardClick } from "@/lib/analytics/trackProductClick";
import { CARD_TRANSITION } from "@/lib/cardTokens";
import { cn } from "@/lib/cn";
import type { ProductCardProps } from "@/components/products/ProductCard";
import { ProductCampaignBadge } from "@/components/products/ProductCampaignBadge";
import { infoDisplayChipSurfaceClass, pickInfoDisplayChips } from "@/lib/productCardSignals";

export type ProductListCardProps = ProductCardProps;

/** duration/meta + overview를 한 줄로 합치되, 동일 조각은 한 번만 */
function mergeDistinctMetaParts(a: string, b: string): string {
  const parts = [...a.split(" · "), ...b.split(" · ")]
    .map((s) => s.trim())
    .filter(Boolean);
  const seen = new Set<string>();
  const out: string[] = [];
  for (const p of parts) {
    const key = p.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(p);
  }
  return out.join(" · ");
}

function formatReviewCount(n: number): string {
  return new Intl.NumberFormat("ko-KR").format(n);
}

/** ratingAvg 유효 + reviewCount > 0 — 형식 ★ 4.8 (127), 제목 우측 상단 배치용 */
function ListRatingBlock({
  ratingAvg,
  reviewCount,
  className,
}: {
  ratingAvg?: number;
  reviewCount?: number;
  className?: string;
}) {
  const hasRating =
    typeof ratingAvg === "number" && Number.isFinite(ratingAvg) && ratingAvg > 0;
  const rcPositive =
    typeof reviewCount === "number" &&
    Number.isFinite(reviewCount) &&
    reviewCount > 0;
  if (!hasRating || !rcPositive) return null;
  return (
    <p
      className={cn(
        "inline-flex shrink-0 items-baseline gap-1 tabular-nums text-sm font-medium text-neutral-700",
        className,
      )}
    >
      <span aria-hidden className="translate-y-px text-[0.95em] leading-none">
        ★
      </span>
      <span>{ratingAvg!.toFixed(1)}</span>
      <span>({formatReviewCount(reviewCount!)})</span>
    </p>
  );
}

export default function ProductListCard({
  title = "",
  price,
  duration = "",
  tags = [],
  status,
  badges = [],
  infoBadges = [],
  thumbnailUrl = "",
  hrefDetail,
  onClickDetail,
  onClickConsult,
  priceMeta = "1인 기준",
  metaInfo = "",
  oneLiner,
  ratingAvg,
  reviewCount,
  overviewStay = "",
  overviewRegion = "",
  overviewDuration = "",
  analyticsSource,
  analyticsSection,
  productId,
}: ProductListCardProps) {
  const [consultPressed, setConsultPressed] = useState(false);

  const priceFormatted =
    typeof price === "number"
      ? new Intl.NumberFormat("ko-KR").format(price)
      : typeof price === "string"
        ? price
        : null;

  /** 대표 배지는 부모 `campaignBadgeMax`로 개수 제어(카탈로그는 2 = 랜딩·destinations와 동일) */
  const visibleCampaignBadges = [...badges]
    .filter((b) => b.isActive !== false)
    .sort((a, b) => (b.priority ?? 0) - (a.priority ?? 0))
    .slice(0, 2);
  const infoDisplayChips = pickInfoDisplayChips(status, infoBadges);

  const handleCardClick = () => {
    onClickDetail?.();
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      onClickDetail?.();
    }
  };

  const handleDetailButtonClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    e.preventDefault();
    onClickDetail?.();
  };

  const handleConsultClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    e.preventDefault();
    if (status === "SOLD_OUT" && typeof window !== "undefined") {
      window.alert(
        "마감된 상품입니다. 대기 문의를 남겨 주시면 다음 일정 시 안내드립니다.",
      );
    }
    setConsultPressed(true);
    onClickConsult?.();
  };

  const handleConsultKey = (e: React.KeyboardEvent) => {
    if (e.key !== "Enter" && e.key !== " ") return;
    e.preventDefault();
    e.stopPropagation();
    if (status === "SOLD_OUT" && typeof window !== "undefined") {
      window.alert(
        "마감된 상품입니다. 대기 문의를 남겨 주시면 다음 일정 시 안내드립니다.",
      );
    }
    setConsultPressed(true);
    onClickConsult?.();
  };

  const metaLine = [duration, metaInfo].filter(Boolean).join(" · ");
  const oneLine = oneLiner?.trim() ?? "";
  const overviewLine = [overviewDuration, overviewRegion, overviewStay]
    .map((s) => s?.trim())
    .filter((s) => s && s !== "-")
    .join(" · ");
  const simpleMetaLine =
    metaLine && overviewLine
      ? mergeDistinctMetaParts(metaLine, overviewLine)
      : metaLine || overviewLine;

  /** SEO 메타 타이틀(스페이스 구분) → 상품등록 시 입력한 키워드를 해시태그로 노출 */
  const seoHashtags = tags.map((t) => t.trim()).filter(Boolean);

  const cardContent = (
    <div className="flex w-full flex-col">
    <div className="grid w-full grid-cols-[280px_minmax(0,1fr)_300px]">
      {/* 좌측: 이미지 + 캠페인 배지 오버레이(/destinations·랜딩 ProductCard와 동일 계열) */}
      <div className="relative h-full min-h-[220px] overflow-hidden rounded-l-2xl bg-[var(--surface-muted)]">
        {visibleCampaignBadges.length > 0 ? (
          <div
            className="pointer-events-none absolute left-2 top-2 z-10 flex max-w-[calc(100%-1rem)] flex-wrap items-start gap-1"
            aria-label="기획 배지"
          >
            {visibleCampaignBadges.map((b, i) => (
              <ProductCampaignBadge
                key={`list-ov-${b.label}-${i}`}
                label={b.label}
                isPrimary={i === 0}
                kind="list"
                badgeTone={b.campaignTone}
                size="md"
                surface="overlay"
              />
            ))}
          </div>
        ) : null}
        {thumbnailUrl ? (
          <Image
            src={normalizeProductImageUrl(thumbnailUrl)}
            alt={title || "상품 이미지"}
            fill
            sizes="280px"
            className="h-full w-full object-cover"
            loading="lazy"
          />
        ) : (
          <div
            className="flex h-full w-full items-center justify-center text-[var(--text-muted)]"
            aria-hidden
          >
            <span className="text-[11px] font-medium">이미지 없음</span>
          </div>
        )}
      </div>

      {/* 중앙: 정보 칩 → 제목 */}
      <div className="flex min-w-0 flex-col gap-1.5 p-5">
        <div className="flex min-w-0 flex-wrap items-center gap-1.5 gap-y-1">
          {infoDisplayChips.map((chip) => (
            <span
              key={`${chip.variant}-${chip.label}`}
              className={cn(
                "inline-flex items-center rounded-full border px-2 py-1 text-[11px] font-semibold leading-none shadow-sm backdrop-blur",
                infoDisplayChipSurfaceClass(chip.variant),
              )}
            >
              {chip.label}
            </span>
          ))}
        </div>
        <div className="flex min-w-0 items-start justify-between gap-3">
          <h2 className="line-clamp-2 min-w-0 flex-1 text-lg font-semibold leading-snug text-[var(--text-primary)]">
            {title || "상품명"}
          </h2>
          <ListRatingBlock
            ratingAvg={ratingAvg}
            reviewCount={reviewCount}
            className="pt-0.5"
          />
        </div>
        {oneLine ? (
          <p className="line-clamp-2 text-sm leading-snug text-[var(--text-muted)]">
            {oneLine}
          </p>
        ) : null}
        {simpleMetaLine ? (
          <p className="line-clamp-1 text-sm text-[var(--text-muted)]">
            {simpleMetaLine}
          </p>
        ) : null}
      </div>

      {/* 우측: 하단 anchor — 가격 먼저, CTA는 보조(시각 비중 완화) */}
      <div className="flex min-h-[220px] flex-col border-l border-[var(--border)] p-5">
        <div className="min-h-0 flex-1" aria-hidden />
        <div className="mt-auto space-y-4">
          <div className="min-w-0">
            {priceFormatted != null ? (
              <>
                <p className="font-price-strong text-3xl font-extrabold leading-tight tabular-nums text-[var(--primary)]">
                  {priceFormatted}원~
                </p>
                {priceMeta ? (
                  <p className="mt-1 text-xs font-medium text-[var(--text-subtle)]">
                    {priceMeta}
                  </p>
                ) : null}
              </>
            ) : (
              <p className="text-base font-semibold text-[var(--text-muted)]">
                상담 후 견적
              </p>
            )}
          </div>
          <div className="flex flex-col gap-2">
            <button
              type="button"
              className="w-full text-center text-sm font-semibold text-[var(--primary)] underline-offset-2 hover:underline"
              onClick={handleDetailButtonClick}
            >
              자세히 보기
            </button>
            {onClickConsult ? (
              <button
                type="button"
                disabled={consultPressed}
                className={cn(
                  buttonVariants({ variant: "accent", size: "md" }),
                  "w-full",
                  consultPressed && "pointer-events-none",
                )}
                onClick={handleConsultClick}
                onKeyDown={(e) => {
                  if (e.key === "Enter" || e.key === " ")
                    handleConsultKey(e);
                }}
              >
                {status === "SOLD_OUT" ? "대기 문의" : "상담 문의"}
              </button>
            ) : null}
          </div>
        </div>
      </div>
    </div>
    {seoHashtags.length > 0 ? (
      <div
        className="flex w-full flex-wrap gap-x-2 gap-y-1 border-t border-[var(--border)]/25 px-5 py-2.5"
        aria-label="상품 SEO 키워드"
      >
        {seoHashtags.map((tag, i) => (
          <span
            key={`${tag}-${i}`}
            className="text-[0.9rem] font-medium leading-snug text-[var(--text-muted)]"
          >
            #{tag}
          </span>
        ))}
      </div>
    ) : null}
    </div>
  );

  /** 테두리·그림자 최소화: 목록이 관리 패널처럼 보이지 않게(콘텐츠 카드 톤). Card interactive는 border+shadow가 고정이라 div로 래핑. */
  const cardClassName = cn(
    "group w-full cursor-pointer overflow-hidden rounded-2xl border-0 bg-[var(--surface)]",
    "shadow-[0_1px_2px_rgba(15,23,42,0.04),0_1px_3px_rgba(15,23,42,0.03)]",
    "dark:shadow-[0_1px_2px_rgba(0,0,0,0.18),0_1px_3px_rgba(0,0,0,0.12)]",
    CARD_TRANSITION,
    "hover:shadow-[0_2px_10px_rgba(15,23,42,0.055)] dark:hover:shadow-[0_2px_12px_rgba(0,0,0,0.22)]",
  );

  if (hrefDetail) {
    const handleLinkClick = () => {
      if (analyticsSource && hrefDetail) {
        const id = productId ?? (hrefDetail.split("/").pop() || "");
        trackProductCardClick({
          productId: id,
          productTitle: title ?? "",
          href: hrefDetail,
          source: analyticsSource,
          section: analyticsSection ?? undefined,
        });
      }
    };
    return (
      <Link
        href={hrefDetail}
        className="block w-full cursor-pointer outline-none focus-visible:ring-2 focus-visible:ring-[var(--primary)] focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--surface)]"
        onClick={handleLinkClick}
      >
        <div className={cardClassName}>{cardContent}</div>
      </Link>
    );
  }

  return (
    <div
      className={cn(
        cardClassName,
        "outline-none focus-visible:ring-2 focus-visible:ring-[var(--primary)] focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--surface)]",
      )}
      role="button"
      tabIndex={0}
      onClick={handleCardClick}
      onKeyDown={handleKeyDown}
    >
      {cardContent}
    </div>
  );
}

```


---

## File: `src/components/products/ProductListCardMobile.tsx`

```tsx
"use client";

import Image from "next/image";
import Link from "next/link";
import { Star } from "lucide-react";
import { useState } from "react";
import { Card } from "@/components/ui/Card";
import { buttonVariants } from "@/components/ui/Button";
import { normalizeProductImageUrl } from "@/lib/media/normalizeProductImageUrl";
import { trackProductCardClick } from "@/lib/analytics/trackProductClick";
import { CARD_TRANSITION } from "@/lib/cardTokens";
import { cn } from "@/lib/cn";
import type { ProductCardProps } from "@/components/products/ProductCard";
import { ProductCampaignBadge } from "@/components/products/ProductCampaignBadge";
import { infoDisplayChipSurfaceClass, pickInfoDisplayChips } from "@/lib/productCardSignals";

export type ProductListCardMobileProps = ProductCardProps;

function formatReviewCount(n: number): string {
  return new Intl.NumberFormat("ko-KR").format(n);
}

function ListRatingBlockMobile({
  ratingAvg,
  reviewCount,
}: {
  ratingAvg?: number;
  reviewCount?: number;
}) {
  const hasRating =
    typeof ratingAvg === "number" && Number.isFinite(ratingAvg) && ratingAvg > 0;
  const rcPositive =
    typeof reviewCount === "number" &&
    Number.isFinite(reviewCount) &&
    reviewCount > 0;
  if (!hasRating || !rcPositive) return null;
  return (
    <p className="inline-flex shrink-0 items-center gap-0.5 tabular-nums text-[11px] text-[var(--text-muted)]">
      <Star
        className="h-3 w-3 shrink-0 fill-amber-400 text-amber-400"
        strokeWidth={0}
        aria-hidden
      />
      <span>{ratingAvg!.toFixed(1)}</span>
      <span>({formatReviewCount(reviewCount!)})</span>
    </p>
  );
}

export default function ProductListCardMobile({
  title = "",
  price,
  duration = "",
  tags = [],
  status,
  badges = [],
  infoBadges = [],
  thumbnailUrl = "",
  hrefDetail,
  onClickDetail,
  onClickConsult,
  priceMeta = "1인 기준",
  metaInfo = "",
  oneLiner,
  ratingAvg,
  reviewCount,
  analyticsSource,
  analyticsSection,
  productId,
}: ProductListCardMobileProps) {
  const [consultPressed, setConsultPressed] = useState(false);

  const priceFormatted =
    typeof price === "number"
      ? new Intl.NumberFormat("ko-KR").format(price)
      : typeof price === "string"
        ? price
        : null;

  const visibleCampaignBadges = [...badges]
    .filter((b) => b.isActive !== false)
    .sort((a, b) => (b.priority ?? 0) - (a.priority ?? 0))
    .slice(0, 2);
  const infoDisplayChips = pickInfoDisplayChips(status, infoBadges);

  const handleCardClick = () => {
    onClickDetail?.();
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      onClickDetail?.();
    }
  };

  const handleConsultClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    e.preventDefault();
    if (status === "SOLD_OUT" && typeof window !== "undefined") {
      window.alert(
        "마감된 상품입니다. 대기 문의를 남겨 주시면 다음 일정 시 안내드립니다.",
      );
    }
    setConsultPressed(true);
    onClickConsult?.();
  };

  const handleConsultKey = (e: React.KeyboardEvent) => {
    if (e.key !== "Enter" && e.key !== " ") return;
    e.preventDefault();
    e.stopPropagation();
    if (status === "SOLD_OUT" && typeof window !== "undefined") {
      window.alert(
        "마감된 상품입니다. 대기 문의를 남겨 주시면 다음 일정 시 안내드립니다.",
      );
    }
    setConsultPressed(true);
    onClickConsult?.();
  };

  const metaLine = [duration, metaInfo].filter(Boolean).join(" · ");
  const oneLine = oneLiner?.trim() ?? "";
  const seoHashtags = tags.map((t) => t.trim()).filter(Boolean);

  const cardContent = (
    <div className="flex w-full flex-col">
    <div className="flex min-h-[148px] w-full">
      {/* 좌측: 이미지 + 캠페인 배지 오버레이(데스크 목록과 동일 소스) */}
      <div className="relative w-[34%] min-w-[112px] max-w-[136px] shrink-0 self-stretch overflow-hidden bg-[var(--surface-muted)]">
        {visibleCampaignBadges.length > 0 ? (
          <div
            className="pointer-events-none absolute left-1 top-1 z-10 flex max-w-[calc(100%-0.5rem)] flex-col items-start gap-0.5 sm:left-1.5 sm:top-1.5 sm:flex-row sm:flex-wrap sm:gap-1"
            aria-label="기획 배지"
          >
            {visibleCampaignBadges.map((b, i) => (
              <ProductCampaignBadge
                key={`m-ov-${b.label}-${i}`}
                label={b.label}
                isPrimary={i === 0}
                kind="mobile"
                badgeTone={b.campaignTone}
                size="sm"
                surface="overlay"
                className="max-w-full"
              />
            ))}
          </div>
        ) : null}
        {thumbnailUrl ? (
          <Image
            src={normalizeProductImageUrl(thumbnailUrl)}
            alt={title || "상품 이미지"}
            fill
            sizes="(max-width: 768px) 34vw, 136px"
            className="h-full w-full object-cover"
            loading="lazy"
          />
        ) : (
          <div
            className="flex h-full min-h-[148px] w-full items-center justify-center text-[var(--text-muted)]"
            aria-hidden
          >
            <span className="text-[10px] font-medium">이미지 없음</span>
          </div>
        )}
      </div>

      {/* 우측: 칩·평점 → 제목 → one-liner → 가격 → 상담(보조) */}
      <div className="flex min-w-0 flex-1 flex-col gap-1 p-3.5">
        <div className="flex min-w-0 flex-wrap items-center gap-1">
          {infoDisplayChips.map((chip) => (
            <span
              key={`${chip.variant}-${chip.label}`}
              className={cn(
                "inline-flex items-center rounded-full border px-1.5 py-0.5 text-[10px] font-semibold leading-none shadow-sm backdrop-blur",
                infoDisplayChipSurfaceClass(chip.variant),
              )}
            >
              {chip.label}
            </span>
          ))}
          <ListRatingBlockMobile
            ratingAvg={ratingAvg}
            reviewCount={reviewCount}
          />
        </div>
        <h2 className="line-clamp-2 text-sm font-semibold leading-snug text-[var(--text-primary)]">
          {title || "상품명"}
        </h2>
        {oneLine ? (
          <p className="line-clamp-1 text-[11px] leading-snug text-[var(--text-muted)]">
            {oneLine}
          </p>
        ) : null}
        {!oneLine && metaLine ? (
          <p className="line-clamp-1 text-[11px] text-[var(--text-muted)]">
            {metaLine}
          </p>
        ) : null}
        <div className="mt-1">
          {priceFormatted != null ? (
            <>
              <p className="text-xl font-bold tabular-nums leading-tight text-[var(--primary)]">
                {priceFormatted}원~
              </p>
              {priceMeta ? (
                <p className="mt-0.5 text-[10px] font-medium text-[var(--text-subtle)]">
                  {priceMeta}
                </p>
              ) : null}
            </>
          ) : (
            <p className="text-sm font-semibold text-[var(--text-muted)]">
              상담 후 견적
            </p>
          )}
        </div>
        {onClickConsult ? (
          <button
            type="button"
            disabled={consultPressed}
            className={cn(
              buttonVariants({ variant: "accent", size: "sm" }),
              "mt-1 w-full shrink-0 text-xs font-semibold",
              consultPressed && "pointer-events-none",
            )}
            onClick={handleConsultClick}
            onKeyDown={(e) => {
              if (e.key === "Enter" || e.key === " ") handleConsultKey(e);
            }}
          >
            {status === "SOLD_OUT" ? "대기 문의" : "상담 문의"}
          </button>
        ) : null}
      </div>
    </div>
    {seoHashtags.length > 0 ? (
      <div
        className="flex w-full flex-wrap gap-x-1.5 gap-y-1 border-t border-[var(--border)]/25 px-3.5 py-2"
        aria-label="상품 SEO 키워드"
      >
        {seoHashtags.map((tag, i) => (
          <span
            key={`${tag}-${i}`}
            className="text-[12px] font-medium leading-snug text-[var(--text-muted)]"
          >
            #{tag}
          </span>
        ))}
      </div>
    ) : null}
    </div>
  );

  const cardClassName = cn(
    "group w-full cursor-pointer overflow-hidden rounded-2xl border border-[var(--border)] bg-[var(--surface)] shadow-[var(--shadow-soft)]",
    CARD_TRANSITION,
    "hover:shadow-md hover:border-[var(--primary)]/30",
    "active:scale-[0.99] active:opacity-95",
  );

  if (hrefDetail) {
    const handleLinkClick = () => {
      if (analyticsSource && hrefDetail) {
        const id = productId ?? (hrefDetail.split("/").pop() || "");
        trackProductCardClick({
          productId: id,
          productTitle: title ?? "",
          href: hrefDetail,
          source: analyticsSource,
          section: analyticsSection ?? undefined,
        });
      }
    };
    return (
      <Link
        href={hrefDetail}
        className="block w-full cursor-pointer outline-none focus-visible:ring-2 focus-visible:ring-[var(--primary)] focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--surface)]"
        onClick={handleLinkClick}
      >
        <Card variant="interactive" className={cardClassName}>
          {cardContent}
        </Card>
      </Link>
    );
  }

  return (
    <Card
      variant="interactive"
      className={`${cardClassName} outline-none focus-visible:ring-2 focus-visible:ring-[var(--primary)] focus-visible:ring-offset-2`}
      role="button"
      tabIndex={0}
      onClick={handleCardClick}
      onKeyDown={handleKeyDown}
    >
      {cardContent}
    </Card>
  );
}

```


---

## File: `src/components/products/HomeProductCard.tsx`

```tsx
"use client";

import Image from "next/image";
import Link from "next/link";
import { useMemo } from "react";
import { Star } from "lucide-react";
import type { Product } from "@/types/product";
import type { ProductCardStatus } from "@/components/products/ProductCard";
import { getPrimaryImageUrl } from "@/lib/products/images";
import { normalizeProductImageUrl } from "@/lib/media/normalizeProductImageUrl";
import { formatPriceKR } from "@/lib/pricing/calcQuote";
import { trackProductCardClick } from "@/lib/analytics/trackProductClick";
import { CARD_HOVER, CARD_TRANSITION } from "@/lib/cardTokens";
import { cn } from "@/lib/cn";
import { buildProductCardInfoBadges, CAMPAIGN_BADGE_MAX } from "@/lib/productCardProps";
import { buildCampaignRepresentativeBadges } from "@/lib/productCampaignBadges";
import { buildCampaignPitchLineFromProduct } from "@/lib/productCampaignPresentation";
import { ProductCampaignBadge } from "@/components/products/ProductCampaignBadge";
import { infoDisplayChipSurfaceClass, pickInfoDisplayChips } from "@/lib/productCardSignals";

export type HomeProductCardProps = {
  product: Product;
  /** 미지정 시 `/products/[id]` */
  href?: string;
  className?: string;
  /** 홈 큐레이션 카드 클릭 계측 section */
  analyticsSection?: string;
};

const PLACEHOLDER_IMAGE = "https://picsum.photos/seed/thealltour-home-card/800/600";

function formatReviewCount(n: number): string {
  return new Intl.NumberFormat("ko-KR").format(n);
}

/** one_liner 없을 때만 보조 한 줄 (ProductCard meta와 유사 역할) */
function buildSubMetaLine(product: Product): string {
  const meta = product.meta_info?.trim();
  if (meta) return meta.length > 52 ? `${meta.slice(0, 49)}…` : meta;
  const dur = product.duration?.trim();
  if (dur) return dur;
  if (product.status === "AVAILABLE") return "예약 가능";
  if (product.status === "LIMITED") return "잔여 한정";
  return "";
}

/**
 * 홈 큐레이션 전용 고밀도 카드.
 * 시선 순서: 배지 → 평점(sm+) → 지역 → 제목 → one_liner(sm+) → 가격.
 * 모바일 2열: 이미지·지역·제목·가격 우선, 칩 1개·평점·원라이너는 sm 이상에서 복원.
 */
export function HomeProductCard({ product, href, className, analyticsSection }: HomeProductCardProps) {
  const resolvedHref = (href?.trim() || `/products/${product.id}`).trim();
  const titleText = product.title?.trim() || "상품";

  const rawImage = getPrimaryImageUrl(product);
  const normalized = rawImage?.trim() ? normalizeProductImageUrl(rawImage.trim()) : "";
  const imageSrc = normalized || PLACEHOLDER_IMAGE;

  const visibleCampaignBadges = useMemo(
    () =>
      buildCampaignRepresentativeBadges(product, { max: CAMPAIGN_BADGE_MAX.home }).filter(
        (b) => b.isActive !== false,
      ),
    [product],
  );
  const infoDisplayChips = useMemo(() => {
    const st = (product.status ?? "AVAILABLE") as ProductCardStatus;
    return pickInfoDisplayChips(st, buildProductCardInfoBadges(product));
  }, [product]);
  const campaignPitch = useMemo(() => buildCampaignPitchLineFromProduct(product, "home"), [product]);

  const ratingAvg = product.trust?.ratingAvg;
  const reviewCount = product.trust?.reviewCount;
  const showRating =
    typeof ratingAvg === "number" &&
    Number.isFinite(ratingAvg) &&
    ratingAvg > 0 &&
    typeof reviewCount === "number" &&
    Number.isFinite(reviewCount) &&
    reviewCount > 0;

  const price = product.price;
  const hasNumericPrice = typeof price === "number" && Number.isFinite(price) && price > 0;
  const priceFormatted = hasNumericPrice ? formatPriceKR(price) : null;
  const priceMetaLine = product.price_meta?.trim() || "1인 기준";

  const regionLabel =
    product.overview_region?.trim() ||
    product.category?.trim() ||
    product.theme?.trim() ||
    "";

  const oneLine = product.one_liner?.trim() ?? "";
  const subMeta = !oneLine ? buildSubMetaLine(product) : "";

  const onNavigate = () => {
    trackProductCardClick({
      productId: product.id,
      productTitle: titleText,
      href: resolvedHref,
      source: "home_curated",
      section: analyticsSection ?? null,
    });
  };

  return (
    <Link
      href={resolvedHref}
      onClick={onNavigate}
      aria-label={`${titleText}, 상세 보기`}
      className={cn(
        "group flex h-full min-h-0 min-w-0 flex-col overflow-hidden rounded-xl border border-[var(--border)] bg-[var(--surface)] shadow-[var(--shadow-soft)] sm:rounded-2xl",
        CARD_HOVER,
        CARD_TRANSITION,
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--focus-ring)] focus-visible:ring-offset-2",
        className,
      )}
    >
      {/* 모바일 2열: 이미지 높이 축소(16:9), sm+ 기존 4:3 */}
      <div className="relative aspect-video w-full shrink-0 overflow-hidden bg-[var(--surface-muted)] sm:aspect-[4/3]">
        {visibleCampaignBadges.length > 0 ? (
          <div className="absolute left-1.5 top-1.5 z-10 flex max-w-[calc(100%-0.75rem)] flex-wrap items-start gap-1 sm:left-2 sm:top-2">
            {visibleCampaignBadges.map((b, i) => (
              <ProductCampaignBadge
                key={`camp-${b.label}-${i}`}
                label={b.label}
                isPrimary={i === 0}
                kind="home"
                badgeTone={b.campaignTone}
                size="md"
                surface="overlay"
              />
            ))}
          </div>
        ) : null}
        <Image
          src={imageSrc}
          alt={titleText}
          fill
          sizes="(max-width: 640px) 46vw, 360px"
          className="object-cover transition duration-200 ease-out group-hover:scale-[1.02]"
        />
      </div>

      <div className="flex min-h-0 flex-1 flex-col gap-1 px-2.5 py-2 sm:gap-1.5 sm:px-4 sm:py-4">
        <div className="flex items-start justify-between gap-1.5 sm:gap-2">
          <div className="flex min-w-0 flex-wrap items-center gap-1">
            {infoDisplayChips.map((chip, i) => (
              <span
                key={`${chip.variant}-${chip.label}`}
                className={cn(
                  "inline-flex max-w-full truncate rounded-full border px-1.5 py-0.5 text-[10px] font-semibold leading-none shadow-sm sm:px-2 sm:py-1 sm:text-[11px]",
                  i >= 1 && "hidden sm:inline-flex",
                  infoDisplayChipSurfaceClass(chip.variant),
                )}
              >
                {chip.label}
              </span>
            ))}
          </div>
          {showRating ? (
            <p className="hidden shrink-0 items-center gap-0.5 tabular-nums text-[11px] text-[var(--text-muted)] sm:inline-flex sm:gap-1 sm:text-xs">
              <Star
                className="h-3 w-3 shrink-0 fill-amber-400 text-amber-400 sm:h-3.5 sm:w-3.5"
                strokeWidth={0}
                aria-hidden
              />
              <span>{ratingAvg!.toFixed(1)}</span>
              <span>({formatReviewCount(reviewCount!)})</span>
            </p>
          ) : null}
        </div>

        {regionLabel ? (
          <p className="line-clamp-1 text-[10px] font-medium text-[var(--text-muted)] sm:text-[11px]">
            {regionLabel}
          </p>
        ) : null}

        <h3 className="line-clamp-2 text-[13px] font-semibold leading-tight text-[var(--foreground)] sm:text-sm sm:leading-snug">
          {titleText}
        </h3>

        {campaignPitch ? (
          <p className="line-clamp-2 text-[10px] font-semibold leading-snug text-[var(--primary)] sm:line-clamp-1 sm:text-[11px]">
            {campaignPitch}
          </p>
        ) : null}

        {oneLine ? (
          <p className="hidden line-clamp-1 text-[11px] leading-snug text-[var(--text-muted)] sm:block sm:text-xs">
            {oneLine}
          </p>
        ) : subMeta ? (
          <p className="hidden line-clamp-1 text-[11px] text-[var(--text-muted)] sm:block sm:text-xs">{subMeta}</p>
        ) : null}

        <div className="mt-auto border-t border-[var(--border)]/60 pt-1.5 sm:border-0 sm:pt-1">
          {priceFormatted ? (
            <>
              <p className="text-[15px] font-bold leading-tight text-[var(--primary)] tabular-nums sm:text-lg">
                ₩{priceFormatted}~
              </p>
              {priceMetaLine ? (
                <p className="mt-0.5 text-[10px] leading-tight text-[var(--text-muted)] sm:text-[11px]">
                  {priceMetaLine}
                </p>
              ) : null}
            </>
          ) : (
            <p className="text-sm font-bold leading-tight text-[var(--text-muted)] sm:text-base md:text-lg">
              상담 후 견적
            </p>
          )}
        </div>
      </div>
    </Link>
  );
}

```


---

## File: `src/components/product/HomeProductCard.tsx`

```tsx
/**
 * 홈 전용 상품 카드 — 구현본은 `@/components/products/HomeProductCard`에 있습니다.
 * PR9 요청 경로(`components/product`)와 실제 구현(`components/products`)을 맞추기 위한 re-export.
 */
export { HomeProductCard, type HomeProductCardProps } from "@/components/products/HomeProductCard";

```


---

## File: `src/components/products/ProductCardGridSection.tsx`

```tsx
"use client";

import * as React from "react";
import { cn } from "@/lib/cn";

export type ProductCardGridSectionProps = {
  /** 카드 목록 (보통 ProductCard 컴포넌트들). key는 각 카드에 부여해야 함. */
  children: React.ReactNode;
  className?: string;
  /** 데스크톱(lg) 그리드 열 수. 기본 3열. 랜딩 추천은 2, 홈 추천은 4열로 카드 폭 축소(약 75%) 등 */
  desktopGridCols?: 2 | 3 | 4;
  /**
   * 홈 큐레이션 전용: 모바일에서 카드 폭·bleed·gap 축소(2장 인지 밀도).
   * 기본 false — 검색/랜딩/가이드 등은 기존 min-w-[78%] 유지.
   */
  homeCuratedMobileCompact?: boolean;
  /**
   * /destinations, /themes 허브 추천 상품: md 미만만 가로 레일 + scroll-snap + PageContainer bleed,
   * md 이상부터 그리드(태블릿 세로 나열 방지).
   */
  hubLandingLayout?: boolean;
  /**
   * /guides/[slug] 상단 추천: 모바일은 세로 스택·gap 축소, 3번째 카드 숨김, 첫·둘째 사이에 interstitial.
   * sm 이상은 3열 그리드.
   */
  guideBridgeTopPicksLayout?: boolean;
  /** guideBridgeTopPicksLayout 전용: 모바일에서 첫 카드 직후 삽입 (sm 이상 hidden) */
  mobileInterstitial?: React.ReactNode;
  /** 가이드 브리지 보조 추천 등: 모바일 가로 레일 gap 축소 (gap-3 → gap-2) */
  guideBridgeMobileTightGap?: boolean;
};

/**
 * 상품 카드 그리드·모바일 가로 스크롤 공통 래퍼.
 * - 모바일 기본: min-w-[78%] max-w-[320px], bleed -mx-1 px-1
 * - homeCuratedMobileCompact: 홈 추천 전용 — 모바일 `grid-cols-2` 고정(가로 스크롤 없음), gap·bleed 정리
 * - hubLandingLayout: 스냅 레일 + 78~84% 카드 폭, md+ 그리드
 * - 데스크톱: 그리드 2열(sm 또는 md) / desktopGridCols(lg, 2~4), max-w 1344px
 */
export function ProductCardGridSection({
  children,
  className,
  desktopGridCols = 3,
  homeCuratedMobileCompact = false,
  hubLandingLayout = false,
  guideBridgeTopPicksLayout = false,
  mobileInterstitial,
  guideBridgeMobileTightGap = false,
}: ProductCardGridSectionProps) {
  const items = React.Children.toArray(children);

  if (items.length === 0) return null;

  if (guideBridgeTopPicksLayout) {
    const first = items[0];
    const second = items[1];
    const third = items[2];
    return (
      <div className={className}>
        <div className="mx-auto w-full max-w-[1344px]">
          <div className="flex flex-col gap-1 sm:grid sm:grid-cols-3 sm:gap-4">
            {first ? <div className="min-w-0">{first}</div> : null}
            {mobileInterstitial ? <div className="sm:hidden">{mobileInterstitial}</div> : null}
            {second ? <div className="min-w-0">{second}</div> : null}
            {third ? <div className="min-w-0 max-sm:hidden">{third}</div> : null}
          </div>
        </div>
      </div>
    );
  }

  const mobileBleedClass = homeCuratedMobileCompact
    ? "-mx-4 px-4 sm:mx-0 sm:px-0"
    : hubLandingLayout
      ? "-mx-4 px-4 md:mx-0 md:px-0"
      : "-mx-1 px-1 sm:mx-0 sm:px-0";

  const mobileItemClass = homeCuratedMobileCompact
    ? "min-w-0"
    : hubLandingLayout
      ? "min-w-[78%] max-w-[84%] shrink-0 snap-start"
      : "min-w-[78%] max-w-[320px] shrink-0";

  const mobileRailHidden = hubLandingLayout ? "md:hidden" : "sm:hidden";

  const desktopGridClass =
    desktopGridCols === 2
      ? hubLandingLayout
        ? "hidden md:grid md:grid-cols-2 lg:grid-cols-2 md:gap-4"
        : "hidden sm:grid sm:grid-cols-2 lg:grid-cols-2 sm:gap-4"
      : desktopGridCols === 4
        ? hubLandingLayout
          ? "hidden md:grid md:grid-cols-2 lg:grid-cols-4 md:gap-4"
          : "hidden sm:grid sm:grid-cols-2 lg:grid-cols-4 sm:gap-4"
        : hubLandingLayout
          ? "hidden md:grid md:grid-cols-2 lg:grid-cols-3 md:gap-4"
          : "hidden sm:grid sm:grid-cols-2 lg:grid-cols-3 sm:gap-4";

  return (
    <div className={className}>
      <div className="mx-auto w-full max-w-[1344px]">
        {/* 모바일: 홈 큐레이션은 2열 그리드 / 그 외는 가로 스크롤 */}
        {homeCuratedMobileCompact ? (
          <div
            className={cn(
              "grid grid-cols-2 gap-x-2 gap-y-2.5 pb-2 sm:hidden",
              mobileBleedClass,
            )}
          >
            {items.map((item, i) => (
              <div key={i} className={mobileItemClass}>
                {item}
              </div>
            ))}
          </div>
        ) : (
          <div
            className={cn(
              "flex overflow-x-auto pb-2 scrollbar-hide",
              hubLandingLayout && "snap-x snap-mandatory scroll-smooth [touch-action:pan-x]",
              hubLandingLayout
                ? guideBridgeMobileTightGap
                  ? "gap-2"
                  : "gap-4"
                : guideBridgeMobileTightGap
                  ? "gap-1.5"
                  : "gap-3",
              mobileRailHidden,
              mobileBleedClass,
            )}
          >
            {items.map((item, i) => (
              <div key={i} className={mobileItemClass}>
                {item}
              </div>
            ))}
          </div>
        )}
        {/* 데스크톱: 그리드 */}
        <div className={desktopGridClass}>{items}</div>
      </div>
    </div>
  );
}

```


---

## File: `src/components/products/ProductCampaignBadge.tsx`

```tsx
"use client";

import { cn } from "@/lib/cn";
import type { CampaignBadgeTone } from "@/types/productCampaignCard";
import type { CampaignBadgeSurface, CampaignCardKind } from "@/lib/productCampaignPresentation";
import { getCampaignBadgeClassName } from "@/lib/productCampaignPresentation";

export type ProductCampaignBadgeProps = {
  label: string;
  /** true: 우선순위 1위 대표 배지 */
  isPrimary: boolean;
  /** 카드 유형별 크기·톤 */
  kind: CampaignCardKind;
  /** PR3: taxonomy CMS 톤. 없으면 라벨로 추론 */
  badgeTone?: CampaignBadgeTone | null;
  /** md: 오버레이·related, sm: 리스트/모바일 인라인 */
  size?: "sm" | "md";
  /** overlay: 이미지 위, inline: 제목 인접(본문 배경) */
  surface?: CampaignBadgeSurface;
  className?: string;
};

/**
 * 기획/추천(campaign) 대표 배지 — 카드 간 동일 라벨 동일 인상.
 */
export function ProductCampaignBadge({
  label,
  isPrimary,
  kind,
  badgeTone,
  size = "md",
  surface = "overlay",
  className,
}: ProductCampaignBadgeProps) {
  const text = label.trim();
  if (!text) return null;

  return (
    <span
      title={text}
      className={cn(
        getCampaignBadgeClassName(text, {
          isPrimary,
          kind,
          badgeTone: badgeTone ?? undefined,
          size,
          surface,
        }),
        className,
      )}
    >
      {text}
    </span>
  );
}

```


---

## File: `src/lib/productCardProps.ts`

```typescript
import type { Product } from "@/types/product";
import type { ProductCardBadge, ProductCardProps, ProductCardStatus } from "@/components/products/ProductCard";
import { getProductBadges } from "@/lib/productCategory";
import { parseMetaTitleAsHashtags } from "@/lib/products/parseMetaTitleAsHashtags";
import { getPrimaryImageUrl } from "@/lib/products/images";
import { buildCampaignRepresentativeBadges } from "@/lib/productCampaignBadges";
import { buildCampaignPitchLineFromProduct, resolveCampaignCardKind } from "@/lib/productCampaignPresentation";

const PRIORITY_BADGES = ["제철", "인기", "마감임박"];

const GUIDE_BRIDGE_SELECTION_MAX = 40;

/**
 * 가이드 브리지 related 카드: 가격 아래 1줄 클릭 맥락 (메타·숙소·태그·테마·카테고리·기간 순).
 * 데이터가 없으면 undefined (렌더 생략).
 */
export function buildGuideBridgeSelectionLine(product: Product): string | undefined {
  const withCheck = (raw: string) => {
    const t = raw.replace(/\s+/g, " ").trim();
    if (t.length < 2) return undefined;
    const clipped =
      t.length > GUIDE_BRIDGE_SELECTION_MAX
        ? `${t.slice(0, Math.max(2, GUIDE_BRIDGE_SELECTION_MAX - 1))}…`
        : t;
    return clipped.startsWith("✔") ? clipped : `✔ ${clipped}`;
  };

  const stay = product.overview_accommodation?.trim();
  if (stay) {
    const line = stay.length <= 28 ? stay : `${stay.slice(0, 26)}…`;
    const w = withCheck(line);
    if (w) return w;
  }

  const meta = product.meta_info?.trim() ?? "";
  if (meta.length >= 4 && meta.length <= 34) {
    const w = withCheck(meta);
    if (w) return w;
  }

  const tags = parseMetaTitleAsHashtags(product.meta_title);
  const tag0 = tags[0]?.trim();
  if (tag0 && tag0.length <= 30) {
    const w = withCheck(tag0.replace(/^#+/, ""));
    if (w) return w;
  }

  const themeRaw = product.theme?.trim();
  if (themeRaw) {
    const first = themeRaw.split(/[,，]/)[0]?.trim();
    if (first && first.length <= 26) {
      const w = withCheck(`${first} 일정`);
      if (w) return w;
    }
  }

  const cat = product.category?.trim();
  if (cat && cat.length <= 22) {
    const w = withCheck(`${cat} 코스`);
    if (w) return w;
  }

  const d = product.duration?.trim();
  if (d) {
    const w = withCheck(`${d} 일정`);
    if (w) return w;
  }

  return undefined;
}

function withCheckFeaturedLine(raw: string): string | undefined {
  const t = raw.replace(/\s+/g, " ").trim();
  if (t.length < 2) return undefined;
  const clipped =
    t.length > GUIDE_BRIDGE_SELECTION_MAX
      ? `${t.slice(0, Math.max(2, GUIDE_BRIDGE_SELECTION_MAX - 1))}…`
      : t;
  return clipped.startsWith("✔") ? clipped : `✔ ${clipped}`;
}

/**
 * 지역·테마 랜딩 `CuratedBlock` 대표 상품: 카드 하단 선택 이유 1줄.
 * 우선순위: 기간 → 숙박/구성(meta) → 테마 → 카테고리 → 태그 → 인기 폴백.
 */
export function getFeaturedHighlightLine(product: Product): string | undefined {
  const d = product.overview_duration?.trim() || product.duration?.trim();
  if (d) {
    const w = withCheckFeaturedLine(`${d} 일정`);
    if (w) return w;
  }

  const stay = product.overview_accommodation?.trim();
  if (stay) {
    const line = stay.length <= 28 ? stay : `${stay.slice(0, 26)}…`;
    const w = withCheckFeaturedLine(line);
    if (w) return w;
  }

  const meta = product.meta_info?.trim() ?? "";
  if (meta.length >= 4 && meta.length <= 34) {
    const w = withCheckFeaturedLine(meta);
    if (w) return w;
  }

  const themeRaw = product.theme?.trim();
  if (themeRaw) {
    const first = themeRaw.split(/[,，]/)[0]?.trim();
    if (first && first.length <= 26) {
      const w = withCheckFeaturedLine(`${first} 일정`);
      if (w) return w;
    }
  }

  const cat = product.category?.trim();
  if (cat && cat.length <= 22) {
    const w = withCheckFeaturedLine(`${cat} 코스`);
    if (w) return w;
  }

  const tags = parseMetaTitleAsHashtags(product.meta_title);
  const tag0 = tags[0]?.trim();
  if (tag0 && tag0.length <= 30) {
    const w = withCheckFeaturedLine(tag0.replace(/^#+/, ""));
    if (w) return w;
  }

  if (product.is_popular) return "✔ 인기 일정";
  return undefined;
}

/** @deprecated `getFeaturedHighlightLine`와 동일 — 하위 호환 */
export function buildCuratedFeaturedSelectionLine(product: Product): string | undefined {
  return getFeaturedHighlightLine(product);
}

/** 가이드 브리지 등: 기간·카테고리·테마로 클릭 맥락 한 줄 */
export function buildProductExperienceSummary(product: Product): string {
  const parts: string[] = [];
  const d = product.duration?.trim();
  if (d) parts.push(d);
  const c = product.category?.trim();
  if (c) parts.push(c);
  const raw = product.theme?.trim();
  if (raw) {
    const first = raw.split(/[,，]/)[0]?.trim();
    if (first) parts.push(first.length > 24 ? `${first.slice(0, 22)}…` : first);
  }
  if (parts.length === 0) return "일정과 구성은 상세에서 확인할 수 있어요";
  return parts.join(" · ");
}

/**
 * 테마·카테고리 기반 **정보성** 배지 (대표 배지 오버레이에 쓰지 않음).
 */
export function buildProductCardInfoBadges(product: Product): ProductCardBadge[] {
  const themeBadges = getProductBadges(product);
  return themeBadges.map((label) => ({
    type: PRIORITY_BADGES.includes(label) ? "gold" : "muted",
    label,
    priority: PRIORITY_BADGES.includes(label) ? 5 : 0,
    isActive: true,
  }));
}

/**
 * @deprecated `buildProductCardInfoBadges` 사용 — 이름이 혼동되기 쉬워 분리됨.
 */
export function buildProductCardBadges(product: Product): ProductCardBadge[] {
  return buildProductCardInfoBadges(product);
}

export type ProductToProductCardOverrides = Partial<
  Pick<
    ProductCardProps,
    | "layout"
    | "analyticsSource"
    | "analyticsSection"
    | "onClickDetail"
    | "onClickConsult"
    | "hrefDetail"
    | "oneLiner"
    | "ratingAvg"
    | "reviewCount"
    | "className"
    | "topPickLabel"
    | "experienceSummary"
    | "emphasizeFirstOnMobile"
    | "guideBridgeNarrowCopy"
    | "selectionHighlightLine"
    | "badges"
    | "infoBadges"
    | "campaignPitchLine"
    | "campaignPresentationKind"
  >
> & {
  /** 기본: list/mobile presentation이면 1, 그 외 2 */
  campaignBadgeMax?: number;
  /** 기본: list/mobile presentation이면 true(피치 생략) */
  omitCampaignPitch?: boolean;
};

export type { CampaignCardKind } from "@/lib/productCampaignPresentation";

/** 카드 표현만 다를 뿐 동일 campaign 소스 — 최대 개수 정책 */
export const CAMPAIGN_BADGE_MAX = {
  related: 2,
  grid: 2,
  home: 2,
  list: 1,
  listMobile: 1,
} as const;

function defaultCampaignBadgeMax(overrides: ProductToProductCardOverrides | undefined): number {
  if (overrides?.campaignBadgeMax != null) return Math.max(1, Math.min(2, overrides.campaignBadgeMax));
  const pk = overrides?.campaignPresentationKind;
  if (pk === "list" || pk === "mobile") return 1;
  return 2;
}

function defaultOmitCampaignPitch(overrides: ProductToProductCardOverrides | undefined): boolean {
  if (overrides?.omitCampaignPitch != null) return overrides.omitCampaignPitch;
  const pk = overrides?.campaignPresentationKind;
  return pk === "list" || pk === "mobile";
}

/**
 * Product → ProductCard에 넘길 공통 props.
 * CuratedBlock, SearchResults, RelatedProductsSection, ProductCatalogSection, ProductListCard* , guides 등에서 재사용.
 * CTR: oneLiner / ratingAvg / reviewCount 는 리스트 카드와 그리드 카드 동일 파이프라인.
 */
export function productToProductCardProps(
  product: Product,
  overrides?: ProductToProductCardOverrides,
): Omit<ProductCardProps, "onClickDetail" | "onClickConsult"> &
  Partial<ProductToProductCardOverrides> {
  const { campaignBadgeMax: _maxMeta, omitCampaignPitch: _pitchMeta, ...restOverrides } =
    overrides ?? {};
  void _maxMeta;
  void _pitchMeta;

  const status: ProductCardStatus = (product.status ?? "AVAILABLE") as ProductCardStatus;
  const isRelatedSection = overrides?.analyticsSection === "related_products";
  const layoutBase = overrides?.layout ?? "grid";
  const effectiveLayout = isRelatedSection ? ("related" as const) : layoutBase;
  const campaignKind = resolveCampaignCardKind({
    layout: effectiveLayout,
    analyticsSection: overrides?.analyticsSection ?? null,
    presentationKind: overrides?.campaignPresentationKind,
  });
  const maxBadges = defaultCampaignBadgeMax(overrides);
  const campaignBadges = buildCampaignRepresentativeBadges(product, { max: maxBadges });
  const infoBadges = buildProductCardInfoBadges(product);
  const campaignPitchLine = defaultOmitCampaignPitch(overrides)
    ? undefined
    : buildCampaignPitchLineFromProduct(product, campaignKind);
  return {
    title: product.title,
    price: product.price,
    duration: product.duration,
    region: product.theme,
    categories: [product.category].filter(Boolean),
    tags: parseMetaTitleAsHashtags(product.meta_title),
    status,
    badges: campaignBadges,
    infoBadges,
    campaignPitchLine,
    thumbnailUrl: getPrimaryImageUrl(product),
    priceMeta: product.price_meta ?? "1인 기준",
    metaInfo: product.meta_info ?? "",
    overviewStay: product.overview_accommodation?.trim() || product.meta_info?.trim() || "",
    overviewRegion: product.overview_region?.trim() || product.theme?.trim() || product.category?.trim() || "",
    overviewDuration: product.overview_duration?.trim() || product.duration?.trim() || "",
    hrefDetail: `/products/${product.id}`,
    productId: product.id,
    layout: "grid",
    oneLiner: product.one_liner?.trim() || undefined,
    ratingAvg: product.trust?.ratingAvg,
    reviewCount: product.trust?.reviewCount,
    ...restOverrides,
    ...(isRelatedSection ? { layout: "related" as const } : {}),
  };
}

```


---

## File: `src/lib/productCardSignals.ts`

```typescript
import type { ProductCardBadge, ProductCardStatus } from "@/components/products/ProductCard";

export type DisplayChip = {
  label: string;
  variant: "accent" | "muted" | "gold";
};

/** ProductCard / HomeProductCard 공통 칩 표면 스타일 */
export function displayChipSurfaceClass(variant: DisplayChip["variant"]): string {
  if (variant === "accent") {
    return "border-blue-200 bg-blue-600/95 text-white";
  }
  if (variant === "gold") {
    return "border-amber-200 bg-amber-500/95 text-white";
  }
  return "border-[var(--border)] bg-[var(--surface)] text-[var(--text-primary)]";
}

/**
 * 테마·상태 등 **정보성** 칩 — 캠페인 대표 배지보다 한 단계 낮은 계층 (PR2).
 */
export function infoDisplayChipSurfaceClass(variant: DisplayChip["variant"]): string {
  if (variant === "gold") {
    return "border-amber-200/70 bg-amber-500/88 text-white";
  }
  if (variant === "accent") {
    return "border-[var(--border)]/70 bg-[var(--surface-muted)] text-[var(--text-muted)]";
  }
  return "border-[var(--border)]/60 bg-[var(--surface-muted)]/80 text-[var(--text-subtle)]";
}

function badgeTypeToTagVariant(type: string): "accent" | "muted" | "gold" {
  const t = type?.toLowerCase() ?? "";
  if (t === "accent" || t === "primary" || t === "인기" || t === "추천") return "accent";
  if (t === "gold" || t === "제철" || t === "마감임박") return "gold";
  return "muted";
}

/**
 * 상태 + 테마 등 **정보성** 배지 칩 (최대 2개).
 * 캠페인 대표 배지는 `badges`(campaign)와 분리 — 여기서는 다루지 않음.
 */
export function pickInfoDisplayChips(
  status: ProductCardStatus | undefined,
  infoBadges: ProductCardBadge[],
): DisplayChip[] {
  const chips: DisplayChip[] = [];

  if (status === "SOLD_OUT") {
    chips.push({ label: "마감", variant: "muted" });
  } else if (status === "LIMITED") {
    chips.push({ label: "마감임박", variant: "gold" });
  } else if (status === "CONSULT_REQUIRED") {
    chips.push({ label: "상담 후 안내", variant: "muted" });
  }

  const sorted = [...infoBadges].filter((b) => b.isActive !== false).sort((a, b) => {
    const pa = a.priority ?? 0;
    const pb = b.priority ?? 0;
    if (pb !== pa) return pb - pa;
    return a.label.localeCompare(b.label, "ko");
  });

  for (const b of sorted) {
    if (chips.length >= 2) break;
    const label = b.label.trim();
    if (!label) continue;
    const low = label.toLowerCase();
    if (status === "SOLD_OUT" && (low.includes("마감") || low.includes("sold"))) continue;
    if (status === "LIMITED" && low.includes("마감임박")) continue;
    const variant = badgeTypeToTagVariant(b.type);
    const key = `${variant}-${label}`;
    if (chips.some((c) => `${c.variant}-${c.label}` === key)) continue;
    chips.push({ label, variant });
  }

  return chips.slice(0, 2);
}

/** 이미지 오버레이용: 캠페인 대표 배지(badges) → DisplayChip, 최대 2개 */
export function campaignBadgesToDisplayChips(badges: ProductCardBadge[]): DisplayChip[] {
  const sorted = [...badges].filter((b) => b.isActive !== false).sort((a, b) => {
    const pa = a.priority ?? 0;
    const pb = b.priority ?? 0;
    if (pb !== pa) return pb - pa;
    return a.label.localeCompare(b.label, "ko");
  });
  const out: DisplayChip[] = [];
  for (const b of sorted) {
    if (out.length >= 2) break;
    const label = b.label.trim();
    if (!label) continue;
    out.push({ label, variant: badgeTypeToTagVariant(b.type) });
  }
  return out;
}

/**
 * @deprecated `pickInfoDisplayChips` 사용 — 인자는 정보성 배지(`infoBadges`)만 넘기세요.
 */
export function pickDisplayChips(
  status: ProductCardStatus | undefined,
  activeBadges: ProductCardBadge[],
): DisplayChip[] {
  return pickInfoDisplayChips(status, activeBadges);
}

```


---

## File: `src/lib/productCampaignBadges.ts`

```typescript
/**
 * 상품 카드 **대표 배지** — PR3: `campaign_card_meta`(taxonomy CMS) 우선, 없으면 문자열 레거시.
 */

import type { Product } from "@/types/product";
import type { ProductCardBadge } from "@/components/products/ProductCard";

/** 레거시: 라벨만 있을 때 우선순위 (taxonomy 없을 때) */
const PRIORITY_RECOMMEND = 1;
const PRIORITY_POPULAR = 2;
const PRIORITY_NEW = 3;
const PRIORITY_OTHER_BASE = 100;

export function normalizeCampaignLabel(raw: string): string {
  return raw.replace(/\s+/g, " ").trim();
}

function campaignKey(label: string): string {
  return normalizeCampaignLabel(label).toLowerCase();
}

/** @deprecated PR3 이후 taxonomy badge_priority 사용. 레거시 fallback 전용 */
export function getCampaignBadgePriority(label: string): number {
  const k = campaignKey(label);
  if (k === "추천") return PRIORITY_RECOMMEND;
  if (k === "인기") return PRIORITY_POPULAR;
  if (k === "신규") return PRIORITY_NEW;
  return PRIORITY_OTHER_BASE;
}

function collectCampaignLabels(product: Product): string[] {
  const raw = product.campaigns ?? product.campaigns_json ?? [];
  if (!Array.isArray(raw)) return [];
  const out: string[] = [];
  const seen = new Set<string>();
  for (const item of raw) {
    if (typeof item !== "string") continue;
    const n = normalizeCampaignLabel(item);
    if (!n) continue;
    const key = campaignKey(n);
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(n);
  }
  return out;
}

function sortCampaignLabelsForDisplay(labels: string[]): string[] {
  return [...labels].sort((a, b) => {
    const pa = getCampaignBadgePriority(a);
    const pb = getCampaignBadgePriority(b);
    if (pa !== pb) return pa - pb;
    return a.localeCompare(b, "ko");
  });
}

function legacyCampaignBadgeTypeForLabel(label: string): string {
  const k = campaignKey(label);
  if (k === "추천" || k === "인기" || k === "신규") return "accent";
  return "muted";
}

/** 레거시 단일 라벨 → ProductCardBadge */
export function buildCampaignBadge(label: string): ProductCardBadge {
  const normalized = normalizeCampaignLabel(label);
  const k = campaignKey(normalized);
  let campaignTone: "primary" | "highlight" | "neutral" = "neutral";
  if (k === "추천") campaignTone = "primary";
  else if (k === "인기") campaignTone = "highlight";
  else if (k === "신규") campaignTone = "neutral";
  return {
    type: legacyCampaignBadgeTypeForLabel(normalized),
    label: normalized,
    priority: 100 - getCampaignBadgePriority(normalized),
    isActive: true,
    campaignTone,
  };
}

function appendRecommendPopularFallback(product: Product, labels: string[]): string[] {
  const next = [...labels];
  const seen = new Set(next.map((l) => campaignKey(l)));

  if (product.is_recommend === true && !seen.has("추천")) {
    next.push("추천");
    seen.add("추천");
  }
  if (product.is_popular === true && !seen.has("인기")) {
    next.push("인기");
    seen.add("인기");
  }
  return sortCampaignLabelsForDisplay(next);
}

function buildBadgesFromCampaignCardMeta(product: Product, max: number): ProductCardBadge[] {
  const meta = product.campaign_card_meta;
  if (!meta?.length) return [];
  const visible = meta.filter((m) => m.badge_visible === true);
  visible.sort((a, b) => {
    if (a.badge_priority !== b.badge_priority) return a.badge_priority - b.badge_priority;
    return a.displayLabel.localeCompare(b.displayLabel, "ko");
  });
  return visible.slice(0, max).map((m) => ({
    type: m.badge_tone,
    label: m.displayLabel,
    priority: 1_000_000 - m.badge_priority,
    isActive: true,
    campaignTone: m.badge_tone,
  }));
}

export type BuildCampaignRepresentativeBadgesOptions = {
  /** 대표 배지 최대 개수. related/grid/home 2, list·모바일 리스트 1 권장 */
  max?: number;
};

const DEFAULT_CAMPAIGN_BADGE_MAX = 2;

/**
 * 카드 상단 대표 배지 (campaign 소스 단일 진입점).
 * - `campaign_card_meta`에 해석된 토큰이 있으면 CMS 규칙만 사용(전부 비노출이면 배지 없음).
 * - 해석된 메타가 없을 때만 campaigns 문자열 + 레거시 추천/인기/신규 + is_* fallback.
 */
export function buildCampaignRepresentativeBadges(
  product: Product,
  options?: BuildCampaignRepresentativeBadgesOptions,
): ProductCardBadge[] {
  const max = Math.max(1, Math.min(2, options?.max ?? DEFAULT_CAMPAIGN_BADGE_MAX));
  const meta = product.campaign_card_meta;
  const hasResolvedCampaignTokens = Array.isArray(meta) && meta.length > 0;
  const fromMeta = buildBadgesFromCampaignCardMeta(product, max);
  if (fromMeta.length > 0) {
    return fromMeta;
  }
  if (hasResolvedCampaignTokens) {
    return [];
  }

  let labels = sortCampaignLabelsForDisplay(collectCampaignLabels(product));

  if (labels.length === 0) {
    labels = appendRecommendPopularFallback(product, []);
  } else {
    labels = labels.slice(0, max);
  }

  if (labels.length === 0) {
    return [];
  }

  return labels.slice(0, max).map((label) => buildCampaignBadge(label));
}

export function getPrimaryRepresentativeCampaignLabel(product: Product): string | undefined {
  const b = buildCampaignRepresentativeBadges(product, { max: 2 })[0];
  const t = b?.label?.trim();
  return t || undefined;
}

```


---

## File: `src/lib/productCampaignPresentation.ts`

```typescript
/**
 * 캠페인 대표 배지 **표시 정책** (PR2 + PR3).
 * PR3: `badge_tone`·taxonomy `description`(badge_description) 데이터 기반, 레거시 라벨 fallback.
 */

import type { Product } from "@/types/product";
import type { CampaignBadgeTone } from "@/types/productCampaignCard";
import { cn } from "@/lib/cn";
import { getPrimaryRepresentativeCampaignLabel, normalizeCampaignLabel } from "@/lib/productCampaignBadges";

/** 카드 표면 종류 — 데이터는 동일, 표현 강도만 조절 */
export type CampaignCardKind = "related" | "list" | "grid" | "mobile" | "home";

export type CampaignVisualTone = "recommend" | "popular" | "new" | "secondary";

function campaignKey(label: string): string {
  return normalizeCampaignLabel(label).toLowerCase();
}

export function getCampaignBadgeTone(label: string): CampaignVisualTone {
  const k = campaignKey(label);
  if (k === "추천") return "recommend";
  if (k === "인기") return "popular";
  if (k === "신규") return "new";
  return "secondary";
}

/** @deprecated 이름 명확화: `getCampaignBadgeTone` */
export function getCampaignBadgeStyle(label: string): CampaignVisualTone {
  return getCampaignBadgeTone(label);
}

/**
 * 대표 캠페인 1줄 설명 (라벨 매핑만, 관리자 자유 입력 없음).
 */
export function getCampaignBadgeDescription(
  label: string,
  opts?: { maxLength?: number },
): string | undefined {
  const raw = normalizeCampaignLabel(label);
  if (!raw) return undefined;
  const k = campaignKey(raw);
  let out: string;
  if (k === "추천") out = "MD가 추천하는 일정";
  else if (k === "인기") out = "요즘 많이 찾는 상품";
  else if (k === "신규") out = "최근 등록된 기획 상품";
  else out = `${raw} 기획 상품`;

  const max = opts?.maxLength ?? 42;
  if (out.length > max) return `${out.slice(0, Math.max(8, max - 1))}…`;
  return out;
}

export function shouldShowCampaignPitch(kind: CampaignCardKind): boolean {
  return kind !== "grid";
}

/**
 * 카드 유형에 맞는 피치 문구 (grid는 생략).
 */
export function getCampaignPitchForLabel(label: string, kind: CampaignCardKind): string | undefined {
  if (!shouldShowCampaignPitch(kind)) return undefined;
  const max =
    kind === "home"
      ? 30
      : kind === "mobile"
        ? 34
        : kind === "list"
          ? 40
          : 44;
  return getCampaignBadgeDescription(label, { maxLength: max });
}

function pitchMaxLengthForKind(kind: CampaignCardKind): number {
  if (kind === "home") return 30;
  if (kind === "mobile") return 34;
  if (kind === "list") return 40;
  return 44;
}

function clipCampaignPitch(text: string, max: number): string {
  const t = text.replace(/\s+/g, " ").trim();
  if (!t) return "";
  if (t.length <= max) return t;
  return `${t.slice(0, Math.max(8, max - 1))}…`;
}

/** 대표 캠페인(visible·priority 1위)의 CMS 설명 1줄 */
function getPrimaryCampaignPitchFromMeta(product: Product, kind: CampaignCardKind): string | undefined {
  if (!shouldShowCampaignPitch(kind)) return undefined;
  const meta = product.campaign_card_meta;
  if (!meta?.length) return undefined;
  const sorted = [...meta]
    .filter((m) => m.badge_visible === true)
    .sort((a, b) => {
      if (a.badge_priority !== b.badge_priority) return a.badge_priority - b.badge_priority;
      return a.displayLabel.localeCompare(b.displayLabel, "ko");
    });
  const raw = sorted[0]?.description?.trim();
  if (!raw) return undefined;
  const clipped = clipCampaignPitch(raw, pitchMaxLengthForKind(kind));
  return clipped || undefined;
}

export function buildCampaignPitchLineFromProduct(
  product: Product,
  kind: CampaignCardKind,
): string | undefined {
  const fromMeta = getPrimaryCampaignPitchFromMeta(product, kind);
  if (fromMeta) return fromMeta;

  const primary = getPrimaryRepresentativeCampaignLabel(product);
  if (!primary) return undefined;
  return getCampaignPitchForLabel(primary, kind);
}

function visualToneFromBadgeTone(tone: CampaignBadgeTone): CampaignVisualTone {
  if (tone === "primary") return "recommend";
  if (tone === "highlight") return "popular";
  return "new";
}

/** ProductCard layout + 옵션 → 표현 kind */
export function resolveCampaignCardKind(args: {
  layout: "grid" | "list" | "related" | "stack";
  analyticsSection?: string | null;
  presentationKind?: CampaignCardKind;
}): CampaignCardKind {
  if (args.presentationKind) return args.presentationKind;
  if (args.analyticsSection === "related_products" || args.layout === "related") return "related";
  if (args.layout === "list") return "list";
  return "grid";
}

/** 이미지 오버레이 vs 본문 인라인(리스트 카드 제목 주변) */
export type CampaignBadgeSurface = "overlay" | "inline";

/**
 * Tailwind 클래스 — 핵심 3종은 캐릭터, 기타는 절제된 pill.
 * - `size`: md = related·그리드 오버레이, sm = 리스트/모바일 인라인
 * - `surface`: overlay = 어두운 보조 배지 허용, inline = 표면 위 보조 칩은 절제
 */
export function getCampaignBadgeClassName(
  label: string,
  opts: {
    isPrimary: boolean;
    kind: CampaignCardKind;
    badgeTone?: CampaignBadgeTone;
    size?: "sm" | "md";
    surface?: CampaignBadgeSurface;
  },
): string {
  const tone: CampaignVisualTone =
    opts.badgeTone != null ? visualToneFromBadgeTone(opts.badgeTone) : getCampaignBadgeTone(label);
  const { isPrimary, kind } = opts;
  const size = opts.size ?? "md";
  const surface = opts.surface ?? "overlay";

  const sizePrimaryMd =
    kind === "related"
      ? "px-2.5 py-1 text-[11px] sm:text-xs"
      : kind === "list"
        ? "px-2 py-0.5 text-[10px] md:px-2.5 md:py-1 md:text-[11px]"
        : kind === "home"
          ? "px-2 py-0.5 text-[10px] sm:px-2 sm:py-1 sm:text-[11px]"
          : kind === "mobile"
            ? "px-1.5 py-0.5 text-[9px] leading-tight"
            : "px-2 py-0.5 text-[10px] sm:text-[11px]";

  const sizePrimarySm =
    "px-1.5 py-0.5 text-[9px] leading-tight sm:px-2 sm:py-0.5 sm:text-[10px]";

  const sizeSecondaryMd =
    kind === "related"
      ? "px-2 py-0.5 text-[10px] sm:text-[11px]"
      : kind === "list"
        ? "px-1.5 py-0.5 text-[9px] md:px-2 md:py-0.5 md:text-[10px]"
        : kind === "home"
          ? "px-1.5 py-0.5 text-[9px] sm:px-2 sm:py-0.5 sm:text-[10px]"
          : kind === "mobile"
            ? "px-1.5 py-0.5 text-[8px] leading-tight"
            : "px-1.5 py-0.5 text-[9px] sm:text-[10px]";

  const sizeSecondarySm =
    "px-1.5 py-0.5 text-[8px] leading-tight sm:text-[9px]";

  const sizePrimary = size === "sm" ? sizePrimarySm : sizePrimaryMd;
  const sizeSecondary = size === "sm" ? sizeSecondarySm : sizeSecondaryMd;

  const baseOverlay = "max-w-[min(100%,10.5rem)] shrink-0 truncate rounded-full font-semibold leading-none ring-1";
  const baseInline =
    "max-w-[min(100%,7rem)] sm:max-w-[8.5rem] shrink-0 truncate rounded-full font-semibold leading-none ring-1";

  const base = surface === "inline" ? baseInline : baseOverlay;

  if (!isPrimary) {
    if (surface === "inline") {
      return cn(
        base,
        sizeSecondary,
        "border border-[var(--border)] bg-[var(--surface-muted)] text-[var(--text-secondary)] ring-0 shadow-none",
      );
    }
    return cn(
      base,
      sizeSecondary,
      "bg-black/38 text-white/92 ring-white/18 backdrop-blur-sm",
      kind === "grid" && "opacity-90",
      kind === "related" && "ring-white/25",
    );
  }

  const tonePrimary: Record<CampaignVisualTone, string> = {
    recommend:
      "bg-[var(--primary)] text-[var(--on-primary)] ring-black/15",
    popular: "bg-blue-800 text-white ring-blue-950/20",
    new: "bg-emerald-700 text-white ring-emerald-950/15",
    secondary: "bg-slate-900/88 text-white ring-white/15",
  };

  if (surface === "inline") {
    return cn(base, sizePrimary, tonePrimary[tone], "shadow-sm");
  }

  return cn(base, sizePrimary, tonePrimary[tone]);
}

```


---

## File: `src/lib/analytics/trackProductClick.ts`

```typescript
/**
 * 상품 카드 클릭 계측용 fire-and-forget 유틸.
 * Link 이동을 막지 않고, 내부에서 trackClientEvent 사용. throw 금지.
 */

import { trackClientEvent } from "@/lib/analytics/trackClientEvent";
import { createAnalyticsPayload, normalizeAnalyticsLabel } from "@/lib/analytics/payload";
import { ANALYTICS_EVENTS, ANALYTICS_SOURCES } from "@/lib/analytics/events";

export type ProductDetailCtaSection = "top" | "sticky_mobile" | "sidebar";
export type ProductDetailCtaType = "primary" | "kakao";

export type TrackProductDetailCtaClickParams = {
  productId: string;
  ctaType: ProductDetailCtaType;
  section: ProductDetailCtaSection;
  status?: string;
  hasPrice?: boolean;
  pagePath?: string;
};

export type ProductCardClickSource = "home_curated" | "landing" | "product_list";

export type TrackProductCardClickParams = {
  productId: string;
  productTitle: string;
  href: string;
  source: ProductCardClickSource;
  section?: string | null;
  /** landing일 때 region | theme */
  landingType?: "region" | "theme" | null;
  taxonomySlug?: string | null;
  pagePath?: string;
};

import type { AnalyticsSource } from "@/lib/analytics/types";

function resolveSource(
  source: ProductCardClickSource,
  landingType?: "region" | "theme" | null,
): AnalyticsSource {
  if (source === "home_curated") return ANALYTICS_SOURCES.home_curated_section;
  if (source === "product_list") return ANALYTICS_SOURCES.products_catalog;
  if (source === "landing" && landingType === "theme") return ANALYTICS_SOURCES.landing_theme;
  return ANALYTICS_SOURCES.landing_region;
}

/**
 * 상품 카드 클릭 시 호출. fire-and-forget, 네비게이션 방해 없음.
 * TODO(CTR 계측): landing 클릭 시 `landingType` / `taxonomySlug`를 ProductCard에서 넘기면
 * 소스가 landing_region으로만 묶이는 문제를 줄일 수 있음 (스키마 확장은 후속 PR).
 */
export function trackProductCardClick(params: TrackProductCardClickParams): void {
  try {
    const source = resolveSource(params.source, params.landingType);
    const pagePath =
      typeof params.pagePath === "string" && params.pagePath.trim()
        ? params.pagePath
        : typeof window !== "undefined"
          ? window.location.pathname
          : null;
    const label = normalizeAnalyticsLabel(params.productTitle || params.productId || "");
    const href =
      typeof params.href === "string" && params.href.length > 0
        ? params.href
        : `/products/${encodeURIComponent(params.productId)}`;

    trackClientEvent(
      createAnalyticsPayload({
        eventName: ANALYTICS_EVENTS.product_card_click,
        source,
        pagePath,
        productId: params.productId?.trim() || null,
        label: label || null,
        href,
        section: typeof params.section === "string" && params.section.trim() ? params.section.trim() : null,
        taxonomyType: params.source === "landing" && params.landingType === "theme" ? "theme" : null,
        taxonomySlug: typeof params.taxonomySlug === "string" && params.taxonomySlug.trim() ? params.taxonomySlug.trim() : null,
      }),
    );
  } catch {
    // no-op: tracking 실패가 클릭/이동을 막지 않음
  }
}

/**
 * 상품 상세 CTA 클릭 시 호출 (PR18). section = top | sticky_mobile | sidebar.
 */
export function trackProductDetailCtaClick(params: TrackProductDetailCtaClickParams): void {
  try {
    const pagePath =
      typeof params.pagePath === "string" && params.pagePath.trim()
        ? params.pagePath
        : typeof window !== "undefined"
          ? window.location.pathname
          : null;
    trackClientEvent(
      createAnalyticsPayload({
        eventName: ANALYTICS_EVENTS.product_detail_cta_click,
        source: ANALYTICS_SOURCES.consult_cta,
        pagePath,
        productId: params.productId?.trim() || null,
        section: params.section,
        label: params.ctaType,
        metadata: {
          cta_type: params.ctaType,
          section: params.section,
          status: params.status ?? null,
          has_price: params.hasPrice ?? null,
        },
      }),
    );
  } catch {
    // no-op
  }
}

/** 일정 Day 탭/네비 클릭 (PR20) */
export type TrackProductItineraryDayClickParams = {
  productId: string;
  dayIndex: number;
  dayLabel: string;
  source: "sticky_nav" | "tabs";
  pagePath?: string;
};

export function trackProductItineraryDayClick(params: TrackProductItineraryDayClickParams): void {
  try {
    const pagePath =
      typeof params.pagePath === "string" && params.pagePath.trim()
        ? params.pagePath
        : typeof window !== "undefined"
          ? window.location.pathname
          : null;
    trackClientEvent(
      createAnalyticsPayload({
        eventName: ANALYTICS_EVENTS.product_itinerary_day_click,
        source: ANALYTICS_SOURCES.consult_cta,
        pagePath,
        productId: params.productId?.trim() || null,
        section: params.source,
        label: params.dayLabel,
        metadata: { day_index: params.dayIndex, source: params.source },
      }),
    );
  } catch {
    // no-op
  }
}

/** 일정 이미지 확대 보기 (PR20) */
export type TrackProductItineraryImageOpenParams = {
  productId: string;
  dayIndex: number;
  eventIndex: number;
  imageIndex: number;
  pagePath?: string;
};

export function trackProductItineraryImageOpen(params: TrackProductItineraryImageOpenParams): void {
  try {
    const pagePath =
      typeof params.pagePath === "string" && params.pagePath.trim()
        ? params.pagePath
        : typeof window !== "undefined"
          ? window.location.pathname
          : null;
    trackClientEvent(
      createAnalyticsPayload({
        eventName: ANALYTICS_EVENTS.product_itinerary_image_open,
        source: ANALYTICS_SOURCES.consult_cta,
        pagePath,
        productId: params.productId?.trim() || null,
        section: "itinerary",
        label: null,
        metadata: {
          day_index: params.dayIndex,
          event_index: params.eventIndex,
          image_index: params.imageIndex,
        },
      }),
    );
  } catch {
    // no-op
  }
}

/** 일정 하단 CTA 클릭 (PR20) */
export type TrackProductItineraryCtaClickParams = {
  productId: string;
  dayIndex?: number;
  ctaType: "primary" | "kakao";
  pagePath?: string;
};

export function trackProductItineraryCtaClick(params: TrackProductItineraryCtaClickParams): void {
  try {
    const pagePath =
      typeof params.pagePath === "string" && params.pagePath.trim()
        ? params.pagePath
        : typeof window !== "undefined"
          ? window.location.pathname
          : null;
    trackClientEvent(
      createAnalyticsPayload({
        eventName: ANALYTICS_EVENTS.product_itinerary_cta_click,
        source: ANALYTICS_SOURCES.consult_cta,
        pagePath,
        productId: params.productId?.trim() || null,
        section: "itinerary_bottom",
        label: params.ctaType,
        metadata: {
          cta_type: params.ctaType,
          day_index: params.dayIndex ?? null,
        },
      }),
    );
  } catch {
    // no-op
  }
}

/** CTA 통합 계측 (PR21): section = top | sticky | itinerary */
export type TrackProductCtaClickParams = {
  productId: string;
  ctaType: "primary" | "kakao";
  section: "top" | "sticky" | "itinerary";
  pagePath?: string;
};

export function trackProductCtaClick(params: TrackProductCtaClickParams): void {
  try {
    const pagePath =
      typeof params.pagePath === "string" && params.pagePath.trim()
        ? params.pagePath
        : typeof window !== "undefined"
          ? window.location.pathname
          : null;
    trackClientEvent(
      createAnalyticsPayload({
        eventName: ANALYTICS_EVENTS.product_cta_click,
        source: ANALYTICS_SOURCES.consult_cta,
        pagePath,
        productId: params.productId?.trim() || null,
        section: params.section,
        label: params.ctaType,
        metadata: { cta_type: params.ctaType, section: params.section },
      }),
    );
  } catch {
    // no-op
  }
}

```


---

## File: `src/components/dev/DevProductCardV2Grid.tsx`

```tsx
"use client";

import { useRouter } from "next/navigation";
import type { Product } from "@/types/product";
import ProductCard from "@/components/products/ProductCard";
import { productToProductCardProps } from "@/lib/productCardProps";

type DevProductCardV2GridProps = {
  products: Product[];
};

export default function DevProductCardV2Grid({ products }: DevProductCardV2GridProps) {
  const router = useRouter();

  return (
    <section className="space-y-6">
      <h2 className="text-xl font-bold text-slate-800">ProductCard 데모 (기존 목록 변경 없음)</h2>
      <div className="flex flex-col space-y-3 sm:space-y-0 sm:grid sm:grid-cols-2 sm:gap-6 lg:grid-cols-3">
        {products.slice(0, 6).map((product) => (
          <ProductCard
            key={product.id}
            {...productToProductCardProps(product, {
              layout: "grid",
              analyticsSource: "home_curated",
              analyticsSection: "dev",
              onClickDetail: () => router.push(`/products/${product.id}`),
              onClickConsult: () => router.push(`/quote?productId=${encodeURIComponent(product.id)}`),
            })}
          />
        ))}
      </div>
      {products.length === 0 && (
        <p className="rounded-2xl bg-slate-100 p-6 text-sm text-slate-600">
          등록된 상품이 없습니다. 상품 등록 후 V2 카드를 확인할 수 있습니다.
        </p>
      )}
    </section>
  );
}

```


---

## File: `src/components/products/ProductRelatedProducts.tsx`

```tsx
"use client";

import type { Product } from "@/types/product";
import ProductCard from "@/components/products/ProductCard";
import { ProductCardGridSection } from "@/components/products/ProductCardGridSection";
import { productToProductCardProps } from "@/lib/productCardProps";

export type ProductRelatedProductsProps = {
  /** 현재 상품 ID (목록에서 제외용, 컴포넌트는 이미 제외된 products만 받음) */
  currentProductId: string;
  /** 추천 상품 목록 (최대 6개 권장) */
  products: Product[];
  /** 섹션 제목 */
  title?: string;
};

const DEFAULT_TITLE = "이 여행과 비슷한 상품";

/**
 * PR31: 상품 상세 하단 추천 여행 상품.
 * 모바일 가로 스크롤 + 데스크톱 그리드, 기존 ProductCard 재사용.
 */
export function ProductRelatedProducts({
  currentProductId,
  products,
  title = DEFAULT_TITLE,
}: ProductRelatedProductsProps) {
  const list = products.filter((p) => p.id?.trim() !== currentProductId?.trim()).slice(0, 6);
  if (list.length === 0) return null;

  return (
    <section
      className="mt-8 w-full px-4 md:px-0"
      aria-labelledby="related-products-heading"
    >
      <h2
        id="related-products-heading"
        className="mb-4 text-lg font-semibold text-slate-900"
      >
        {title}
      </h2>
      <div>
        <ProductCardGridSection>
          {list.map((product) => (
            <ProductCard
              key={product.id}
              {...productToProductCardProps(product, {
                layout: "grid",
                analyticsSource: "product_list",
                analyticsSection: "related_products",
              })}
            />
          ))}
        </ProductCardGridSection>
      </div>
    </section>
  );
}

```


---

## File: `src/components/products/RelatedProductsSection.tsx`

```tsx
"use client";

import type { Product } from "@/types/product";
import ProductCard from "@/components/products/ProductCard";
import { ProductCardGridSection } from "@/components/products/ProductCardGridSection";
import { productToProductCardProps } from "@/lib/productCardProps";

export type RelatedProductsSectionProps = {
  /** 섹션 제목 */
  title?: string;
  /** 설명 문구 1줄 */
  description?: string;
  /** 연관 상품 목록 (현재 상품 제외된 상태로 넘어옴) */
  products?: Product[];
};

const DEFAULT_TITLE = "이 상품과 비슷한 여행";
const DEFAULT_DESCRIPTION = "여행지, 테마, 상품 구성이 비슷한 상품을 모아봤어요.";

/**
 * PR43: 상품 상세 하단 연관 상품 섹션.
 * 기존 ProductCard + ProductCardGridSection 재사용, 모바일 가로 스크롤 + 데스크톱 그리드.
 */
export default function RelatedProductsSection({
  title = DEFAULT_TITLE,
  description = DEFAULT_DESCRIPTION,
  products = [],
}: RelatedProductsSectionProps) {
  const list = Array.isArray(products) ? products : [];
  if (!list.length) return null;

  return (
    <section
      className="mt-8 w-full px-4 md:px-0"
      aria-labelledby="related-products-section-heading"
    >
      <div className="space-y-1 mb-4">
        <h2
          id="related-products-section-heading"
          className="text-lg font-semibold text-slate-900"
        >
          {title}
        </h2>
        {description?.trim() && (
          <p className="text-sm text-slate-500">{description}</p>
        )}
      </div>

      <ProductCardGridSection>
        {list.map((product) => (
          <ProductCard
            key={product.id}
            {...productToProductCardProps(product, {
              layout: "grid",
              analyticsSource: "product_list",
              analyticsSection: "related_products",
            })}
          />
        ))}
      </ProductCardGridSection>
    </section>
  );
}

```


---

## File: `src/components/search/RelatedProductsSection.tsx`

```tsx
"use client";

import type { Product } from "@/types/product";
import ProductCard from "@/components/products/ProductCard";
import { ProductCardGridSection } from "@/components/products/ProductCardGridSection";
import { productToProductCardProps } from "@/lib/productCardProps";

export type RelatedProductsSectionProps = {
  /** 섹션 제목. 결과 있음: "이런 상품도 있어요", 결과 없음: "추천 여행 상품" 등 */
  title?: string;
  products: Product[];
};

/**
 * 검색 결과 페이지 하단 추천 상품.
 * /recommended와 동일한 노출 방식: 모바일 가로 스크롤 + 데스크톱 2/3열 그리드.
 */
export default function RelatedProductsSection({
  title = "이런 상품도 있어요",
  products,
}: RelatedProductsSectionProps) {
  if (products.length === 0) return null;

  return (
    <section aria-labelledby="related-products-heading" className="space-y-4">
      <h2
        id="related-products-heading"
        className="heading-display type-h3 text-[var(--foreground)]"
      >
        {title}
      </h2>
      <ProductCardGridSection>
        {products.map((product) => (
          <ProductCard
            key={product.id}
            {...productToProductCardProps(product, {
              layout: "grid",
              analyticsSource: "product_list",
              analyticsSection: "search_related",
            })}
          />
        ))}
      </ProductCardGridSection>
    </section>
  );
}

```


---

## File: `src/components/search/SearchResults.tsx`

```tsx
"use client";

import type { Product } from "@/types/product";
import ProductCard from "@/components/products/ProductCard";
import { ProductCardGridSection } from "@/components/products/ProductCardGridSection";
import { productToProductCardProps } from "@/lib/productCardProps";

export type SearchResultsProps = {
  products: Product[];
};

/**
 * 검색 결과 상품 그리드.
 * /recommended와 동일한 노출 방식: 모바일 가로 스크롤 + 데스크톱 2/3열 그리드.
 */
export default function SearchResults({ products }: SearchResultsProps) {
  if (products.length === 0) return null;

  return (
    <section aria-label="검색 결과 상품 목록">
      <ProductCardGridSection>
        {products.map((product) => (
          <ProductCard
            key={product.id}
            {...productToProductCardProps(product, {
              layout: "grid",
              analyticsSource: "product_list",
              analyticsSection: "search",
            })}
          />
        ))}
      </ProductCardGridSection>
    </section>
  );
}

```


---

## File: `src/components/home/CuratedBlock.tsx`

```tsx
import type { Product } from "@/types/product";
import { cn } from "@/lib/cn";
import { SectionHeader } from "@/components/layout/SectionHeader";
import ProductCard from "@/components/products/ProductCard";
import { ProductCardGridSection } from "@/components/products/ProductCardGridSection";
import {
  getFeaturedHighlightLine,
  buildProductExperienceSummary,
  productToProductCardProps,
} from "@/lib/productCardProps";
import { CARD_BASE, CARD_PADDING_RELAXED } from "@/lib/cardTokens";

export type CuratedBlockSurface = "none" | "muted" | "card";

export type CuratedBlockProps = {
  title: string;
  description: string;
  products: Product[];
  /** 섹션 래퍼 강조. none: 헤더+그리드만, muted/card: 배경/박스 적용 */
  surface?: CuratedBlockSurface;
  /**
   * true: /destinations·/themes 허브 추천 상품 — md 미만 가로 스냅 레일, md+ 그리드.
   */
  hubLandingLayout?: boolean;
  /**
   * true: **[slug] 랜딩** 상단 대표 상품 — 브리지 수준(선택 유도 문구·related 카드·첫 카드 강조·✔ 한 줄·타이트 레일).
   * `/recommended`·허브 인덱스 등에서는 false.
   */
  featuredLanding?: boolean;
};

const SURFACE_CLASS: Record<CuratedBlockSurface, string> = {
  none: "",
  muted: "rounded-2xl bg-[var(--surface-muted)] ring-1 ring-[var(--border)] p-5 sm:p-6",
  card: cn(CARD_BASE, CARD_PADDING_RELAXED),
};

export default function CuratedBlock({
  title,
  description,
  products,
  surface = "none",
  hubLandingLayout = false,
  featuredLanding = false,
}: CuratedBlockProps) {
  if (!products || products.length === 0) return null;

  const useHubRail = hubLandingLayout || featuredLanding;
  const useTightMobileGap = featuredLanding;

  return (
    <section className={cn("space-y-3 sm:space-y-4", SURFACE_CLASS[surface])}>
      <SectionHeader title={title} description={description} />

      {featuredLanding ? (
        <p className="mt-1 text-sm text-[var(--text-muted)] sm:mt-0.5">
          가장 많이 선택되는 일정부터 확인해보세요.
        </p>
      ) : null}

      <ProductCardGridSection
        hubLandingLayout={useHubRail}
        guideBridgeMobileTightGap={useTightMobileGap}
      >
        {products.map((product, index) => (
          <ProductCard
            key={product.id}
            {...productToProductCardProps(
              product,
              featuredLanding
                ? {
                    layout: "related",
                    analyticsSource: "landing",
                    analyticsSection: title,
                    guideBridgeNarrowCopy: true,
                    experienceSummary: buildProductExperienceSummary(product),
                    selectionHighlightLine: getFeaturedHighlightLine(product),
                    emphasizeFirstOnMobile: index === 0,
                    topPickLabel: index === 0 ? "가장 많이 선택된" : undefined,
                  }
                : {
                    layout: "grid",
                    analyticsSource: "home_curated",
                    analyticsSection: title,
                  },
            )}
          />
        ))}
      </ProductCardGridSection>
    </section>
  );
}

```


---

## File: `src/components/home/CuratedSectionScrollBlock.tsx`

```tsx
"use client";

import { ProductCardGridSection } from "@/components/products/ProductCardGridSection";
import { HomeProductCard } from "@/components/products/HomeProductCard";
import type { HomeCuratedSectionWithProducts } from "@/types/homeCurated";
import { cn } from "@/lib/cn";

export type CuratedSectionScrollBlockProps = {
  section: HomeCuratedSectionWithProducts;
  /** 섹션 제목 노출 여부 (2개 이상 섹션일 때) */
  showTitle?: boolean;
  className?: string;
};

/**
 * 추천 여행 단일 섹션.
 * /recommended와 동일한 노출 방식: 모바일 가로 스크롤 + 데스크톱 2/3열 그리드.
 */
export function CuratedSectionScrollBlock({
  section,
  showTitle = false,
  className,
}: CuratedSectionScrollBlockProps) {
  if (section.products.length === 0) return null;

  return (
    <div className={cn("space-y-3 sm:space-y-4", className)}>
      {showTitle && section.title ? (
        <h3 className="font-card-title text-base font-semibold text-[var(--foreground)] md:text-lg">
          {section.title}
        </h3>
      ) : null}
      <ProductCardGridSection homeCuratedMobileCompact desktopGridCols={4}>
        {section.products.map((product) => (
          <HomeProductCard
            key={product.id}
            product={product}
            analyticsSection={section.title ?? undefined}
          />
        ))}
      </ProductCardGridSection>
    </div>
  );
}

```


---

## File: `src/components/products/landing/ProductLandingPage.tsx`

```tsx
"use client";

import Link from "next/link";
import { useMemo } from "react";
import type { ProductLandingData, ProductLandingProductSummary } from "@/types/productLanding";
import { getDestinationLandingHref, getThemeLandingHref } from "@/lib/hubLandingLinks";
import { trackLandingCtaClick } from "@/lib/analytics/trackLandingCta";
import { buildLandingCtaPayload } from "@/lib/analytics/landingCtaPayload";
import { HeroVisual } from "@/components/landing/HeroVisual";
import { HubBrowseCard } from "@/components/landing/HubBrowseCard";
import ProductCard from "@/components/products/ProductCard";
import { ProductCardGridSection } from "@/components/products/ProductCardGridSection";
import { solidButtonShadowClasses } from "@/components/ui/Button";
import { cn } from "@/lib/cn";
import { NavigationContextHeader } from "@/components/navigation/NavigationContextHeader";
import type { BreadcrumbItem } from "@/components/navigation/Breadcrumb";

export type ProductLandingNavigationContext = {
  items: BreadcrumbItem[];
  pageTitle: string;
  fallbackHref: string;
};

export type ProductLandingPageProps = {
  data: ProductLandingData;
  /** 지역/테마 랜딩 상단: 모바일 백 + 데스크톱 브레드크럼 */
  navigationContext?: ProductLandingNavigationContext;
};

export default function ProductLandingPage({ data, navigationContext }: ProductLandingPageProps) {
  const { hero, featuredLinks, recommendedProducts, relatedTaxonomies, type, taxonomyName, productCount, childDestinations, childThemes } = data;

  /** 동일 id 중복 제거 (React key 충돌 방지) */
  const uniqueRecommendedProducts = useMemo(() => {
    const seen = new Set<string>();
    return recommendedProducts.filter((item) => {
      if (seen.has(item.id)) return false;
      seen.add(item.id);
      return true;
    });
  }, [recommendedProducts]);

  const relatedTitle = type === "region" ? "함께 살펴볼 테마" : "함께 살펴볼 지역";
  const relatedDescription =
    type === "region"
      ? `${taxonomyName} 여행과 함께 많이 찾는 테마를 둘러보세요.`
      : `${taxonomyName} 테마로 많이 찾는 지역을 확인해보세요.`;
  const moreProductsLabel = type === "region" ? "이 지역 상품 더 보기" : "이 테마 상품 더 보기";

  const basePayload = buildLandingCtaPayload(data, "hero");

  return (
    <div className="min-h-screen bg-gradient-to-b from-[var(--surface-muted)] to-[var(--surface)] text-[var(--text-primary)]">
      <main className="mx-auto w-full max-w-6xl px-3 py-6 sm:px-6 sm:py-10 md:px-10 md:py-14">
        <div className="flex flex-col gap-10">
          {navigationContext ? (
            <NavigationContextHeader
              items={navigationContext.items}
              pageTitle={navigationContext.pageTitle}
              fallbackHref={navigationContext.fallbackHref}
              withMarginBottom={false}
            />
          ) : null}
          {/* Hero: 이미지 있으면 배경 히어로, 없으면 카드 스타일 */}
          {hero.imageUrl ? (
            <HeroVisual
              imageUrl={hero.imageUrl}
              priority
              contentClassName="max-w-[680px] gap-2"
            >
              {hero.eyebrow ? (
                <p className="hero-text-shadow-body text-sm font-semibold text-white/92">{hero.eyebrow}</p>
              ) : null}
              <h1 className="hero-text-shadow-title text-2xl font-bold leading-tight text-white sm:text-3xl">
                {hero.title}
              </h1>
              {hero.description ? (
                <p className="hero-text-shadow-body max-w-2xl text-sm text-white/90 sm:text-base">
                  {hero.description}
                </p>
              ) : null}
              {productCount > 0 ? (
                <p className="inline-flex w-fit rounded-lg border border-white/25 bg-black/20 px-2.5 py-1 text-sm text-white/90 backdrop-blur-sm">
                  총 {productCount}개 상품
                </p>
              ) : null}
              <div className="mt-6 flex flex-wrap gap-3">
                <Link
                  href={hero.primaryCtaHref}
                  className={cn(
                    "inline-flex items-center justify-center rounded-xl bg-[var(--primary)] px-5 py-2.5 text-sm font-semibold text-white transition hover:opacity-90",
                    solidButtonShadowClasses,
                  )}
                  onClick={() =>
                    trackLandingCtaClick({
                      ...basePayload,
                      section: "hero",
                      label: hero.primaryCtaLabel,
                      href: hero.primaryCtaHref,
                    })
                  }
                >
                  {hero.primaryCtaLabel}
                </Link>
                {hero.secondaryCtaLabel && hero.secondaryCtaHref ? (
                  <Link
                    href={hero.secondaryCtaHref}
                    className="inline-flex items-center justify-center rounded-xl border border-white/60 bg-white/10 px-5 py-2.5 text-sm font-semibold text-white backdrop-blur-sm transition hover:bg-white/20"
                    onClick={() =>
                      trackLandingCtaClick({
                        ...basePayload,
                        section: "hero",
                        label: hero.secondaryCtaLabel!,
                        href: hero.secondaryCtaHref!,
                      })
                    }
                  >
                    {hero.secondaryCtaLabel}
                  </Link>
                ) : null}
              </div>
            </HeroVisual>
          ) : (
          <section className="rounded-2xl bg-[var(--surface)] p-6 shadow-[var(--shadow-soft)] ring-1 ring-[var(--border)] sm:p-8">
            {hero.eyebrow ? (
              <p className="text-sm font-semibold text-[var(--text-muted)]">{hero.eyebrow}</p>
            ) : null}
            <h1 className="mt-2 text-2xl font-bold text-[var(--foreground)] sm:text-3xl">{hero.title}</h1>
            {hero.description ? (
              <p className="mt-3 text-[var(--text-muted)] sm:text-base">{hero.description}</p>
            ) : null}
            {productCount > 0 ? (
              <p className="mt-2 text-sm text-[var(--text-muted)]">총 {productCount}개 상품</p>
            ) : null}
            <div className="mt-6 flex flex-wrap gap-3">
              <Link
                href={hero.primaryCtaHref}
                className={cn(
                  "inline-flex items-center justify-center rounded-xl bg-[var(--primary)] px-5 py-2.5 text-sm font-semibold text-white transition hover:opacity-90",
                  solidButtonShadowClasses,
                )}
                onClick={() =>
                  trackLandingCtaClick({
                    ...basePayload,
                    section: "hero",
                    label: hero.primaryCtaLabel,
                    href: hero.primaryCtaHref,
                  })
                }
              >
                {hero.primaryCtaLabel}
              </Link>
              {hero.secondaryCtaLabel && hero.secondaryCtaHref ? (
                <Link
                  href={hero.secondaryCtaHref}
                  className="inline-flex items-center justify-center rounded-xl border border-[var(--border)] bg-[var(--surface)] px-5 py-2.5 text-sm font-semibold text-[var(--foreground)] transition hover:bg-[var(--surface-muted)]"
                  onClick={() =>
                    trackLandingCtaClick({
                      ...basePayload,
                      section: "hero",
                      label: hero.secondaryCtaLabel!,
                      href: hero.secondaryCtaHref!,
                    })
                  }
                >
                  {hero.secondaryCtaLabel}
                </Link>
              ) : null}
            </div>
          </section>
          )}

          {/* 도시·지역 선택 (region 랜딩이고 소분류가 있을 때만) */}
          {type === "region" && childDestinations && childDestinations.length > 0 ? (
            <section>
              <h2 className="text-lg font-bold text-[var(--foreground)]">도시·지역 선택</h2>
              <p className="mt-1 text-sm text-[var(--text-muted)]">원하는 도시·지역을 선택해 보세요.</p>
              <ul className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
                {childDestinations.map((d) => (
                  <li key={d.id}>
                    <HubBrowseCard
                      item={d}
                      href={getDestinationLandingHref(d)}
                      showImage={true}
                    />
                  </li>
                ))}
              </ul>
            </section>
          ) : null}

          {/* 세부 테마 선택 (theme 랜딩이고 하위 테마가 있을 때만) */}
          {type === "theme" && childThemes && childThemes.length > 0 ? (
            <section>
              <h2 className="text-lg font-bold text-[var(--foreground)]">세부 테마 선택</h2>
              <p className="mt-1 text-sm text-[var(--text-muted)]">원하는 테마를 선택해 보세요.</p>
              <ul className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
                {childThemes.map((t) => (
                  <li key={t.id}>
                    <HubBrowseCard
                      item={t}
                      href={getThemeLandingHref(t)}
                      showImage={true}
                    />
                  </li>
                ))}
              </ul>
            </section>
          ) : null}

          {/* 바로가기 링크 묶음 */}
          {featuredLinks.length > 0 ? (
            <section>
              <h2 className="text-sm font-semibold text-[var(--text-muted)]">바로가기</h2>
              <div className="mt-2 flex flex-wrap gap-2">
                {featuredLinks.slice(0, 4).map((link) => (
                  <Link
                    key={link.key}
                    href={link.href}
                    className="rounded-full border border-[var(--border)] bg-[var(--surface)] px-4 py-2 text-sm font-medium text-[var(--foreground)] transition hover:bg-[var(--surface-muted)]"
                  >
                    {link.label}
                  </Link>
                ))}
              </div>
            </section>
          ) : null}

          {/* 추천 상품 그리드 */}
          <section>
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <h2 className="text-lg font-bold text-[var(--foreground)]">추천 상품</h2>
              {productCount > 0 && uniqueRecommendedProducts.length > 0 ? (
                <p className="text-sm text-[var(--text-muted)]">현재 {productCount}개 상품을 확인할 수 있습니다.</p>
              ) : null}
            </div>
            {uniqueRecommendedProducts.length === 0 ? (
              <div className="mt-3 space-y-4">
                <p className="rounded-xl bg-[var(--surface)] p-6 text-sm text-[var(--text-muted)] ring-1 ring-[var(--border)]">
                  현재 준비된 추천 상품이 없습니다. 전체 상품 목록에서 더 많은 상품을 확인해보세요.
                </p>
                <div className="flex justify-end">
                  <Link
                    href={hero.primaryCtaHref}
                    className="inline-flex items-center justify-center rounded-xl border border-[var(--border)] bg-[var(--surface)] px-4 py-2.5 text-sm font-semibold text-[var(--foreground)] transition hover:bg-[var(--surface-muted)]"
                    onClick={() =>
                      trackLandingCtaClick({
                        ...buildLandingCtaPayload(data, "recommended_products"),
                        section: "recommended_products",
                        label: "전체 상품 보기",
                        href: hero.primaryCtaHref,
                      })
                    }
                  >
                    전체 상품 보기
                  </Link>
                </div>
              </div>
            ) : (
              <>
                <ProductCardGridSection desktopGridCols={2}>
                  {uniqueRecommendedProducts.map((item) => (
                    <ProductCard
                      key={item.id}
                      layout="grid"
                      title={item.title}
                      price={item.price ?? undefined}
                      region={item.themes?.join(", ")}
                      categories={item.categories ?? []}
                      status="AVAILABLE"
                      badges={item.badges ?? []}
                      thumbnailUrl={item.imageUrl ?? ""}
                      hrefDetail={item.href}
                      analyticsSource="landing"
                      analyticsSection={`${data.type}_${data.taxonomySlug ?? data.slug ?? ""}`}
                      productId={item.id}
                    />
                  ))}
                </ProductCardGridSection>
                <div className="mt-4 flex justify-end">
                  <Link
                    href={hero.primaryCtaHref}
                    className="inline-flex items-center justify-center rounded-xl border border-[var(--border)] bg-[var(--surface)] px-4 py-2.5 text-sm font-semibold text-[var(--foreground)] transition hover:bg-[var(--surface-muted)] sm:px-5"
                    onClick={() =>
                      trackLandingCtaClick({
                        ...buildLandingCtaPayload(data, "recommended_products"),
                        section: "recommended_products",
                        label: moreProductsLabel,
                        href: hero.primaryCtaHref,
                      })
                    }
                  >
                    {moreProductsLabel}
                  </Link>
                </div>
              </>
            )}
          </section>

          {/* 관련 taxonomy 링크 */}
          {relatedTaxonomies.length > 0 ? (
            <section>
              <h2 className="text-lg font-bold text-[var(--foreground)]">{relatedTitle}</h2>
              <p className="mt-1 text-sm text-[var(--text-muted)]">{relatedDescription}</p>
              <div className="mt-3 flex flex-wrap gap-2">
                {relatedTaxonomies.slice(0, 6).map((link) => (
                  <Link
                    key={link.key}
                    href={link.href}
                    className="inline-flex min-h-[44px] items-center rounded-full border border-[var(--border)] bg-[var(--surface)] px-4 py-2.5 text-sm font-medium text-[var(--foreground)] transition hover:bg-[var(--surface-muted)]"
                  >
                    {link.label}
                  </Link>
                ))}
              </div>
            </section>
          ) : null}
        </div>
      </main>
    </div>
  );
}

```


---

## File: `src/components/product-detail/ProductCatalogSection.tsx`

```tsx
"use client";

import { useMemo, useState, useEffect } from "react";
import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import type { Product } from "@/types/product";
import ProductListCard from "@/components/products/ProductListCard";
import ProductListCardMobile from "@/components/products/ProductListCardMobile";
import ProductCard from "@/components/products/ProductCard";
import { ProductCardGridSection } from "@/components/products/ProductCardGridSection";
import { productToProductCardProps } from "@/lib/productCardProps";
import { useConsultModal } from "@/components/inquiry/ConsultModal";
import { solidButtonShadowClasses } from "@/components/ui/Button";
import { cn } from "@/lib/cn";
import {
  getThemeTabs,
  groupProductsByTheme,
  matchesThemeTab,
  matchesProductTab,
  type ProductCategoryTabId,
} from "@/lib/productCategory";
import {
  normalizeProductCatalogSearchKeyword,
  productCatalogMatchesKeyword,
} from "@/lib/products/productCatalogKeyword";
import { getCollectionLabel } from "@/lib/productFilters";

/** 지역 칩 첫 항목 라벨 (내부 탭 id는 `all`) */
const REGION_ALL_LABEL = "전체";
/** 테마 칩 전체 (matchesThemeTab / getThemeTabs 와 동일) */
const THEME_ALL_LABEL = "전체";

type ProductCatalogSectionProps = {
  products: Product[];
  categories: string[];
  initialKeyword?: string;
  presetCategories?: string[];
  presetLabel?: string;
  /** URL 연동 시 초기 지역(상품 category 문자열) */
  initialRegion?: string | null;
  /** URL 연동 시 초기 테마 */
  initialTheme?: string | null;
  /** URL 연동 시 지역 변경 콜백 */
  onCategoryChange?: (region: string | null) => void;
  /** URL 연동 시 테마 변경 콜백 */
  onThemeChange?: (theme: string | null) => void;
  /** URL 연동 시 초기 컬렉션 */
  initialCollection?: string | null;
  /** URL 연동 시 컬렉션 해제 콜백 */
  onClearCollection?: () => void;
  /** 결과 0건일 때 필터 초기화 CTA */
  onResetFilters?: () => void;
  /** list: /products 목록형. related: 연관·랜딩용 카드 그리드 */
  cardLayout?: "list" | "related";
};

export default function ProductCatalogSection({
  products,
  categories,
  initialKeyword = "",
  presetCategories,
  presetLabel,
  initialRegion,
  initialTheme,
  onCategoryChange,
  onThemeChange,
  initialCollection,
  onClearCollection,
  onResetFilters,
  cardLayout = "list",
}: ProductCatalogSectionProps) {
  const [internalTab, setInternalTab] = useState<ProductCategoryTabId>("all");
  const [internalThemeTab, setInternalThemeTab] = useState(THEME_ALL_LABEL);

  const isUrlControlled = onCategoryChange != null && onThemeChange != null;
  const activeTab: ProductCategoryTabId = isUrlControlled
    ? (initialRegion ?? "all")
    : internalTab;
  const activeThemeTab = isUrlControlled ? (initialTheme ?? THEME_ALL_LABEL) : internalThemeTab;

  useEffect(() => {
    if (!isUrlControlled) return;
    setInternalTab(initialRegion ?? "all");
    setInternalThemeTab(initialTheme ?? THEME_ALL_LABEL);
  }, [isUrlControlled, initialRegion, initialTheme]);

  const keyword = useMemo(
    () => normalizeProductCatalogSearchKeyword(initialKeyword),
    [initialKeyword],
  );
  const presetCategorySet = useMemo(
    () => new Set((presetCategories ?? []).map((item) => item.trim()).filter(Boolean)),
    [presetCategories],
  );
  const baseProducts = useMemo(
    () =>
      presetCategorySet.size > 0
        ? products.filter((product) => presetCategorySet.has(product.category))
        : products,
    [products, presetCategorySet],
  );
  const visibleCategories = useMemo(
    () => (presetCategorySet.size > 0 ? categories.filter((category) => presetCategorySet.has(category)) : categories),
    [categories, presetCategorySet],
  );
  const categoryTabs = useMemo(() => [REGION_ALL_LABEL, ...visibleCategories], [visibleCategories]);

  const filteredProducts = useMemo(() => {
    if (isUrlControlled) return baseProducts;
    return baseProducts.filter((product) => matchesProductTab(product, activeTab));
  }, [baseProducts, activeTab, isUrlControlled]);

  const themeTabs = useMemo(() => {
    const inferred = getThemeTabs(baseProducts, activeTab);
    return Array.from(new Set(inferred));
  }, [baseProducts, activeTab]);

  const themeFilteredProducts = useMemo(() => {
    if (isUrlControlled) return filteredProducts;
    return filteredProducts.filter((product) => matchesThemeTab(product, activeThemeTab));
  }, [filteredProducts, activeThemeTab, isUrlControlled]);

  const keywordFilteredProducts = useMemo(
    () =>
      (isUrlControlled ? filteredProducts : themeFilteredProducts).filter((product) =>
        productCatalogMatchesKeyword(product, keyword),
      ),
    [isUrlControlled, filteredProducts, themeFilteredProducts, keyword],
  );

  const groupedByTheme = useMemo(
    () => groupProductsByTheme(keywordFilteredProducts, themeTabs),
    [keywordFilteredProducts, themeTabs],
  );

  const displayGroups = useMemo(
    () =>
      groupedByTheme.length > 0
        ? groupedByTheme
        : keywordFilteredProducts.length > 0
          ? [{ theme: "상품", products: keywordFilteredProducts }]
          : [],
    [groupedByTheme, keywordFilteredProducts],
  );

  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const { openModal } = useConsultModal();

  function handleProductConsult(product: Product) {
    const query = searchParams.toString();
    openModal({
      productId: product.id,
      productTitle: product.title,
      sourcePath: query ? `${pathname}?${query}` : pathname,
    });
  }

  const regionSummary = activeTab === "all" ? REGION_ALL_LABEL : activeTab;
  const collectionLabel = getCollectionLabel(initialCollection ?? null);

  return (
    <section className="space-y-4">
      <div className="sticky top-[76px] z-20 rounded-xl border border-[var(--border)] bg-[var(--surface)]/98 px-3 py-2.5 backdrop-blur sm:rounded-xl sm:px-3 sm:py-3">
        <div className="space-y-1">
          <p className="text-xs leading-snug text-[var(--text-muted)] sm:text-sm">
            총 {keywordFilteredProducts.length}개 · 지역 {regionSummary}
          </p>
          {presetLabel ? (
            <p className="text-xs leading-snug text-[#15803d] sm:text-sm">프리셋: {presetLabel}</p>
          ) : null}
          {keyword ? (
            <p className="text-xs leading-snug text-[var(--primary)] sm:text-sm">
              검색어: {initialKeyword}
            </p>
          ) : null}
          {collectionLabel ? (
            <p className="text-xs leading-snug text-[var(--text-secondary)] sm:text-sm">
              컬렉션: {collectionLabel}
            </p>
          ) : null}
        </div>
        <div className="mt-2.5 flex flex-wrap items-center gap-1.5">
          {categoryTabs.map((tab) => (
            <button
              key={tab}
              type="button"
              onClick={() => {
                if (isUrlControlled && onCategoryChange) {
                  onCategoryChange(tab === REGION_ALL_LABEL ? null : tab);
                  return;
                }
                setInternalTab(tab === REGION_ALL_LABEL ? "all" : tab);
                setInternalThemeTab(THEME_ALL_LABEL);
              }}
              className={`min-h-[32px] rounded-full px-3 py-1.5 text-sm font-medium transition ${
                (tab === REGION_ALL_LABEL ? "all" : tab) === activeTab
                  ? "bg-[var(--primary-soft)] text-[var(--primary)]"
                  : "border border-[var(--border)] bg-[var(--surface)] text-[var(--text-secondary)] hover:bg-[var(--surface-muted)]"
              }`}
            >
              {tab}
            </button>
          ))}
        </div>

        <div className="mt-2 flex flex-wrap items-center gap-1.5">
          {themeTabs.map((tab) => (
            <button
              key={`theme-${tab}`}
              type="button"
              onClick={() => {
                if (isUrlControlled && onThemeChange) {
                  onThemeChange(tab === THEME_ALL_LABEL ? null : tab);
                  return;
                }
                setInternalThemeTab(tab);
              }}
              className={`min-h-[28px] rounded-full px-2.5 py-1 text-xs font-semibold transition sm:min-h-[32px] sm:px-3 sm:py-1.5 sm:text-sm ${
                activeThemeTab === tab
                  ? "bg-[var(--primary-soft)] text-[var(--primary)]"
                  : "border border-[var(--border)] bg-[var(--surface)] text-[var(--text-secondary)] hover:bg-[var(--surface-muted)]"
              }`}
            >
              {tab}
            </button>
          ))}
        </div>
      </div>

      <div key={`${activeTab}-${activeThemeTab}`} className="fade-in-up space-y-5">
        {keywordFilteredProducts.length === 0 ? (
          <div className="rounded-2xl bg-[var(--surface)] p-8 type-small text-[var(--text-muted)] shadow-[var(--shadow-soft)] ring-1 ring-[var(--border)] sm:rounded-3xl">
            {(initialRegion ||
              initialTheme ||
              (initialKeyword && initialKeyword.trim()) ||
              initialCollection) &&
            (onResetFilters || onClearCollection) ? (
              <>
                <p className="font-semibold text-[var(--text-primary)]">
                  선택한 조건에 맞는 상품이 없습니다.
                </p>
                <p className="mt-2 text-[var(--text-secondary)]">
                  {[
                    initialRegion && `지역: ${initialRegion}`,
                    initialTheme && `테마: ${initialTheme}`,
                    initialKeyword?.trim() && `검색어: ${initialKeyword.trim()}`,
                    collectionLabel && `컬렉션: ${collectionLabel}`,
                  ]
                    .filter(Boolean)
                    .join(" · ")}
                </p>
                <div className="mt-4 flex flex-wrap items-center gap-3">
                  {onClearCollection && initialCollection ? (
                    <button
                      type="button"
                      onClick={onClearCollection}
                      className="inline-flex items-center rounded-lg border border-[var(--border)] bg-[var(--surface)] px-4 py-2 type-btn font-semibold text-[var(--foreground)] transition hover:bg-[var(--surface-muted)]"
                    >
                      컬렉션 해제
                    </button>
                  ) : null}
                  <Link
                    href="/products"
                    className={cn(
                      "inline-flex items-center gap-1.5 rounded-lg bg-[var(--primary)] px-4 py-2 type-btn font-semibold text-[var(--on-primary)] transition hover:opacity-90",
                      solidButtonShadowClasses,
                    )}
                  >
                    전체 상품 보기
                  </Link>
                  {onResetFilters ? (
                    <button
                      type="button"
                      onClick={onResetFilters}
                      className="inline-flex items-center rounded-lg border border-[var(--border)] bg-[var(--surface)] px-4 py-2 type-btn font-semibold text-[var(--foreground)] transition hover:bg-[var(--surface-muted)]"
                    >
                      필터 초기화
                    </button>
                  ) : null}
                </div>
              </>
            ) : keyword ? (
              "검색 조건에 맞는 상품이 없습니다."
            ) : (
              "표시할 상품이 없습니다. 지역·테마 칩을 바꿔 보세요."
            )}
          </div>
        ) : (
          displayGroups.map((group) => (
            <div key={group.theme} className="space-y-3">
              <h3 className="font-card-title type-h3 text-[var(--primary)]">{group.theme}</h3>
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
                    const catalogOverrides = {
                      analyticsSource: "product_list" as const,
                      analyticsSection: "catalog",
                      onClickDetail: () => router.push(`/products/${product.id}`),
                      onClickConsult: () => handleProductConsult(product),
                      /** /destinations 추천 카드와 동일하게 대표 배지 최대 2개(이미지 오버레이) */
                      campaignBadgeMax: 2,
                    };

                    return (
                      <div key={product.id} className="w-full">
                        <div className="hidden md:block">
                          <ProductListCard
                            {...productToProductCardProps(product, {
                              ...catalogOverrides,
                              campaignPresentationKind: "list",
                            })}
                          />
                        </div>
                        <div className="md:hidden">
                          <ProductListCardMobile
                            {...productToProductCardProps(product, {
                              ...catalogOverrides,
                              campaignPresentationKind: "mobile",
                            })}
                          />
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          ))
        )}
      </div>
    </section>
  );
}

```


---

## File: `src/components/products/ProductsPageContent.tsx`

```tsx
"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useState, useMemo } from "react";
import ProductCatalogSection from "@/components/product-detail/ProductCatalogSection";
import { ProductFilterSidebar } from "@/components/products/ProductFilterSidebar";
import { ProductFilterChips } from "@/components/products/ProductFilterChips";
import { MobileProductFilterDrawer } from "@/components/products/MobileProductFilterDrawer";
import { MobileProductSortSheet } from "@/components/products/MobileProductSortSheet";
import { ProductListToolbar } from "@/components/products/ProductListToolbar";
import {
  mergeFiltersIntoSearchParams,
  applyProductFilters,
  getCollectionLabel,
  SORT_OPTIONS,
  type ProductCollectionId,
  type ProductFiltersState,
  type ProductSortId,
} from "@/lib/productFilters";
import { resolveProductsPageInitialFilters } from "@/lib/products/productsListingPolicy";
import type { Product } from "@/types/product";
import type { RegionTreeNode } from "@/types/productTaxonomy";
import { getSelfAndDescendantIdsAndNames } from "@/lib/productTaxonomies";
import type { ProductsPageContentListingConfig } from "@/lib/products/productsPageContentConfig";

export type { ProductsPageContentListingConfig };

export type ProductsPageContentProps = {
  products: Product[];
  /** id → name (destination_id, product_line_id FK resolve용). 있으면 필터 FK 우선 적용 */
  taxonomyNameMap?: Record<string, string>;
  regionOptions: string[];
  /** 지역 트리(대분류>중분류>소분류). 있으면 좌측 필터에 접이식 트리로 표시 */
  regionTree?: RegionTreeNode[];
  themeOptions: string[];
  /** 테마 트리(부모>자식). 있으면 좌측 필터에 접이식 트리로 표시 */
  themeTree?: RegionTreeNode[];
  productLineOptions: string[];
  initialKeyword?: string;
  presetCategories?: string[];
  presetLabel?: string;
  /** 목록 퍼널 옵션(랜딩·basePath·카드 레이아웃 등). 미전달 시 각 필드 기본값 */
  listing?: ProductsPageContentListingConfig;
};

export function ProductsPageContent({
  products,
  taxonomyNameMap,
  regionOptions,
  regionTree,
  themeOptions,
  themeTree,
  productLineOptions,
  initialKeyword = "",
  presetCategories,
  presetLabel,
  listing,
}: ProductsPageContentProps) {
  const initialFiltersFromServer = listing?.initialFiltersFromServer ?? null;
  const basePath = listing?.basePath ?? "/products";
  const filterContextLabel = listing?.filterContextLabel ?? null;
  const initialRegionDescendants = listing?.initialRegionDescendants ?? null;
  const initialThemeDescendantNames = listing?.initialThemeDescendantNames ?? null;
  const cardLayout = listing?.cardLayout ?? "list";
  const mobileListToolbarBelowBackHeader = listing?.mobileListToolbarBelowBackHeader ?? false;
  const regionTaxonomies = listing?.regionTaxonomies ?? null;
  const themeTaxonomies = listing?.themeTaxonomies ?? null;
  const router = useRouter();
  const searchParams = useSearchParams();
  const [filterDrawerOpen, setFilterDrawerOpen] = useState(false);
  const [sortSheetOpen, setSortSheetOpen] = useState(false);

  const filters = useMemo(
    () => resolveProductsPageInitialFilters(searchParams, initialFiltersFromServer),
    [searchParams, initialFiltersFromServer],
  );

  const baseProducts = useMemo(() => {
    if (!presetCategories?.length) return products;
    const set = new Set(presetCategories.map((c) => c.trim()).filter(Boolean));
    return products.filter((p) => set.has(p.category ?? ""));
  }, [products, presetCategories]);

  const filterApplyOptions = useMemo(() => {
    const regionName = filters.region?.trim();
    const themeName = filters.theme?.trim();

    let regionDescendants: { ids: string[]; names: string[] } | undefined;
    let regionDescendantForName: string | undefined;
    let themeDescendantNames: string[] | undefined;
    let themeDescendantForName: string | undefined;

    // 지역: 랜딩에서 넘긴 하위 집합 우선, 없으면 /products용 flat 목록으로 계산
    const useInitialRegion =
      initialFiltersFromServer?.region &&
      regionName === initialFiltersFromServer.region.trim() &&
      initialRegionDescendants &&
      (initialRegionDescendants.ids.length > 0 || initialRegionDescendants.names.length > 0);
    if (useInitialRegion && initialRegionDescendants) {
      regionDescendants = initialRegionDescendants;
      regionDescendantForName = regionName ?? undefined;
    } else if (regionTaxonomies?.length && regionName) {
      const computed = getSelfAndDescendantIdsAndNames(regionTaxonomies, regionName);
      if (computed.ids.length > 0 || computed.names.length > 0) {
        regionDescendants = computed;
        regionDescendantForName = regionName;
      }
    }

    // 테마: 랜딩에서 넘긴 하위 집합 우선, 없으면 flat 목록으로 계산
    const useInitialTheme =
      initialFiltersFromServer?.theme &&
      themeName === initialFiltersFromServer.theme.trim() &&
      initialThemeDescendantNames &&
      initialThemeDescendantNames.length > 0;
    if (useInitialTheme && initialThemeDescendantNames) {
      themeDescendantNames = initialThemeDescendantNames;
      themeDescendantForName = themeName ?? undefined;
    } else if (themeTaxonomies?.length && themeName) {
      const computed = getSelfAndDescendantIdsAndNames(themeTaxonomies, themeName);
      if (computed.names.length > 0) {
        themeDescendantNames = computed.names;
        themeDescendantForName = themeName;
      }
    }

    const ccn = listing?.collectionCampaignNames;
    const hasCollectionCampaigns =
      ccn &&
      ((ccn.recommend?.length ?? 0) > 0 || (ccn.popular?.length ?? 0) > 0);

    if (!regionDescendants && !themeDescendantNames && !hasCollectionCampaigns) return undefined;
    return {
      ...(regionDescendants && regionDescendantForName
        ? { regionDescendants, regionDescendantForName }
        : {}),
      ...(themeDescendantNames && themeDescendantForName
        ? { themeDescendantNames, themeDescendantForName }
        : {}),
      ...(hasCollectionCampaigns && ccn ? { collectionCampaignNames: ccn } : {}),
    };
  }, [
    filters.region,
    filters.theme,
    initialFiltersFromServer,
    initialRegionDescendants,
    initialThemeDescendantNames,
    regionTaxonomies,
    themeTaxonomies,
    listing?.collectionCampaignNames,
  ]);

  const filteredProducts = useMemo(
    () => applyProductFilters(baseProducts, filters, taxonomyNameMap, filterApplyOptions),
    [baseProducts, filters, taxonomyNameMap, filterApplyOptions],
  );

  function handleFilterChange(next: Partial<ProductFiltersState>) {
    const merged: ProductFiltersState = { ...filters, ...next };
    const nextParams = mergeFiltersIntoSearchParams(searchParams, merged);
    const qs = nextParams.toString();
    router.push(qs ? `${basePath}?${qs}` : basePath);
  }

  const sortLabel = filters.sort
    ? SORT_OPTIONS.find((o) => o.value === filters.sort)?.label ?? null
    : null;

  const handleResetFilters = () => {
    if (initialFiltersFromServer != null) {
      handleFilterChange({
        ...initialFiltersFromServer,
        q: null,
        sort: "",
      });
    } else {
      handleFilterChange({
        region: null,
        theme: null,
        product_line: null,
        q: null,
        sort: "",
        collection: null,
      });
    }
  };

  const collectionLabel = getCollectionLabel(filters.collection);

  return (
    <div className="flex w-full max-w-full gap-8 items-start">
      <ProductFilterSidebar
        regionOptions={regionOptions}
        regionTree={regionTree}
        themeOptions={themeOptions}
        themeTree={themeTree}
        productLineOptions={productLineOptions}
        filters={filters}
        onFilterChange={handleFilterChange}
      />

      <div className="min-w-0 flex-1 space-y-4">
        <ProductListToolbar
          sortLabel={sortLabel}
          currentSort={filters.sort}
          currentCollection={filters.collection}
          onFilterClick={() => setFilterDrawerOpen(true)}
          onSortClick={() => setSortSheetOpen(true)}
          onSortChange={(sort) => handleFilterChange({ sort })}
          onCollectionChange={(collection: ProductCollectionId | null) =>
            handleFilterChange({ collection })
          }
          belowMobileBackHeader={mobileListToolbarBelowBackHeader}
        />

        <div className="space-y-2">
          {collectionLabel && (
            <div
              className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-[var(--border)] bg-[var(--surface-muted)] px-3 py-2"
              role="status"
            >
              <p className="type-small text-[var(--text-secondary)]">
                현재 <span className="font-semibold text-[var(--foreground)]">{collectionLabel}</span>
                {" "}내에서 상품을 보여주고 있습니다.
              </p>
              <button
                type="button"
                onClick={() => handleFilterChange({ collection: null })}
                className="inline-flex items-center rounded-lg border border-[var(--border)] bg-[var(--surface)] px-3 py-1.5 type-caption font-semibold text-[var(--foreground)] transition hover:bg-[var(--surface)]/70"
              >
                전체 상품 보기
              </button>
            </div>
          )}
          {filterContextLabel && (
            <p className="type-small text-[var(--text-muted)]" role="status">
              {filterContextLabel}
            </p>
          )}
          <ProductFilterChips
            filters={filters}
            onRemoveRegion={() => handleFilterChange({ region: null })}
            onRemoveTheme={() => handleFilterChange({ theme: null })}
            onRemoveProductLine={() => handleFilterChange({ product_line: null })}
            onRemoveKeyword={() => handleFilterChange({ q: null })}
            onRemoveCollection={() => handleFilterChange({ collection: null })}
            onRemoveSort={() => handleFilterChange({ sort: "" })}
          />
        </div>

        <ProductCatalogSection
          products={filteredProducts}
          categories={regionOptions}
          initialKeyword={initialKeyword}
          presetCategories={presetCategories}
          presetLabel={presetLabel}
          initialRegion={filters.region}
          initialTheme={filters.theme}
          onCategoryChange={(region) => handleFilterChange({ region: region ?? null })}
          onThemeChange={(theme) => handleFilterChange({ theme: theme ?? null })}
          onResetFilters={handleResetFilters}
          initialCollection={filters.collection}
          onClearCollection={() => handleFilterChange({ collection: null })}
          cardLayout={cardLayout}
        />
      </div>

      <MobileProductFilterDrawer
        isOpen={filterDrawerOpen}
        onClose={() => setFilterDrawerOpen(false)}
        regionOptions={regionOptions}
        regionTree={regionTree}
        themeOptions={themeOptions}
        themeTree={themeTree}
        productLineOptions={productLineOptions}
        filters={filters}
        onApply={(next) => handleFilterChange(next)}
        onReset={handleResetFilters}
      />

      <MobileProductSortSheet
        isOpen={sortSheetOpen}
        onClose={() => setSortSheetOpen(false)}
        currentSort={filters.sort}
        onSelect={(sort: ProductSortId) => handleFilterChange({ sort })}
      />
    </div>
  );
}

```


---

## File: `src/app/products/[id]/page.tsx`

```tsx
import Image from "next/image";
import Link from "next/link";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import SiteHeader from "@/components/site-chrome/SiteHeader";
import ProductDetailV2 from "@/components/products/ProductDetailV2";
import { ProductReviewsSection } from "@/components/products/ProductReviewsSection";
import { ProductReviewSection } from "@/components/products/ProductReviewSection";
import RelatedProductsSection from "@/components/products/RelatedProductsSection";
import { GuideCard } from "@/components/guides/GuideCard";
import {
  ProductDetailStickyV2Desktop,
  ProductDetailStickyV2Mobile,
} from "@/components/products/ProductDetailStickyV2";
import { PageContainer } from "@/components/layout/PageContainer";
import { NavigationContextHeader } from "@/components/navigation/NavigationContextHeader";
import {
  buildProductsBreadcrumbItems,
  getProductsNavFallbackHref,
} from "@/components/navigation/breadcrumb-config";
import { SectionBlock } from "@/components/layout/SectionBlock";
import { SectionHeader } from "@/components/layout/SectionHeader";
import { ProductQuoteProvider } from "@/components/products/ProductQuoteContext";
import AlertCard from "@/components/ui/AlertCard";
import { ConsultModalProvider } from "@/components/inquiry/ConsultModal";
import { getProductByIdFresh, getProducts } from "@/lib/products";
import { getRelatedProducts } from "@/lib/products/getRelatedProducts";
import { getGuidesByDestinationId } from "@/lib/guides";
import { getProductReviewStats, getProductReviews } from "@/lib/reviewStats";
import { buildProductReviewJsonLd } from "@/lib/seo/products";
import { addTrustScoresToReviews } from "@/lib/reviewTrustScore";
import {
  buildProductReviewStructuredData,
} from "@/lib/reviewStructuredData";
import { parseReviewPersonalizationContext } from "@/lib/reviewPersonalizationContext";
import { getReviewExperimentVariant } from "@/lib/reviewExperimentAssignment";
import { cookies } from "next/headers";
import { getSiteSettings } from "@/lib/siteSettings";
import { normalizeProductImageUrl } from "@/lib/media/normalizeProductImageUrl";
import { getTermsTemplateContent } from "@/lib/termsTemplates";
import { THEALL_WORDMARK_IMAGE_SRC } from "@/lib/brandAssets";
import { getProductSeoData } from "@/lib/products/getProductSeoData";
import { getSiteBaseUrl, toAbsoluteUrl } from "@/lib/seo/getSiteSeoDefaults";

type ProductDetailPageProps = {
  params: Promise<{ id: string }>;
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
};

export async function generateMetadata({ params }: ProductDetailPageProps): Promise<Metadata> {
  const { id } = await params;
  const siteUrl = getSiteBaseUrl();
  const productPath = `/products/${id}`;
  const productUrl = `${siteUrl}${productPath}`;
  const defaultOgImageUrl = `${siteUrl}/og-default-v1.png`;
  /** 메타 description·OG 부제는 getProductSeoData 내부에서 DB SEO → slug 패턴 카피 → fallback 순으로 결정 */
  const seo = await getProductSeoData(id);

  if (!seo) {
    const title = "여행 상품 상세 | 일정·가격·후기 한눈에 | 더올투어";
    const description =
      "여행 상품 상세 정보입니다. 일정, 가격, 후기까지 한 번에 확인하고 상담으로 맞춤 여행을 준비해보세요.";
    return {
      title,
      description,
      alternates: {
        canonical: productUrl,
      },
      openGraph: {
        type: "article",
        url: productUrl,
        siteName: "더올투어",
        title,
        description,
        images: [
          {
            url: defaultOgImageUrl,
            width: 1200,
            height: 630,
            alt: "여행 상품 상세",
          },
        ],
        locale: "ko_KR",
      },
    };
  }

  const title = `${seo.name} | 일정·가격·후기 한눈에 | 더올투어`;
  const description = `${seo.name} 여행 상품 상세 정보입니다. 일정, 가격, 후기까지 한 번에 확인하고 상담으로 맞춤 여행을 준비해보세요.`;

  return {
    title,
    description,
    alternates: {
      canonical: productUrl,
    },
    openGraph: {
      type: "article",
      url: productUrl,
      siteName: "더올투어",
      title,
      description,
      images: [
        {
          url: defaultOgImageUrl,
          width: 1200,
          height: 630,
          alt: seo.name,
        },
      ],
      locale: "ko_KR",
    },
    twitter: {
      card: "summary_large_image",
      title,
      description,
      images: [`${productPath}/twitter-image`],
    },
  };
}

function formatPrice(price?: number) {
  if (typeof price !== "number") return null;
  return new Intl.NumberFormat("ko-KR").format(price);
}

type FlightCardData = {
  fromAirport?: string;
  fromDate?: string;
  fromTime?: string;
  toAirport?: string;
  toDate?: string;
  toTime?: string;
  flightName?: string;
};

export default async function ProductDetailPage({ params, searchParams }: ProductDetailPageProps) {
  const { id } = await params;
  const rawSearch = searchParams ? await searchParams : {};
  const personalizationContext = parseReviewPersonalizationContext(rawSearch);
  const reviewSort =
    rawSearch?.reviewSort === "rating" ? "rating" : rawSearch?.reviewSort === "latest" ? "latest" : undefined;
  const cookieStore = await cookies();
  const subjectKey = cookieStore.get("review_exp_subject")?.value;
  const persistedVariant = cookieStore.get("review_exp_highlight")?.value;
  const queryVariant = typeof rawSearch?.reviewVariant === "string" ? rawSearch.reviewVariant : undefined;
  const reviewExperimentVariant = getReviewExperimentVariant("review_highlight_variant", {
    queryVariant,
    persistedVariant: persistedVariant ?? undefined,
    subjectKey: subjectKey ?? undefined,
  });
  const product = await getProductByIdFresh(id);

  if (!product) {
    notFound();
  }

  if (product.is_active === false) {
    notFound();
  }

  const formattedPrice = formatPrice(product.price);
  const normalizedIncluded = product.included_items?.trim() ?? "";
  const normalizedExcluded = product.excluded_items?.trim() ?? "";
  const normalizedOptional = product.optional_tours?.trim() ?? "";
  const normalizedTerms = product.terms_and_notes?.trim() ?? "";
  const shouldFallbackFromLegacyDetailFields =
    !normalizedIncluded && !normalizedExcluded && (normalizedOptional || normalizedTerms);
  const resolvedIncludedItems = shouldFallbackFromLegacyDetailFields
    ? product.optional_tours ?? product.inclusions
    : product.included_items ?? product.inclusions;
  const resolvedExcludedItems = shouldFallbackFromLegacyDetailFields
    ? product.terms_and_notes
    : product.excluded_items;
  const resolvedOptionalTours = shouldFallbackFromLegacyDetailFields ? undefined : product.optional_tours;
  const selectedTermsTemplateContent = await getTermsTemplateContent(product.terms_template_type);
  const resolvedTermsAndNotes = selectedTermsTemplateContent.trim()
    ? selectedTermsTemplateContent
    : shouldFallbackFromLegacyDetailFields
      ? undefined
      : product.terms_and_notes;
  const siteUrl = getSiteBaseUrl();
  const productUrl = `${siteUrl}/products/${product.id}`;
  const productImageUrl = toAbsoluteUrl(siteUrl, product.image_url?.trim() || THEALL_WORDMARK_IMAGE_SRC);
  const productReviewStats = await getProductReviewStats(product.id);
  const productReviewsForSeo = await getProductReviews(product.id, {
    limit: 50,
    sort: "recommended",
  });
  const reviewsWithTrust = addTrustScoresToReviews(productReviewsForSeo);
  const reviewsForSeo = reviewsWithTrust.map((r) => ({ ...r, status: "visible" }));
  const structuredData = buildProductReviewStructuredData(
    { name: product.title, id: product.id },
    reviewsForSeo,
  );
  const productJsonLdBase = buildProductReviewJsonLd(
    {
      id: product.id,
      title: product.title,
      description: product.description,
      image_url: product.image_url,
    },
    productReviewStats,
    [],
    { productUrl },
  );
  if (structuredData) {
    if (structuredData.aggregateRating) {
      (productJsonLdBase as Record<string, unknown>).aggregateRating =
        structuredData.aggregateRating;
    }
    if (structuredData.review?.length) {
      (productJsonLdBase as Record<string, unknown>).review = structuredData.review;
    }
  } else {
    delete (productJsonLdBase as Record<string, unknown>).aggregateRating;
    delete (productJsonLdBase as Record<string, unknown>).review;
  }
  const productJsonLd = {
    ...productJsonLdBase,
    category: product.category,
    offers:
      typeof product.price === "number"
        ? {
            "@type": "Offer",
            priceCurrency: "KRW",
            price: product.price,
            availability: "https://schema.org/InStock",
            url: productUrl,
          }
        : undefined,
  };
  const departureFlight: FlightCardData = {
    fromAirport: product.departure_from_airport,
    fromDate: product.departure_from_date,
    fromTime: product.departure_from_time,
    toAirport: product.departure_to_airport,
    toDate: product.departure_to_date,
    toTime: product.departure_to_time,
    flightName: product.departure_flight_name,
  };
  const arrivalFlight: FlightCardData = {
    fromAirport: product.arrival_from_airport,
    fromDate: product.arrival_from_date,
    fromTime: product.arrival_from_time,
    toAirport: product.arrival_to_airport,
    toDate: product.arrival_to_date,
    toTime: product.arrival_to_time,
    flightName: product.arrival_flight_name,
  };
  const settings = await getSiteSettings();
  const kakaoHref = settings.kakao_chat_url || settings.kakao_channel_url || "https://pf.kakao.com";
  const sourcePath = `/products/${product.id}`;
  const [relatedGuides, allProducts] = await Promise.all([
    product.destination_id?.trim()
      ? getGuidesByDestinationId(product.destination_id.trim(), 3)
      : Promise.resolve([]),
    getProducts(),
  ]);

  const relatedProducts = getRelatedProducts({
    currentProduct: product,
    allProducts,
    limit: 6,
  });

  const statusV2 = product.status ?? "AVAILABLE";
  const oneLiner =
    product.one_liner?.trim() ||
    product.description?.trim().split(/\n/)[0]?.slice(0, 200) ||
    product.title;

  const hasReviews = productReviewStats.reviewCount > 0;

  return (
    <ConsultModalProvider>
      <ProductQuoteProvider>
        <SiteHeader activeTab="products" />
      <div className="min-h-screen bg-gradient-to-b from-[#f3f8ff] to-white py-6 sm:py-10 md:py-14">
        <PageContainer size="wide">
          <main className="w-full">
            <NavigationContextHeader
              items={buildProductsBreadcrumbItems("product_detail", {
                currentLabel: product.title,
              })}
              pageTitle={product.title}
              fallbackHref={getProductsNavFallbackHref("product_detail")}
            />

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

              {/* PR27: 리뷰 영역 신뢰도 카드 (평점/후기 수 또는 최근 예약 + 상담 CTA) */}
              <ProductReviewSection
                rating={productReviewStats.averageRating}
                reviewCount={productReviewStats.reviewCount}
                bookingCount={product.trust?.recentConsultCount}
                consultHref={`/quote?productId=${encodeURIComponent(product.id)}`}
                productId={product.id}
                productTitle={product.title}
                sourcePath={`${sourcePath}#reviews`}
              />
              <ProductReviewsSection
                productId={product.id}
                productTitle={product.title}
                personalizationContext={personalizationContext}
                experimentKey="review_highlight_variant"
                variant={reviewExperimentVariant}
                reviewSort={reviewSort}
                hideWhenNoReviews
              />

              {/* PR43: 연관 상품 섹션 (관련도 우선 정렬, fallback 채움) */}
              <RelatedProductsSection
                title="이 상품과 비슷한 여행"
                description="여행지, 테마, 상품 구성이 비슷한 상품을 모아봤어요."
                products={relatedProducts}
              />

              {relatedGuides.length > 0 ? (
                <SectionBlock surface="none" padding="md">
                  <SectionHeader
                    eyebrow="TRAVEL GUIDE"
                    title="이 여행을 더 잘 즐기는 방법"
                    description="이 지역과 관련된 가이드를 만나보세요."
                    align="left"
                  />
                  <ul
                    className="mt-6 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3"
                    aria-label="관련 가이드"
                  >
                    {relatedGuides.map((guide) => (
                      <li key={guide.id} className="flex min-h-0 h-full min-w-0">
                        <GuideCard guide={guide} className="w-full" />
                      </li>
                    ))}
                  </ul>
                  <div className="mt-4">
                    <Link
                      href="/guides"
                      className="type-btn inline-flex rounded-xl border border-[var(--border-strong)] bg-[var(--surface)] px-5 py-2.5 text-[var(--primary)] transition hover:bg-[var(--primary-soft)]"
                    >
                      가이드 더 보기
                    </Link>
                  </div>
                </SectionBlock>
              ) : null}

              <AlertCard variant="info" title="상담 안내">
                문의를 남겨주시면 일정/예산/동행구성에 맞춰 맞춤 동선과 견적 옵션을 안내드립니다.
              </AlertCard>
            </div>

            <ProductDetailStickyV2Desktop
              priceFormatted={formattedPrice}
              productId={product.id}
              productTitle={product.title}
              sourcePath={sourcePath}
              kakaoHref={kakaoHref}
              status={statusV2}
              trust={product.trust}
              product={product}
              experimentKey="review_highlight_variant"
              variant={reviewExperimentVariant}
            />
          </div>
        </main>
        </PageContainer>

        <ProductDetailStickyV2Mobile
          priceFormatted={formattedPrice}
          productId={product.id}
          productTitle={product.title}
          sourcePath={sourcePath}
          kakaoHref={kakaoHref}
          status={statusV2}
          trust={product.trust}
          experimentKey="review_highlight_variant"
          variant={reviewExperimentVariant}
        />
      </div>
      </ProductQuoteProvider>
    </ConsultModalProvider>
  );
}

```


---

## File: `src/components/products/ProductDetailV2.tsx`

```tsx
"use client";

import { useMemo, useState, useCallback, useRef, useEffect } from "react";
import { Card } from "@/components/ui/Card";
import { Icon } from "@/components/ui/Icon";
import { Button } from "@/components/ui/Button";
import Tag from "@/components/ui/Tag";
import { Tabs, TabsTrigger } from "@/components/ui/Tabs";
import AlertCard from "@/components/ui/AlertCard";
import TrustSignals from "@/components/products/TrustSignals";
import { OptionPanel } from "@/components/products/OptionPanel";
import { QuoteSummary } from "@/components/products/QuoteSummary";
import { useProductQuote } from "@/components/products/ProductQuoteContext";
import { ENABLE_PRODUCT_OPTIONS } from "@/config/featureFlags";
import { calcQuote, formatPriceKR } from "@/lib/pricing/calcQuote";
import type { Product, ProductTrust, ProductOptions, SelectedOptions } from "@/types/product";
import type { TravelOverviewModel } from "@/lib/products/mapProductToOverview";
import { mapProductToOverview } from "@/lib/products/mapProductToOverview";
import { mapProductToTimelineModel, getTimelineModelFromSchedule } from "@/lib/products/mapProductToTimelineModel";
import { ProductFeatureCard } from "@/components/products/ProductFeatureCard";
import { FlightSummarySection } from "@/components/products/FlightSummarySection";
import { ProductIncludeExclude } from "@/components/products/ProductIncludeExclude";
import { ProductHotelCard } from "@/components/products/ProductHotelCard";
import { getHotelValue } from "@/lib/products/mapProductToOverview";
import { InteractiveTimelineV2 } from "@/components/products/InteractiveTimelineV2";
import { ProductImageCarousel } from "@/components/products/ProductImageCarousel";
import type { ProductGalleryImage } from "@/components/products/ProductImageGalleryModal";
import { normalizeProductImageUrl } from "@/lib/media/normalizeProductImageUrl";
import { getPrimaryImageUrl } from "@/lib/products/images";
import { ProductConsultCTA } from "@/components/products/ProductConsultCTA";
import { getProductCtaLabel } from "@/lib/products/getProductCtaLabel";
import { ProductItineraryPreview } from "@/components/products/ProductItineraryPreview";
import { ProductQuickSummaryCard } from "@/components/products/ProductQuickSummaryCard";
import { ProductHighlightsCard } from "@/components/products/ProductHighlightsCard";
import { ProductQuickInfoBar } from "@/components/products/ProductQuickInfoBar";
import { ProductTrustSummary } from "@/components/products/ProductTrustSummary";
import { ProductHeroBadges } from "@/components/products/ProductHeroBadges";
import ProductSummaryInfo from "@/components/products/ProductSummaryInfo";
import ProductDepartureSelector from "@/components/products/ProductDepartureSelector";
import ProductItineraryTimeline from "@/components/products/ProductItineraryTimeline";
import { buildHeroBadges } from "@/lib/products/buildHeroBadges";
import {
  getLegacyDayPreviewLabel,
  parseDayContentToSections,
} from "@/lib/products/itineraryPreviewLabel";
import { ProductDayScheduleCard } from "@/components/products/ProductDayScheduleCard";
import { parseThemeTokens } from "@/lib/productTaxonomies";

export type ProductDetailV2StatusTag =
  | "AVAILABLE"
  | "LIMITED"
  | "SOLD_OUT"
  | "CONSULT_REQUIRED";

export type ProductDetailV2Props = {
  title?: string;
  region?: string;
  category?: string;
  statusTag?: ProductDetailV2StatusTag;
  oneLiner?: string;
  priceFormatted?: string | null;
  duration?: string;
  priceMeta?: string;
  fuelIncluded?: boolean;
  includedItems?: string;
  excludedItems?: string;
  detailedSchedule?: string;
  optionalTours?: string;
  minDeparturePeople?: string;
  termsAndNotes?: string;
  onConsultClick?: () => void;
  kakaoHref?: string;
  /** 상담 견적 페이지 링크. productId 등이 있으면 본문 CTA는 모달을 띄우고 이 값은 폼 기본 링크로만 사용 */
  consultHref?: string;
  /** 모달 열 때 전달할 상품 정보 (있으면 본문 상담 버튼이 모달 오픈) */
  productId?: string;
  productTitle?: string;
  sourcePath?: string;
  trust?: ProductTrust | null;
  /** 옵션 정의. ENABLE_PRODUCT_OPTIONS && options 존재 시에만 옵션 UI 노출 */
  options?: ProductOptions;
  /** 기준가(원). 옵션 있을 때 calcQuote에 사용 */
  basePrice?: number;
  /** 있으면 내부에서 mapProductToOverview(product) 호출해 오버뷰 자동 생성 (우선) */
  product?: Product | null;
  /** product 없을 때 사용. 여행 오버뷰 렌더용 모델 */
  overviewModel?: TravelOverviewModel | null;
  /** 오버뷰 커버 이미지 fallback (product 있으면 product.image_url 사용) */
  overviewFallbackUrl?: string;
  /** PR6: 리뷰 요약 (있으면 제목 근처에 평점·후기 수 표시) */
  reviewSummary?: { averageRating: number; reviewCount: number } | null;
};

type ScheduleDay = { label: string; content: string };
type MainTab = "schedule" | "included" | "booking" | "refund";

const STATUS_LABELS: Record<ProductDetailV2StatusTag, string> = {
  AVAILABLE: "예약 가능",
  LIMITED: "잔여 한정",
  SOLD_OUT: "마감",
  CONSULT_REQUIRED: "상담 후 안내",
};

function parseScheduleDays(raw?: string): ScheduleDay[] {
  const source = raw?.trim();
  if (!source) return [];
  const lines = source.split(/\r?\n/);
  const days: ScheduleDay[] = [];
  let currentLabel = "";
  let currentContent: string[] = [];
  for (const line of lines) {
    const match = line.match(/^\[(.+)\]\s*$/);
    if (match) {
      if (currentLabel) {
        days.push({ label: currentLabel, content: currentContent.join("\n").trim() });
      }
      currentLabel = match[1].trim();
      currentContent = [];
      continue;
    }
    currentContent.push(line);
  }
  if (currentLabel) {
    days.push({ label: currentLabel, content: currentContent.join("\n").trim() });
  }
  const filtered = days.filter((d) => d.content.length > 0);
  if (filtered.length === 0 && source) return [{ label: "일정", content: source }];
  return filtered;
}

function parseBulletLines(raw?: string): string[] {
  return (raw ?? "")
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => line.length > 0);
}

export default function ProductDetailV2({
  title = "",
  region = "",
  category = "",
  statusTag,
  oneLiner = "",
  priceFormatted = null,
  duration = "",
  priceMeta = "1인 기준",
  fuelIncluded,
  includedItems = "",
  excludedItems = "",
  detailedSchedule = "",
  optionalTours = "",
  minDeparturePeople = "",
  termsAndNotes = "",
  onConsultClick,
  kakaoHref = "",
  consultHref = "",
  productId,
  productTitle,
  sourcePath,
  trust,
  options,
  basePrice,
  product,
  overviewModel,
  overviewFallbackUrl = "",
  reviewSummary,
}: ProductDetailV2Props) {
  const resolvedOverview = useMemo(() => {
    if (product != null) return mapProductToOverview(product);
    return overviewModel ?? null;
  }, [product, overviewModel]);

  /** 오버뷰 카드에서는 항공 카드를 제외하고, 항공편은 오버뷰 내부 컴팩트 섹션으로 표시 */
  const overviewForCards = useMemo(() => {
    if (!resolvedOverview?.cards?.length) return resolvedOverview;
    const withoutFlight = resolvedOverview.cards.filter((c) => c.iconKey !== "flight");
    return withoutFlight.length === resolvedOverview.cards.length
      ? resolvedOverview
      : { ...resolvedOverview, cards: withoutFlight };
  }, [resolvedOverview]);

  const resolvedOverviewFallbackUrl = product ? getPrimaryImageUrl(product) : overviewFallbackUrl ?? "";
  const galleryImages = useMemo<ProductGalleryImage[]>(() => {
    const seen = new Set<string>();
    const list: ProductGalleryImage[] = [];
    const altBase = title?.trim() || product?.title?.trim() || "상품";
    const pushImage = (rawUrl: string | undefined | null, label?: string) => {
      if (!rawUrl?.trim()) return;
      const normalized = normalizeProductImageUrl(rawUrl);
      if (!normalized) return;
      if (seen.has(normalized)) return;
      seen.add(normalized);
      list.push({ url: normalized, alt: `${altBase} 이미지`, label });
    };

    if (Array.isArray(product?.images_json)) {
      product.images_json.forEach((url, idx) => {
        pushImage(url, idx === 0 ? "대표 이미지" : `추가 이미지 ${idx + 1}`);
      });
    }
    pushImage(product?.image_url, "대표 이미지");

    if (Array.isArray(product?.itinerary_v2_json?.days)) {
      product?.itinerary_v2_json.days.forEach((day) => {
        pushImage(day.coverImageUrl, `Day ${day.day}`);
      });
    }

    const media = product?.itinerary_media_json;
    if (media && typeof media === "object") {
      Object.entries(media)
        .sort((a, b) => Number(a[0]) - Number(b[0]))
        .forEach(([day, url]) => {
          if (typeof url === "string") {
            pushImage(url, `Day ${day}`);
          }
        });
    }

    if (list.length === 0) {
      pushImage(overviewFallbackUrl, "대표 이미지");
    }

    return list;
  }, [overviewFallbackUrl, product, title]);
  /** [STEP 5] 시각화 타임라인: itinerary_v2_json.days가 있을 때만 InteractiveTimelineV2, 없으면 레거시 텍스트 일정만 */
  const hasVisualItinerary =
    product != null &&
    Array.isArray(product.itinerary_v2_json?.days) &&
    product.itinerary_v2_json.days.length > 0;
  /** 텍스트 일정 → 시각화 타임라인(InteractiveTimelineV2). 시각화 있을 때만 사용 */
  const timelineModel = useMemo(
    () =>
      product != null
        ? mapProductToTimelineModel(product)
        : getTimelineModelFromSchedule(detailedSchedule ?? ""),
    [product, detailedSchedule],
  );
  const [activeTab, setActiveTab] = useState<MainTab>("schedule");
  const [pendingPreviewDayIndex, setPendingPreviewDayIndex] = useState<number | null>(null);
  const [openAccordionIndex, setOpenAccordionIndex] = useState<number | null>(0);
  const [selectedOptions, setSelectedOptions] = useState<SelectedOptions>({});
  const isSoldOut = statusTag === "SOLD_OUT";
  const optionsPanelRef = useRef<HTMLDivElement>(null);
  const { setQuoteSummary, setRequiredGroupsMissing, setSelectedOptions: syncSelectedOptionsToQuote, registerScrollToOptions } = useProductQuote();

  const hasOptions = ENABLE_PRODUCT_OPTIONS && options?.groups != null && options.groups.length > 0;
  const quote = useMemo(
    () => calcQuote(options, selectedOptions),
    [options, selectedOptions],
  );
  const displayPrice = hasOptions && quote.total != null
    ? formatPriceKR(quote.total)
    : priceFormatted;
  const displayDuration = hasOptions && quote.durationLabel ? quote.durationLabel : duration;

  const requiredGroupsMissing = useMemo(() => {
    if (!hasOptions || !options?.requiredGroups?.length) return false;
    return options.requiredGroups.some((key) => !selectedOptions[key]);
  }, [hasOptions, options, selectedOptions]);

  useEffect(() => {
    setQuoteSummary(hasOptions ? quote : null);
    setRequiredGroupsMissing(hasOptions ? requiredGroupsMissing : false);
    syncSelectedOptionsToQuote(hasOptions && Object.keys(selectedOptions).length > 0 ? selectedOptions : null);
  }, [hasOptions, quote, requiredGroupsMissing, selectedOptions, setQuoteSummary, setRequiredGroupsMissing, syncSelectedOptionsToQuote]);

  useEffect(() => {
    registerScrollToOptions(() => {
      optionsPanelRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
    });
  }, [registerScrollToOptions]);

  const handleOptionChange = useCallback((groupId: string, optionId: string) => {
    setSelectedOptions((prev) => ({ ...prev, [groupId]: optionId }));
  }, []);

  /** PR15-1 Step3: 일정 미리보기 Day 카드 클릭 → schedule 탭 + 해당 Day 전달 + 상세 일정 섹션으로 스크롤 (단일 Day 구조) */
  const handlePreviewDayClick = useCallback((dayNumber: number) => {
    setActiveTab("schedule");
    setPendingPreviewDayIndex(dayNumber - 1);

    requestAnimationFrame(() => {
      setTimeout(() => {
        document.getElementById("itinerary-section")?.scrollIntoView({
          behavior: "smooth",
          block: "start",
        });

        setTimeout(() => {
          setPendingPreviewDayIndex(null);
        }, 100);
      }, 150);
    });
  }, []);

  const scheduleDays = useMemo(() => parseScheduleDays(detailedSchedule), [detailedSchedule]);
  const includedLines = useMemo(() => parseBulletLines(includedItems), [includedItems]);
  const excludedLines = useMemo(() => parseBulletLines(excludedItems), [excludedItems]);
  const optionalLines = useMemo(() => parseBulletLines(optionalTours), [optionalTours]);
  const termsLines = useMemo(() => parseBulletLines(termsAndNotes), [termsAndNotes]);

  const hasSchedule = scheduleDays.length > 0;
  const listClass = "space-y-2 text-sm leading-7 text-slate-700";

  /** PR8-1: 메타 정보 바용 날짜 범위. startDate~endDate 단일 표현, 동일일이면 한 번만 */
  const metaDateRange = useMemo(() => {
    const from = product?.departure_from_date?.trim();
    const to = product?.departure_to_date?.trim();
    if (!from && !to) return "";
    const WEEKDAY = ["일", "월", "화", "수", "목", "금", "토"];
    const fmt = (s: string) => {
      const m = s.match(/^(\d{4})-(\d{2})-(\d{2})$/);
      if (!m) return s;
      const d = new Date(parseInt(m[1], 10), parseInt(m[2], 10) - 1, parseInt(m[3], 10));
      return `${m[1]}.${m[2]}.${m[3]}(${WEEKDAY[d.getDay()]})`;
    };
    if (from && to) {
      if (from === to) return fmt(from);
      const start = fmt(from);
      const mTo = to.match(/^(\d{4})-(\d{2})-(\d{2})$/);
      if (mTo && from.startsWith(mTo[1])) return `${start} ~ ${mTo[2]}.${mTo[3]}(${WEEKDAY[new Date(parseInt(mTo[1], 10), parseInt(mTo[2], 10) - 1, parseInt(mTo[3], 10)).getDay()]})`;
      return `${start} ~ ${fmt(to)}`;
    }
    return from ? fmt(from) : fmt(to!);
  }, [product?.departure_from_date, product?.departure_to_date]);

  /** PR8-1: 기간 한 종류만 (3박5일 우선, 중복 제거) */
  const durationLabel = useMemo(() => {
    const raw = displayDuration || product?.overview_duration?.trim() || product?.duration?.trim() || "";
    return raw;
  }, [displayDuration, product?.overview_duration, product?.duration]);

  /** PR9: 카드 상단 테마 라벨 (중복 없이 1회) */
  const themeLabel = useMemo(() => {
    return product?.theme?.trim() || category || "";
  }, [product?.theme, category]);

  /** PR9: 단일 출발일일 때 "YYYY.MM.DD(요일) 출발" */
  const departureLabel = useMemo(() => {
    const from = product?.departure_from_date?.trim();
    const to = product?.departure_to_date?.trim();
    if (!from || (to && to !== from)) return "";
    const WEEKDAY = ["일", "월", "화", "수", "목", "금", "토"];
    const m = from.match(/^(\d{4})-(\d{2})-(\d{2})$/);
    if (!m) return "";
    const d = new Date(parseInt(m[1], 10), parseInt(m[2], 10) - 1, parseInt(m[3], 10));
    return `${m[1]}.${m[2]}.${m[3]}(${WEEKDAY[d.getDay()]}) 출발`;
  }, [product?.departure_from_date, product?.departure_to_date]);

  /** PR9: 상품 특징 (카드 하단 chips, 최대 4개) */
  const productHighlights = useMemo(() => {
    const items: string[] = [];
    if (product?.point_tourism?.trim()) items.push("핵심 관광 포함");
    if (!hasOptions) items.push("노옵션");
    const meta = product?.meta_info?.trim();
    if (meta && items.length < 3) {
      const isDuration = /^\d+박?\s*\d*일?\s*$/.test(meta) || /^\d+일\s*$/.test(meta);
      const shoppingMatch = meta.match(/쇼핑\s*(\d+)\s*회?/i) || meta.match(/(\d+)\s*회\s*쇼핑/i);
      if (shoppingMatch) items.push(`쇼핑 ${shoppingMatch[1]}회`);
      else if (!isDuration && meta !== (product?.theme?.trim() || "")) items.push(meta.length > 20 ? `${meta.slice(0, 18)}…` : meta);
    }
    return items.slice(0, 4);
  }, [product?.meta_info, product?.point_tourism, product?.theme, hasOptions]);

  /** PR34: Hero 배지 (모바일, 짧은 키워드만. QuickInfoBar/HighlightsCard와 역할 구분) */
  const heroBadges = useMemo(
    () => buildHeroBadges(product, { hasOptions }),
    [product, hasOptions],
  );

  /** 포함사항 요약 (줄바꿈 기준 앞 2~3개만 쉼표로 연결, Summary 카드용) */
  const includedSummary = useMemo(() => {
    const raw = includedItems?.trim();
    if (!raw) return undefined;
    return raw
      .split("\n")
      .map((v) => v.trim())
      .filter(Boolean)
      .slice(0, 3)
      .join(", ");
  }, [includedItems]);

  /** PR40: 상품 요약 블록 표시 여부 (값이 하나라도 있을 때만) */
  const hasSummaryData = useMemo(() => {
    const d = product?.duration ?? duration;
    const dep = product?.departure ?? product?.overview_region ?? product?.theme;
    const air = product?.airline ?? product?.departure_flight_name;
    const hot = product?.hotel ?? product?.overview_accommodation;
    const style = product?.travelStyle ?? product?.theme;
    const minPeople = product?.min_departure_people ?? minDeparturePeople;
    const pr = typeof product?.price === "number" && product.price > 0 ? product.price : undefined;
    return Boolean(d || dep || air || hot || style || minPeople || includedSummary || pr);
  }, [product, duration, minDeparturePeople, includedSummary]);

  /** PR22: 핵심 여행 요약 카드용. highlights → tags → themes 순, 최대 5개 */
  const highlightsForCard = useMemo(() => {
    if (!product) return [];
    const fromHighlights = product.highlights?.length ? product.highlights : undefined;
    const fromTags = product.tags?.length ? product.tags : undefined;
    const fromThemes = product.theme ? parseThemeTokens(product.theme) : undefined;
    const source = fromHighlights ?? fromTags ?? fromThemes ?? [];
    return source.slice(0, 5);
  }, [product?.highlights, product?.tags, product?.theme]);

  /** PR26: 호텔 안내 카드용 (overview_accommodation 우선, 없으면 meta_info/itinerary 패턴) */
  const hotelValue = useMemo(
    () => (product ? getHotelValue(product) : ""),
    [product],
  );

  /** PR29: 핵심 정보 요약 바용 (모바일, 사실 정보만) */
  const quickInfoBarProps = useMemo(() => {
    const duration = durationLabel?.trim() || "";
    const destination = themeLabel?.trim() || "";
    const hasFlight =
      product &&
      (product.departure_from_airport?.trim() ||
        product.departure_to_airport?.trim() ||
        product.departure_flight_name?.trim());
    const flight = hasFlight ? "항공 포함" : "";
    const hotel = hotelValue?.trim() ? (hotelValue.length > 20 ? `${hotelValue.slice(0, 18)}…` : hotelValue) : "";
    const status = statusTag != null ? STATUS_LABELS[statusTag] : "";
    return {
      durationLabel: duration || undefined,
      destinationLabel: destination || undefined,
      flightLabel: flight || undefined,
      hotelLabel: hotel || undefined,
      statusLabel: status || undefined,
    };
  }, [durationLabel, themeLabel, product, hotelValue, statusTag]);

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
          {displayPrice ? (
            <p className="font-price-strong text-xl font-bold text-[var(--primary)] md:text-2xl">
              ₩{displayPrice}~
            </p>
          ) : (
            <p className="font-price-strong text-xl font-semibold text-slate-600 md:text-2xl">
              상담 후 견적 안내
            </p>
          )}
          {(displayDuration || priceMeta) && (
            <p className="mt-1 text-sm text-slate-500">
              {[displayDuration, priceMeta].filter(Boolean).join(" · ")}
            </p>
          )}
          {typeof fuelIncluded === "boolean" && (
            <p className="mt-0.5 text-xs text-slate-500">
              {fuelIncluded ? "유류할증료 포함" : "유류할증료 별도"}
            </p>
          )}
          <p className="mt-0.5 text-xs text-slate-500">유류할증료는 상담 시 안내</p>
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
              minDeparturePeople={(product?.min_departure_people ?? minDeparturePeople) || undefined}
              includedSummary={includedSummary}
              consultHref={consultHref || undefined}
              kakaoHref={kakaoHref || undefined}
              productId={productId}
              productTitle={productTitle ?? ""}
              sourcePath={sourcePath ?? ""}
            />
          </div>
        )}

        {/* PR41: 출발일 선택 영역 (Summary 다음) */}
        {product?.departures?.length ? (
          <div className="mt-6">
            <ProductDepartureSelector
              departures={product.departures}
              onInquiryClick={onConsultClick}
            />
          </div>
        ) : null}

        {/* PR34: 모바일 Hero 직하단 핵심 배지 (인기·노옵션·가이드·테마 등). PR37: Hero 아래 첫 블록 mt-6 */}
        {heroBadges.length > 0 && (
          <div className="mt-6 md:hidden">
            <ProductHeroBadges badges={heroBadges} />
          </div>
        )}

        {/* PR33: 모바일 Hero 직하단 신뢰도 정보 바. PR37: 섹션 간격 mt-6 */}
        <div className="mt-6 md:hidden">
          <ProductTrustSummary
            rating={reviewSummary?.averageRating}
            reviewCount={reviewSummary?.reviewCount}
            bookingCount={trust?.recentConsultCount}
            statusLabel={statusTag != null ? STATUS_LABELS[statusTag] : undefined}
          />
        </div>

        {/* PR29: 모바일 전용 핵심 정보 요약 바. PR37: 섹션 간격 mt-6 */}
        {(quickInfoBarProps.durationLabel ||
          quickInfoBarProps.destinationLabel ||
          quickInfoBarProps.flightLabel ||
          quickInfoBarProps.hotelLabel ||
          quickInfoBarProps.statusLabel) && (
          <div className="mt-6">
            <ProductQuickInfoBar {...quickInfoBarProps} />
          </div>
        )}

        {/* PR22: 핵심 여행 요약 카드. PR37: 주요 섹션 mt-8 */}
        {highlightsForCard.length > 0 && (
          <div className="mt-8">
            <ProductHighlightsCard highlights={highlightsForCard} />
          </div>
        )}

        {/* PR9: 여행 핵심 요약 카드. PR37: 주요 섹션 mt-8 */}
        <div className="mt-8">
          <ProductQuickSummaryCard
            durationLabel={durationLabel || undefined}
            themeLabel={themeLabel || undefined}
            departureLabel={departureLabel || undefined}
            dateRangeLabel={departureLabel ? undefined : (metaDateRange || undefined)}
            highlightItems={productHighlights}
          />
        </div>

        <div className="mt-8 space-y-4">
          {hasOptions && (
            <div id="product-options-panel" ref={optionsPanelRef}>
              <OptionPanel
                options={options}
                selected={selectedOptions}
                onSelectionChange={handleOptionChange}
              />
            </div>
          )}

          {hasOptions && (quote.total != null || quote.basePrice != null || quote.breakdown.length > 0) && (
            <QuoteSummary quote={quote} />
          )}

          {/* Trust Signals: 데이터 있을 때만 */}
          <TrustSignals trust={trust} />
        </div>

        {/* CTA: 모바일에서만 표시. 통합 ProductConsultCTA 사용 */}
        <div className="mb-0 md:hidden">
          {productId ? (
            <ProductConsultCTA
              productId={productId}
              productTitle={productTitle ?? ""}
              sourcePath={sourcePath ?? ""}
              status={statusTag}
              kakaoHref={kakaoHref || undefined}
              section="top"
              requiredGroupsMissing={requiredGroupsMissing}
              scrollToOptions={() => optionsPanelRef.current?.scrollIntoView({ behavior: "smooth", block: "start" })}
              isSoldOut={isSoldOut}
            />
          ) : (
            <>
              {requiredGroupsMissing && (
                <p className="mb-2 text-sm text-amber-600">필수 옵션을 선택해 주세요.</p>
              )}
              <div className="flex flex-wrap gap-3">
                {consultHref ? (
                  <a href={consultHref}>
                    <Button variant="accent" size="md">{getProductCtaLabel(statusTag)}</Button>
                  </a>
                ) : null}
                {kakaoHref ? (
                  <a href={kakaoHref} target="_blank" rel="noopener noreferrer">
                    <Button variant="kakao" size="md">카톡 상담</Button>
                  </a>
                ) : null}
              </div>
              <p className="mt-2 text-[11px] text-slate-500">상담 후 확정 · 맞춤 견적 안내</p>
            </>
          )}
        </div>
      </section>

      {/* PR42: 상세 일정 타임라인 (itinerary_days 있을 때만, 본문 아래 노출) */}
      {product?.itinerary_days?.length ? (
        <div className="mt-8">
          <ProductItineraryTimeline itinerary={product.itinerary_days} />
        </div>
      ) : null}

      {/* Itinerary Preview: 일정 미리보기 (PR14: Day 카드 클릭 시 해당 Day로 이동) */}
      <ProductItineraryPreview
        timelineModel={timelineModel?.days?.length ? timelineModel : null}
        scheduleDays={scheduleDays}
        maxDays={4}
        itinerarySectionId="itinerary-section"
        onViewFullItinerary={() => setActiveTab("schedule")}
        onPreviewDayClick={handlePreviewDayClick}
      />

      {/* PR24: 여행 특징 카드 (테마 구성비 오버뷰 영역 대체) */}
      {highlightsForCard.length > 0 && (
        <ProductFeatureCard features={highlightsForCard} />
      )}

      {/* 항공 정보 */}
      <FlightSummarySection product={product ?? null} compact embedded />

      {/* PR26: 호텔 안내 카드 */}
      {hotelValue ? <ProductHotelCard hotelName={hotelValue} /> : null}

      {/* Tabs */}
      <section>
        <Tabs value={activeTab} onChange={(v) => setActiveTab(v as MainTab)} className="mb-4 flex flex-wrap gap-2">
          <TabsTrigger value="schedule">일정 안내</TabsTrigger>
          <TabsTrigger value="included">포함/불포함</TabsTrigger>
          <TabsTrigger value="booking">예약 조건</TabsTrigger>
          <TabsTrigger value="refund">환불/취소 규정</TabsTrigger>
        </Tabs>

        {activeTab === "schedule" && (
          <div id="itinerary-section" className="space-y-6">
            {/* PR42: itinerary_days 있으면 타임라인 UI, 없으면 기존 v2/레거시 일정 */}
            {product?.itinerary_days?.length ? (
              <ProductItineraryTimeline itinerary={product.itinerary_days} />
            ) : hasVisualItinerary && timelineModel?.days?.length ? (
              <InteractiveTimelineV2
                model={timelineModel}
                fallbackImageUrl={resolvedOverviewFallbackUrl || null}
                productId={productId}
                status={statusTag}
                productTitle={productTitle}
                sourcePath={sourcePath}
                kakaoHref={kakaoHref}
                selectedDayIndex={pendingPreviewDayIndex ?? undefined}
              />
            ) : hasSchedule ? (
              <>
                {scheduleDays.map((day, index) => {
                  const summary = getLegacyDayPreviewLabel(day.label, day.content ?? "");
                  const sections = parseDayContentToSections(day.content ?? "");
                  return (
                    <ProductDayScheduleCard
                      key={`${day.label}-${index}`}
                      dayLabel={day.label}
                      summary={summary || undefined}
                      experience={sections.experience}
                      movement={sections.movement}
                    />
                  );
                })}
              </>
            ) : (
              <p className="text-sm text-slate-500">일정 정보 준비 중입니다.</p>
            )}
          </div>
        )}

        {activeTab === "included" && (
          <div className="space-y-4">
            {/* PR25: 포함/불포함 카드 UI */}
            <ProductIncludeExclude included={includedLines} excluded={excludedLines} />
            {(includedLines.length === 0 && excludedLines.length === 0) && (
              <p className="text-sm text-slate-500">등록된 포함/불포함 사항이 없습니다.</p>
            )}
            {optionalLines.length > 0 && (
              <div>
                <h3 className="mb-3 text-sm font-bold text-[var(--primary)]">선택 관광</h3>
                <ul className={listClass}>
                  {optionalLines.map((line, i) => (
                    <li key={i} className="flex items-start gap-2">
                      <Icon
                        name="check"
                        decorative
                        size={14}
                        className="mt-1 shrink-0 text-[var(--primary)]"
                      />
                      <span className="whitespace-normal">{line}</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        )}

        {activeTab === "booking" && (
          <div className="space-y-4">
            <ul className="space-y-3">
              {minDeparturePeople?.trim() && (
                <li className="flex items-start gap-3">
                  <Icon name="check" decorative size={20} className="mt-0.5 shrink-0 text-emerald-600" />
                  <span className="text-sm leading-7 text-slate-700 whitespace-normal">
                    출발 인원: {minDeparturePeople.trim()}명 이상 확정 시 출발
                  </span>
                </li>
              )}
              <li className="flex items-start gap-3">
                <Icon name="check" decorative size={20} className="mt-0.5 shrink-0 text-emerald-600" />
                <span className="text-sm leading-7 text-slate-700 whitespace-normal">
                  최종 일정·가격은 상담 후 확정됩니다.
                </span>
              </li>
              <li className="flex items-start gap-3">
                <Icon name="check" decorative size={20} className="mt-0.5 shrink-0 text-emerald-600" />
                <span className="text-sm leading-7 text-slate-700 whitespace-normal">
                  문의 주시면 맞춤 견적과 예약 절차를 안내해 드립니다.
                </span>
              </li>
            </ul>
            {termsLines.length > 0 && (
              <AlertCard variant="info" title="예약 시 유의사항">
                <ul className="mt-2 space-y-1">
                  {termsLines.map((line, i) => (
                    <li key={i}>{line}</li>
                  ))}
                </ul>
              </AlertCard>
            )}
          </div>
        )}

        {activeTab === "refund" && (
          <div>
            {termsLines.length > 0 ? (
              <AlertCard variant="neutral" title="환불 및 취소 규정">
                <ul className="mt-2 space-y-2 leading-[1.7]">
                  {termsLines.map((line, i) => (
                    <li key={i}>{line}</li>
                  ))}
                </ul>
              </AlertCard>
            ) : (
              <AlertCard variant="info" title="환불 규정">
                <p>
                  상품별 상세 환불·취소 규정은 상담 시 안내해 드립니다. 문의해 주시면 기간별 취소 수수료와
                  절차를 안내해 드립니다.
                </p>
              </AlertCard>
            )}
          </div>
        )}
      </section>
    </div>
  );
}

```


---

## File: `src/components/products/ProductDetailStickyV2.tsx`

```tsx
"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import TrustSignals from "@/components/products/TrustSignals";
import { ProductConsultCTA } from "@/components/products/ProductConsultCTA";
import { ThemeChartCard } from "@/components/products/ThemeChartCard";
import { useProductQuote } from "@/components/products/ProductQuoteContext";
import { formatPriceKR } from "@/lib/pricing/calcQuote";
import { parseMetaTitleAsHashtags } from "@/lib/products/parseMetaTitleAsHashtags";
import { mapProductToOverview } from "@/lib/products/mapProductToOverview";
import { trackReviewConversionCtaClick } from "@/lib/reviewExperimentTracking";
import type { Product, ProductTrust } from "@/types/product";

export type ProductDetailStickyV2Status =
  | "AVAILABLE"
  | "LIMITED"
  | "SOLD_OUT"
  | "CONSULT_REQUIRED";

type ProductDetailStickyV2Props = {
  priceFormatted: string | null;
  productId: string;
  productTitle: string;
  sourcePath: string;
  kakaoHref: string;
  status?: ProductDetailStickyV2Status;
  trust?: ProductTrust | null;
  /** 웹에서 예상가 위에 차트 표시용 */
  product?: Product | null;
  /** PR27: 리뷰 전환 attribution용 실험 컨텍스트 */
  experimentKey?: string;
  variant?: string;
};

export function ProductDetailStickyV2Desktop({
  priceFormatted,
  productId,
  productTitle,
  sourcePath,
  kakaoHref,
  status = "AVAILABLE",
  trust,
  product,
  experimentKey,
  variant,
}: ProductDetailStickyV2Props) {
  const { quoteSummary, requiredGroupsMissing, scrollToOptions } = useProductQuote();
  const isSoldOut = status === "SOLD_OUT";

  const chart = useMemo(() => {
    if (!product) return null;
    const overview = mapProductToOverview(product);
    return overview.chart?.items?.length ? overview.chart : null;
  }, [product]);
  const seoHashtags = useMemo(
    () => parseMetaTitleAsHashtags(product?.meta_title),
    [product?.meta_title],
  );
  const MAX_KEYWORDS_STICKY = 5;
  const displayKeywords = seoHashtags.slice(0, MAX_KEYWORDS_STICKY);
  const keywordOverflowCount = Math.max(0, seoHashtags.length - MAX_KEYWORDS_STICKY);

  const displayPrice = quoteSummary?.total != null
    ? formatPriceKR(quoteSummary.total)
    : priceFormatted;

  /** Desktop Sticky 전용: 행동 유도형 primary CTA 문구 (문의/예약 흐름 명확화) */
  const desktopPrimaryLabel =
    status === "AVAILABLE"
      ? "일정/가격 문의하기"
      : status === "LIMITED"
        ? "잔여 좌석 문의하기"
        : status === "SOLD_OUT"
          ? "대기 문의하기"
          : status === "CONSULT_REQUIRED"
            ? "견적 문의하기"
            : "상담 문의하기";

  /** PR23: 데스크톱 sticky 헤더 충돌 방지 — SiteHeader(유틸바 40px + 메인 바 64px) + 여백 */
  const desktopStickyTop = 120;
  const desktopStickyMaxHeight = `calc(100vh - ${desktopStickyTop}px - 16px)`;

  return (
    <aside
      className="hidden lg:block sticky w-full max-w-[300px] shrink-0 overflow-auto"
      style={{
        top: `${desktopStickyTop}px`,
        maxHeight: desktopStickyMaxHeight,
      }}
      aria-label="상품 요약"
    >
      {/* 전환 핵심 그룹: 예상가 + CTA. 스크롤 위치와 무관하게 카드/버튼 UI 일관 유지 */}
      <div className="rounded-2xl border-2 border-[#93c5fd] bg-white p-5 shadow-lg ring-1 ring-[#bfdbfe]">
        <div className="space-y-3">
          <div>
            <p className="text-xs font-medium text-slate-500">예상가</p>
            {displayPrice ? (
              <p className="font-price-strong mt-1 text-2xl font-bold leading-tight text-[var(--primary)]">
                ₩{displayPrice}~
              </p>
            ) : (
              <p className="mt-1 text-lg font-semibold text-slate-600">상담 후 안내</p>
            )}
            {product && (
              <div className="mt-2 space-y-0.5">
                {(product.duration || product.price_meta) && (
                  <p className="text-xs text-slate-500">
                    {[product.duration, product.price_meta || "1인 기준"].filter(Boolean).join(" · ")}
                  </p>
                )}
                {typeof product.fuel_included === "boolean" && (
                  <p className="text-xs text-slate-500">
                    {product.fuel_included ? "유류할증료 포함" : "유류할증료 별도"}
                  </p>
                )}
                <p className="text-xs text-slate-500">유류할증료는 상담 시 안내</p>
              </div>
            )}
          </div>
          {/* 가격/전환 신뢰도 마이크로카피: 기준·포함·문의 안내 */}
          <ul className="mt-3 list-none space-y-1 border-t border-slate-100 pt-3 text-xs leading-relaxed text-slate-500" aria-label="가격 및 예약 안내">
            <li>최종 금액은 일정과 인원 기준으로 안내됩니다.</li>
            <li>포함사항과 옵션 내용은 상세 정보에서 확인 가능합니다.</li>
            <li>상담 후 예약 가능 여부와 예상 비용을 안내해드립니다.</li>
          </ul>
          <TrustSignals trust={trust} />
          <div className="flex flex-col gap-2 pt-0.5 rounded-xl">
            <ProductConsultCTA
              productId={productId}
              productTitle={productTitle}
              sourcePath={sourcePath}
              status={status}
              kakaoHref={kakaoHref}
              section="top"
              requiredGroupsMissing={requiredGroupsMissing}
              scrollToOptions={scrollToOptions}
              isSoldOut={isSoldOut}
              onPrimaryClick={() => trackReviewConversionCtaClick(productId, { experimentKey, variant })}
              primaryLabel={desktopPrimaryLabel}
              helperText="문의를 남기시면 가능 일정과 예상 비용을 안내해드립니다."
            />
          </div>
        </div>
      </div>

      {/* 보조 정보 그룹: 키워드 / 차트 / 목록 링크 (탐색 보조, CTA 방해 최소화) */}
      <div className="sticky-supporting-info mt-5 space-y-3 border-t border-slate-200 pt-5" aria-label="보조 정보">
        {displayKeywords.length > 0 && (
          <div className="rounded-lg border border-slate-100 bg-slate-50/60 p-2.5">
            <p className="mb-1 text-[10px] font-medium uppercase tracking-wide text-slate-400">핵심 키워드</p>
            <div className="flex flex-wrap items-center gap-1">
              {displayKeywords.map((tag, index) => (
                <span
                  key={`detail-seo-${tag}-${index}`}
                  className="inline-flex shrink-0 items-center rounded-full border border-slate-200 bg-white px-1.5 py-0.5 text-[10px] font-medium text-slate-500"
                >
                  #{tag}
                </span>
              ))}
              {keywordOverflowCount > 0 && (
                <span className="inline-flex shrink-0 items-center text-[10px] font-medium text-slate-400">
                  +{keywordOverflowCount}
                </span>
              )}
            </div>
          </div>
        )}
        {chart && (
          <div className="rounded-lg border border-slate-100 bg-slate-50/60 p-2.5">
            <ThemeChartCard items={chart.items} />
          </div>
        )}
        <Link
          href="/products"
          className="block text-sm text-slate-500 underline decoration-slate-300 underline-offset-2 transition hover:text-slate-700 hover:decoration-slate-500"
        >
          ← 다른 상품 보기
        </Link>
      </div>
    </aside>
  );
}

export function ProductDetailStickyV2Mobile({
  priceFormatted,
  productId,
  productTitle,
  sourcePath,
  kakaoHref,
  status = "AVAILABLE",
  experimentKey,
  variant,
}: ProductDetailStickyV2Props) {
  const { quoteSummary, requiredGroupsMissing, scrollToOptions } = useProductQuote();
  const isSoldOut = status === "SOLD_OUT";
  const [compact, setCompact] = useState(false);
  const lastScrollYRef = useRef(0);
  const idleTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const displayPrice = quoteSummary?.total != null
    ? formatPriceKR(quoteSummary.total)
    : priceFormatted;

  useEffect(() => {
    lastScrollYRef.current = window.scrollY;
    const onScroll = () => {
      const currentY = window.scrollY;
      const delta = currentY - lastScrollYRef.current;
      if (delta > 6) {
        setCompact(true);
      } else if (delta < -4) {
        setCompact(false);
      }
      lastScrollYRef.current = currentY;
      if (idleTimerRef.current) clearTimeout(idleTimerRef.current);
      idleTimerRef.current = setTimeout(() => setCompact(false), 240);
    };

    window.addEventListener("scroll", onScroll, { passive: true });
    return () => {
      window.removeEventListener("scroll", onScroll);
      if (idleTimerRef.current) clearTimeout(idleTimerRef.current);
    };
  }, []);

  /** CTA 고정 높이 + visualViewport 보정: 주소창/하단 UI 표시 시에도 CTA가 잘리지 않도록 bottom offset 적용 */
  const PADDING_TOP = 12;
  const PADDING_BOTTOM_BASE = 12;

  useEffect(() => {
    const updateViewportOffset = () => {
      if (typeof window === "undefined") return;
      const vv = window.visualViewport;
      if (!vv) {
        document.documentElement.style.setProperty("--mobile-cta-viewport-offset", "0px");
        return;
      }
      const viewportBottom = vv.offsetTop + vv.height;
      const gap = window.innerHeight - viewportBottom;
      const offsetPx = Math.max(0, gap);
      document.documentElement.style.setProperty("--mobile-cta-viewport-offset", `${offsetPx}px`);
    };

    updateViewportOffset();

    const vv = typeof window !== "undefined" ? window.visualViewport : null;
    if (vv) {
      vv.addEventListener("resize", updateViewportOffset);
      vv.addEventListener("scroll", updateViewportOffset);
    }
    window.addEventListener("resize", updateViewportOffset);
    window.addEventListener("orientationchange", updateViewportOffset);

    return () => {
      if (vv) {
        vv.removeEventListener("resize", updateViewportOffset);
        vv.removeEventListener("scroll", updateViewportOffset);
      }
      window.removeEventListener("resize", updateViewportOffset);
      window.removeEventListener("orientationchange", updateViewportOffset);
      document.documentElement.style.setProperty("--mobile-cta-viewport-offset", "0px");
    };
  }, []);

  return (
    <div
      role="banner"
      aria-label="상품 예약 상담"
      className="fixed left-0 right-0 z-50 box-border w-full border-t border-[var(--divider)] bg-white shadow-[0_-2px_8px_rgba(0,0,0,0.06)] md:hidden"
      style={{
        bottom: "var(--mobile-cta-viewport-offset, 0px)",
        paddingTop: `${PADDING_TOP}px`,
        paddingBottom: `calc(${PADDING_BOTTOM_BASE}px + env(safe-area-inset-bottom, 0px))`,
        paddingLeft: "max(12px, env(safe-area-inset-left, 0px))",
        paddingRight: "max(12px, env(safe-area-inset-right, 0px))",
      }}
    >
      <div className="mx-auto flex min-h-[44px] w-full max-w-[100%] items-center gap-3">
        <ProductConsultCTA
          productId={productId}
          productTitle={productTitle}
          sourcePath={sourcePath}
          status={status}
          kakaoHref={kakaoHref}
          section="sticky"
          priceFormatted={displayPrice}
          requiredGroupsMissing={requiredGroupsMissing}
          scrollToOptions={scrollToOptions}
          isSoldOut={isSoldOut}
          compact={compact}
          onPrimaryClick={() => trackReviewConversionCtaClick(productId, { experimentKey, variant })}
        />
      </div>
    </div>
  );
}

```


---

## File: `src/components/products/QuoteSummary.tsx`

```tsx
"use client";

import { useMemo } from "react";
import { Card } from "@/components/ui/Card";
import type { QuoteResult } from "@/lib/pricing/calcQuote";
import { formatPriceKR } from "@/lib/pricing/calcQuote";

export type QuoteSummaryProps = {
  quote: QuoteResult;
  className?: string;
};

/**
 * 선택된 옵션만 반영한 예상 견적 요약.
 * - breakdown은 선택된 항목만 표시, 0원 변동 항목은 나열하지 않음.
 * - "예상 금액/예상 견적" 표현만 사용 (최종 결제 금액 등 확정 표현 금지).
 */
export function QuoteSummary({ quote, className = "" }: QuoteSummaryProps) {
  const lines = useMemo(() => {
    const result: { label: string; amount: number; isTotal?: boolean }[] = [];
    if (quote.basePrice != null) {
      result.push({ label: "기본가", amount: quote.basePrice });
    }
    quote.breakdown.forEach((item) => {
      if (item.priceDelta === 0) return;
      result.push({ label: item.optionLabel, amount: item.priceDelta });
    });
    if (quote.total != null && (result.length > 0 || quote.basePrice != null)) {
      result.push({ label: "합계", amount: quote.total, isTotal: true });
    }
    return result;
  }, [quote]);

  const totalFormatted = quote.total != null ? formatPriceKR(quote.total) : null;
  if (totalFormatted == null && lines.length === 0) return null;

  return (
    <Card
      variant="default"
      className={`border-[#dbeafe] bg-[#f8fbff] p-5 ring-[#dbeafe] ${className}`.trim()}
      aria-label="예상 견적"
    >
      <p className="text-sm font-semibold text-slate-500">예상 금액</p>
      {totalFormatted ? (
        <p className="font-price-strong mt-1 text-2xl font-bold text-[var(--primary)] md:text-3xl">
          ₩{totalFormatted}~
        </p>
      ) : null}
      {lines.length > 0 && (
        <ul className="mt-4 space-y-1.5 border-t border-[var(--divider)] pt-4">
          {lines.map((line, index) => (
            <li
              key={`${line.label}-${index}`}
              className={`flex justify-between text-sm ${line.isTotal ? "font-semibold text-[#0f172a]" : "text-slate-600"}`}
            >
              <span>
                {line.isTotal ? line.label : line.label === "기본가" ? "기본가" : `${line.label}:`}
              </span>
              <span>
                {line.isTotal
                  ? `₩${formatPriceKR(line.amount) ?? ""}~`
                  : line.amount >= 0
                    ? `+₩${formatPriceKR(line.amount) ?? ""}`
                    : `-₩${formatPriceKR(-line.amount) ?? ""}`}
              </span>
            </li>
          ))}
        </ul>
      )}
    </Card>
  );
}

```


---

## File: `src/components/products/ProductQuoteContext.tsx`

```tsx
"use client";

import {
  createContext,
  useCallback,
  useContext,
  useRef,
  useState,
  type ReactNode,
} from "react";
import type { QuoteResult } from "@/lib/pricing/calcQuote";
import type { SelectedOptions } from "@/types/product";

type ProductQuoteContextValue = {
  quoteSummary: QuoteResult | null;
  selectedOptions: SelectedOptions | null;
  requiredGroupsMissing: boolean;
  setQuoteSummary: (q: QuoteResult | null) => void;
  setSelectedOptions: (s: SelectedOptions | null) => void;
  setRequiredGroupsMissing: (v: boolean) => void;
  registerScrollToOptions: (fn: () => void) => void;
  scrollToOptions: () => void;
};

const ProductQuoteContext = createContext<ProductQuoteContextValue | null>(null);

export function useProductQuote() {
  const ctx = useContext(ProductQuoteContext);
  if (!ctx) {
    return {
      quoteSummary: null,
      selectedOptions: null,
      requiredGroupsMissing: false,
      setQuoteSummary: () => {},
      setSelectedOptions: () => {},
      setRequiredGroupsMissing: () => {},
      registerScrollToOptions: () => {},
      scrollToOptions: () => {},
    };
  }
  return ctx;
}

export function ProductQuoteProvider({ children }: { children: ReactNode }) {
  const [quoteSummary, setQuoteSummary] = useState<QuoteResult | null>(null);
  const [selectedOptions, setSelectedOptions] = useState<SelectedOptions | null>(null);
  const [requiredGroupsMissing, setRequiredGroupsMissing] = useState(false);
  const scrollToOptionsRef = useRef<(() => void) | null>(null);

  const registerScrollToOptions = useCallback((fn: () => void) => {
    scrollToOptionsRef.current = fn;
  }, []);

  const scrollToOptions = useCallback(() => {
    scrollToOptionsRef.current?.();
  }, []);

  const value: ProductQuoteContextValue = {
    quoteSummary,
    selectedOptions,
    requiredGroupsMissing,
    setQuoteSummary,
    setSelectedOptions,
    setRequiredGroupsMissing,
    registerScrollToOptions,
    scrollToOptions,
  };

  return (
    <ProductQuoteContext.Provider value={value}>
      {children}
    </ProductQuoteContext.Provider>
  );
}

```


---

## File: `src/components/product-detail/ProductDetailTabs.tsx`

```tsx
"use client";

import { useMemo, useState } from "react";
import {
  ChevronDown,
  Plane,
  Hotel,
  MapPin,
  CalendarDays,
  Check,
  UtensilsCrossed,
} from "lucide-react";
import AlertCard from "@/components/ui/AlertCard";

type ProductDetailTabsProps = {
  pointBenefits?: string;
  pointTourism?: string;
  pointGuide?: string;
  meetingInfo?: string;
  travelInsurance?: string;
  includedItems?: string;
  excludedItems?: string;
  detailedSchedule?: string;
  optionalTours?: string;
  minDeparturePeople?: string;
  termsAndNotes?: string;
};

type ScheduleDay = {
  label: string;
  content: string;
};

type MainTab = "schedule" | "included" | "booking" | "refund";

function parseScheduleDays(raw?: string): ScheduleDay[] {
  const source = raw?.trim();
  if (!source) return [];

  const lines = source.split(/\r?\n/);
  const days: ScheduleDay[] = [];
  let currentLabel = "";
  let currentContent: string[] = [];

  for (const line of lines) {
    const match = line.match(/^\[(.+)\]\s*$/);
    if (match) {
      if (currentLabel) {
        days.push({ label: currentLabel, content: currentContent.join("\n").trim() });
      }
      currentLabel = match[1].trim();
      currentContent = [];
      continue;
    }
    currentContent.push(line);
  }

  if (currentLabel) {
    days.push({ label: currentLabel, content: currentContent.join("\n").trim() });
  }

  if (days.length === 0) return [{ label: "일정", content: source }];
  return days.filter((d) => d.content.length > 0);
}

function getScheduleIcon(label: string) {
  const lower = label.toLowerCase().replace(/\s+/g, "");
  if (/출발|항공|비행|공항|day\s*1/.test(lower)) return Plane;
  if (/호텔|숙박|체크인|체크아웃/.test(lower)) return Hotel;
  if (/골프|라운딩|코스/.test(lower)) return MapPin;
  if (/식사|맛집|식당|브런치|디너/.test(lower)) return UtensilsCrossed;
  return CalendarDays;
}

function parseBulletLines(raw?: string) {
  return (raw ?? "")
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => line.length > 0);
}

export default function ProductDetailTabs({
  includedItems,
  excludedItems,
  detailedSchedule,
  optionalTours,
  minDeparturePeople,
  termsAndNotes,
}: ProductDetailTabsProps) {
  const [activeTab, setActiveTab] = useState<MainTab>("schedule");
  const [openScheduleIndex, setOpenScheduleIndex] = useState<number | null>(0);
  const scheduleDays = useMemo(() => parseScheduleDays(detailedSchedule), [detailedSchedule]);
  const includedLines = useMemo(() => parseBulletLines(includedItems), [includedItems]);
  const excludedLines = useMemo(() => parseBulletLines(excludedItems), [excludedItems]);
  const optionalLines = useMemo(() => parseBulletLines(optionalTours), [optionalTours]);
  const termsLines = useMemo(() => parseBulletLines(termsAndNotes), [termsAndNotes]);

  const mainTabs: { key: MainTab; label: string }[] = [
    { key: "schedule", label: "일정 안내" },
    { key: "included", label: "포함/불포함" },
    { key: "booking", label: "예약 조건" },
    { key: "refund", label: "환불 규정" },
  ];

  const listClass = "space-y-2 text-sm leading-[1.7] text-slate-700";
  const bulletClass = "mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-[var(--dot-indicator)]";

  return (
    <section className="space-y-5 rounded-3xl bg-white/95 p-4 shadow-sm ring-1 ring-[var(--primary-soft)] backdrop-blur md:p-6">
      <div className="flex flex-wrap gap-2">
        {mainTabs.map((tab) => (
          <button
            key={tab.key}
            type="button"
            onClick={() => setActiveTab(tab.key)}
            className={`rounded-full border px-4 py-2 text-sm font-semibold transition ${
              activeTab === tab.key
                ? "border-[var(--primary)] bg-[var(--primary-bg)] text-[var(--primary)] shadow-sm"
                : "border-slate-200 bg-white text-slate-600 hover:border-slate-300 hover:bg-slate-50"
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* 일정 안내 - Accordion */}
      {activeTab === "schedule" && (
        <div key="schedule" className="fade-in-up space-y-2">
          {scheduleDays.length > 0 ? (
            scheduleDays.map((day, index) => {
              const Icon = getScheduleIcon(day.label);
              const isOpen = openScheduleIndex === index;
              return (
                <div
                  key={`${day.label}-${index}`}
                  className="overflow-hidden rounded-xl border border-[var(--primary-soft)] bg-[var(--primary-soft)] ring-1 ring-[var(--primary-soft)]"
                >
                  <button
                    type="button"
                    onClick={() => setOpenScheduleIndex(isOpen ? null : index)}
                    className="flex w-full items-center gap-3 px-4 py-3 text-left transition hover:bg-[var(--primary-bg)]"
                  >
                    <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-white text-[var(--primary)] ring-1 ring-[var(--primary-soft)]">
                      <Icon className="h-4 w-4" />
                    </span>
                    <span className="flex-1 font-semibold text-[#0f172a]">{day.label}</span>
                    <ChevronDown
                      className={`h-5 w-5 shrink-0 text-slate-500 transition ${isOpen ? "rotate-180" : ""}`}
                    />
                  </button>
                  {isOpen && (
                    <div className="border-t border-[var(--divider)] px-4 pb-4 pt-2">
                      <p className="whitespace-pre-line text-sm leading-[1.7] text-slate-700">
                        {day.content}
                      </p>
                    </div>
                  )}
                </div>
              );
            })
          ) : (
            <p className="text-sm text-slate-500">등록된 일정이 없습니다.</p>
          )}
        </div>
      )}

      {/* 포함/불포함 */}
      {activeTab === "included" && (
        <div key="included" className="fade-in-up space-y-6">
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2 md:gap-6">
            {/* 포함 사항 - 긍정 색상 박스, 웹에서 왼쪽 */}
            <div className="rounded-xl border border-emerald-200 bg-emerald-50/50 p-4 ring-1 ring-emerald-200">
              <h3 className="mb-3 text-sm font-bold text-emerald-800">포함 사항</h3>
              {includedLines.length > 0 ? (
                <ul className={listClass}>
                  {includedLines.map((line, i) => (
                    <li key={i} className="flex items-start gap-2">
                      <span className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-emerald-500" />
                      <span>{line}</span>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="text-sm text-slate-500">등록된 포함 사항이 없습니다.</p>
              )}
            </div>

            {/* 불포함 사항 - 웹에서 오른쪽 */}
            <div className="rounded-xl border border-amber-200 bg-amber-50/50 p-4 ring-1 ring-amber-200">
              <h3 className="mb-3 text-sm font-bold text-amber-800">불포함 사항</h3>
              {excludedLines.length > 0 ? (
                <ul className={listClass}>
                  {excludedLines.map((line, i) => (
                    <li key={i} className="flex items-start gap-2">
                      <span className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-amber-500" />
                      <span>{line}</span>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="text-sm text-slate-500">등록된 불포함 사항이 없습니다.</p>
              )}
            </div>
          </div>

          {optionalLines.length > 0 && (
            <div>
              <h3 className="mb-3 text-sm font-bold text-[var(--primary)]">선택 관광</h3>
              <ul className={listClass}>
                {optionalLines.map((line, i) => (
                  <li key={i} className="flex items-start gap-2">
                    <span className={bulletClass} />
                    <span>{line}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}

      {/* 예약 조건 - 체크리스트 + 약관 요약 */}
      {activeTab === "booking" && (
        <div key="booking" className="fade-in-up space-y-5">
          <ul className="space-y-3">
            {minDeparturePeople?.trim() && (
              <li className="flex items-start gap-3">
                <Check className="mt-0.5 h-5 w-5 shrink-0 text-emerald-600" />
                <span className="text-sm leading-[1.7] text-slate-700">
                  출발 인원: {minDeparturePeople.trim()}명 이상 확정 시 출발
                </span>
              </li>
            )}
            <li className="flex items-start gap-3">
              <Check className="mt-0.5 h-5 w-5 shrink-0 text-emerald-600" />
              <span className="text-sm leading-[1.7] text-slate-700">
                최종 일정·가격은 상담 후 확정됩니다.
              </span>
            </li>
            <li className="flex items-start gap-3">
              <Check className="mt-0.5 h-5 w-5 shrink-0 text-emerald-600" />
              <span className="text-sm leading-[1.7] text-slate-700">
                문의 주시면 맞춤 견적과 예약 절차를 안내해 드립니다.
              </span>
            </li>
          </ul>
          {termsLines.length > 0 && (
            <AlertCard variant="info" title="예약 시 유의사항">
              <ul className="mt-2 space-y-1">
                {termsLines.map((line, i) => (
                  <li key={i}>{line}</li>
                ))}
              </ul>
            </AlertCard>
          )}
        </div>
      )}

      {/* 환불 규정 */}
      {activeTab === "refund" && (
        <div key="refund" className="fade-in-up">
          {termsLines.length > 0 ? (
            <AlertCard variant="neutral" title="환불 및 취소 규정">
              <ul className="mt-2 space-y-2 leading-[1.7]">
                {termsLines.map((line, i) => (
                  <li key={i}>{line}</li>
                ))}
              </ul>
            </AlertCard>
          ) : (
            <AlertCard variant="info" title="환불 규정">
              <p>
                상품별 상세 환불·취소 규정은 상담 시 안내해 드립니다. 문의해 주시면 기간별 취소 수수료와
                절차를 안내해 드립니다.
              </p>
            </AlertCard>
          )}
        </div>
      )}
    </section>
  );
}

```


---

## File: `src/components/product-detail/ProductsHero.tsx`

```tsx
"use client";

import { useEffect, useMemo, useState } from "react";

type ProductsHeroVariant = "package" | "golf";

type SiteSettingsClient = {
  products_hero_headline?: string;
  products_hero_subcopy?: string;
  golf_hero_headline?: string;
  golf_hero_subcopy?: string;
};

const DEFAULT_PACKAGE_HEADLINE =
  "패키지상품으로 원하시는 지역·예산에 맞춰 바로 상담까지 연결해 드려요.";
const DEFAULT_PACKAGE_SUBCOPY =
  "골프/패키지, 가족·지인·단체 여행까지. 관심 있는 지역과 대략적인 일정만 알려주시면, 담당자가 상품을 추려 1:1로 안내해 드립니다.";

const DEFAULT_GOLF_HEADLINE =
  "골프/파크골프 전문 맞춤 설계로 라운딩 동선을 깔끔하게 잡아드립니다.";
const DEFAULT_GOLF_SUBCOPY =
  "선호하는 골프장, 라운딩 횟수, 동행 인원과 예산을 알려주시면, 시즌에 맞는 최적의 골프투어 코스를 추천해 드립니다.";

type ProductsHeroProps = {
  variant: ProductsHeroVariant;
};

export default function ProductsHero({ variant }: ProductsHeroProps) {
  const [settings, setSettings] = useState<SiteSettingsClient | null>(null);

  useEffect(() => {
    let isMounted = true;
    async function load() {
      try {
        const response = await fetch("/api/site-settings", { cache: "no-store" });
        const result = (await response.json()) as SiteSettingsClient | { message?: string };
        if (!response.ok || !result || typeof result !== "object" || "message" in result) {
          return;
        }
        if (isMounted) {
          setSettings(result as SiteSettingsClient);
        }
      } catch {
        // ignore
      }
    }
    load();
    return () => {
      isMounted = false;
    };
  }, [variant]);

  const headline = useMemo(() => {
    if (variant === "golf") {
      if (settings?.golf_hero_headline && settings.golf_hero_headline.trim().length > 0) {
        return settings.golf_hero_headline;
      }
      return DEFAULT_GOLF_HEADLINE;
    }
    if (settings?.products_hero_headline && settings.products_hero_headline.trim().length > 0) {
      return settings.products_hero_headline;
    }
    return DEFAULT_PACKAGE_HEADLINE;
  }, [settings, variant]);

  const subcopy = useMemo(() => {
    if (variant === "golf") {
      if (settings?.golf_hero_subcopy && settings.golf_hero_subcopy.trim().length > 0) {
        return settings.golf_hero_subcopy;
      }
      return DEFAULT_GOLF_SUBCOPY;
    }
    if (settings?.products_hero_subcopy && settings.products_hero_subcopy.trim().length > 0) {
      return settings.products_hero_subcopy;
    }
    return DEFAULT_PACKAGE_SUBCOPY;
  }, [settings, variant]);

  return (
    <section className="space-y-1" aria-labelledby="products-hero-title">
      <p className="section-label text-[var(--text-muted)] text-xs font-semibold uppercase tracking-wide md:type-small">
        {variant === "golf" ? "THEALL TOUR GOLF" : "THEALL TOUR PACKAGE"}
      </p>
      <h1 id="products-hero-title" className="section-title type-h2 text-[var(--foreground)] md:type-h1 md:leading-[1.2]">
        {headline}
      </h1>
      <p className="type-small max-w-2xl leading-relaxed text-[var(--text-muted)] md:type-body">
        {subcopy}
      </p>
    </section>
  );
}


```


---

## File: `src/types/product.ts`

```typescript
import type { ProductCampaignCardMeta } from "@/types/productCampaignCard";

export type ProductTrust = {
  recentConsultCount?: number;
  recentDays?: number;
  totalInquiries?: number;
  ratingAvg?: number;
  reviewCount?: number;
};

/**
 * 옵션 항목: 단일 선택지 (예: "3박4일", "싱글룸")
 * - value: 선택 시 SelectedOptions에 저장되는 값
 * - priceDelta: 기준가에 더할 금액(원). 미설정 시 0
 * - meta: "1인1실", "성수기" 등 부가 표시
 * - isDefault: true면 초기 선택값 후보
 */
export type ProductOptionItem = {
  value: string;
  label: string;
  priceDelta?: number;
  meta?: string;
  isDefault?: boolean;
};

/**
 * 옵션 그룹: 선택 그룹 (예: "기간", "룸 타입")
 * - key: 그룹 식별자, SelectedOptions의 키로 사용
 * - type: UI 타입 (radio / select / stepper / multi)
 */
export type ProductOptionGroup = {
  key: string;
  title: string;
  type: "radio" | "select" | "stepper" | "multi";
  items: ProductOptionItem[];
};

/**
 * 상품 옵션 정의 (Phase 4-3 통일 구조)
 * - basePrice + 선택된 items의 priceDelta 합으로 총액 계산
 * - requiredGroups에 포함된 key는 반드시 하나 선택
 */
export type ProductOptions = {
  basePrice: number;
  currency: "KRW";
  /** 필수 그룹 key 목록. 이 key들은 반드시 하나 선택 */
  requiredGroups?: string[];
  groups: ProductOptionGroup[];
};

/** 선택된 옵션: groupKey -> itemValue (UI/계산용) */
export type SelectedOptions = Record<string, string>;

/** 여행 오버뷰 요약 카드 kind */
export type OverviewSummaryCardKind =
  | "flight"
  | "hotel"
  | "region"
  | "theme"
  | "golf"
  | "etc";

/** 여행 오버뷰 요약 카드 */
export type OverviewSummaryCard = {
  kind: OverviewSummaryCardKind;
  label: string;
  value: string;
};

/** 여행 오버뷰 차트 아이템 */
export type OverviewChartItem = { label: string; percent: number };

/** 여행 오버뷰 타임라인 Day */
export type OverviewTimelineDay = {
  day: number;
  dateText?: string;
  headline?: string;
  bullets: string[];
};

/** [STEP 0] 구조화 일정 이벤트 1개 (시간대·아이콘 지원) */
export type ItineraryStructuredEvent = {
  heading: string;
  description?: string;
  timeOfDay?: "오전" | "오후" | "저녁" | "종일";
  iconKey?: string;
  /** 이벤트별 이미지 URL 목록 (대표·정렬 포함) */
  images?: Array<{ url: string; alt?: string; sortOrder?: number; isCover?: boolean }>;
};

/** [STEP 0] 구조화 일정 Day 1개 */
export type ItineraryStructuredDay = {
  day: number;
  dateText?: string;
  title?: string;
  coverImageUrl?: string | null;
  events: ItineraryStructuredEvent[];
};

/** [STEP 1] 구조화 일정 v2 (시각화 최적화, jsonb 1컬럼) */
export type ItineraryV2Event = {
  timeOfDay?: "오전" | "오후" | "저녁" | "종일";
  /** 시각 (예: 09:00, 14:30). 오전/오후 옆에 표시 */
  timeText?: string;
  iconKey?: string;
  heading: string;
  description?: string;
  location?: string;
  order?: number;
  /** 이벤트별 이미지 URL 목록 (대표·정렬 포함) */
  images?: Array<{ url: string; alt?: string; sortOrder?: number; isCover?: boolean }>;
};

export type ItineraryV2Day = {
  day: number;
  dateText?: string;
  title?: string;
  coverImageUrl?: string;
  events: ItineraryV2Event[];
};

export type ItineraryV2 = {
  days: ItineraryV2Day[];
};

/** 이벤트 선택 상태: 상품 공용 이미지 → "이 이벤트에 추가" 시 참조 (관리자 UI용) */
export type SelectedEventRef =
  | { editorType: "v2"; dayIndex: number; eventIndex: number }
  | { editorType: "structured"; dayIndex: number; eventIndex: number };

/** PR42: 상세 일정 타임라인용 일차 데이터 (title/subtitle/description/meals/hotel) */
export type ProductItineraryDay = {
  day: number;
  title?: string;
  subtitle?: string;
  description?: string;
  meals?: string[];
  hotel?: string;
};

/** 여행 오버뷰 (jsonb 1컬럼 스키마) */
export type ProductOverview = {
  enabled: boolean;
  title?: string;
  summaryCards: OverviewSummaryCard[];
  coverImageUrl?: string;
  chart?: {
    enabled: boolean;
    items: OverviewChartItem[];
  };
  timeline?: {
    enabled: boolean;
    days: OverviewTimelineDay[];
  };
};

export type Product = {
  id: string;
  title: string;
  description: string;
  /** 상세 히어로용 (hero 1920px). 카드 썸네일은 image_card_url 우선, 없으면 이 값 사용 */
  image_url: string;
  /** 상품 이미지 갤러리 URL 배열. 첫 번째가 대표 이미지로 사용됨 */
  images_json?: string[];
  /** TODO: 목록 카드 썸네일용 (card 800px). 확장 시 ProductCatalogSection 등에서 우선 사용. */
  // image_card_url?: string;
  /**
   * @deprecated legacy. destination_id / product_line_id 비어 있을 때만 fallback 사용.
   * 지역·상품군이 혼재했던 단일 문자열. 점진적 이전 후 제거 검토.
   */
  category: string;
  /**
   * @deprecated legacy. 테마 이름 토큰 문자열(쉼표/구분자).
   * 새 스키마에서는 theme_ids_json 등 검토. 당분간 유지.
   */
  theme?: string;
  /** 지역 1개 (product_taxonomies.id, taxonomy_type=destination). 비어 있으면 category fallback */
  destination_id?: string | null;
  /** 상품군 1개 (product_taxonomies.id, taxonomy_type=product_line). 비어 있으면 category fallback */
  product_line_id?: string | null;
  /** 기획/강조 항목. taxonomy 이름 배열 또는 id 배열. 선택 */
  campaigns?: string[] | null;
  /** DB 컬럼명. API 응답에서 올 수 있음 */
  campaigns_json?: string[] | null;
  /** 태그 이름 배열. 선택 */
  tags?: string[] | null;
  /** PR22: 핵심 여행 요약용 문구 배열. 없으면 tags/themes로 대체 */
  highlights?: string[] | null;
  price?: number;
  duration?: string;
  /** 출발지역 (Summary 블록용) */
  departure?: string;
  /** 항공 요약 (Summary 블록용) */
  airline?: string;
  /** 숙소 요약 (Summary 블록용) */
  hotel?: string;
  /** 여행스타일 (Summary 블록용) */
  travelStyle?: string;
  /** 출발일 목록 (ProductDepartureSelector용). 예: ["2025-06-12", "2025-07-03"] */
  departures?: string[];
  /** PR42: 일차별 타임라인용 일정 (ProductItineraryTimeline). 없으면 기존 itinerary / detailed_schedule 사용 */
  itinerary_days?: ProductItineraryDay[];
  itinerary?: string;
  inclusions?: string;
  point_benefits?: string;
  point_tourism?: string;
  point_guide?: string;
  meeting_info?: string;
  travel_insurance?: string;
  included_items?: string;
  excluded_items?: string;
  detailed_schedule?: string;
  optional_tours?: string;
  min_departure_people?: string;
  terms_and_notes?: string;
  terms_template_type?: string;
  product_source_url?: string;
  departure_from_airport?: string;
  departure_from_date?: string;
  departure_from_time?: string;
  departure_to_airport?: string;
  departure_to_date?: string;
  departure_to_time?: string;
  departure_flight_name?: string;
  /** 출발편 수하물 한도 (예: 23KG) */
  departure_baggage_limit?: string;
  arrival_from_airport?: string;
  arrival_from_date?: string;
  arrival_from_time?: string;
  arrival_to_airport?: string;
  arrival_to_date?: string;
  arrival_to_time?: string;
  arrival_flight_name?: string;
  /** 도착편 수하물 한도 (예: 23KG) */
  arrival_baggage_limit?: string;
  meta_title?: string;
  meta_description?: string;
  is_active?: boolean;
  /** 추천 여행 컬렉션용. true면 /products?collection=recommend에 노출 */
  is_recommend?: boolean;
  /** 인기 여행 컬렉션용. true면 /products?collection=popular에 노출 */
  is_popular?: boolean;
  sort_order?: number;
  created_at?: string;
  /** DB에 컬럼이 있으면 목록 등에서 사용. 없으면 undefined */
  updated_at?: string;
  /** 상품 상태: 없으면 AVAILABLE로 간주 */
  status?: "AVAILABLE" | "LIMITED" | "SOLD_OUT" | "CONSULT_REQUIRED";
  /** 유류할증료 포함 여부. null이면 상세에서 문구 미노출 */
  fuel_included?: boolean;
  /** 가격 기준 문구 (예: 1인 기준). 카드/상세에 표시 */
  price_meta?: string;
  /** 카드 부가 문구 (예: 항공 포함). 카드 메타 영역에 표시 */
  meta_info?: string;
  /** 상세 상단 한 줄 소개. 비우면 description 첫 줄 사용 */
  one_liner?: string;
  /** [STEP 2] 오버뷰 jsonb 1컬럼. enabled/summaryCards/chart/timeline/coverImageUrl */
  overview_json?: ProductOverview | null;
  /** [STEP 3] 일정 Day별 대표 이미지 URL. 예: { "1": "https://...", "2": "https://..." } */
  itinerary_media_json?: Record<string, string> | null;
  /** [STEP 0] 구조화 일정. 있으면 상세에서 시각화 타임라인 우선 사용, 없으면 detailed_schedule 텍스트 fallback */
  itinerary_days_json?: ItineraryStructuredDay[] | null;
  /** [STEP 1] 구조화 일정 v2 (jsonb 1컬럼, 시각화 최적화) */
  itinerary_v2_json?: ItineraryV2 | null;
  /** 일정 테마 구성비. 상품 등록 시 입력, 없으면 theme/category 기반 자동 생성 */
  theme_chart_json?: { items: Array<{ label: string; percent: number }> } | null;
  /** 여행 오버뷰 카드 전용 입력 (숙소·지역·기간). 있으면 우선 사용 */
  overview_accommodation?: string;
  overview_region?: string;
  overview_duration?: string;
  trust?: ProductTrust;
  /** 옵션 정의. 없거나 groups가 비어 있으면 옵션 UI 미노출 */
  options?: ProductOptions;
  /**
   * PR3: 기획(campaign) taxonomy 기반 카드 배지 해석.
   * `getProducts` 등에서 hydrate; 없으면 `campaigns` 문자열 + 레거시 규칙 사용.
   */
  campaign_card_meta?: ProductCampaignCardMeta[];
};

```


---

## File: `src/types/adminProductForm.ts`

```typescript
import type { ItineraryStructuredDay, ItineraryV2 } from "@/types/product";

/** 약관 템플릿 타입 (상품 등록 폼용) */
export type TermsTemplateType =
  | "overseas_brokerage"
  | "domestic_brokerage"
  | "overseas_direct"
  | "domestic_direct";

export type ProductFormState = {
  title: string;
  description: string;
  product_source_url: string;
  point_benefits: string;
  point_tourism: "O" | "X";
  point_guide: "O" | "X";
  meeting_info: "O" | "X";
  travel_insurance: "O" | "X";
  included_items: string;
  excluded_items: string;
  departure_from_airport: string;
  departure_from_date: string;
  departure_from_time: string;
  departure_to_airport: string;
  departure_to_date: string;
  departure_to_time: string;
  departure_flight_name: string;
  departure_baggage_limit: string;
  arrival_from_airport: string;
  arrival_from_date: string;
  arrival_from_time: string;
  arrival_to_airport: string;
  arrival_to_date: string;
  arrival_to_time: string;
  arrival_flight_name: string;
  arrival_baggage_limit: string;
  detailed_schedule: string;
  optional_tours: string;
  min_departure_people: string;
  terms_template_type: "" | TermsTemplateType;
  terms_and_notes: string;
  meta_title: string;
  meta_description: string;
  image_url: string;
  images_json: string[];
  category: string;
  /** 지역 1개 (product_taxonomies.id, taxonomy_type=destination). 빈 문자열 = 미선택 */
  destination_id: string;
  theme: string;
  /** 상품군 1개 (product_taxonomies.id). 빈 문자열 = 미선택 */
  product_line_id: string;
  /** 기획/추천 다중 선택. 쉼표 등으로 구분된 이름 문자열 (테마와 동일 방식) */
  campaigns: string;
  price: string;
  duration: string;
  itinerary: string;
  inclusions: string;
  is_active: boolean;
  sort_order: string;
  /** 예약 가능 / 잔여 한정 / 마감 / 상담 후 안내 */
  status: "" | "AVAILABLE" | "LIMITED" | "SOLD_OUT" | "CONSULT_REQUIRED";
  one_liner: string;
  price_meta: string;
  /** "" = 표시 안 함, "true" = 포함, "false" = 별도 */
  fuel_included: "" | "true" | "false";
  meta_info: string;
  /** JSON 문자열. 옵션 사용 시 ProductOptions 직렬화 */
  options_json: string;
  /** [STEP 3] 일정 Day별 대표 이미지 URL. 키: "1","2",... 값: URL */
  itinerary_media_json: Record<string, string>;
  /** [STEP 0] 구조화 일정. 있으면 상세에서 시각화 타임라인 우선 사용 */
  itinerary_days_json: ItineraryStructuredDay[];
  /** [STEP 1] 시각화 일정 v2 (jsonb 1컬럼, 권장) */
  itinerary_v2_json: ItineraryV2;
  /** [STEP 3] 레거시 텍스트 붙여넣기용 (저장 안 함, 초안 생성용) */
  legacy_itinerary_text: string;
  /** 일정 테마 구성비. 상세 오버뷰 차트용. 2개 이상 입력 시 저장 */
  theme_chart_json: Array<{ label: string; percent: number }>;
  /** 여행 오버뷰 카드 전용 (숙소·지역·기간) */
  overview_accommodation: string;
  overview_region: string;
  overview_duration: string;
};

/** 임시저장 payload (로컬 저장/복원용) */
export type ProductFormDraft = {
  version: 1;
  form: ProductFormState;
  savedAt: number;
};

/** 빈 폼 상태 생성 (상품 등록 초기값·Import base 등) */
export function createEmptyProductFormState(): ProductFormState {
  return {
    title: "",
    description: "",
    product_source_url: "",
    point_benefits: "",
    point_tourism: "X",
    point_guide: "X",
    meeting_info: "X",
    travel_insurance: "X",
    included_items: "",
    excluded_items: "",
    departure_from_airport: "",
    departure_from_date: "",
    departure_from_time: "",
    departure_to_airport: "",
    departure_to_date: "",
    departure_to_time: "",
    departure_flight_name: "",
    departure_baggage_limit: "",
    arrival_from_airport: "",
    arrival_from_date: "",
    arrival_from_time: "",
    arrival_to_airport: "",
    arrival_to_date: "",
    arrival_to_time: "",
    arrival_flight_name: "",
    arrival_baggage_limit: "",
    detailed_schedule: "",
    optional_tours: "",
    min_departure_people: "",
    terms_template_type: "",
    terms_and_notes: "",
    meta_title: "",
    meta_description: "",
    image_url: "",
    images_json: [],
    category: "여행상품",
    destination_id: "",
    theme: "",
    product_line_id: "",
    campaigns: "",
    price: "",
    duration: "",
    itinerary: "",
    inclusions: "",
    is_active: true,
    sort_order: "",
    status: "AVAILABLE",
    one_liner: "",
    price_meta: "",
    fuel_included: "",
    meta_info: "",
    options_json: "",
    itinerary_media_json: {},
    itinerary_days_json: [],
    itinerary_v2_json: { days: [] },
    legacy_itinerary_text: "",
    theme_chart_json: [],
    overview_accommodation: "",
    overview_region: "",
    overview_duration: "",
  };
}

```


---

## File: `src/types/productLanding.ts`

```typescript
/**
 * 랜딩 페이지용 타입 (region/theme).
 * 후속 PR에서 실제 랜딩 UI가 이 shape를 소비.
 */

import type { ProductTaxonomy } from "@/types/productTaxonomy";

export type ProductLandingType = "region" | "theme";

export type ProductLandingHero = {
  eyebrow: string;
  title: string;
  description: string;
  /** 카테고리/테마 관리에서 저장한 히어로 배경 이미지. 없으면 카드 스타일만 표시 */
  imageUrl?: string | null;
  primaryCtaLabel: string;
  primaryCtaHref: string;
  secondaryCtaLabel?: string;
  secondaryCtaHref?: string;
};

export type ProductLandingFeaturedLink = {
  key: string;
  label: string;
  href: string;
};

/** ProductCard `badges`와 동일 형태 — 랜딩 직렬화용 */
export type ProductLandingCardBadge = {
  type: string;
  label: string;
  priority?: number;
  isActive?: boolean;
  campaignTone?: "primary" | "highlight" | "neutral";
};

export type ProductLandingProductSummary = {
  id: string;
  title: string;
  imageUrl?: string | null;
  description?: string | null;
  price?: string | number | null;
  href: string;
  categories?: string[];
  themes?: string[];
  /** campaign 대표 배지 — 이미지 오버레이(다른 랜딩·목록과 동일 소스) */
  badges?: ProductLandingCardBadge[];
};

export type ProductLandingData = {
  type: ProductLandingType;
  slug: string;
  taxonomyName: string;
  taxonomySlug: string | null;
  hero: ProductLandingHero;
  featuredLinks: ProductLandingFeaturedLink[];
  recommendedProducts: ProductLandingProductSummary[];
  relatedTaxonomies: ProductLandingFeaturedLink[];
  productCount: number;
  /** region 랜딩일 때만: 현재 지역의 소분류(도시·지역) 카드용. card_image_url은 서버에서 fallback 적용 후 전달 */
  childDestinations?: ProductTaxonomy[];
  /** theme 랜딩일 때만: 현재 테마의 하위 테마 카드용. card_image_url은 서버에서 fallback 적용 후 전달 */
  childThemes?: ProductTaxonomy[];
};

```


---

## File: `src/types/productCampaignCard.ts`

```typescript
/**
 * PR3: 상품 카드 대표 배지용 캠페인 해석 결과 (taxonomy + fallback).
 */

export type CampaignBadgeTone = "primary" | "highlight" | "neutral";

export type ProductCampaignCardMeta = {
  /** taxonomy 행 id (문자열 토큰만 있을 때는 없음) */
  taxonomyId?: string;
  /** DB name (관리용) */
  name: string;
  /** 카드에 그릴 라벨 */
  displayLabel: string;
  badge_priority: number;
  badge_visible: boolean;
  badge_tone: CampaignBadgeTone;
  /** 카드 피치 1줄. 없으면 레거시 라벨 fallback 가능 */
  description?: string;
};

```


---

## File: `src/types/modetourImport.ts`

```typescript
export type ModetourImportWarning = {
  code: string;
  message: string;
  path?: string;
};

export type ModetourImportV1 = {
  version: "modetour-import-v1";

  source: {
    provider: "modetour";
    url: string;
    fetchedAtISO: string;
  };

  product: {
    title?: string;
    summary?: string;
    nights?: number;
    days?: number;
    regionText?: string;
    priceText?: string;
  };

  inclusions?: {
    includedText?: string;
    excludedText?: string;
    /** DOM 파싱으로 추출한 포함 사항 리스트 (우선 사용) */
    includedItems?: string[];
    /** DOM 파싱으로 추출한 불포함 사항 리스트 (우선 사용) */
    excludedItems?: string[];
  };

  terms?: {
    termsText?: string;
    cancelText?: string;
    noticeText?: string;
  };

  /** 탭형 상세정보 (일정 안내 / 예약 조건 / 환불·취소 규정) DOM 파싱 결과 */
  detailTabs?: {
    scheduleNotice?: { title: string; rawText: string; sections: { heading?: string | null; lines: string[] }[]; lines: string[] } | null;
    bookingTerms?: { title: string; rawText: string; sections: { heading?: string | null; lines: string[] }[]; lines: string[] } | null;
    cancellationPolicy?: { title: string; rawText: string; sections: { heading?: string | null; lines: string[] }[]; lines: string[] } | null;
  };

  itinerary?: {
    days: Array<{
      dayNumber: number;
      title?: string;
      dateText?: string;
      descriptionText?: string;
      imageUrls?: string[];

      events: Array<{
        order: number;
        timeText?: string;
        title?: string;
        typeText?: string;
        descriptionText?: string;
        imageUrls?: string[];
      }>;
    }>;
  };

  media?: {
    heroImageUrl?: string;
    galleryImageUrls?: string[];
    unassignedImageUrls?: string[];
  };

  warnings?: ModetourImportWarning[];

  raw?: {
    textSnippets?: Record<string, string>;
  };
};

```


---

## File: `src/lib/pricing/calcQuote.ts`

```typescript
import type { ProductOptions, ProductOptionGroup, ProductOptionItem, SelectedOptions } from "@/types/product";

export type QuoteBreakdownItem = {
  groupId: string;
  groupLabel: string;
  optionId: string;
  optionLabel: string;
  priceDelta: number;
  durationLabel?: string;
};

export type QuoteResult = {
  /** 합계 금액(원). basePrice + 선택 항목 priceDelta 합 */
  total: number | null;
  /** 기준가(원). options.basePrice */
  basePrice: number | null;
  /** 선택된 항목만 포함 */
  breakdown: QuoteBreakdownItem[];
  /** 표시용 기간. 옵션에서 meta 등으로 확장 가능 시 사용, 현재는 null */
  durationLabel: string | null;
};

function findItemByValue(group: ProductOptionGroup, value: string): ProductOptionItem | null {
  const found = group.items.find((o) => o.value === value);
  return found ?? null;
}

/**
 * 옵션 그룹 배열 반환 (정렬 필요 시 groups 순서 유지 또는 추후 sortOrder 확장)
 */
export function sortOptionGroups(options: ProductOptions): ProductOptionGroup[] {
  return options.groups ?? [];
}

/**
 * 기준가 + 선택된 옵션으로 견적 계산.
 * - total = basePrice + sum(선택된 items의 priceDelta)
 * - breakdown에는 선택된 항목만 포함
 * - options가 없거나 groups가 비어 있으면 total = basePrice, breakdown = []
 */
export function calcQuote(
  options: ProductOptions | undefined,
  selected: SelectedOptions
): QuoteResult {
  if (!options?.groups?.length) {
    const base = options?.basePrice ?? null;
    return {
      total: base,
      basePrice: base,
      breakdown: [],
      durationLabel: null,
    };
  }

  const breakdown: QuoteBreakdownItem[] = [];
  let total = options.basePrice;

  for (const group of options.groups) {
    const itemValue = selected[group.key];
    if (!itemValue) continue;

    const item = findItemByValue(group, itemValue);
    if (!item) continue;

    const delta = typeof item.priceDelta === "number" ? item.priceDelta : 0;
    breakdown.push({
      groupId: group.key,
      groupLabel: group.title,
      optionId: item.value,
      optionLabel: item.label,
      priceDelta: delta,
    });
    total += delta;
  }

  return {
    total,
    basePrice: options.basePrice,
    breakdown,
    durationLabel: null,
  };
}

/**
 * 금액을 한국 원화 포맷 문자열로 반환.
 */
export function formatPriceKR(amount: number | null | undefined): string | null {
  if (amount == null || typeof amount !== "number") return null;
  return new Intl.NumberFormat("ko-KR").format(amount);
}

```


---

## File: `src/lib/admin/productPreview.ts`

```typescript
/**
 * 공용 미리보기 로직: 저장 API와 preview API가 동일한 규칙 사용
 * - form → Product (formToPreviewProduct)
 * - Product → ProductCardProps / ProductDetailV2Props (직렬화 가능한 payload만, CTA는 클라이언트에서 주입)
 */

import type { Product, ProductOptions, ItineraryStructuredDay, ItineraryV2 } from "@/types/product";
import type { TravelOverviewModel } from "@/lib/products/mapProductToOverview";
import { mapProductToOverview } from "@/lib/products/mapProductToOverview";
import { buildProductCardInfoBadges } from "@/lib/productCardProps";
import { buildCampaignRepresentativeBadges } from "@/lib/productCampaignBadges";
import { buildCampaignPitchLineFromProduct } from "@/lib/productCampaignPresentation";
import { parseMetaTitleAsHashtags } from "@/lib/products/parseMetaTitleAsHashtags";
import { formatPriceKR } from "@/lib/pricing/calcQuote";
import { getPrimaryImageUrl, normalizeImageList } from "@/lib/products/images";

/** 폼 필드 (API POST body 및 클라이언트 form과 호환) */
export type ProductFormPayload = {
  title?: string;
  description?: string;
  one_liner?: string;
  options_json?: string;
  image_url?: string;
  images_json?: string[];
  category?: string;
  /** 지역 1개 (product_taxonomies.id). 빈 문자열 = 미선택 */
  destination_id?: string;
  theme?: string;
  product_line_id?: string;
  campaigns?: string;
  price?: string;
  duration?: string;
  itinerary?: string;
  inclusions?: string;
  point_benefits?: string;
  point_tourism?: string;
  point_guide?: string;
  meeting_info?: string;
  travel_insurance?: string;
  included_items?: string;
  excluded_items?: string;
  detailed_schedule?: string;
  optional_tours?: string;
  min_departure_people?: string;
  terms_and_notes?: string;
  product_source_url?: string;
  departure_from_airport?: string;
  departure_from_date?: string;
  departure_from_time?: string;
  departure_to_airport?: string;
  departure_to_date?: string;
  departure_to_time?: string;
  departure_flight_name?: string;
  departure_baggage_limit?: string;
  arrival_from_airport?: string;
  arrival_from_date?: string;
  arrival_from_time?: string;
  arrival_to_airport?: string;
  arrival_to_date?: string;
  arrival_to_time?: string;
  arrival_flight_name?: string;
  arrival_baggage_limit?: string;
  meta_title?: string;
  meta_description?: string;
  is_active?: boolean;
  sort_order?: string;
  status?: "" | "AVAILABLE" | "LIMITED" | "SOLD_OUT" | "CONSULT_REQUIRED";
  fuel_included?: "" | "true" | "false";
  price_meta?: string;
  meta_info?: string;
  overview_accommodation?: string;
  overview_region?: string;
  overview_duration?: string;
  itinerary_media_json?: Record<string, string>;
  itinerary_days_json?: ItineraryStructuredDay[];
  itinerary_v2_json?: ItineraryV2;
  theme_chart_json?: Array<{ label: string; percent: number }>;
};

/** 폼 → 미리보기용 Product (저장 API와 동일한 보정 규칙) */
export function formToPreviewProduct(
  form: ProductFormPayload,
  imageUrlForPreview: string,
): Product {
  const priceNum = form.price ? parseInt(String(form.price).replace(/\D/g, ""), 10) : undefined;
  const price =
    priceNum !== undefined && !Number.isNaN(priceNum) ? priceNum : undefined;
  const oneLiner = (
    (form.one_liner?.trim() ||
      form.description?.trim().split(/\n/)[0]?.slice(0, 200) ||
      form.title ||
      "") as string
  ).trim();
  const options = (() => {
    const raw = form.options_json?.trim();
    if (!raw) return undefined;
    try {
      const parsed = JSON.parse(raw) as Record<string, unknown>;
      if (
        parsed &&
        typeof parsed === "object" &&
        Array.isArray(parsed.groups) &&
        (parsed.groups as unknown[]).length > 0
      ) {
        return parsed as ProductOptions;
      }
    } catch {
      /* ignore */
    }
    return undefined;
  })();

  const imagesJson = normalizeImageList(form.images_json);
  const primaryImageUrl = imageUrlForPreview?.trim() || imagesJson[0] || form.image_url?.trim() || "";

  return {
    id: "_preview",
    title: ((form.title?.trim() || "상품명") as string).slice(0, 200),
    description: (form.description?.trim() || "") as string,
    image_url: primaryImageUrl as string,
    images_json: imagesJson.length > 0 ? imagesJson : undefined,
    category: (form.category?.trim() || "여행상품") as string,
    destination_id: form.destination_id?.trim() || null,
    theme: form.theme?.trim() || undefined,
    product_line_id: form.product_line_id?.trim() || null,
    campaigns: (() => {
      const s = form.campaigns?.trim();
      if (!s) return undefined;
      const arr = s.split(/[,\s]+/).map((v) => v.trim()).filter(Boolean);
      return arr.length > 0 ? arr : undefined;
    })(),
    campaigns_json: (() => {
      const s = form.campaigns?.trim();
      if (!s) return undefined;
      const arr = s.split(/[,\s]+/).map((v) => v.trim()).filter(Boolean);
      return arr.length > 0 ? arr : undefined;
    })(),
    price,
    duration: form.duration?.trim() || undefined,
    itinerary: form.itinerary?.trim() || undefined,
    inclusions: form.inclusions?.trim() || undefined,
    point_benefits: form.point_benefits?.trim() || undefined,
    point_tourism: form.point_tourism as "O" | "X" | undefined,
    point_guide: form.point_guide as "O" | "X" | undefined,
    meeting_info: form.meeting_info as "O" | "X" | undefined,
    travel_insurance: form.travel_insurance as "O" | "X" | undefined,
    included_items: form.included_items?.trim() || undefined,
    excluded_items: form.excluded_items?.trim() || undefined,
    detailed_schedule: form.detailed_schedule?.trim() || undefined,
    optional_tours: form.optional_tours?.trim() || undefined,
    min_departure_people: form.min_departure_people?.trim() || undefined,
    terms_and_notes: form.terms_and_notes?.trim() || undefined,
    product_source_url: form.product_source_url?.trim() || undefined,
    departure_from_airport: form.departure_from_airport?.trim() || undefined,
    departure_from_date: form.departure_from_date?.trim() || undefined,
    departure_from_time: form.departure_from_time?.trim() || undefined,
    departure_to_airport: form.departure_to_airport?.trim() || undefined,
    departure_to_date: form.departure_to_date?.trim() || undefined,
    departure_to_time: form.departure_to_time?.trim() || undefined,
    departure_flight_name: form.departure_flight_name?.trim() || undefined,
    departure_baggage_limit: form.departure_baggage_limit?.trim() || undefined,
    arrival_from_airport: form.arrival_from_airport?.trim() || undefined,
    arrival_from_date: form.arrival_from_date?.trim() || undefined,
    arrival_from_time: form.arrival_from_time?.trim() || undefined,
    arrival_to_airport: form.arrival_to_airport?.trim() || undefined,
    arrival_to_date: form.arrival_to_date?.trim() || undefined,
    arrival_to_time: form.arrival_to_time?.trim() || undefined,
    arrival_flight_name: form.arrival_flight_name?.trim() || undefined,
    arrival_baggage_limit: form.arrival_baggage_limit?.trim() || undefined,
    meta_title: form.meta_title?.trim() || undefined,
    meta_description: form.meta_description?.trim() || undefined,
    is_active: form.is_active ?? true,
    sort_order: form.sort_order ? parseInt(String(form.sort_order), 10) : undefined,
    status: form.status || "AVAILABLE",
    fuel_included:
      form.fuel_included === ""
        ? undefined
        : form.fuel_included === "true",
    price_meta: ((form.price_meta?.trim() || "1인 기준") as string) || undefined,
    meta_info: form.meta_info?.trim() || undefined,
    overview_accommodation: form.overview_accommodation?.trim() || undefined,
    overview_region: form.overview_region?.trim() || undefined,
    overview_duration: form.overview_duration?.trim() || undefined,
    one_liner: oneLiner || undefined,
    options,
    itinerary_media_json:
      form.itinerary_media_json && Object.keys(form.itinerary_media_json).length > 0
        ? form.itinerary_media_json
        : undefined,
    itinerary_days_json:
      form.itinerary_days_json && form.itinerary_days_json.length > 0
        ? form.itinerary_days_json
        : undefined,
    itinerary_v2_json:
      form.itinerary_v2_json?.days?.length
        ? form.itinerary_v2_json
        : undefined,
    theme_chart_json: (() => {
      const items = form.theme_chart_json?.filter((i) => i?.label?.trim() && typeof i.percent === "number") ?? [];
      return items.length >= 2 ? { items } : undefined;
    })(),
    // overview는 mapProductToOverview(product)로 자동 생성
  };
}

/** Product → 카드용 props (직렬화 가능, CTA는 클라이언트에서 추가) */
export type ProductCardPropsPayload = {
  title?: string;
  price?: number;
  duration?: string;
  region?: string;
  categories?: string[];
  tags?: string[];
  status?: "AVAILABLE" | "LIMITED" | "SOLD_OUT" | "CONSULT_REQUIRED";
  /** campaign 대표 배지 */
  badges?: { type: string; label: string; priority?: number; isActive?: boolean }[];
  /** 테마·카테고리 정보성 배지 */
  infoBadges?: { type: string; label: string; priority?: number; isActive?: boolean }[];
  thumbnailUrl?: string;
  priceMeta?: string;
  metaInfo?: string;
  /** grid 미리보기 — 피치는 보통 생략 */
  campaignPitchLine?: string;
};

export function productToCardPropsPayload(product: Product): ProductCardPropsPayload {
  return {
    title: product.title,
    price: product.price,
    duration: product.duration,
    region: product.theme,
    categories: [product.category],
    tags: parseMetaTitleAsHashtags(product.meta_title),
    status: (product.status ?? "AVAILABLE") as ProductCardPropsPayload["status"],
    badges: buildCampaignRepresentativeBadges(product),
    infoBadges: buildProductCardInfoBadges(product),
    thumbnailUrl: getPrimaryImageUrl(product),
    priceMeta: product.price_meta || "1인 기준",
    metaInfo: product.meta_info ?? "",
    campaignPitchLine: buildCampaignPitchLineFromProduct(product, "grid"),
  };
}

/** Product → 상세용 props (직렬화 가능, onConsultClick/kakaoHref 등은 클라이언트에서 추가) */
export type ProductDetailV2PropsPayload = {
  title?: string;
  region?: string;
  category?: string;
  statusTag?: "AVAILABLE" | "LIMITED" | "SOLD_OUT" | "CONSULT_REQUIRED";
  oneLiner?: string;
  priceFormatted: string | null;
  duration?: string;
  priceMeta?: string;
  fuelIncluded?: boolean;
  includedItems?: string;
  excludedItems?: string;
  detailedSchedule?: string;
  optionalTours?: string;
  minDeparturePeople?: string;
  termsAndNotes?: string;
  trust?: unknown;
  options?: ProductOptions;
  basePrice?: number;
  /** 있으면 ProductDetailV2가 mapProductToOverview(product)로 오버뷰 자동 생성 */
  product?: Product | null;
  /** product 없을 때만 사용 */
  overviewModel?: TravelOverviewModel | null;
  overviewFallbackUrl?: string;
};

export function productToDetailV2PropsPayload(product: Product): ProductDetailV2PropsPayload {
  const oneLiner =
    product.one_liner?.trim() ||
    product.description?.trim().split(/\n/)[0]?.slice(0, 200) ||
    product.title ||
    "";
  const priceFormatted = product.price != null ? formatPriceKR(product.price) : null;
  return {
    title: product.title,
    region: product.theme,
    category: product.category,
    statusTag: (product.status ?? "AVAILABLE") as ProductDetailV2PropsPayload["statusTag"],
    oneLiner,
    priceFormatted,
    duration: product.duration ?? "",
    priceMeta: product.price_meta || "1인 기준",
    fuelIncluded: product.fuel_included,
    includedItems: product.included_items ?? "",
    excludedItems: product.excluded_items ?? "",
    detailedSchedule: product.detailed_schedule ?? product.itinerary ?? "",
    optionalTours: product.optional_tours ?? "",
    minDeparturePeople: product.min_departure_people ?? "",
    termsAndNotes: product.terms_and_notes ?? "",
    trust: undefined,
    options: product.options,
    basePrice: product.price,
    product,
    overviewModel: mapProductToOverview(product),
    overviewFallbackUrl: getPrimaryImageUrl(product),
  };
}

```


---

## File: `src/lib/products.ts`

```typescript
import { supabase } from "@/lib/supabase";
import { unstable_cache } from "next/cache";
import { CACHE_TAGS } from "@/lib/cacheTags";
import { getTaxonomyById, parseThemeTokens, getCampaignTaxonomiesForCard } from "@/lib/productTaxonomies";
import { hydrateProductsWithCampaignCardMeta } from "@/lib/productCampaignResolve";
import {
  sortRelatedProducts,
  scoreRelatedProduct,
  MIN_RELATED_SCORE,
} from "@/lib/products/relatedProductScoring";
import { normalizeEventImages as normalizeEventImagesLib } from "@/lib/images/normalizeEventImages";
import { dedupeEventImages } from "@/lib/images/dedupeEventImages";
import type {
  Product,
  ProductTrust,
  ProductOptions,
  ProductOptionGroup,
  ProductOptionItem,
  ProductOverview,
  ProductItineraryDay,
  ItineraryStructuredDay,
  ItineraryStructuredEvent,
  ItineraryV2,
  ItineraryV2Event,
} from "@/types/product";
import type { Guide } from "@/types/guide";
import { extractGuideBridgeSearchTokens } from "@/lib/guides";
import { normalizeImageList } from "@/lib/products/images";

const FALLBACK_IMAGE = "https://picsum.photos/seed/thealltour-product/900/560";

function safeUuidOrNull(value: unknown): string | null {
  if (value == null) return null;
  const s = typeof value === "string" ? value.trim() : String(value).trim();
  return s === "" ? null : s;
}

function normalizeStringArray(value: unknown): string[] | undefined {
  if (!Array.isArray(value)) return undefined;
  const arr = value
    .filter((v): v is string => typeof v === "string")
    .map((v) => v.trim())
    .filter(Boolean);
  return arr.length > 0 ? arr : undefined;
}

export function normalizeProduct(row: Record<string, unknown>): Product {
  const rawPrice = row.price;
  const price = typeof rawPrice === "number" ? rawPrice : undefined;
  const sortOrder = typeof row.sort_order === "number" ? row.sort_order : undefined;
  let imagesInput: Array<string | null | undefined> | null = null;
  if (Array.isArray(row.images_json)) {
    imagesInput = row.images_json as Array<string | null | undefined>;
  } else if (typeof row.images_json === "string" && row.images_json.trim()) {
    try {
      const parsed = JSON.parse(row.images_json) as unknown;
      imagesInput = Array.isArray(parsed) ? (parsed as Array<string | null | undefined>) : null;
    } catch {
      imagesInput = null;
    }
  }
  const images = normalizeImageList(imagesInput);
  const primaryImage = images[0] ?? String(row.image_url ?? row.image ?? FALLBACK_IMAGE);

  return {
    id: String(row.id ?? ""),
    title: String(row.title ?? row.name ?? "상품명 미정"),
    description: String(row.description ?? row.content ?? "상세 설명이 준비 중입니다."),
    image_url: primaryImage,
    images_json: images.length > 0 ? images : undefined,
    category: String(row.category ?? row.type ?? "여행상품"),
    theme: typeof row.theme === "string" ? row.theme : undefined,
    destination_id: safeUuidOrNull(row.destination_id),
    product_line_id: safeUuidOrNull(row.product_line_id),
    campaigns: normalizeStringArray(row.campaigns),
    campaigns_json: normalizeStringArray(row.campaigns_json ?? row.campaigns),
    tags: normalizeStringArray(row.tags_json ?? row.tags),
    highlights: normalizeStringArray(row.highlights_json ?? row.highlights),
    price,
    duration:
      typeof row.duration === "string"
        ? row.duration
        : typeof row.duration_days === "number"
          ? `${row.duration_days}일`
          : undefined,
    departure:
      typeof row.departure === "string" && row.departure.trim() !== ""
        ? row.departure.trim()
        : undefined,
    airline:
      typeof row.airline === "string" && row.airline.trim() !== ""
        ? row.airline.trim()
        : undefined,
    hotel:
      typeof row.hotel === "string" && row.hotel.trim() !== ""
        ? row.hotel.trim()
        : undefined,
    travelStyle:
      typeof row.travel_style === "string" && row.travel_style.trim() !== ""
        ? (row.travel_style as string).trim()
        : typeof row.travelStyle === "string" && (row.travelStyle as string).trim() !== ""
          ? (row.travelStyle as string).trim()
          : undefined,
    departures: (() => {
      const raw = row.departures ?? row.departures_json;
      if (Array.isArray(raw)) return normalizeStringArray(raw) ?? undefined;
      if (typeof raw === "string" && raw.trim()) {
        try {
          const parsed = JSON.parse(raw) as unknown;
          return Array.isArray(parsed) ? normalizeStringArray(parsed) ?? undefined : undefined;
        } catch {
          return undefined;
        }
      }
      return undefined;
    })(),
    itinerary: typeof row.itinerary === "string" ? row.itinerary : undefined,
    inclusions: typeof row.inclusions === "string" ? row.inclusions : undefined,
    point_benefits: typeof row.point_benefits === "string" ? row.point_benefits : undefined,
    point_tourism: typeof row.point_tourism === "string" ? row.point_tourism : undefined,
    point_guide: typeof row.point_guide === "string" ? row.point_guide : undefined,
    meeting_info: typeof row.meeting_info === "string" ? row.meeting_info : undefined,
    travel_insurance: typeof row.travel_insurance === "string" ? row.travel_insurance : undefined,
    included_items: typeof row.included_items === "string" ? row.included_items : undefined,
    excluded_items: typeof row.excluded_items === "string" ? row.excluded_items : undefined,
    detailed_schedule: typeof row.detailed_schedule === "string" ? row.detailed_schedule : undefined,
    optional_tours: typeof row.optional_tours === "string" ? row.optional_tours : undefined,
    min_departure_people: typeof row.min_departure_people === "string" ? row.min_departure_people : undefined,
    terms_and_notes: typeof row.terms_and_notes === "string" ? row.terms_and_notes : undefined,
    terms_template_type:
      typeof row.terms_template_type === "string" ? row.terms_template_type : undefined,
    departure_from_airport:
      typeof row.departure_from_airport === "string" ? row.departure_from_airport : undefined,
    departure_from_date:
      typeof row.departure_from_date === "string" ? row.departure_from_date : undefined,
    departure_from_time:
      typeof row.departure_from_time === "string" ? row.departure_from_time : undefined,
    departure_to_airport:
      typeof row.departure_to_airport === "string" ? row.departure_to_airport : undefined,
    departure_to_date:
      typeof row.departure_to_date === "string" ? row.departure_to_date : undefined,
    departure_to_time:
      typeof row.departure_to_time === "string" ? row.departure_to_time : undefined,
    departure_flight_name:
      typeof row.departure_flight_name === "string" ? row.departure_flight_name : undefined,
    departure_baggage_limit:
      typeof row.departure_baggage_limit === "string" ? row.departure_baggage_limit : undefined,
    arrival_from_airport:
      typeof row.arrival_from_airport === "string" ? row.arrival_from_airport : undefined,
    arrival_from_date:
      typeof row.arrival_from_date === "string" ? row.arrival_from_date : undefined,
    arrival_from_time:
      typeof row.arrival_from_time === "string" ? row.arrival_from_time : undefined,
    arrival_to_airport:
      typeof row.arrival_to_airport === "string" ? row.arrival_to_airport : undefined,
    arrival_to_date:
      typeof row.arrival_to_date === "string" ? row.arrival_to_date : undefined,
    arrival_to_time:
      typeof row.arrival_to_time === "string" ? row.arrival_to_time : undefined,
    arrival_flight_name:
      typeof row.arrival_flight_name === "string" ? row.arrival_flight_name : undefined,
    arrival_baggage_limit:
      typeof row.arrival_baggage_limit === "string" ? row.arrival_baggage_limit : undefined,
    meta_title: typeof row.meta_title === "string" ? row.meta_title : undefined,
    meta_description:
      typeof row.meta_description === "string" ? row.meta_description : undefined,
    is_active: typeof row.is_active === "boolean" ? row.is_active : undefined,
    is_recommend: typeof row.is_recommend === "boolean" ? row.is_recommend : undefined,
    is_popular: typeof row.is_popular === "boolean" ? row.is_popular : undefined,
    sort_order: sortOrder,
    created_at: typeof row.created_at === "string" ? row.created_at : undefined,
    status:
      row.status === "AVAILABLE" ||
      row.status === "LIMITED" ||
      row.status === "SOLD_OUT" ||
      row.status === "CONSULT_REQUIRED"
        ? row.status
        : undefined,
    fuel_included:
      row.fuel_included === true ? true : row.fuel_included === false ? false : undefined,
    price_meta:
      typeof row.price_meta === "string" && row.price_meta.trim() !== ""
        ? row.price_meta.trim()
        : undefined,
    meta_info:
      typeof row.meta_info === "string" && row.meta_info.trim() !== ""
        ? row.meta_info.trim()
        : undefined,
    overview_accommodation:
      typeof row.overview_accommodation === "string" && row.overview_accommodation.trim() !== ""
        ? row.overview_accommodation.trim()
        : undefined,
    overview_region:
      typeof row.overview_region === "string" && row.overview_region.trim() !== ""
        ? row.overview_region.trim()
        : undefined,
    overview_duration:
      typeof row.overview_duration === "string" && row.overview_duration.trim() !== ""
        ? row.overview_duration.trim()
        : undefined,
    one_liner:
      typeof row.one_liner === "string" && row.one_liner.trim() !== ""
        ? row.one_liner.trim()
        : undefined,
    overview_json: normalizeOverview(row.overview_json),
    itinerary_media_json: normalizeItineraryMedia(row.itinerary_media_json),
    itinerary_days: normalizeProductItineraryDays(row.itinerary_days ?? row.itinerary_days_simple),
    itinerary_days_json: normalizeItineraryDays(row.itinerary_days_json),
    itinerary_v2_json: normalizeItineraryV2(row.itinerary_v2_json),
    theme_chart_json: normalizeThemeChartJson(row.theme_chart_json),
    trust: normalizeTrust(row.trust),
    options: normalizeOptions(row.options, typeof row.price === "number" ? row.price : undefined),
  };
}

function normalizeThemeChartJson(raw: unknown): { items: Array<{ label: string; percent: number }> } | undefined {
  if (!raw || typeof raw !== "object") return undefined;
  const o = raw as Record<string, unknown>;
  const items = o.items;
  if (!Array.isArray(items) || items.length < 2) return undefined;
  const parsed = items
    .filter((i): i is Record<string, unknown> => i != null && typeof i === "object")
    .map((i) => {
      const label = typeof i.label === "string" ? i.label.trim() : "";
      const percent = typeof i.percent === "number" ? i.percent : Number(i.percent);
      return { label, percent: Number.isNaN(percent) ? 0 : Math.max(0, Math.min(100, percent)) };
    })
    .filter((i) => i.label.length > 0);
  return parsed.length >= 2 ? { items: parsed } : undefined;
}

const OVERVIEW_SUMMARY_KINDS = ["flight", "hotel", "region", "theme", "golf", "etc"] as const;

function normalizeItineraryMedia(raw: unknown): Record<string, string> | undefined {
  if (!raw || typeof raw !== "object") return undefined;
  const o = raw as Record<string, unknown>;
  const result: Record<string, string> = {};
  for (const [key, value] of Object.entries(o)) {
    if (typeof value === "string" && value.trim()) result[key] = value.trim();
  }
  return Object.keys(result).length > 0 ? result : undefined;
}

/** PR42: ProductItineraryTimeline용 일차 배열 정규화 (day, title, subtitle, description, meals, hotel) */
function normalizeProductItineraryDays(raw: unknown): ProductItineraryDay[] | undefined {
  if (!raw) return undefined;
  let arr: unknown[];
  if (Array.isArray(raw)) {
    arr = raw;
  } else if (typeof raw === "string" && raw.trim()) {
    try {
      const parsed = JSON.parse(raw) as unknown;
      arr = Array.isArray(parsed) ? parsed : [];
    } catch {
      return undefined;
    }
  } else {
    return undefined;
  }
  const days: ProductItineraryDay[] = [];
  for (const item of arr) {
    if (!item || typeof item !== "object") continue;
    const o = item as Record<string, unknown>;
    const day =
      typeof o.day === "number"
        ? o.day
        : typeof o.day === "string"
          ? parseInt(String(o.day).trim(), 10)
          : undefined;
    if (day == null || !Number.isFinite(day) || day < 1) continue;
    const title = typeof o.title === "string" && o.title.trim() ? o.title.trim() : undefined;
    const subtitle = typeof o.subtitle === "string" && o.subtitle.trim() ? o.subtitle.trim() : undefined;
    const description =
      typeof o.description === "string" && o.description.trim() ? o.description.trim() : undefined;
    let meals: string[] | undefined;
    if (Array.isArray(o.meals)) {
      meals = (o.meals as unknown[])
        .filter((m): m is string => typeof m === "string" && String(m).trim().length > 0)
        .map((m) => String(m).trim());
      if (meals.length === 0) meals = undefined;
    }
    const hotel = typeof o.hotel === "string" && o.hotel.trim() ? o.hotel.trim() : undefined;
    days.push({ day, title, subtitle, description, meals, hotel });
  }
  return days.length > 0 ? days : undefined;
}

function normalizeItineraryDays(raw: unknown): ItineraryStructuredDay[] | undefined {
  if (!Array.isArray(raw) || raw.length === 0) return undefined;
  const days: ItineraryStructuredDay[] = [];
  for (const item of raw) {
    if (!item || typeof item !== "object") continue;
    const o = item as Record<string, unknown>;
    const day = typeof o.day === "number" ? o.day : typeof o.day === "string" ? parseInt(o.day, 10) : undefined;
    if (day == null || !Number.isFinite(day) || day < 1) continue;
    const events = Array.isArray(o.events)
      ? (o.events as Array<Record<string, unknown>>)
          .map((e) => {
            const heading = typeof e.heading === "string" ? e.heading.trim() : "";
            if (!heading) return null;
            return {
              heading,
              description:
                typeof e.description === "string" && e.description.trim()
                  ? e.description.trim()
                  : undefined,
              timeOfDay:
                e.timeOfDay === "오전" ||
                e.timeOfDay === "오후" ||
                e.timeOfDay === "저녁" ||
                e.timeOfDay === "종일"
                  ? (e.timeOfDay as ItineraryStructuredEvent["timeOfDay"])
                  : undefined,
              iconKey:
                typeof e.iconKey === "string" && e.iconKey.trim() ? e.iconKey.trim() : undefined,
              images: normalizeEventImages(e.images),
            };
          })
          .filter((x): x is NonNullable<typeof x> => x !== null)
      : [];
    days.push({
      day,
      dateText: typeof o.dateText === "string" && o.dateText.trim() ? o.dateText.trim() : undefined,
      title: typeof o.title === "string" && o.title.trim() ? o.title.trim() : undefined,
      coverImageUrl:
        o.coverImageUrl == null || (typeof o.coverImageUrl === "string" && o.coverImageUrl.trim() === "")
          ? undefined
          : typeof o.coverImageUrl === "string"
            ? o.coverImageUrl.trim()
            : null,
      events,
    });
  }
  return days.length > 0 ? days : undefined;
}

/** event.images 정규화: lib/images 규칙 사용 (products 로드 시 editor와 동일 규칙) */
function normalizeEventImages(raw: unknown): ItineraryV2Event["images"] {
  if (!raw || !Array.isArray(raw)) return undefined;
  const normalized = normalizeEventImagesLib(raw);
  const deduped = dedupeEventImages(normalized);
  return deduped.length > 0 ? deduped : undefined;
}

function normalizeItineraryV2(raw: unknown): ItineraryV2 | undefined {
  if (raw == null) return undefined;
  let o: Record<string, unknown>;
  if (typeof raw === "string") {
    try {
      const parsed = JSON.parse(raw) as unknown;
      if (!parsed || typeof parsed !== "object") return undefined;
      o = parsed as Record<string, unknown>;
    } catch {
      return undefined;
    }
  } else if (typeof raw === "object") {
    o = raw as Record<string, unknown>;
  } else {
    return undefined;
  }
  const rawDays = Array.isArray(o.days) ? o.days : [];
  if (rawDays.length === 0) return undefined;
  const days: ItineraryV2["days"] = [];
  for (const item of rawDays) {
    if (!item || typeof item !== "object") continue;
    const d = item as Record<string, unknown>;
    const day = typeof d.day === "number" ? d.day : typeof d.day === "string" ? parseInt(d.day, 10) : undefined;
    if (day == null || !Number.isFinite(day) || day < 1) continue;
    const rawEvents = Array.isArray(d.events) ? d.events : [];
    const events = rawEvents
      .map((e: unknown) => {
        if (!e || typeof e !== "object") return null;
        const ev = e as Record<string, unknown>;
        const heading = typeof ev.heading === "string" ? ev.heading.trim() : "";
        if (!heading) return null;
        return {
          timeOfDay:
            ev.timeOfDay === "오전" ||
            ev.timeOfDay === "오후" ||
            ev.timeOfDay === "저녁" ||
            ev.timeOfDay === "종일"
              ? (ev.timeOfDay as ItineraryV2Event["timeOfDay"])
              : undefined,
          timeText:
            typeof ev.timeText === "string" && ev.timeText.trim() ? ev.timeText.trim() : undefined,
          iconKey:
            typeof ev.iconKey === "string" && ev.iconKey.trim() ? ev.iconKey.trim() : undefined,
          heading,
          description:
            typeof ev.description === "string" && ev.description.trim()
              ? ev.description.trim()
              : undefined,
          location:
            typeof ev.location === "string" && ev.location.trim()
              ? ev.location.trim()
              : undefined,
          order: typeof ev.order === "number" && Number.isFinite(ev.order) ? ev.order : undefined,
          images: normalizeEventImages(ev.images),
        };
      })
      .filter((x): x is NonNullable<typeof x> => x !== null);
    days.push({
      day,
      dateText: typeof d.dateText === "string" && d.dateText.trim() ? d.dateText.trim() : undefined,
      title: typeof d.title === "string" && d.title.trim() ? d.title.trim() : undefined,
      coverImageUrl: typeof d.coverImageUrl === "string" && d.coverImageUrl.trim() ? d.coverImageUrl.trim() : undefined,
      events,
    });
  }
  return days.length > 0 ? { days } : undefined;
}

export function normalizeOverview(raw: unknown): ProductOverview | undefined {
  if (!raw || typeof raw !== "object") return undefined;
  const o = raw as Record<string, unknown>;

  // 새 스키마 (enabled, summaryCards with kind, chart, timeline)
  if (typeof o.enabled === "boolean") {
    const summaryCards = Array.isArray(o.summaryCards)
      ? (o.summaryCards as Array<{ kind?: string; label?: string; value?: string }>)
          .filter(
            (c) =>
              c &&
              typeof c.label === "string" &&
              typeof c.value === "string" &&
              OVERVIEW_SUMMARY_KINDS.includes((c.kind ?? "etc") as (typeof OVERVIEW_SUMMARY_KINDS)[number]),
          )
          .map((c) => ({
            kind: (OVERVIEW_SUMMARY_KINDS.includes((c.kind ?? "etc") as (typeof OVERVIEW_SUMMARY_KINDS)[number])
              ? c.kind
              : "etc") as (typeof OVERVIEW_SUMMARY_KINDS)[number],
            label: c.label!,
            value: c.value!,
          }))
      : [];
    const chart =
      o.chart && typeof o.chart === "object"
        ? (() => {
            const ch = o.chart as Record<string, unknown>;
            if (ch.enabled !== true) return undefined;
            const items = Array.isArray(ch.items)
              ? (ch.items as Array<{ label?: string; percent?: number }>)
                  .filter((i) => i && typeof i.label === "string" && typeof i.percent === "number")
                  .map((i) => ({ label: i.label!, percent: i.percent! }))
              : [];
            return items.length > 0 ? { enabled: true, items } : undefined;
          })()
        : undefined;
    const timeline =
      o.timeline && typeof o.timeline === "object"
        ? (() => {
            const tl = o.timeline as Record<string, unknown>;
            if (tl.enabled !== true) return undefined;
            const days = Array.isArray(tl.days)
              ? (tl.days as Array<{ day?: number; dateText?: string; headline?: string; bullets?: unknown }>)
                  .filter(
                    (d) =>
                      d &&
                      typeof d.day === "number" &&
                      Array.isArray(d.bullets) &&
                      (d.bullets as unknown[]).every((b) => typeof b === "string"),
                  )
                  .map((d) => ({
                    day: d.day!,
                    dateText: typeof d.dateText === "string" ? d.dateText : undefined,
                    headline: typeof d.headline === "string" ? d.headline : undefined,
                    bullets: d.bullets as string[],
                  }))
              : [];
            return days.length > 0 ? { enabled: true, days } : undefined;
          })()
        : undefined;
    const coverImageUrl =
      typeof o.coverImageUrl === "string" && o.coverImageUrl.trim() !== "" ? o.coverImageUrl.trim() : undefined;
    const title = typeof o.title === "string" && o.title.trim() !== "" ? o.title.trim() : undefined;
    return {
      enabled: o.enabled,
      title,
      summaryCards,
      coverImageUrl,
      chart,
      timeline,
    };
  }

  // 구 스키마 호환 (summaryCards, themeChart, days) → 새 스키마로 변환
  const legacySummaryCards = Array.isArray(o.summaryCards)
    ? (o.summaryCards as Array<{ label?: string; value?: string }>)
        .filter((c) => c && typeof c.label === "string" && typeof c.value === "string")
        .map((c) => ({ kind: "etc" as const, label: c.label!, value: c.value! }))
    : [];
  const themeChart = o.themeChart && typeof o.themeChart === "object" ? (o.themeChart as Record<string, unknown>) : null;
  const chartItems =
    themeChart && Array.isArray(themeChart.labels) && Array.isArray(themeChart.values)
      ? (themeChart.labels as string[]).map((label, i) => {
          const values = themeChart.values as number[];
          const total = values.reduce((a, b) => a + b, 0);
          const percent = total > 0 ? Math.round(((values[i] ?? 0) / total) * 100) : 0;
          return { label, percent };
        })
      : [];
  const legacyDays = Array.isArray(o.days)
    ? (o.days as Array<{ day?: string; summary?: string }>)
        .filter((d) => d && typeof d.day === "string" && typeof d.summary === "string")
        .map((d) => ({
          day: parseInt(d.day!, 10) || 1,
          bullets: d.summary!.split(/\n/).filter((b) => b.trim()),
        }))
    : [];
  const hasData = legacySummaryCards.length > 0 || chartItems.length > 0 || legacyDays.length > 0;
  if (!hasData) return undefined;
  return {
    enabled: true,
    summaryCards: legacySummaryCards,
    chart: chartItems.length > 0 ? { enabled: true, items: chartItems } : undefined,
    timeline: legacyDays.length > 0 ? { enabled: true, days: legacyDays } : undefined,
  };
}

function normalizeTrust(raw: unknown): ProductTrust | undefined {
  if (!raw || typeof raw !== "object") return undefined;
  const o = raw as Record<string, unknown>;
  const recentConsultCount = typeof o.recentConsultCount === "number" ? o.recentConsultCount : undefined;
  const recentDays = typeof o.recentDays === "number" ? o.recentDays : undefined;
  const totalInquiries = typeof o.totalInquiries === "number" ? o.totalInquiries : undefined;
  const ratingAvg = typeof o.ratingAvg === "number" ? o.ratingAvg : undefined;
  const reviewCount = typeof o.reviewCount === "number" ? o.reviewCount : undefined;
  if (
    recentConsultCount === undefined &&
    recentDays === undefined &&
    totalInquiries === undefined &&
    ratingAvg === undefined &&
    reviewCount === undefined
  ) {
    return undefined;
  }
  return {
    recentConsultCount,
    recentDays,
    totalInquiries,
    ratingAvg,
    reviewCount,
  };
}

function normalizeOptionItem(raw: unknown): ProductOptionItem | null {
  if (!raw || typeof raw !== "object") return null;
  const o = raw as Record<string, unknown>;
  const value = typeof o.value === "string" ? o.value : typeof o.id === "string" ? o.id : undefined;
  const label = typeof o.label === "string" ? o.label : undefined;
  if (!value || !label) return null;
  return {
    value,
    label,
    priceDelta: typeof o.priceDelta === "number" ? o.priceDelta : undefined,
    meta: typeof o.meta === "string" ? o.meta : undefined,
    isDefault: o.isDefault === true,
  };
}

function normalizeOptionGroup(raw: unknown): ProductOptionGroup | null {
  if (!raw || typeof raw !== "object") return null;
  const o = raw as Record<string, unknown>;
  const key = typeof o.key === "string" ? o.key : typeof o.id === "string" ? o.id : undefined;
  const title = typeof o.title === "string" ? o.title : typeof o.label === "string" ? o.label : undefined;
  const type =
    o.type === "radio" || o.type === "select" || o.type === "stepper" || o.type === "multi"
      ? o.type
      : "radio";
  const rawItems = Array.isArray(o.items) ? o.items : Array.isArray(o.options) ? o.options : [];
  const items = rawItems.map((item: unknown) => normalizeOptionItem(item)).filter((x): x is ProductOptionItem => x !== null);
  if (!key || !title || items.length === 0) return null;
  return { key, title, type, items };
}

/** 신규: { basePrice, currency, groups }. 레거시: 그룹 배열 → basePrice는 productPrice 사용 */
function normalizeOptions(raw: unknown, productPrice?: number): ProductOptions | undefined {
  const fallbackBase = typeof productPrice === "number" ? productPrice : 0;

  if (raw && typeof raw === "object" && !Array.isArray(raw)) {
    const o = raw as Record<string, unknown>;
    const basePrice = typeof o.basePrice === "number" ? o.basePrice : fallbackBase;
    const currency = o.currency === "KRW" ? "KRW" : "KRW";
    const rawGroups = Array.isArray(o.groups) ? o.groups : [];
    const groups = rawGroups.map((g: unknown) => normalizeOptionGroup(g)).filter((x): x is ProductOptionGroup => x !== null);
    const requiredGroups = Array.isArray(o.requiredGroups)
      ? (o.requiredGroups as string[]).filter((k): k is string => typeof k === "string")
      : undefined;
    if (groups.length === 0) return undefined;
    return { basePrice, currency, requiredGroups, groups };
  }

  if (!Array.isArray(raw) || raw.length === 0) return undefined;
  const legacyGroups = raw.map((item: unknown) => normalizeOptionGroup(item)).filter((x): x is ProductOptionGroup => x !== null);
  if (legacyGroups.length === 0) return undefined;
  const requiredKeys = (raw as Record<string, unknown>[])
    .filter((r) => r.required === true)
    .map((r) => (typeof r.key === "string" ? r.key : typeof r.id === "string" ? r.id : null))
    .filter((k): k is string => k != null);
  return {
    basePrice: fallbackBase,
    currency: "KRW",
    requiredGroups: requiredKeys.length > 0 ? requiredKeys : undefined,
    groups: legacyGroups,
  };
}

/** 패키지상품 목록용: is_active인 전체 상품 (추천 여부 무관) */
export async function getProducts() {
  return getProductsCached();
}

/** 가이드 상세용: guide의 destination_id / theme_id 기준 관련 상품. destination 우선, theme 보조, 최대 limit(기본 6). */
export async function getProductsForGuide(
  guide: { destination_id?: string | null; theme_id?: string | null },
  limit = 6,
): Promise<Product[]> {
  const products = await getProducts();
  if (products.length === 0) return [];

  const destinationId = guide.destination_id?.trim() || null;
  const themeId = guide.theme_id?.trim() || null;

  const byDestination =
    destinationId != null
      ? products.filter((p) => p.destination_id === destinationId)
      : [];
  let byTheme: Product[] = [];
  if (themeId) {
    const themeTax = await getTaxonomyById(themeId);
    const themeNameLower = themeTax?.name?.trim().toLowerCase();
    if (themeNameLower) {
      byTheme = products.filter((p) => {
        const tokens = parseThemeTokens(p.theme).map((t) => t.toLowerCase());
        return tokens.some(
          (t) =>
            t === themeNameLower ||
            t.includes(themeNameLower) ||
            themeNameLower.includes(t),
        );
      });
    }
  }

  const seen = new Set<string>();
  const merged: Product[] = [];
  for (const p of byDestination) {
    if (!seen.has(p.id)) {
      seen.add(p.id);
      merged.push(p);
    }
  }
  for (const p of byTheme) {
    if (!seen.has(p.id) && merged.length < limit) {
      seen.add(p.id);
      merged.push(p);
    }
  }
  return merged.slice(0, limit);
}

/** 브리지 추천 점수 계산용 컨텍스트 (가이드 1건당 1회 생성) */
export type GuideBridgeRecContext = {
  guideDestinationId: string | null;
  guideThemeId: string | null;
  themeNameLower: string | null;
  destinationNameLower: string | null;
  searchTokens: string[];
};

export type GuideBridgeScoredProduct = {
  product: Product;
  score: number;
  reasons: string[];
};

export type GuideBridgeRecommendationsOptions = {
  totalLimit?: number;
  /** 개발 점검용: 점수·사유 배열 (프로덕션 UI에 노출 금지) */
  includeDebug?: boolean;
};

export type GuideBridgeProductDebugEntry = {
  productId: string;
  title: string;
  score: number;
  reasons: string[];
};

export type GuideBridgeRecommendations = {
  /** score > 0 상위 3 (soft diversity 적용, 폴백 미포함) */
  primary: Product[];
  /** 그 다음 score > 0 최대 6건 (동일 규칙) */
  secondary: Product[];
  /** score === 0 전체(정렬 순). `all` 끝에서만 보충 */
  fallback: Product[];
  /** primary + secondary + 남은 양수 점수 + 폴백, totalLimit까지 */
  all: Product[];
  debug?: GuideBridgeProductDebugEntry[];
};

const SCORE_DESTINATION_EXACT = 100;
const SCORE_THEME_TOKEN_EXACT = 60;
const SCORE_THEME_TOKEN_PARTIAL = 35;
const SCORE_TOKEN_TITLE = 25;
const SCORE_TOKEN_CATEGORY = 18;
const SCORE_TOKEN_THEME = 20;
const SCORE_TOKEN_DESCRIPTION = 8;
const SCORE_BONUS_TOKENS_2 = 10;
const SCORE_BONUS_TOKENS_3 = 18;
const SCORE_BONUS_TOKENS_4 = 25;

function compareGuideBridgeScored(
  a: GuideBridgeScoredProduct,
  b: GuideBridgeScoredProduct,
): number {
  if (b.score !== a.score) return b.score - a.score;
  const oa = a.product.sort_order ?? 1e9;
  const ob = b.product.sort_order ?? 1e9;
  if (oa !== ob) return oa - ob;
  return (b.product.created_at ?? "").localeCompare(a.product.created_at ?? "");
}

function compareProductsFallbackOrder(a: Product, b: Product): number {
  const oa = a.sort_order ?? 1e9;
  const ob = b.sort_order ?? 1e9;
  if (oa !== ob) return oa - ob;
  return (b.created_at ?? "").localeCompare(a.created_at ?? "");
}

/** 가이드 1건에 대한 추천용 컨텍스트 (taxonomy 이름 + 정제 토큰) */
export async function buildGuideRecommendationContext(guide: Guide): Promise<GuideBridgeRecContext> {
  const destId = guide.destination_id?.trim() || null;
  const themeId = guide.theme_id?.trim() || null;
  const [destTax, themeTax] = await Promise.all([
    destId ? getTaxonomyById(destId) : Promise.resolve(null),
    themeId ? getTaxonomyById(themeId) : Promise.resolve(null),
  ]);
  const destinationNameLower =
    (destTax?.name ?? guide.destination_name)?.trim().toLowerCase() || null;
  const themeNameLower = (themeTax?.name ?? guide.theme_name)?.trim().toLowerCase() || null;

  const searchTokens = extractGuideBridgeSearchTokens(guide, {
    destinationLower: destinationNameLower,
    themeLower: themeNameLower,
  });

  return {
    guideDestinationId: destId,
    guideThemeId: themeId,
    themeNameLower,
    destinationNameLower,
    searchTokens,
  };
}

/**
 * 단일 상품의 가이드 브리지 관련도 점수.
 * destination_id 일치 > 테마 토큰 > 제목·카테고리·테마·설명 토큰(가중치 상이) > 다중 토큰 보너스.
 */
export function scoreProductForGuideBridge(
  product: Product,
  ctx: GuideBridgeRecContext,
): GuideBridgeScoredProduct {
  let score = 0;
  const reasons: string[] = [];

  const titleL = product.title?.toLowerCase() ?? "";
  const catL = product.category?.toLowerCase() ?? "";
  const themeStrL = (product.theme ?? "").toLowerCase();
  const descL = (product.description ?? "").toLowerCase();
  const themeTokens = parseThemeTokens(product.theme).map((t) => t.toLowerCase());

  const gDest = ctx.guideDestinationId;
  if (gDest && product.destination_id === gDest) {
    score += SCORE_DESTINATION_EXACT;
    reasons.push("destination:exact");
  }

  const tn = ctx.themeNameLower;
  if (tn) {
    const exactTok = themeTokens.some((t) => t === tn);
    const partialTok =
      !exactTok &&
      themeTokens.some((t) => t.includes(tn) || tn.includes(t));
    const inThemeStr =
      !exactTok &&
      !partialTok &&
      (themeStrL.includes(tn) || titleL.includes(tn) || catL.includes(tn));

    if (exactTok) {
      score += SCORE_THEME_TOKEN_EXACT;
      reasons.push("theme:exact-token");
    } else if (partialTok) {
      score += SCORE_THEME_TOKEN_PARTIAL;
      reasons.push("theme:partial-token");
    } else if (inThemeStr && (themeStrL.includes(tn) || themeTokens.length === 0)) {
      score += SCORE_THEME_TOKEN_PARTIAL;
      reasons.push("theme:string-match");
    }
  }

  const uniqueTokensMatched = new Set<string>();

  for (const tok of ctx.searchTokens) {
    if (!tok || tok.length < 2) continue;
    if (titleL.includes(tok)) {
      score += SCORE_TOKEN_TITLE;
      reasons.push(`token:title=${tok}`);
      uniqueTokensMatched.add(tok);
    }
    if (catL.includes(tok)) {
      score += SCORE_TOKEN_CATEGORY;
      reasons.push(`token:category=${tok}`);
      uniqueTokensMatched.add(tok);
    }
    if (themeStrL.includes(tok)) {
      score += SCORE_TOKEN_THEME;
      reasons.push(`token:theme=${tok}`);
      uniqueTokensMatched.add(tok);
    }
    if (descL.includes(tok)) {
      score += SCORE_TOKEN_DESCRIPTION;
      reasons.push(`token:description=${tok}`);
      uniqueTokensMatched.add(tok);
    }
  }

  const n = uniqueTokensMatched.size;
  if (n >= 4) {
    score += SCORE_BONUS_TOKENS_4;
    reasons.push("bonus:unique-tokens>=4");
  } else if (n >= 3) {
    score += SCORE_BONUS_TOKENS_3;
    reasons.push("bonus:unique-tokens>=3");
  } else if (n >= 2) {
    score += SCORE_BONUS_TOKENS_2;
    reasons.push("bonus:unique-tokens>=2");
  }

  return { product, score, reasons };
}

/** score > 0 목록에서 상위 take건을 고를 때, 동일 destination/category 연속만 완화 */
function softDiversityPick(
  poolInput: GuideBridgeScoredProduct[],
  take: number,
): GuideBridgeScoredProduct[] {
  const pool = [...poolInput].sort(compareGuideBridgeScored);
  const out: GuideBridgeScoredProduct[] = [];

  while (out.length < take && pool.length > 0) {
    if (out.length < 2) {
      out.push(pool.shift()!);
      continue;
    }

    const prev2 = out[out.length - 2]!;
    const prev1 = out[out.length - 1]!;
    const top = pool[0]!;

    let pickIdx = 0;
    const dest2 = prev2.product.destination_id ?? "";
    const dest1 = prev1.product.destination_id ?? "";
    const topDest = top.product.destination_id ?? "";
    if (dest2 && dest2 === dest1 && topDest === dest2) {
      const alt = pool.findIndex(
        (c, i) =>
          i > 0 &&
          (c.product.destination_id ?? "") !== dest2 &&
          c.score >= top.score - 25,
      );
      if (alt !== -1) pickIdx = alt;
    } else {
      const cat2 = (prev2.product.category ?? "").toLowerCase();
      const cat1 = (prev1.product.category ?? "").toLowerCase();
      const topCat = (top.product.category ?? "").toLowerCase();
      if (cat1 && cat2 === cat1 && topCat === cat1) {
        const alt = pool.findIndex(
          (c, i) =>
            i > 0 &&
            (c.product.category ?? "").toLowerCase() !== cat1 &&
            c.score >= top.score - 15,
        );
        if (alt !== -1) pickIdx = alt;
      }
    }

    const [picked] = pool.splice(pickIdx, 1);
    out.push(picked);
  }

  return out;
}

/**
 * 가이드 브리지: 점수 정렬 + 폴백 분리 + primary(3) / secondary(6) / fallback.
 */
export async function getGuideBridgeRecommendations(
  guide: Guide,
  options?: GuideBridgeRecommendationsOptions,
): Promise<GuideBridgeRecommendations> {
  const products = await getProducts();
  if (products.length === 0) {
    return { primary: [], secondary: [], fallback: [], all: [] };
  }

  const totalLimit = Math.max(1, options?.totalLimit ?? 18);
  const ctx = await buildGuideRecommendationContext(guide);

  const scored = products.map((p) => scoreProductForGuideBridge(p, ctx));
  const positive = scored.filter((s) => s.score > 0).sort(compareGuideBridgeScored);
  const zeroProducts = scored
    .filter((s) => s.score === 0)
    .map((s) => s.product)
    .sort(compareProductsFallbackOrder);

  const headPick = softDiversityPick(positive, 9);
  const headIds = new Set(headPick.map((s) => s.product.id));
  const remainingPositive = positive.filter((s) => !headIds.has(s.product.id));

  const primary = headPick.slice(0, 3).map((s) => s.product);
  const secondary = headPick.slice(3, 9).map((s) => s.product);

  const all: Product[] = [];
  const seen = new Set<string>();
  const pushUnique = (p: Product) => {
    if (seen.has(p.id)) return;
    seen.add(p.id);
    if (all.length < totalLimit) all.push(p);
  };

  for (const p of primary) pushUnique(p);
  for (const p of secondary) pushUnique(p);
  for (const s of remainingPositive) pushUnique(s.product);
  for (const p of zeroProducts) pushUnique(p);

  const debug: GuideBridgeProductDebugEntry[] | undefined = options?.includeDebug
    ? scored
        .slice()
        .sort(compareGuideBridgeScored)
        .map((s) => ({
          productId: s.product.id,
          title: s.product.title,
          score: s.score,
          reasons: s.reasons,
        }))
    : undefined;

  return {
    primary,
    secondary,
    fallback: zeroProducts,
    all,
    ...(debug ? { debug } : {}),
  };
}

/**
 * 가이드 브리지(/guides/[slug]): 점수 기반 추천 후 `all`만 반환 (기존 호출 호환).
 */
export async function getRecommendedProductsForGuideBridge(
  guide: Guide,
  limit = 18,
): Promise<Product[]> {
  const { all } = await getGuideBridgeRecommendations(guide, { totalLimit: limit });
  return all;
}

/** PR31/PR35: 상품 상세 하단 추천용. 관련도 점수 기반 정렬, 현재 상품 제외, 품질 임계값 적용, 최대 limit(기본 6). */
export async function getRelatedProducts(
  currentProduct: Product,
  limit = 6,
): Promise<Product[]> {
  const products = await getProducts();
  const sorted = sortRelatedProducts(currentProduct, products);
  const withScore = sorted.filter(
    (p) => scoreRelatedProduct(currentProduct, p) >= MIN_RELATED_SCORE,
  );
  return withScore.slice(0, limit);
}

const getProductsCached = unstable_cache(
  async () => {
    const [advancedQuery, campaignTaxonomies] = await Promise.all([
      supabase
        .from("products")
        .select("*")
        .eq("is_active", true)
        .order("sort_order", { ascending: true, nullsFirst: false })
        .order("created_at", { ascending: false, nullsFirst: false }),
      getCampaignTaxonomiesForCard(),
    ]);

    let rows: Record<string, unknown>[] = [];
    if (!advancedQuery.error) {
      rows = (advancedQuery.data ?? []) as Record<string, unknown>[];
    } else {
      const fallbackQuery = await supabase.from("products").select("*");
      if (fallbackQuery.error) {
        console.error("[products] list fetch error:", fallbackQuery.error.message);
        return [] as Product[];
      }
      rows = (fallbackQuery.data ?? []) as Record<string, unknown>[];
    }

    const normalized = rows.map((row) => normalizeProduct(row));
    return hydrateProductsWithCampaignCardMeta(normalized, campaignTaxonomies);
  },
  ["products:list"],
  { revalidate: 60, tags: [CACHE_TAGS.PRODUCTS] },
);

export async function getProductById(id: string) {
  return getProductByIdCached(id);
}

/** 상세 페이지용: 캐시 없이 항상 최신 데이터 조회 (수정 저장 후 즉시 반영) */
export async function getProductByIdFresh(id: string) {
  const [{ data, error }, campaignTaxonomies] = await Promise.all([
    supabase.from("products").select("*").eq("id", id).maybeSingle(),
    getCampaignTaxonomiesForCard(),
  ]);

  if (error || !data) {
    return null;
  }

  const p = normalizeProduct(data as Record<string, unknown>);
  return hydrateProductsWithCampaignCardMeta([p], campaignTaxonomies)[0]!;
}

const getProductByIdCached = unstable_cache(
  async (id: string) => {
    const [{ data, error }, campaignTaxonomies] = await Promise.all([
      supabase.from("products").select("*").eq("id", id).maybeSingle(),
      getCampaignTaxonomiesForCard(),
    ]);

    if (error || !data) {
      return null;
    }

    const p = normalizeProduct(data as Record<string, unknown>);
    return hydrateProductsWithCampaignCardMeta([p], campaignTaxonomies)[0]!;
  },
  ["products:by-id"],
  { revalidate: 120, tags: [CACHE_TAGS.PRODUCTS] },
);

```


---

## File: `src/lib/products/getRelatedProducts.ts`

```typescript
import type { Product } from "@/types/product";
import {
  sortRelatedProducts,
  scoreRelatedProduct,
  MIN_RELATED_SCORE,
} from "@/lib/products/relatedProductScoring";

export type GetRelatedProductsParams = {
  currentProduct?: Product | null;
  allProducts?: Product[];
  limit?: number;
};

/**
 * PR43: 현재 상품 기준 연관 상품 목록 반환.
 * - 현재 상품 제외
 * - 관련도(destination_id > theme > category/product_line_id) 순 정렬
 * - score가 MIN_RELATED_SCORE 미만인 상품 제외 후, 부족분은 fallback으로 채움
 */
export function getRelatedProducts({
  currentProduct,
  allProducts,
  limit = 6,
}: GetRelatedProductsParams): Product[] {
  if (!currentProduct?.id?.trim() || !Array.isArray(allProducts)) {
    return [];
  }
  const sorted = sortRelatedProducts(currentProduct, allProducts);
  const matched = sorted.filter(
    (p) => scoreRelatedProduct(currentProduct, p) >= MIN_RELATED_SCORE,
  );
  const top = matched.slice(0, limit);

  if (top.length >= limit) return top;

  const topIds = new Set(top.map((p) => p.id));
  const fallback = sorted.filter((p) => !topIds.has(p.id));
  return [...top, ...fallback].slice(0, limit);
}

```


---

## File: `src/app/api/admin/products/[id]/route.ts`

```typescript
import { NextResponse } from "next/server";
import { revalidatePath, revalidateTag } from "next/cache";
import { CACHE_TAGS, REVALIDATE_MAX } from "@/lib/cacheTags";
import { supabase } from "@/lib/supabase";
import type { ItineraryV2 } from "@/types/product";

function isMissingImagesJsonColumn(message?: string): boolean {
  if (!message) return false;
  const normalized = message.toLowerCase();
  return normalized.includes("images_json") && normalized.includes("column");
}

type ProductBody = {
  title?: string;
  description?: string;
  product_source_url?: string | null;
  point_benefits?: string | null;
  point_tourism?: string | null;
  point_guide?: string | null;
  meeting_info?: string | null;
  travel_insurance?: string | null;
  included_items?: string | null;
  excluded_items?: string | null;
  detailed_schedule?: string | null;
  optional_tours?: string | null;
  min_departure_people?: string | null;
  terms_and_notes?: string | null;
  terms_template_type?: string | null;
  departure_from_airport?: string | null;
  departure_from_date?: string | null;
  departure_from_time?: string | null;
  departure_to_airport?: string | null;
  departure_to_date?: string | null;
  departure_to_time?: string | null;
  departure_flight_name?: string | null;
  departure_baggage_limit?: string | null;
  arrival_from_airport?: string | null;
  arrival_from_date?: string | null;
  arrival_from_time?: string | null;
  arrival_to_airport?: string | null;
  arrival_to_date?: string | null;
  arrival_to_time?: string | null;
  arrival_flight_name?: string | null;
  arrival_baggage_limit?: string | null;
  meta_title?: string | null;
  meta_description?: string | null;
  image_url?: string;
  images_json?: string[] | null;
  /** TODO: cardUrl 분리 저장 시 updates.image_card_url 추가. docs/design/product-image-card-url-extension.md */
  // image_card_url?: string;
  category?: string;
  theme?: string | null;
  destination_id?: string | null;
  product_line_id?: string | null;
  campaigns?: string[] | null;
  tags?: string[] | null;
  price?: number | null;
  duration?: string | null;
  itinerary?: string | null;
  inclusions?: string | null;
  is_active?: boolean;
  sort_order?: number | null;
  status?: "AVAILABLE" | "LIMITED" | "SOLD_OUT" | "CONSULT_REQUIRED" | null;
  fuel_included?: boolean | null;
  price_meta?: string | null;
  meta_info?: string | null;
  one_liner?: string | null;
  options?: Record<string, unknown> | null;
  /** [STEP 3] 일정 Day별 대표 이미지 URL. { "1": "https://...", "2": "https://..." } */
  itinerary_media_json?: Record<string, string> | null;
  /** [STEP 0] 구조화 일정. 있으면 상세 시각화 타임라인 우선 */
  itinerary_days_json?: Array<{
    day: number;
    dateText?: string;
    title?: string;
    coverImageUrl?: string | null;
    events: Array<{
      heading: string;
      description?: string;
      timeOfDay?: "오전" | "오후" | "저녁" | "종일";
      iconKey?: string;
    }>;
  }> | null;
  /** [STEP 1] 구조화 일정 v2 (jsonb 1컬럼) */
  itinerary_v2_json?: ItineraryV2 | null;
  /** 일정 테마 구성비. { items: [{ label, percent }] } */
  theme_chart_json?: { items: Array<{ label: string; percent: number }> } | null;
  overview_accommodation?: string | null;
  overview_region?: string | null;
  overview_duration?: string | null;
};

export async function PATCH(
  request: Request,
  context: { params: Promise<{ id: string }> },
) {
  let body: ProductBody;
  try {
    body = (await request.json()) as ProductBody;
  } catch {
    return NextResponse.json(
      { message: "요청 본문(JSON)을 읽을 수 없습니다. 다시 시도해 주세요." },
      { status: 400 },
    );
  }

  const { id } = await context.params;

  const updates: Record<string, unknown> = {};

  if (body.title !== undefined) updates.title = body.title?.trim();
  if (body.description !== undefined) updates.description = body.description?.trim();
  if (body.meta_title !== undefined) updates.meta_title = body.meta_title?.trim() || null;
  if (body.meta_description !== undefined) updates.meta_description = body.meta_description?.trim() || null;
  if (body.point_benefits !== undefined) updates.point_benefits = body.point_benefits?.trim() || null;
  if (body.point_tourism !== undefined) updates.point_tourism = body.point_tourism?.trim() || null;
  if (body.point_guide !== undefined) updates.point_guide = body.point_guide?.trim() || null;
  if (body.meeting_info !== undefined) updates.meeting_info = body.meeting_info?.trim() || null;
  if (body.travel_insurance !== undefined) updates.travel_insurance = body.travel_insurance?.trim() || null;
  if (body.included_items !== undefined) updates.included_items = body.included_items?.trim() || null;
  if (body.excluded_items !== undefined) updates.excluded_items = body.excluded_items?.trim() || null;
  if (body.detailed_schedule !== undefined) updates.detailed_schedule = body.detailed_schedule?.trim() || null;
  if (body.optional_tours !== undefined) updates.optional_tours = body.optional_tours?.trim() || null;
  if (body.min_departure_people !== undefined) updates.min_departure_people = body.min_departure_people?.trim() || null;
  if (body.terms_and_notes !== undefined) updates.terms_and_notes = body.terms_and_notes?.trim() || null;
  if (body.terms_template_type !== undefined) updates.terms_template_type = body.terms_template_type?.trim() || null;
  if (body.product_source_url !== undefined) updates.product_source_url = body.product_source_url?.trim() || null;
  if (body.departure_from_airport !== undefined)
    updates.departure_from_airport = body.departure_from_airport?.trim() || null;
  if (body.departure_from_date !== undefined) updates.departure_from_date = body.departure_from_date?.trim() || null;
  if (body.departure_from_time !== undefined) updates.departure_from_time = body.departure_from_time?.trim() || null;
  if (body.departure_to_airport !== undefined)
    updates.departure_to_airport = body.departure_to_airport?.trim() || null;
  if (body.departure_to_date !== undefined) updates.departure_to_date = body.departure_to_date?.trim() || null;
  if (body.departure_to_time !== undefined) updates.departure_to_time = body.departure_to_time?.trim() || null;
  if (body.departure_flight_name !== undefined)
    updates.departure_flight_name = body.departure_flight_name?.trim() || null;
  if (body.departure_baggage_limit !== undefined)
    updates.departure_baggage_limit = body.departure_baggage_limit?.trim() || null;
  if (body.arrival_from_airport !== undefined)
    updates.arrival_from_airport = body.arrival_from_airport?.trim() || null;
  if (body.arrival_from_date !== undefined) updates.arrival_from_date = body.arrival_from_date?.trim() || null;
  if (body.arrival_from_time !== undefined) updates.arrival_from_time = body.arrival_from_time?.trim() || null;
  if (body.arrival_to_airport !== undefined) updates.arrival_to_airport = body.arrival_to_airport?.trim() || null;
  if (body.arrival_to_date !== undefined) updates.arrival_to_date = body.arrival_to_date?.trim() || null;
  if (body.arrival_to_time !== undefined) updates.arrival_to_time = body.arrival_to_time?.trim() || null;
  if (body.arrival_flight_name !== undefined) updates.arrival_flight_name = body.arrival_flight_name?.trim() || null;
  if (body.arrival_baggage_limit !== undefined)
    updates.arrival_baggage_limit = body.arrival_baggage_limit?.trim() || null;
  if (body.image_url !== undefined) updates.image_url = body.image_url?.trim();
  if (body.images_json !== undefined) {
    const images = Array.isArray(body.images_json)
      ? body.images_json
          .filter((v): v is string => typeof v === "string")
          .map((v) => v.trim())
          .filter(Boolean)
      : [];
    updates.images_json = images.length > 0 ? images : null;
    if (body.image_url === undefined && images.length > 0) {
      updates.image_url = images[0];
    }
  }
  if (body.category !== undefined) updates.category = body.category?.trim();
  if (body.theme !== undefined) updates.theme = body.theme?.trim() || null;
  if (body.destination_id !== undefined) {
    updates.destination_id = body.destination_id?.trim() || null;
  }
  if (body.product_line_id !== undefined) {
    updates.product_line_id = body.product_line_id?.trim() || null;
  }
  if (body.campaigns !== undefined) {
    updates.campaigns_json =
      Array.isArray(body.campaigns) && body.campaigns.length > 0
        ? body.campaigns.filter((v): v is string => typeof v === "string").map((v) => v.trim()).filter(Boolean)
        : null;
  }
  if (body.tags !== undefined) {
    updates.tags_json =
      Array.isArray(body.tags) && body.tags.length > 0
        ? body.tags.filter((v): v is string => typeof v === "string").map((v) => v.trim()).filter(Boolean)
        : null;
  }
  if (body.duration !== undefined) updates.duration = body.duration?.trim() || null;
  if (body.itinerary !== undefined) updates.itinerary = body.itinerary?.trim() || null;
  if (body.inclusions !== undefined) updates.inclusions = body.inclusions?.trim() || null;
  if (body.price !== undefined) updates.price = typeof body.price === "number" ? body.price : null;
  if (body.is_active !== undefined) updates.is_active = body.is_active;
  if (body.sort_order !== undefined) {
    updates.sort_order = typeof body.sort_order === "number" ? body.sort_order : null;
  }
  if (body.status !== undefined) {
    updates.status = body.status && ["AVAILABLE", "LIMITED", "SOLD_OUT", "CONSULT_REQUIRED"].includes(body.status) ? body.status : null;
  }
  if (body.fuel_included !== undefined) {
    updates.fuel_included = typeof body.fuel_included === "boolean" ? body.fuel_included : null;
  }
  if (body.price_meta !== undefined) {
    updates.price_meta = body.price_meta?.trim() || null;
  }
  if (body.meta_info !== undefined) {
    updates.meta_info = body.meta_info?.trim() || null;
  }
  if (body.one_liner !== undefined) {
    updates.one_liner = body.one_liner?.trim() || null;
  }
  if (body.options !== undefined) {
    updates.options = body.options && typeof body.options === "object" ? body.options : null;
  }
  if (body.itinerary_media_json !== undefined) {
    updates.itinerary_media_json =
      body.itinerary_media_json && typeof body.itinerary_media_json === "object"
        ? body.itinerary_media_json
        : null;
  }
  if (body.itinerary_days_json !== undefined) {
    updates.itinerary_days_json =
      Array.isArray(body.itinerary_days_json) && body.itinerary_days_json.length > 0
        ? body.itinerary_days_json
        : null;
  }
  if (body.itinerary_v2_json !== undefined) {
    updates.itinerary_v2_json =
      body.itinerary_v2_json &&
      typeof body.itinerary_v2_json === "object" &&
      Array.isArray(body.itinerary_v2_json.days) &&
      body.itinerary_v2_json.days.length > 0
        ? body.itinerary_v2_json
        : null;
  }
  if (body.theme_chart_json !== undefined) {
    const items = body.theme_chart_json?.items;
    const filtered = Array.isArray(items)
      ? items.filter((i) => i?.label?.trim() && typeof i.percent === "number")
      : [];
    updates.theme_chart_json = filtered.length >= 2 ? { items: filtered } : null;
  }
  if (body.overview_accommodation !== undefined) {
    updates.overview_accommodation = body.overview_accommodation?.trim() || null;
  }
  if (body.overview_region !== undefined) {
    updates.overview_region = body.overview_region?.trim() || null;
  }
  if (body.overview_duration !== undefined) {
    updates.overview_duration = body.overview_duration?.trim() || null;
  }
  // overview_json: 저장 제거. 상세 화면은 mapProductToOverview(product)로 자동 생성

  if (Object.keys(updates).length === 0) {
    return NextResponse.json(
      { message: "수정할 항목이 없습니다. 상품명 등 필드를 확인한 뒤 다시 저장해 주세요." },
      { status: 400 },
    );
  }

  let imagesJsonPersisted = true;
  let updateResult = await supabase
    .from("products")
    .update(updates)
    .eq("id", id)
    .select("id")
    .maybeSingle();

  // DB에 images_json 컬럼이 아직 없는 환경 호환
  if (updateResult.error && "images_json" in updates && isMissingImagesJsonColumn(updateResult.error.message)) {
    imagesJsonPersisted = false;
    const { images_json: _omit, ...fallbackUpdates } = updates;
    updateResult = await supabase
      .from("products")
      .update(fallbackUpdates)
      .eq("id", id)
      .select("id")
      .maybeSingle();
  }

  if (updateResult.error) {
    return NextResponse.json(
      { message: `상품 수정에 실패했습니다. (${updateResult.error.message})` },
      { status: 500 },
    );
  }
  if (!updateResult.data) {
    return NextResponse.json(
      { message: "상품 수정 권한이 없거나 대상 상품을 찾지 못했습니다. (RLS 정책 확인 필요)" },
      { status: 403 },
    );
  }

  revalidateTag(CACHE_TAGS.PRODUCTS, REVALIDATE_MAX);
  revalidatePath(`/products/${id}`);
  revalidatePath("/products");
  if (!imagesJsonPersisted) {
    return NextResponse.json({
      message: "상품이 수정되었습니다. (대표 이미지만 저장됨)",
      warningCode: "IMAGES_JSON_NOT_PERSISTED",
    });
  }
  return NextResponse.json({ message: "상품이 수정되었습니다." });
}

export async function DELETE(
  _request: Request,
  context: { params: Promise<{ id: string }> },
) {
  const { id } = await context.params;
  const deleteResult = await supabase.from("products").delete().eq("id", id).select("id").maybeSingle();

  if (deleteResult.error) {
    return NextResponse.json({ message: "상품 삭제에 실패했습니다." }, { status: 500 });
  }
  if (!deleteResult.data) {
    return NextResponse.json(
      { message: "상품 삭제 권한이 없거나 대상 상품을 찾지 못했습니다. (RLS 정책 확인 필요)" },
      { status: 403 },
    );
  }

  revalidateTag(CACHE_TAGS.PRODUCTS, REVALIDATE_MAX);
  revalidatePath(`/products/${id}`);
  revalidatePath("/products");
  return NextResponse.json({ message: "상품이 삭제되었습니다." });
}

export async function GET(
  _request: Request,
  context: { params: Promise<{ id: string }> },
) {
  const { id } = await context.params;
  const { data, error } = await supabase
    .from("products")
    .select("*")
    .eq("id", id)
    .maybeSingle();

  if (error) {
    return NextResponse.json(
      { message: `상품 조회에 실패했습니다. (${error.message})` },
      { status: 500 },
    );
  }
  if (!data) {
    return NextResponse.json({ message: "상품을 찾을 수 없습니다." }, { status: 404 });
  }
  return NextResponse.json(data);
}

```


---

## File: `src/components/admin/products/AdminProductManager.tsx`

```tsx
"use client";

import { FormEvent, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useSearchParams, usePathname } from "next/navigation";
import type { Product, ItineraryStructuredDay, ItineraryV2, SelectedEventRef } from "@/types/product";
import type { ProductTaxonomyWithUsage } from "@/types/productTaxonomy";
import type { ProductFormState, ProductFormDraft, TermsTemplateType } from "@/types/adminProductForm";
import { createEmptyAdminProductFormState } from "@/components/admin/products/editor/adminProductForm.defaults";
import { serializeAdminProductForm } from "@/components/admin/products/editor/adminProductForm.serializer";
import { deserializeAdminProductToForm } from "@/components/admin/products/editor/adminProductForm.deserializer";
import {
  mapAdminProductFormToPreviewProduct,
  getPreviewWarnings,
  type PreviewWarning,
} from "@/components/admin/products/editor/adminProductPreview.mapper";
import { SECTIONS } from "@/components/admin/products/editor/adminProductForm.validation";
import { useProductFormIssues } from "@/components/admin/products/editor/hooks/useProductFormIssues";
import { useProductFormAutosave } from "@/components/admin/products/editor/hooks/useProductFormAutosave";
import { useUnsavedChangesGuard } from "@/components/admin/products/editor/hooks/useUnsavedChangesGuard";
import {
  EDITOR_UI_STATE_KEY,
  useEditorSectionPersistence,
} from "@/components/admin/products/editor/hooks/useEditorSectionPersistence";
import { useEditorKeyboardShortcuts } from "@/components/admin/products/editor/hooks/useEditorKeyboardShortcuts";
import { parseDetailedSchedule, type DayScheduleDraft } from "@/components/admin/products/editor/adminProductForm.helpers";

import type { SectionId, FormIssue, SectionIssue } from "@/components/admin/products/editor/adminProductForm.types";
/** AdminProductManager에서 사용하는 섹션/이슈 타입 re-export */
export type { SectionId, FormIssue, SectionIssue };
export type { PreviewWarning } from "@/components/admin/products/editor/adminProductPreview.mapper";
import { useAdminToast } from "@/components/admin/AdminToastProvider";
import { useAdminConfirm } from "@/components/admin/AdminConfirmProvider";
import ProductCard, { type ProductCardProps } from "@/components/products/ProductCard";
import ProductDetailV2, { type ProductDetailV2StatusTag } from "@/components/products/ProductDetailV2";
import {
  ProductDetailStickyV2Desktop,
  ProductDetailStickyV2Mobile,
} from "@/components/products/ProductDetailStickyV2";
import { ConsultModalProvider } from "@/components/inquiry/ConsultModal";
import { ProductQuoteProvider } from "@/components/products/ProductQuoteContext";
import {
  productToCardPropsPayload,
  productToDetailV2PropsPayload,
} from "@/lib/admin/productPreview";
import { hydrateProductWithCampaignCardMeta } from "@/lib/productCampaignResolve";
import {
  itineraryV2ToTimelineModel,
} from "@/lib/products/mapProductToTimelineModel";
import { InteractiveTimelineV2 } from "@/components/products/InteractiveTimelineV2";
import { normalizeAirline } from "@/lib/airlines/normalizeAirline";
import { AIRLINE_LOGO_BY_CODE } from "@/lib/airlines/airlineLogos";
import { normalizeImageList } from "@/lib/products/images";
import {
  fetchAdminProduct,
  createAdminProduct,
  updateAdminProduct,
} from "@/components/admin/products/api/adminProducts.client";
import { normalizeProductImageUrl } from "@/lib/media/normalizeProductImageUrl";
import { ImageImportGuideModal } from "@/components/admin/ImageImportGuideModal";
import { parsePastedImageUrls } from "@/lib/admin/parsePastedImageUrls";
import { ProductFormActionBar } from "@/components/admin/ProductFormActionBar";
import { ProductFormSectionNav } from "@/components/admin/ProductFormSectionNav";
import { extractTitleCandidates } from "@/lib/products/extractProductTitle";
import {
  recommendCoverCandidates,
  type CoverCandidate,
} from "@/lib/products/recommendCoverImage";
import { getProductDiffSummary } from "@/lib/adminProductDiff";
import AdminHomeCuratedManager from "@/components/admin/products/AdminHomeCuratedManager";
import AdminHomeRegionCardsManager from "@/components/admin/products/AdminHomeRegionCardsManager";
import AdminHomeThemeCardsManager from "@/components/admin/products/AdminHomeThemeCardsManager";
import AdminProductsCollectionCampaignsManager from "@/components/admin/products/AdminProductsCollectionCampaignsManager";
import AdminProductTaxonomyView from "@/components/admin/products/AdminProductTaxonomyView";
import AdminProductListSection from "@/components/admin/products/AdminProductListSection";
import { useAdminProductTaxonomyController } from "@/components/admin/products/hooks/useAdminProductTaxonomyController";
import AdminProductEditorView from "@/components/admin/products/AdminProductEditorView";
import {
  ADMIN_PRODUCTS_VIEW,
  ADMIN_PRODUCTS_QUERY_KEYS,
  DEFAULT_PRODUCTS_PAGE_SIZE,
} from "@/components/admin/products/adminProducts.constants";
import { buildRegionTree } from "@/lib/productTaxonomies";
import type { RegionTreeNode } from "@/types/productTaxonomy";
import { ProductEditorShell } from "@/components/admin/products/editor/ProductEditorShell";

function normalizeUrlForCompare(url: string): string {
  return url.trim();
}

type TermsTemplateMap = Record<TermsTemplateType, string>;

function createEmptyTermsTemplateMap(): TermsTemplateMap {
  return {
    overseas_brokerage: "",
    domestic_brokerage: "",
    overseas_direct: "",
    domestic_direct: "",
  };
}

/** 임시저장 localStorage 키 접두사 (뒤에 productId or 'new' 붙임) */
const PRODUCT_FORM_DRAFT_KEY_PREFIX = "admin_product_form_draft_v1:";

function getDraftKey(productId: string | null): string {
  return PRODUCT_FORM_DRAFT_KEY_PREFIX + (productId ?? "new");
}

/** 상품 폼용: taxonomy 항목을 대분류(parent_id null) 기준 그룹으로 묶어 반환. 대분류가 있으면 그룹별로, 없으면 한 그룹에 전체. */
function buildTaxonomyGroupsForForm(
  items: ProductTaxonomyWithUsage[],
  fallbackGroupLabel: string,
): { label: string; items: { id: string; name: string }[] }[] {
  const active = items.filter((i) => i.is_active);
  const roots = active
    .filter((i) => !i.parent_id || i.parent_id.trim() === "")
    .sort((a, b) => {
      const sa = a.sort_order ?? 9999;
      const sb = b.sort_order ?? 9999;
      if (sa !== sb) return sa - sb;
      return (a.name ?? "").localeCompare(b.name ?? "", "ko");
    });
  const byParent = new Map<string, ProductTaxonomyWithUsage[]>();
  for (const i of active) {
    const pid = i.parent_id?.trim();
    if (!pid) continue;
    if (!byParent.has(pid)) byParent.set(pid, []);
    byParent.get(pid)!.push(i);
  }
  for (const arr of byParent.values()) {
    arr.sort((a, b) => {
      const sa = a.sort_order ?? 9999;
      const sb = b.sort_order ?? 9999;
      if (sa !== sb) return sa - sb;
      return (a.name ?? "").localeCompare(b.name ?? "", "ko");
    });
  }
  if (roots.length > 0) {
    return roots.map((root) => {
      const children = byParent.get(root.id) ?? [];
      return {
        label: root.name ?? "",
        items: [
          { id: root.id, name: root.name ?? "" },
          ...children.map((c) => ({ id: c.id, name: c.name ?? "" })),
        ],
      };
    });
  }
  const flat = active
    .sort((a, b) => {
      const sa = a.sort_order ?? 9999;
      const sb = b.sort_order ?? 9999;
      if (sa !== sb) return sa - sb;
      return (a.name ?? "").localeCompare(b.name ?? "", "ko");
    })
    .map((i) => ({ id: i.id, name: i.name ?? "" }));
  return flat.length > 0 ? [{ label: fallbackGroupLabel, items: flat }] : [];
}

/** 트리에서 id에 해당하는 노드까지의 경로(루트→리프) 반환. 없으면 []. */
function getPathToNodeById(tree: RegionTreeNode[], targetId: string): RegionTreeNode[] {
  const path: RegionTreeNode[] = [];
  function find(nodes: RegionTreeNode[], target: string): boolean {
    for (const node of nodes) {
      path.push(node);
      if (node.id === target) return true;
      if (node.children?.length && find(node.children, target)) return true;
      path.pop();
    }
    return false;
  }
  find(tree, targetId);
  return path;
}

/** 트리 모든 노드 id 수집 (activeDestinationIds 등용). */
function flattenTreeIds(nodes: RegionTreeNode[]): string[] {
  const ids: string[] = [];
  function walk(n: RegionTreeNode) {
    ids.push(n.id);
    n.children?.forEach(walk);
  }
  nodes.forEach(walk);
  return ids;
}

/** 트리에서 name에 해당하는 노드까지의 경로(루트→리프) 반환. 첫 번째 일치. 없으면 []. */
function getPathToNodeByName(tree: RegionTreeNode[], targetName: string): RegionTreeNode[] {
  const path: RegionTreeNode[] = [];
  const name = targetName.trim();
  if (!name) return [];
  function find(nodes: RegionTreeNode[], target: string): boolean {
    for (const node of nodes) {
      path.push(node);
      if (node.name === target) return true;
      if (node.children?.length && find(node.children, target)) return true;
      path.pop();
    }
    return false;
  }
  find(tree, name);
  return path;
}

const initialFormState: ProductFormState = createEmptyAdminProductFormState();

type ToastState = {
  type: "success" | "error";
  text: string;
} | null;

function formatPriceWithCommas(raw: string) {
  const hasTilde = raw.includes("~");
  const digitsOnly = raw.replace(/[^\d]/g, "");
  if (!digitsOnly) return "";
  const formatted = digitsOnly.replace(/\B(?=(\d{3})+(?!\d))/g, ",");
  return hasTilde ? `${formatted}~` : formatted;
}

function serializeDetailedSchedule(drafts: DayScheduleDraft[]) {
  const cleaned = drafts
    .map((item) => ({
      label: item.label.trim(),
      content: item.content.trim(),
    }))
    .filter((item) => item.label.length > 0 || item.content.length > 0);

  return cleaned
    .map((item) => {
      const safeLabel = item.label || "일정";
      return item.content ? `[${safeLabel}]\n${item.content}` : `[${safeLabel}]`;
    })
    .join("\n\n");
}

function createNextDayLabel(drafts: DayScheduleDraft[]) {
  const dayNumbers = drafts
    .map((item) => item.label.trim().match(/^(\d+)\s*일차$/))
    .filter((match): match is RegExpMatchArray => Boolean(match))
    .map((match) => Number(match[1]))
    .filter((n) => Number.isFinite(n));
  const next = dayNumbers.length > 0 ? Math.max(...dayNumbers) + 1 : drafts.length + 1;
  return `${next}일차`;
}

export default function AdminProductManager() {
  const searchParams = useSearchParams();
  const pathname = usePathname();
  const viewParam = searchParams.get(ADMIN_PRODUCTS_QUERY_KEYS.VIEW);
  const isTaxonomyView = viewParam === ADMIN_PRODUCTS_VIEW.TAXONOMY;
  const isCreateView = viewParam === ADMIN_PRODUCTS_VIEW.CREATE;
  const isFeaturedView = viewParam === ADMIN_PRODUCTS_VIEW.FEATURED;
  const isHomeRegionCardsView = viewParam === ADMIN_PRODUCTS_VIEW.HOME_REGION_CARDS;
  const isHomeThemeCardsView = viewParam === ADMIN_PRODUCTS_VIEW.HOME_THEME_CARDS;
  const isListView = !viewParam || viewParam === ADMIN_PRODUCTS_VIEW.LIST;
  const [form, setForm] = useState<ProductFormState>(initialFormState);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");
  const [toast, setToast] = useState<ToastState>(null);
  const [termsTemplates, setTermsTemplates] = useState<TermsTemplateMap>(createEmptyTermsTemplateMap());
  const [isTermsTemplatesLoading, setIsTermsTemplatesLoading] = useState(true);
  const [isTermsTemplatesSaving, setIsTermsTemplatesSaving] = useState(false);
  const [termsTemplatesErrorMessage, setTermsTemplatesErrorMessage] = useState("");
  const [isTermsTemplatesPanelOpen, setIsTermsTemplatesPanelOpen] = useState(false);
  const [activeSchedulePreviewIndex, setActiveSchedulePreviewIndex] = useState(0);
  const [showRawScheduleEditor, setShowRawScheduleEditor] = useState(false);
  /** 일정 입력 모드: 시각화(권장) vs 레거시 텍스트 */
  const [scheduleEditorMode, setScheduleEditorMode] = useState<"visual" | "legacy">("visual");
  /** 현재 선택된 이벤트 (상품 이미지 → 이 이벤트에 추가용). 일정 탭에서 이벤트 클릭 시 설정 */
  const [selectedEvent, setSelectedEvent] = useState<SelectedEventRef | null>(null);
  const [pasteToAddValue, setPasteToAddValue] = useState("");
  const [showImageImportGuideModal, setShowImageImportGuideModal] = useState(false);
  const [showDraftBanner, setShowDraftBanner] = useState(false);
  const [draftData, setDraftData] = useState<ProductFormDraft | null>(null);
  const [isSavingDraft, setIsSavingDraft] = useState(false);
  const [productFormOpenSections, setProductFormOpenSections] = useState<Record<string, boolean>>({
    basic: true,
    taxonomy: true,
    price: false,
    description: false,
    included: false,
    schedule: false,
    flight: false,
    terms: false,
  });
  /** 목차 네비에서 현재 스크롤 기준 활성 섹션 (IntersectionObserver로 갱신) */
  const [activeSectionId, setActiveSectionId] = useState<SectionId | null>("basic");
  /** 필수 오류 순차 이동 시 `requiredIssues` 인덱스 */
  const [currentIssueIndex, setCurrentIssueIndex] = useState(0);
  const [showShortcutTip, setShowShortcutTip] = useState(false);

  const departureFlightCode = useMemo(
    () => (form.departure_flight_name ? normalizeAirline(form.departure_flight_name) : null),
    [form.departure_flight_name],
  );
  const arrivalFlightCode = useMemo(
    () => (form.arrival_flight_name ? normalizeAirline(form.arrival_flight_name) : null),
    [form.arrival_flight_name],
  );

  const departureHasLogo = departureFlightCode ? Boolean(AIRLINE_LOGO_BY_CODE[departureFlightCode]) : false;
  const arrivalHasLogo = arrivalFlightCode ? Boolean(AIRLINE_LOGO_BY_CODE[arrivalFlightCode]) : false;
  /** 미리보기 디바이스 뷰 (클래스로만 구분) */
  const [previewDevice, setPreviewDevice] = useState<"desktop" | "mobile">("desktop");
  /** 미리보기용 로컬 이미지 파일 선택 시 ObjectURL 생성/해제용 */
  const [previewImageFile, setPreviewImageFile] = useState<File | null>(null);
  const [previewImageObjectUrl, setPreviewImageObjectUrl] = useState<string | null>(null);
  /** 상세 미리보기에서 Sticky CTA 표시 여부 (UX 방해 시 숨김) */
  const [showDetailSticky, setShowDetailSticky] = useState(true);
  /** 상품명 추출 모달 */
  const [showTitleExtractModal, setShowTitleExtractModal] = useState(false);
  const [titleExtractPaste, setTitleExtractPaste] = useState("");
  const [titleCandidates, setTitleCandidates] = useState<string[]>([]);
  /** 대표 이미지 추천 모달 */
  const [showCoverRecommendModal, setShowCoverRecommendModal] = useState(false);
  const [coverCandidates, setCoverCandidates] = useState<CoverCandidate[]>([]);
  const toastTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const refreshListRef = useRef<(() => Promise<void>) | null>(null);
  const pageSize = DEFAULT_PRODUCTS_PAGE_SIZE;
  const { showToast } = useAdminToast();
  const { confirm } = useAdminConfirm();

  const taxonomyController = useAdminProductTaxonomyController({
    showToast,
    confirm,
    onCategoryAdded(name) {
      setForm((prev) => ({ ...prev, category: name }));
    },
    onThemeAdded(name) {
      setForm((prev) => ({ ...prev, theme: name }));
    },
  });

  /** 대분류만 선택한 상태(중분류 표시용). destination_id가 있으면 path로 대체. */
  const [selectedLevel1Id, setSelectedLevel1Id] = useState("");
  /** 중분류만 선택한 상태(소분류 표시용). */
  const [selectedLevel2Id, setSelectedLevel2Id] = useState("");
  /** 테마 대분류만 선택한 상태(중분류 표시용). */
  const [selectedThemeLevel1Id, setSelectedThemeLevel1Id] = useState("");
  /** 테마 중분류만 선택한 상태(소분류 표시용). */
  const [selectedThemeLevel2Id, setSelectedThemeLevel2Id] = useState("");

  function parseCampaignsList(value: string) {
    return value
      .split(/[,\n|]+/)
      .map((item) => item.trim())
      .filter((item) => item.length > 0);
  }
  function stringifyCampaignsList(list: string[]) {
    return list.join(",");
  }

  function showLocalToast(type: "success" | "error", text: string) {
    setToast({ type, text });
    if (toastTimerRef.current) {
      clearTimeout(toastTimerRef.current);
    }
    toastTimerRef.current = setTimeout(() => {
      setToast(null);
    }, 2500);
  }

  /** 스크롤 오프셋: sticky 액션바 높이 + 여유 16px */
  function getStickyHeaderOffset(): number {
    if (typeof document === "undefined") return 80;
    const bar = document.getElementById("product-form-actionbar");
    const h = bar?.getBoundingClientRect().height ?? 0;
    return h + 16;
  }

  /** 네비/경고/이슈 클릭 시: 해당 섹션 열기 + DOM 반영 후 스크롤 + (anchorId 있으면 포커스). 토글이 아닌 항상 펼치기만 함. */
  function openSectionAndScrollTo(sectionId: SectionId, anchorId?: string) {
    setProductFormOpenSections((prev) => ({ ...prev, [sectionId]: true }));
    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        const headerOffset = getStickyHeaderOffset();
        const targetId = anchorId ?? `form-section-${sectionId}`;
        const el = document.getElementById(targetId) as HTMLElement | null;
        if (!el) return;
        const top = el.getBoundingClientRect().top + window.scrollY - headerOffset;
        window.scrollTo({ top, behavior: "smooth" });
        if (anchorId && typeof el.focus === "function") {
          el.focus();
          el.scrollIntoView({ behavior: "smooth", block: "center" });
        }
      });
    });
  }

  const openSectionAndScrollToRef = useRef(openSectionAndScrollTo);
  openSectionAndScrollToRef.current = openSectionAndScrollTo;

  /** 아코디언 헤더 클릭: 토글(열려 있으면 접기, 닫혀 있으면 열고 스크롤). */
  function toggleSection(sectionId: SectionId) {
    setProductFormOpenSections((prev) => {
      const next = { ...prev, [sectionId]: !prev[sectionId] };
      if (next[sectionId]) {
        requestAnimationFrame(() => {
          requestAnimationFrame(() => {
            const headerOffset = getStickyHeaderOffset();
            const el = document.getElementById(`form-section-${sectionId}`) as HTMLElement | null;
            if (!el) return;
            const top = el.getBoundingClientRect().top + window.scrollY - headerOffset;
            window.scrollTo({ top, behavior: "smooth" });
          });
        });
      }
      return next;
    });
  }

  /** 검증 실패 시 섹션 열기 + 스크롤 + 포커스 + 토스트. 네비 클릭 시에도 호출되며, 항상 해당 섹션을 펼침만 함(토글 없음). */
  function openSectionAndFocus(opts: {
    sectionId: SectionId;
    anchorId?: string;
    reason?: string;
  }) {
    const { sectionId, anchorId, reason } = opts;
    openSectionAndScrollTo(sectionId, anchorId);
    if (reason) showLocalToast("error", reason);
  }

  /** 상품 공용 이미지 URL을 현재 선택된 이벤트의 images에 추가. 중복 시 스킵, cover/ sortOrder 자동 설정 */
  function addProductImageToSelectedEvent(url: string) {
    const ref = selectedEvent;
    if (!ref) return false;
    const normalized = normalizeUrlForCompare(url);
    if (!normalized || !/^https?:\/\//i.test(normalized)) return false;

    if (ref.editorType === "v2") {
      const days = form.itinerary_v2_json?.days ?? [];
      const day = days[ref.dayIndex];
      if (!day) return false;
      const events = day.events ?? [];
      const event = events[ref.eventIndex];
      if (!event) return false;
      const images = event.images ?? [];
      const existingSet = new Set(images.map((i) => normalizeUrlForCompare(i.url)));
      if (existingSet.has(normalized)) return false;
      const newItem = { url: normalized };
      const nextImages = [...images, newItem];
      setForm((prev: any) => ({
        ...prev,
        itinerary_v2_json: {
          ...prev.itinerary_v2_json,
          days: prev.itinerary_v2_json.days.map((d: ItineraryStructuredDay, di: number) =>
            di === ref.dayIndex
              ? {
                  ...d,
                  events: d.events.map((e: any, ei: number) =>
                    ei === ref.eventIndex ? { ...e, images: nextImages } : e,
                  ),
                }
              : d,
          ),
        },
      }));
      return true;
    }

    if (ref.editorType === "structured") {
      const days = form.itinerary_days_json ?? [];
      const day = days[ref.dayIndex];
      if (!day) return false;
      const events = day.events ?? [];
      const event = events[ref.eventIndex];
      if (!event) return false;
      const images = (event as { images?: Array<{ url: string; sortOrder?: number; isCover?: boolean }> }).images ?? [];
      const existingSet = new Set(images.map((i) => normalizeUrlForCompare(i.url)));
      if (existingSet.has(normalized)) return false;
      const newItem = { url: normalized };
      const nextImages = [...images, newItem];
      setForm((prev: any) => ({
        ...prev,
        itinerary_days_json: prev.itinerary_days_json.map((d: ItineraryStructuredDay, di: number) =>
          di === ref.dayIndex
            ? {
                ...d,
                events: d.events.map((e: any, ei: number) =>
                  ei === ref.eventIndex ? { ...e, images: nextImages } : e,
                ),
              }
            : d,
        ),
      }));
      return true;
    }

    return false;
  }

  /** 선택 이벤트 라벨 "Day N - 이벤트명" (상단 배너용) */
  function getSelectedEventLabel(): string | null {
    const ref = selectedEvent;
    if (!ref) return null;
    if (ref.editorType === "v2") {
      const days = form.itinerary_v2_json?.days ?? [];
      const day = days[ref.dayIndex];
      if (!day) return null;
      const event = day.events?.[ref.eventIndex];
      if (!event) return null;
      const dayNum = day.day ?? ref.dayIndex + 1;
      return `Day ${dayNum} - ${(event.heading || "").trim() || "이벤트"}`;
    }
    if (ref.editorType === "structured") {
      const days = form.itinerary_days_json ?? [];
      const day = days[ref.dayIndex];
      if (!day) return null;
      const event = day.events?.[ref.eventIndex];
      if (!event) return null;
      const dayNum = day.day ?? ref.dayIndex + 1;
      return `Day ${dayNum} - ${(event.heading || "").trim() || "이벤트"}`;
    }
    return null;
  }

  /** 붙여넣기 URL 목록을 선택 이벤트에 일괄 추가. 중복/cover/sortOrder 동일 규칙. 반환: 추가된 개수 */
  function addImagesToEvent(ref: SelectedEventRef | null, urls: string[]): number {
    if (!ref || urls.length === 0) return 0;
    const parsed = parsePastedImageUrls(urls.join("\n"));
    const valid = parsed.filter((u) => /^https?:\/\//i.test(normalizeUrlForCompare(u)));
    if (valid.length === 0) return 0;

    let added = 0;
    if (ref.editorType === "v2") {
      const days = form.itinerary_v2_json?.days ?? [];
      const day = days[ref.dayIndex];
      if (!day) return 0;
      const events = day.events ?? [];
      const event = events[ref.eventIndex];
      if (!event) return 0;
      const images = event.images ?? [];
      const existingSet = new Set(images.map((i) => normalizeUrlForCompare(i.url)));
      const toAdd: Array<{ url: string }> = [];
      for (const url of valid) {
        const normalized = normalizeUrlForCompare(url);
        if (!normalized || existingSet.has(normalized)) continue;
        existingSet.add(normalized);
        toAdd.push({ url: normalized });
      }
      if (toAdd.length === 0) return added;
      added = toAdd.length;
      const nextImages = [...images, ...toAdd];
      setForm((prev: any) => ({
        ...prev,
        itinerary_v2_json: {
          ...prev.itinerary_v2_json,
          days: prev.itinerary_v2_json.days.map((d: ItineraryStructuredDay, di: number) =>
            di === ref.dayIndex
              ? {
                  ...d,
                  events: d.events.map((e: any, ei: number) =>
                    ei === ref.eventIndex ? { ...e, images: nextImages } : e,
                  ),
                }
              : d,
          ),
        },
      }));
      return added;
    }

    if (ref.editorType === "structured") {
      const days = form.itinerary_days_json ?? [];
      const day = days[ref.dayIndex];
      if (!day) return 0;
      const events = day.events ?? [];
      const event = events[ref.eventIndex];
      if (!event) return 0;
      const images = (event as { images?: Array<{ url: string; sortOrder?: number; isCover?: boolean }> }).images ?? [];
      const existingSet = new Set(images.map((i) => normalizeUrlForCompare(i.url)));
      const toAdd: Array<{ url: string }> = [];
      for (const url of valid) {
        const normalized = normalizeUrlForCompare(url);
        if (!normalized || existingSet.has(normalized)) continue;
        existingSet.add(normalized);
        toAdd.push({ url: normalized });
      }
      if (toAdd.length === 0) return added;
      added = toAdd.length;
      const nextImages = [...images, ...toAdd];
      setForm((prev: any) => ({
        ...prev,
        itinerary_days_json: prev.itinerary_days_json.map((d: ItineraryStructuredDay, di: number) =>
          di === ref.dayIndex
            ? {
                ...d,
                events: d.events.map((e: any, ei: number) =>
                  ei === ref.eventIndex ? { ...e, images: nextImages } : e,
                ),
              }
            : d,
        ),
      }));
      return added;
    }
    return 0;
  }

  async function loadTermsTemplates() {
    try {
      setIsTermsTemplatesLoading(true);
      setTermsTemplatesErrorMessage("");
      const response = await fetch("/api/admin/terms-templates", { cache: "no-store" });
      const result = (await response.json()) as Partial<TermsTemplateMap> | { message?: string };
      if (!response.ok) {
        const msg = "message" in result ? result.message : "약관 템플릿 조회에 실패했습니다.";
        setTermsTemplatesErrorMessage(msg ?? "약관 템플릿 조회에 실패했습니다.");
        return;
      }
      const templateResult = result as Partial<TermsTemplateMap>;
      setTermsTemplates({
        overseas_brokerage: templateResult.overseas_brokerage ?? "",
        domestic_brokerage: templateResult.domestic_brokerage ?? "",
        overseas_direct: templateResult.overseas_direct ?? "",
        domestic_direct: templateResult.domestic_direct ?? "",
      });
    } catch {
      setTermsTemplatesErrorMessage("약관 템플릿 조회 중 오류가 발생했습니다.");
    } finally {
      setIsTermsTemplatesLoading(false);
    }
  }

  useEffect(() => {
    loadTermsTemplates();
  }, []);

  const urlEditingId = searchParams.get(ADMIN_PRODUCTS_QUERY_KEYS.EDITING_ID);
  const initialFormSnapshotRef = useRef<ProductFormState | null>(null);

  const writeDraftToStorage = useCallback((nextForm: ProductFormState) => {
    const key = getDraftKey(editingId);
    const payload: ProductFormDraft = { version: 1, form: nextForm, savedAt: Date.now() };
    localStorage.setItem(key, JSON.stringify(payload));
  }, [editingId]);

  const autosaveEnabled = isCreateView || Boolean(editingId);
  const autosaveStorageKey = autosaveEnabled ? getDraftKey(editingId) : null;
  const autosaveBaseSnapshot = editingId
    ? (initialFormSnapshotRef.current ?? null)
    : initialFormState;

  const {
    isDirty,
    autosaveStatus,
    lastSavedAt,
    resetBaseSnapshot,
    markSavedNow,
  } = useProductFormAutosave({
    enabled: autosaveEnabled,
    form,
    storageKey: autosaveStorageKey,
    saveDraft: writeDraftToStorage,
    initialSnapshot: autosaveBaseSnapshot,
    debounceMs: 1500,
    pause: isSubmitting || isSavingDraft,
  });

  const { markSafeNavigation } = useUnsavedChangesGuard({
    enabled: autosaveEnabled,
    isDirty,
  });

  const editorUIKey = EDITOR_UI_STATE_KEY(editingId);

  useEditorSectionPersistence({
    storageKey: editorUIKey,
    openSections: productFormOpenSections,
    setOpenSections: setProductFormOpenSections,
    activeSectionId,
    setActiveSectionId: (id) => setActiveSectionId(id as SectionId),
  });

  useEffect(() => {
    if (!urlEditingId) return;
    initialFormSnapshotRef.current = null;
    let cancelled = false;
    (async () => {
      try {
        const product = await fetchAdminProduct(urlEditingId);
        if (cancelled) return;
        const images = normalizeImageList(product.images_json);
        const productWithImages = {
          ...product,
          images_json: images,
          image_url: images[0] ?? product.image_url ?? "",
        };
        const nextForm = deserializeAdminProductToForm(productWithImages);
        setForm(nextForm);
        initialFormSnapshotRef.current = structuredClone(nextForm);
        setEditingId(urlEditingId);
        setErrorMessage("");
        resetBaseSnapshot(nextForm);
        setTimeout(() => {
          try {
            const raw = sessionStorage.getItem(EDITOR_UI_STATE_KEY(urlEditingId));
            if (!raw) return;
            const parsed = JSON.parse(raw) as { activeSectionId?: string };
            if (parsed.activeSectionId) {
              openSectionAndScrollToRef.current(parsed.activeSectionId as SectionId);
            }
          } catch {
            // ignore
          }
        }, 0);
      } catch {
        if (!cancelled) {
          setEditingId(urlEditingId);
          setForm(initialFormState);
          resetBaseSnapshot(initialFormState);
          setErrorMessage("상품을 불러오지 못했습니다. 목록에서 다시 시도해 주세요.");
          showLocalToast("error", "상품 조회에 실패했습니다.");
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [urlEditingId, resetBaseSnapshot]);

  const diffSummary = useMemo(() => {
    const initial = editingId
      ? (initialFormSnapshotRef.current ?? initialFormState)
      : initialFormState;
    return getProductDiffSummary(initial, form);
  }, [form, editingId]);

  const { issuesBySection, allIssues, requiredIssues } = useProductFormIssues(form);

  /** 폼 제출 (액션 바 [저장] 및 form onSubmit에서 공통 호출) */
  const submit = () => void handleSubmit(undefined);

  const submitRequestIdRef = useRef(0);

  async function handleSubmit(event?: FormEvent<HTMLFormElement>) {
    event?.preventDefault();
    if (isSubmitting) return;
    setIsSubmitting(true);
    setErrorMessage("");

    if (requiredIssues.length > 0) {
      setCurrentIssueIndex(0);
      const first = requiredIssues[0];
      const sectionTitle = SECTIONS.find((s) => s.id === first.sectionId)?.title ?? first.sectionId;
      openSectionAndFocus({
        sectionId: first.sectionId,
        anchorId: first.anchorId,
        reason: `저장 실패: ${sectionTitle} - ${first.message}`,
      });
      setIsSubmitting(false);
      return;
    }

    const requestId = ++submitRequestIdRef.current;
    const currentDraftKey = getDraftKey(editingId);
    try {
      const payload = serializeAdminProductForm(form, { editingId });
      let result: { message?: string; warningCode?: string };
      if (editingId) {
        result = await updateAdminProduct(editingId, payload);
      } else {
        result = await createAdminProduct(payload);
      }

      if (requestId !== submitRequestIdRef.current) return;

      if (result.warningCode === "IMAGES_JSON_NOT_PERSISTED") {
        showLocalToast(
          "error",
          "DB에 images_json 컬럼이 없어 대표 이미지 외 나머지는 저장되지 않았습니다. supabase/products_images_json_upgrade.sql 실행이 필요합니다.",
        );
      } else {
        showToast("success", editingId ? "상품이 수정되었습니다." : "상품이 등록되었습니다.");
      }
      markSafeNavigation();
      setEditingId(null);
      setForm(initialFormState);
      resetBaseSnapshot(initialFormState);
      setActiveSchedulePreviewIndex(0);
      setShowRawScheduleEditor(false);
      setScheduleEditorMode("visual");
      localStorage.removeItem(currentDraftKey);
      setShowDraftBanner(false);
      setDraftData(null);
      await refreshListRef.current?.();
    } catch (error) {
      if (requestId !== submitRequestIdRef.current) return;
      const message = error instanceof Error ? error.message : "상품 저장 중 오류가 발생했습니다.";
      setErrorMessage(message);
      showLocalToast("error", message);
    } finally {
      if (requestId === submitRequestIdRef.current) {
        setIsSubmitting(false);
      }
    }
  }

  function goToNextIssue() {
    if (requiredIssues.length === 0) return;

    const nextIndex = (currentIssueIndex + 1) % requiredIssues.length;
    const issue = requiredIssues[nextIndex];

    openSectionAndFocus({
      sectionId: issue.sectionId,
      anchorId: issue.anchorId,
      reason: `다음 오류: ${issue.message}`,
    });

    setCurrentIssueIndex(nextIndex);
  }

  const categoryGroups = useMemo(
    () =>
      buildTaxonomyGroupsForForm(
        taxonomyController.destinationOptions.filter((i) => i.taxonomy_type === "destination"),
        "지역",
      ),
    [taxonomyController.destinationOptions],
  );
  const destinationTree = useMemo(
    () =>
      buildRegionTree(
        taxonomyController.destinationOptions.filter((i) => i.taxonomy_type === "destination"),
      ),
    [taxonomyController.destinationOptions],
  );
  const categoryOptions = useMemo(
    () => categoryGroups.flatMap((g) => g.items.map((i) => i.name)),
    [categoryGroups],
  );
  const activeDestinationIds = useMemo(
    () => new Set(flattenTreeIds(destinationTree)),
    [destinationTree],
  );
  const destinationPath = useMemo(
    () => (form.destination_id ? getPathToNodeById(destinationTree, form.destination_id) : []),
    [destinationTree, form.destination_id],
  );
  const themeTree = useMemo(
    () =>
      buildRegionTree(
        taxonomyController.themeOptions.filter((i) => i.taxonomy_type === "theme"),
      ),
    [taxonomyController.themeOptions],
  );
  const themePath = useMemo(
    () => (form.theme.trim() ? getPathToNodeByName(themeTree, form.theme.trim()) : []),
    [themeTree, form.theme],
  );
  const availableThemeOptions = useMemo(() => {
    const names: string[] = [];
    function walk(n: RegionTreeNode) {
      names.push(n.name);
      n.children?.forEach(walk);
    }
    themeTree.forEach(walk);
    return names;
  }, [themeTree]);
  const activeProductLineOptions = useMemo(
    () =>
      taxonomyController.productLineOptions.filter(
        (i) => i.taxonomy_type === "product_line" && i.is_active,
      ),
    [taxonomyController.productLineOptions],
  );
  const activeCampaignOptions = useMemo(
    () =>
      taxonomyController.campaignOptions.filter(
        (i) => i.taxonomy_type === "campaign" && i.is_active,
      ),
    [taxonomyController.campaignOptions],
  );
  const selectedCampaigns = useMemo(
    () => parseCampaignsList(form.campaigns),
    [form.campaigns],
  );
  const scheduleDrafts = useMemo(
    () => parseDetailedSchedule(form.detailed_schedule),
    [form.detailed_schedule],
  );
  const effectiveDayCount =
    form.itinerary_days_json.length > 0
      ? form.itinerary_days_json.length
      : scheduleDrafts.length;
  const selectedTermsTemplateContent = useMemo(() => {
    if (!form.terms_template_type) return "";
    return termsTemplates[form.terms_template_type] ?? "";
  }, [form.terms_template_type, termsTemplates]);

  /** 폼 + 이미지(URL 또는 File ObjectURL) 기반 미리보기용 Product (공용 로직). PR3: campaign taxonomy로 배지 해석 */
  const previewProduct = useMemo(() => {
    const base = mapAdminProductFormToPreviewProduct(
      form,
      previewImageObjectUrl ?? form.images_json[0] ?? form.image_url?.trim() ?? "",
    );
    return hydrateProductWithCampaignCardMeta(base, activeCampaignOptions);
  }, [form, previewImageObjectUrl, activeCampaignOptions]);

  /** 로컬 fallback: 카드/상세 props (API 실패 시 사용) */
  const localCardProps = useMemo<ProductCardProps>(() => {
    const payload = productToCardPropsPayload(previewProduct);
    return {
      ...payload,
      onClickDetail: () => {},
      onClickConsult: () => {},
    };
  }, [previewProduct]);

  const localDetailProps = useMemo(() => {
    const payload = productToDetailV2PropsPayload(previewProduct);
    return {
      ...payload,
      onConsultClick: () => {},
      kakaoHref: "#",
      trust: undefined,
    };
  }, [previewProduct]);

  /** 서버 preview API 응답 (우선 사용, 실패 시 로컬 fallback) */
  const [serverPreview, setServerPreview] = useState<{
    previewProduct: Product;
    cardProps: ReturnType<typeof productToCardPropsPayload>;
    detailProps: ReturnType<typeof productToDetailV2PropsPayload>;
  } | null>(null);

  const effectivePreviewProduct = serverPreview?.previewProduct ?? previewProduct;
  const previewCardProps: ProductCardProps = serverPreview
    ? { ...serverPreview.cardProps, onClickDetail: () => {}, onClickConsult: () => {} }
    : localCardProps;
  const previewDetailProps = serverPreview
    ? {
        ...serverPreview.detailProps,
        onConsultClick: () => {},
        kakaoHref: "#",
        trust: undefined,
      }
    : localDetailProps;

  const hasPreviewImage = !!(form.image_url?.trim() || form.images_json.length > 0 || previewImageFile);
  const previewWarnings = useMemo(
    () => getPreviewWarnings(form, hasPreviewImage),
    [form, hasPreviewImage],
  );

  /** 일정에서 이미지 URL 수집 (대표 이미지 추천: 상품 이미지 없을 때) — Day1 cover 또는 Day1 첫 이벤트 첫 이미지 우선 */
  const itineraryImageUrls = useMemo(() => {
    const out: string[] = [];
    const v2Days = form.itinerary_v2_json?.days ?? [];
    if (v2Days.length > 0) {
      const day1 = v2Days[0];
      if (day1?.coverImageUrl?.trim()) out.push(day1.coverImageUrl.trim());
      const events = day1?.events ?? [];
      for (const ev of events) {
        const imgs = ev.images ?? [];
        for (const img of imgs) {
          if (typeof img.url === "string" && img.url.trim()) {
            out.push(img.url.trim());
            break;
          }
        }
      }
    }
    const structDays = form.itinerary_days_json ?? [];
    if (out.length === 0 && structDays.length > 0) {
      const day1 = structDays[0];
      const events = (day1 as { events?: Array<{ images?: Array<{ url?: string }> }> })?.events ?? [];
      for (const ev of events) {
        const imgs = ev.images ?? [];
        for (const img of imgs) {
          if (typeof img.url === "string" && img.url.trim()) {
            out.push(img.url.trim());
            break;
          }
        }
      }
    }
    return out;
  }, [form.itinerary_v2_json, form.itinerary_days_json]);

  useEffect(() => {
    if (!(isCreateView || editingId)) return;
    const key = getDraftKey(editingId);
    try {
      const raw = localStorage.getItem(key);
      if (!raw) return;
      const parsed = JSON.parse(raw) as Record<string, unknown>;
      if (
        parsed &&
        parsed.version === 1 &&
        parsed.form &&
        typeof parsed.savedAt === "number"
      ) {
        setDraftData(parsed as unknown as ProductFormDraft);
        setShowDraftBanner(true);
      } else {
        localStorage.removeItem(key);
      }
    } catch {
      localStorage.removeItem(key);
    }
  }, [isCreateView, editingId]);

  /** 상단 액션바 높이에 맞춰 좌측 네비 sticky top 오프셋 설정 (겹침 방지) */
  useEffect(() => {
    if (!(isCreateView || editingId)) return;
    const setNavTop = () => {
      const bar = document.getElementById("product-form-actionbar");
      const h = bar?.getBoundingClientRect().height ?? 0;
      const offset = h + 16;
      document.documentElement.style.setProperty("--product-form-nav-top", `${offset}px`);
    };
    const t = setTimeout(setNavTop, 100);
    const ro = new ResizeObserver(() => {
      requestAnimationFrame(setNavTop);
    });
    const observe = () => {
      const bar = document.getElementById("product-form-actionbar");
      if (bar) ro.observe(bar);
    };
    const t2 = setTimeout(observe, 150);
    return () => {
      clearTimeout(t);
      clearTimeout(t2);
      ro.disconnect();
    };
  }, [isCreateView, editingId]);

  /** Scroll Spy: 윈도우 스크롤 기준 activeSectionId 자동 동기화 */
  useEffect(() => {
    if (!(isCreateView || editingId)) return;
    const headerOffset = getStickyHeaderOffset();
    const ids = SECTIONS.map((s) => s.id);

    const els = ids
      .map((id) => document.getElementById(`form-section-${id}`))
      .filter(Boolean) as HTMLElement[];

    if (els.length === 0) return;

    let raf = 0;

    const io = new IntersectionObserver(
      (entries) => {
        const visible = entries
          .filter((e) => e.isIntersecting)
          .map((e) => e.target as HTMLElement)
          .sort((a, b) => a.getBoundingClientRect().top - b.getBoundingClientRect().top);

        const next = visible[0]?.id?.replace("form-section-", "");
        if (!next) return;

        cancelAnimationFrame(raf);
        raf = requestAnimationFrame(() => {
          setActiveSectionId(next as SectionId);
        });
      },
      {
        root: null,
        rootMargin: `-${headerOffset + 8}px 0px -60% 0px`,
        threshold: [0, 0.1, 0.25],
      }
    );

    els.forEach((el) => io.observe(el));

    return () => {
      cancelAnimationFrame(raf);
      io.disconnect();
    };
  }, [isCreateView, editingId]);

  function handleSaveDraft() {
    setIsSavingDraft(true);
    try {
      writeDraftToStorage(form);
      showLocalToast("success", "임시저장 완료");
      markSavedNow(form);
    } catch {
      showLocalToast("error", "임시저장에 실패했습니다.");
    } finally {
      setIsSavingDraft(false);
    }
  }

  const editorShortcutsEnabled =
    (isCreateView || Boolean(editingId)) &&
    !isFeaturedView &&
    !isHomeRegionCardsView &&
    !isHomeThemeCardsView;

  useEditorKeyboardShortcuts({
    enabled: editorShortcutsEnabled,
    onSave: submit,
    onTempSave: handleSaveDraft,
    isSaving: isSubmitting,
    isSavingDraft,
  });

  useEffect(() => {
    if (!(isCreateView || editingId)) {
      setShowShortcutTip(false);
      return;
    }
    try {
      setShowShortcutTip(!localStorage.getItem("editor-shortcut-tip-dismissed"));
    } catch {
      setShowShortcutTip(false);
    }
  }, [isCreateView, editingId]);

  function handleRestoreDraft() {
    if (!draftData) return;
    setForm(draftData.form);
    resetBaseSnapshot(draftData.form);
    markSafeNavigation();
    localStorage.removeItem(getDraftKey(editingId));
    setDraftData(null);
    setShowDraftBanner(false);
    showLocalToast("success", "임시 저장본을 복원했습니다.");
  }

  function handleDismissDraft() {
    localStorage.removeItem(getDraftKey(editingId));
    setDraftData(null);
    setShowDraftBanner(false);
  }

  function handlePreviewClick() {
    if (typeof window === "undefined") return;
    const el = document.getElementById("product-form-preview-panel");
    if (el) {
      el.scrollIntoView({ behavior: "smooth", block: "start" });
    }
  }

  function handleWarningClick(sectionId: SectionId) {
    openSectionAndFocus({ sectionId });
  }

  function runTitleExtract() {
    const candidates = extractTitleCandidates(titleExtractPaste);
    setTitleCandidates(candidates);
    showLocalToast("success", `후보 ${candidates.length}개 추출`);
  }

  async function applyTitleCandidate(candidate: string, append: boolean) {
    const current = form.title.trim();
    if (current && !append) {
      const ok = await confirm({
        title: "상품명 덮어쓰기",
        description: "이미 입력된 상품명이 있습니다. 덮어쓸까요?",
        confirmLabel: "덮어쓰기",
        cancelLabel: "취소",
      });
      if (!ok) return;
    }
    if (append && current) {
      setForm((prev) => ({ ...prev, title: `${current} ${candidate}`.trim() }));
      showLocalToast("success", "상품명에 이어서 붙였습니다.");
    } else {
      setForm((prev) => ({ ...prev, title: candidate }));
      showLocalToast("success", "상품명 적용 완료");
    }
    setShowTitleExtractModal(false);
    setTitleExtractPaste("");
    setTitleCandidates([]);
  }

  function openCoverRecommendModal() {
    const productImages = normalizeImageList(form.images_json);
    const currentCover = form.image_url?.trim();
    const list = currentCover && !productImages.includes(currentCover) ? [currentCover, ...productImages] : productImages;
    const candidates = recommendCoverCandidates({
      productImages: list,
      itineraryImages: list.length === 0 ? itineraryImageUrls : undefined,
    });
    setCoverCandidates(candidates);
    setShowCoverRecommendModal(true);
  }

  function setCoverAsPrimary(url: string) {
    const hadCover = !!(form.image_url?.trim());
    setForm((prev) => ({ ...prev, image_url: url }));
    showLocalToast("success", hadCover ? "대표 이미지를 변경했습니다." : "대표 이미지가 지정되었습니다.");
    setShowCoverRecommendModal(false);
  }

  /** File 선택 시 ObjectURL 생성, 언마운트/파일 변경 시 revoke */
  useEffect(() => {
    if (!previewImageFile) {
      setPreviewImageObjectUrl(null);
      return;
    }
    const url = URL.createObjectURL(previewImageFile);
    setPreviewImageObjectUrl(url);
    return () => {
      URL.revokeObjectURL(url);
    };
  }, [previewImageFile]);

  /** 400ms debounce로 preview API 호출, 성공 시 serverPreview 설정, 실패 시 로컬 fallback 유지 */
  const previewDebounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const previewRequestIdRef = useRef(0);
  useEffect(() => {
    setServerPreview(null);
    previewDebounceRef.current && clearTimeout(previewDebounceRef.current);
    const requestId = ++previewRequestIdRef.current;
    previewDebounceRef.current = setTimeout(() => {
      previewDebounceRef.current = null;
      const imageUrl = previewImageObjectUrl ?? form.images_json[0] ?? form.image_url?.trim() ?? "";
      fetch("/api/admin/products/preview", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ form, imageUrl }),
      })
        .then((res) => {
          if (!res.ok) throw new Error(res.statusText);
          return res.json();
        })
        .then((data: { previewProduct: Product; cardProps: unknown; detailProps: unknown }) => {
          if (requestId !== previewRequestIdRef.current) return;
          setServerPreview({
            previewProduct: data.previewProduct,
            cardProps: data.cardProps as ReturnType<typeof productToCardPropsPayload>,
            detailProps: data.detailProps as ReturnType<typeof productToDetailV2PropsPayload>,
          });
        })
        .catch(() => {
          if (requestId !== previewRequestIdRef.current) return;
          setServerPreview(null);
        });
    }, 400);
    return () => {
      if (previewDebounceRef.current) clearTimeout(previewDebounceRef.current);
    };
  }, [form, previewImageObjectUrl]);

  useEffect(() => {
    if (categoryOptions.length === 0) {
      if (form.category === "") return;
      setForm((prev) => ({ ...prev, category: "" }));
      return;
    }
    if (form.destination_id) return;
    if (categoryOptions.includes(form.category)) return;
    setForm((prev) => ({ ...prev, category: "" }));
  }, [categoryOptions, form.category, form.destination_id]);

  useEffect(() => {
    if (form.destination_id && !activeDestinationIds.has(form.destination_id)) {
      setForm((prev) => ({ ...prev, destination_id: "" }));
    }
  }, [activeDestinationIds, form.destination_id]);

  useEffect(() => {
    setSelectedLevel1Id("");
    setSelectedLevel2Id("");
    setSelectedThemeLevel1Id("");
    setSelectedThemeLevel2Id("");
  }, [editingId]);

  const themeSyncRef = useRef(false);
  useEffect(() => {
    if (themeSyncRef.current) return;
    const allowedThemes = new Set(availableThemeOptions);
    const current = form.theme.trim();
    const cleaned = current && allowedThemes.has(current) ? current : "";
    if (cleaned !== current) {
      themeSyncRef.current = true;
      setForm((prev) => ({ ...prev, theme: cleaned }));
      queueMicrotask(() => { themeSyncRef.current = false; });
    }
  }, [availableThemeOptions, form.theme]);

  const campaignsSyncRef = useRef(false);
  useEffect(() => {
    if (campaignsSyncRef.current) return;
    const allowedCampaigns = new Set(activeCampaignOptions.map((i) => i.name));
    const cleaned = parseCampaignsList(form.campaigns).filter((c) => allowedCampaigns.has(c));
    const cleanedSet = new Set(cleaned);
    const currentSet = new Set(parseCampaignsList(form.campaigns));
    if (cleanedSet.size !== currentSet.size || [...currentSet].some((c) => !cleanedSet.has(c))) {
      campaignsSyncRef.current = true;
      const cleanedText = stringifyCampaignsList(cleaned);
      setForm((prev) => ({ ...prev, campaigns: cleanedText }));
      queueMicrotask(() => { campaignsSyncRef.current = false; });
    }
  }, [activeCampaignOptions, form.campaigns]);

  useEffect(() => {
    const validIds = new Set(activeProductLineOptions.map((i) => i.id));
    if (form.product_line_id && !validIds.has(form.product_line_id)) {
      setForm((prev) => ({ ...prev, product_line_id: "" }));
    }
  }, [activeProductLineOptions, form.product_line_id]);

  useEffect(() => {
    if (scheduleDrafts.length === 0) {
      if (activeSchedulePreviewIndex === 0) return;
      setActiveSchedulePreviewIndex(0);
      return;
    }
    if (activeSchedulePreviewIndex < scheduleDrafts.length) return;
    setActiveSchedulePreviewIndex(scheduleDrafts.length - 1);
  }, [scheduleDrafts, activeSchedulePreviewIndex]);

  function updateScheduleDrafts(updater: (current: DayScheduleDraft[]) => DayScheduleDraft[]) {
    setForm((prev) => {
      const current = parseDetailedSchedule(prev.detailed_schedule);
      const next = updater(current);
      return {
        ...prev,
        detailed_schedule: serializeDetailedSchedule(next),
      };
    });
  }

  function addScheduleDay() {
    const nextIndex = scheduleDrafts.length;
    updateScheduleDrafts((current) => [
      ...current,
      {
        label: createNextDayLabel(current),
        content: "",
      },
    ]);
    setActiveSchedulePreviewIndex(nextIndex);
  }

  function appendScheduleTemplate(index: number, templateText: string) {
    updateScheduleDrafts((current) =>
      current.map((draft, draftIndex) => {
        if (draftIndex !== index) return draft;
        const nextContent = draft.content.trim()
          ? `${draft.content.trim()}\n${templateText}`
          : templateText;
        return { ...draft, content: nextContent };
      }),
    );
    setActiveSchedulePreviewIndex(index);
  }

  async function saveTermsTemplates() {
    try {
      setIsTermsTemplatesSaving(true);
      setTermsTemplatesErrorMessage("");
      const response = await fetch("/api/admin/terms-templates", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(termsTemplates),
      });
      const result = (await response.json()) as { message?: string };
      if (!response.ok) {
        setTermsTemplatesErrorMessage(result.message ?? "약관 템플릿 저장에 실패했습니다.");
        return;
      }
      showToast("success", "약관 템플릿을 저장했습니다.");
    } catch {
      setTermsTemplatesErrorMessage("약관 템플릿 저장 중 오류가 발생했습니다.");
    } finally {
      setIsTermsTemplatesSaving(false);
    }
  }

  function toggleCampaign(name: string) {
    setForm((prev) => {
      const current = parseCampaignsList(prev.campaigns);
      const next = current.includes(name)
        ? current.filter((item) => item !== name)
        : [...current, name];
      return { ...prev, campaigns: stringifyCampaignsList(next) };
    });
  }

  return (
    <div className="space-y-6">
      {isTaxonomyView && (
        <AdminProductTaxonomyView
          activeTab={taxonomyController.activeTab}
          setActiveTab={taxonomyController.setActiveTab}
          taxonomyTabTypes={taxonomyController.taxonomyTabTypes}
          taxonomyItems={taxonomyController.taxonomyItems}
          hasFallbackItems={taxonomyController.hasFallbackItems}
          errorMessage={taxonomyController.errorMessage || null}
          isLoading={taxonomyController.isLoading}
          newNameInput={taxonomyController.newNameInput}
          newSlug={taxonomyController.newSlug}
          newSortOrder={taxonomyController.newSortOrder}
          newParentId={taxonomyController.newParentId}
          pendingCreateType={taxonomyController.pendingCreateType}
          pendingDeleteId={taxonomyController.pendingDeleteId}
          pendingUpdateId={taxonomyController.pendingUpdateId}
          onNameInputChange={taxonomyController.setNewNameInput}
          onSlugChange={taxonomyController.setNewSlug}
          onSortOrderChange={taxonomyController.setNewSortOrder}
          onParentIdChange={taxonomyController.setNewParentId}
          onCreate={taxonomyController.addCustom}
          onDeleteTaxonomy={taxonomyController.handleDeleteTaxonomy}
          onUpdateTaxonomy={taxonomyController.handleUpdateTaxonomy}
        />
      )}

      {isFeaturedView && (
        <div className="space-y-10">
          <AdminProductsCollectionCampaignsManager />
          <AdminHomeCuratedManager />
        </div>
      )}

      {isHomeRegionCardsView && <AdminHomeRegionCardsManager />}

      {isHomeThemeCardsView && <AdminHomeThemeCardsManager />}

      {(isCreateView || editingId) && !isFeaturedView && !isHomeRegionCardsView && !isHomeThemeCardsView ? (
        <AdminProductEditorView>
        <>
        {showShortcutTip ? (
          <div className="mb-2 rounded-lg bg-[var(--primary-soft)] px-3 py-2 text-xs text-[var(--text-primary)]">
            새 기능: ⌘/Ctrl+S 저장 · ⌘/Ctrl+Shift+S 임시저장
            <button
              type="button"
              onClick={() => {
                try {
                  localStorage.setItem("editor-shortcut-tip-dismissed", "1");
                } catch {
                  // ignore
                }
                setShowShortcutTip(false);
              }}
              className="ml-2 underline font-medium"
            >
              닫기
            </button>
          </div>
        ) : null}
        <div className="flex items-start gap-4 lg:gap-6">
        {/* 좌측 필드: 섹션 네비 + 액션 바 (sticky, 문서 흐름 내) */}
        <aside
          className="sticky top-24 z-10 flex max-h-[calc(100vh-6rem)] w-[260px] shrink-0 flex-col gap-4 self-start overflow-hidden rounded-xl border border-[var(--border)] bg-[var(--surface)] p-3 shadow-sm max-md:hidden"
          aria-label="폼 섹션 목차 및 액션"
        >
          <div className="flex min-h-0 flex-1 flex-col overflow-y-auto">
            <ProductFormSectionNav
              sections={SECTIONS.map((s) => ({ id: s.id, title: s.title }))}
              activeSectionId={activeSectionId}
              setActiveSectionId={(id) => setActiveSectionId(id as SectionId)}
              openSection={(id, anchorId) =>
                openSectionAndScrollTo(id as SectionId, anchorId)
              }
              issues={allIssues}
            />
          </div>
          <div className="flex shrink-0 flex-col gap-2 border-t border-[var(--border)] pt-3" role="group" aria-label="상품 등록 액션">
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-bold text-[var(--primary)]">{editingId ? "상품 수정" : "상품 등록"}</h3>
              {editingId ? (
                <button
                  type="button"
                  onClick={() => {
                    markSafeNavigation();
                    try {
                      sessionStorage.removeItem(EDITOR_UI_STATE_KEY(null));
                    } catch {
                      // ignore
                    }
                    setEditingId(null);
                    setForm(initialFormState);
                    resetBaseSnapshot(initialFormState);
                    setActiveSchedulePreviewIndex(0);
                    setShowRawScheduleEditor(false);
                    setScheduleEditorMode("visual");
                    setErrorMessage("");
                  }}
                  className="text-sm font-medium text-[var(--text-muted)] hover:text-[var(--text-primary)]"
                >
                  수정 취소
                </button>
              ) : null}
            </div>
            <ProductFormActionBar
              sections={SECTIONS.map((s) => ({ id: s.id, title: s.title }))}
              openSections={productFormOpenSections}
              setOpenSections={setProductFormOpenSections}
              issues={allIssues}
              onSave={submit}
              onTempSave={handleSaveDraft}
              onNextIssue={goToNextIssue}
              onPreviewClick={handlePreviewClick}
              hasTempDraft={showDraftBanner && !!draftData}
              isSaving={isSubmitting}
              isSavingDraft={isSavingDraft}
              isEditing={Boolean(editingId)}
              sticky={false}
              isDirty={isDirty}
              autosaveStatus={autosaveStatus}
              lastAutosaveAt={lastSavedAt}
            />
          </div>
        </aside>
        {/* 오른쪽 필드: 입력 아코디언 + 미리보기 */}
        <div className="flex min-w-0 flex-1 flex-col gap-4 lg:gap-6">
          {/* 아코디언 폼 (2열 내용) */}
          <main className="min-w-0">
        <form
          className="space-y-4 rounded-xl bg-[var(--surface-muted)] p-4 ring-1 ring-[var(--border)]"
          onSubmit={(e) => {
            e.preventDefault();
            submit();
          }}
          noValidate
        >
        {showDraftBanner && draftData && (
          <div className="rounded-lg border border-amber-200 bg-amber-50 dark:border-amber-800 dark:bg-amber-950/50 px-3 py-2 flex flex-wrap items-center justify-between gap-2">
            <span className="text-sm text-amber-800 dark:text-amber-200">
              임시 저장본이 있습니다 ({new Date(draftData.savedAt).toLocaleString("ko-KR")})
            </span>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={handleRestoreDraft}
                className="rounded-lg bg-amber-600 px-3 py-1.5 text-sm font-semibold text-white hover:bg-amber-700"
              >
                복원
              </button>
              <button
                type="button"
                onClick={handleDismissDraft}
                className="rounded-lg border border-[var(--border)] bg-[var(--surface)] px-3 py-1.5 text-sm font-semibold text-[var(--text-secondary)] hover:bg-[var(--surface-muted)]"
              >
                무시
              </button>
            </div>
          </div>
        )}

        <ProductEditorShell
          sectionIssuesBySection={issuesBySection}
          openSections={productFormOpenSections}
          toggleSection={toggleSection}
          openSectionAndScrollTo={openSectionAndScrollTo}
          basicInfoProps={{
            form,
            setForm,
            setTitleExtractPaste,
            setTitleCandidates,
            setShowTitleExtractModal,
            selectedEvent,
            addProductImageToSelectedEvent,
            showToast,
            previewImageFile,
            setPreviewImageFile,
            openCoverRecommendModal,
            setShowImageImportGuideModal,
          }}
          scheduleProps={{
            form,
            setForm,
            scheduleEditorMode,
            setScheduleEditorMode,
            selectedEvent,
            setSelectedEvent,
            pasteToAddValue,
            setPasteToAddValue,
            getSelectedEventLabel,
            addImagesToEvent,
            showToast,
            previewImageObjectUrl,
            activeSchedulePreviewIndex,
            setActiveSchedulePreviewIndex,
            showRawScheduleEditor,
            setShowRawScheduleEditor,
            scheduleDrafts,
            effectiveDayCount,
            updateScheduleDrafts,
            addScheduleDay,
            appendScheduleTemplate,
          }}
          remainingAccordionProps={{
            form,
            setForm,
            destinationTree,
            destinationPath,
            selectedLevel1Id,
            setSelectedLevel1Id,
            selectedLevel2Id,
            setSelectedLevel2Id,
            themeTree,
            themePath,
            selectedThemeLevel1Id,
            setSelectedThemeLevel1Id,
            selectedThemeLevel2Id,
            setSelectedThemeLevel2Id,
            activeProductLineOptions,
            activeCampaignOptions,
            selectedCampaigns,
            toggleCampaign,
            formatPriceWithCommas,
            termsTemplates,
            setTermsTemplates,
            selectedTermsTemplateContent,
            isTermsTemplatesPanelOpen,
            setIsTermsTemplatesPanelOpen,
            saveTermsTemplates,
            isTermsTemplatesLoading,
            isTermsTemplatesSaving,
            termsTemplatesErrorMessage,
          }}
        />

        {diffSummary.changed && (
          <div
            className="rounded-lg border border-[var(--primary)]/30 bg-[var(--primary-soft)]/20 px-4 py-3 text-sm"
            role="region"
            aria-label="저장 시 반영될 변경사항"
          >
            <p className="mb-2 font-semibold text-[var(--text-primary)]">
              저장 시 반영될 변경사항
            </p>
            <ul className="list-inside list-disc space-y-0.5 text-[var(--text-secondary)]">
              {diffSummary.sections.flatMap((s) =>
                s.items.map((item, i) => (
                  <li key={`${s.key}-${i}`}>{item}</li>
                )),
              )}
            </ul>
          </div>
        )}

        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={() => {
              void handleSubmit();
            }}
            disabled={isSubmitting}
            className="rounded-lg bg-[var(--accent)] px-4 py-2 text-sm font-semibold text-[var(--on-accent)] transition hover:bg-[var(--accent-hover)] active:bg-[var(--accent-active)] disabled:cursor-not-allowed disabled:opacity-50"
          >
            {isSubmitting ? "저장 중..." : editingId ? "수정 저장" : "상품 등록"}
          </button>
          {errorMessage ? <p className="text-xs text-red-600">{errorMessage}</p> : null}
        </div>
        </form>
          </main>
          {/* 실시간 미리보기 — 2열(폼) 하단에 배치 */}
          <aside
            id="product-form-preview-panel"
            className="block"
            aria-label="실시간 미리보기"
          >
            <div className="sticky top-4 space-y-4 rounded-xl border border-[var(--border)] bg-[var(--surface)] ring-1 ring-[var(--border)] p-4">
              <h3 className="text-lg font-bold text-[var(--primary)]">실시간 미리보기</h3>

              {previewWarnings.length > 0 && (
                <div className="space-y-1.5 rounded-lg border border-amber-200 bg-amber-50/80 p-3">
                  <p className="text-xs font-semibold text-amber-800">미리보기 품질 경고</p>
                  <ul className="space-y-1">
                    {previewWarnings.map((w) => (
                      <li key={w.id}>
                        <button
                          type="button"
                          onClick={() => handleWarningClick(w.sectionId)}
                          className="w-full text-left text-xs text-amber-800 underline-offset-2 hover:underline"
                        >
                          {w.message}
                        </button>
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              <details className="rounded-lg border border-[var(--border)] bg-slate-50">
                <summary className="cursor-pointer px-3 py-2 text-sm font-medium text-[var(--text-primary)]">
                  previewProduct 확인 (JSON)
                </summary>
                <div className="relative">
                  <pre className="max-h-48 overflow-auto p-3 text-xs text-[var(--text-secondary)]">
                    {JSON.stringify(effectivePreviewProduct, null, 2)}
                  </pre>
                  <button
                    type="button"
                    onClick={async () => {
                      try {
                        await navigator.clipboard.writeText(
                          JSON.stringify(effectivePreviewProduct, null, 2),
                        );
                        showToast("success", "전체 JSON이 클립보드에 복사되었습니다.");
                      } catch {
                        showToast("error", "클립보드 복사에 실패했습니다.");
                      }
                    }}
                    className="absolute right-2 top-2 rounded border border-[var(--border)] bg-[var(--surface)] px-2 py-1.5 text-xs font-medium text-[var(--text-secondary)] hover:bg-[var(--surface-muted)] hover:text-[var(--text-primary)]"
                  >
                    전체 복사
                  </button>
                </div>
              </details>

              <div className="flex gap-2" role="tablist" aria-label="미리보기 뷰">
                <button
                  type="button"
                  role="tab"
                  aria-selected={previewDevice === "desktop"}
                  onClick={() => setPreviewDevice("desktop")}
                  className={`rounded-lg px-3 py-2 text-sm font-medium transition ${
                    previewDevice === "desktop"
                      ? "bg-[var(--primary)] text-[var(--on-primary)]"
                      : "bg-[var(--surface-muted)] text-[var(--text-secondary)] hover:bg-[var(--border)]"
                  }`}
                >
                  Desktop
                </button>
                <button
                  type="button"
                  role="tab"
                  aria-selected={previewDevice === "mobile"}
                  onClick={() => setPreviewDevice("mobile")}
                  className={`rounded-lg px-3 py-2 text-sm font-medium transition ${
                    previewDevice === "mobile"
                      ? "bg-[var(--primary)] text-[var(--on-primary)]"
                      : "bg-[var(--surface-muted)] text-[var(--text-secondary)] hover:bg-[var(--border)]"
                  }`}
                >
                  Mobile
                </button>
              </div>

              <section className="block" aria-labelledby="preview-card-heading">
                <h4 id="preview-card-heading" className="mb-2 text-sm font-semibold text-[var(--text-primary)]">
                  상품 카드 미리보기
                </h4>
                <div
                  className={`${previewDevice === "mobile" ? "max-w-[360px]" : "max-w-[640px]"} mx-auto`}
                  data-preview-view={previewDevice}
                >
                  <ProductCard {...previewCardProps} />
                </div>
              </section>

              <section className="block" aria-labelledby="preview-detail-heading">
                <h4 id="preview-detail-heading" className="mb-2 text-sm font-semibold text-[var(--text-primary)]">
                  상세 페이지 미리보기
                </h4>
                <label className="mb-2 flex items-center gap-2 text-xs text-[var(--text-secondary)]">
                  <input
                    type="checkbox"
                    checked={showDetailSticky}
                    onChange={(e) => setShowDetailSticky(e.target.checked)}
                    className="h-3.5 w-3.5 accent-[var(--primary)]"
                  />
                  Sticky CTA 표시
                </label>
                <div
                  className={`rounded-xl border border-[#dbeafe] bg-[#f8fbff] ${previewDevice === "mobile" ? "max-w-[360px]" : ""}`}
                  data-preview-view={previewDevice}
                >
                  <ConsultModalProvider>
                    <ProductQuoteProvider>
                      <div className="flex flex-col gap-4 lg:flex-row lg:items-start">
                        <div className="min-w-0 flex-1 space-y-4 p-4">
                          <ProductDetailV2 {...previewDetailProps} />
                        </div>
                        {showDetailSticky && previewDevice !== "mobile" && (
                          <ProductDetailStickyV2Desktop
                            priceFormatted={previewDetailProps.priceFormatted}
                            productId="_preview"
                            productTitle={effectivePreviewProduct.title}
                            sourcePath="/admin/products"
                            kakaoHref="#"
                            status={previewDetailProps.statusTag}
                            trust={undefined}
                          />
                        )}
                      </div>
                      {showDetailSticky && (
                        <ProductDetailStickyV2Mobile
                          priceFormatted={previewDetailProps.priceFormatted}
                          productId="_preview"
                          productTitle={effectivePreviewProduct.title}
                          sourcePath="/admin/products"
                          kakaoHref="#"
                          status={previewDetailProps.statusTag}
                        />
                      )}
                    </ProductQuoteProvider>
                  </ConsultModalProvider>
                </div>
              </section>
            </div>
          </aside>
        </div>
        </div>

          {/* 상품명 추출 모달 */}
          {showTitleExtractModal && (
            <div
              className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
              role="dialog"
              aria-modal="true"
              aria-labelledby="title-extract-modal-title"
              onClick={() => setShowTitleExtractModal(false)}
            >
              <div
                className="max-h-[90vh] w-full max-w-lg overflow-auto rounded-xl border border-[var(--border)] bg-[var(--surface)] p-4 shadow-lg"
                onClick={(e) => e.stopPropagation()}
              >
                <h3 id="title-extract-modal-title" className="mb-3 text-lg font-bold text-[var(--text-primary)]">
                  상품명 추출
                </h3>
                <p className="mb-2 text-xs text-[var(--text-muted)]">
                  원본 페이지에서 상품명/요약(상단 소개)을 복사해 붙여넣으세요.
                </p>
                <textarea
                  value={titleExtractPaste}
                  onChange={(e) => setTitleExtractPaste(e.target.value)}
                  placeholder="텍스트 붙여넣기..."
                  rows={5}
                  className="mb-3 w-full rounded-lg border border-[var(--border)] bg-[var(--surface)] px-3 py-2 text-sm text-[var(--text-primary)] outline-none focus:border-[var(--primary)]"
                />
                <div className="mb-3 flex flex-wrap gap-2">
                  <button
                    type="button"
                    onClick={runTitleExtract}
                    className="rounded-lg bg-[var(--primary)] px-3 py-2 text-sm font-semibold text-[var(--on-primary)] hover:opacity-90"
                  >
                    후보 추출
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setShowTitleExtractModal(false);
                      setTitleExtractPaste("");
                      setTitleCandidates([]);
                    }}
                    className="rounded-lg border border-[var(--border)] bg-[var(--surface)] px-3 py-2 text-sm font-medium text-[var(--text-secondary)] hover:bg-[var(--surface-muted)]"
                  >
                    닫기
                  </button>
                </div>
                {titleCandidates.length > 0 ? (
                  <ul className="space-y-2">
                    {titleCandidates.map((c, i) => (
                      <li key={i} className="flex flex-wrap items-center gap-2 rounded-lg border border-[var(--border)] bg-[var(--surface-muted)] p-2">
                        <span className="min-w-0 flex-1 truncate text-sm text-[var(--text-primary)]">{c}</span>
                        <button
                          type="button"
                          onClick={() => void applyTitleCandidate(c, false)}
                          className="shrink-0 rounded border border-[var(--primary)]/50 bg-[var(--primary-soft)] px-2 py-1 text-xs font-medium text-[var(--primary)]"
                        >
                          상품명에 적용
                        </button>
                        {form.title.trim() ? (
                          <button
                            type="button"
                            onClick={() => void applyTitleCandidate(c, true)}
                            className="shrink-0 rounded border border-[var(--border)] bg-[var(--surface)] px-2 py-1 text-xs text-[var(--text-secondary)] hover:bg-[var(--surface-muted)]"
                          >
                            합치기
                          </button>
                        ) : null}
                      </li>
                    ))}
                  </ul>
                ) : null}
              </div>
            </div>
          )}

          {/* 대표 이미지 추천 모달 */}
          {showCoverRecommendModal && (
            <div
              className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
              role="dialog"
              aria-modal="true"
              aria-labelledby="cover-recommend-modal-title"
              onClick={() => setShowCoverRecommendModal(false)}
            >
              <div
                className="max-h-[90vh] w-full max-w-lg overflow-auto rounded-xl border border-[var(--border)] bg-[var(--surface)] p-4 shadow-lg"
                onClick={(e) => e.stopPropagation()}
              >
                <h3 id="cover-recommend-modal-title" className="mb-3 text-lg font-bold text-[var(--text-primary)]">
                  대표 이미지 추천
                </h3>
                {coverCandidates.length === 0 ? (
                  <p className="text-sm text-[var(--text-muted)]">추천할 이미지가 없습니다. 상품 이미지 또는 일정 이미지를 먼저 등록하세요.</p>
                ) : (
                  <ul className="space-y-3">
                    {coverCandidates.map((c, i) => (
                      <li key={c.url + i} className="flex items-center gap-3 rounded-lg border border-[var(--border)] bg-[var(--surface-muted)] p-3">
                        <div className="h-16 w-24 shrink-0 overflow-hidden rounded bg-[var(--surface)]">
                          <img
                            src={normalizeProductImageUrl(c.url)}
                            alt=""
                            className="h-full w-full object-cover"
                          />
                        </div>
                        <div className="min-w-0 flex-1">
                          <p className="text-xs text-[var(--text-muted)]">{c.reason}</p>
                          <button
                            type="button"
                            onClick={() => setCoverAsPrimary(c.url)}
                            className="mt-1 rounded border border-[var(--primary)]/50 bg-[var(--primary-soft)] px-2 py-1 text-xs font-medium text-[var(--primary)] hover:bg-[var(--primary-soft)]/80"
                          >
                            대표로 지정
                          </button>
                        </div>
                      </li>
                    ))}
                  </ul>
                )}
                <button
                  type="button"
                  onClick={() => setShowCoverRecommendModal(false)}
                  className="mt-3 w-full rounded-lg border border-[var(--border)] bg-[var(--surface)] py-2 text-sm font-medium text-[var(--text-secondary)] hover:bg-[var(--surface-muted)]"
                >
                  닫기
                </button>
              </div>
            </div>
          )}

        </>
        </AdminProductEditorView>
      ) : null}

      {isListView && !editingId && !isFeaturedView && !isHomeRegionCardsView && !isHomeThemeCardsView ? (
        <AdminProductListSection
          showToast={showToast}
          confirm={confirm}
          pageSize={pageSize}
          onAfterDelete={(id) => {
            if (editingId === id) {
              markSafeNavigation();
              try {
                sessionStorage.removeItem(EDITOR_UI_STATE_KEY(null));
              } catch {
                // ignore
              }
              setEditingId(null);
              setForm(initialFormState);
              resetBaseSnapshot(initialFormState);
              setActiveSchedulePreviewIndex(0);
              setShowRawScheduleEditor(false);
              setScheduleEditorMode("visual");
              setErrorMessage("");
            }
          }}
          onEditProduct={(product: Product) => {
            setEditingId(product.id);
            const nextForm = deserializeAdminProductToForm(product);
            setForm(nextForm);
            initialFormSnapshotRef.current = structuredClone(nextForm);
            resetBaseSnapshot(nextForm);
            setSelectedLevel1Id("");
            setSelectedLevel2Id("");
            setSelectedThemeLevel1Id("");
            setSelectedThemeLevel2Id("");
            setActiveSchedulePreviewIndex(0);
            setShowRawScheduleEditor(false);
            setErrorMessage("");
            setTimeout(() => {
              try {
                const raw = sessionStorage.getItem(EDITOR_UI_STATE_KEY(product.id));
                if (!raw) return;
                const parsed = JSON.parse(raw) as { activeSectionId?: string };
                if (parsed.activeSectionId) {
                  openSectionAndScrollTo(parsed.activeSectionId as SectionId);
                }
              } catch {
                // ignore
              }
            }, 0);
          }}
          newProductHref={pathname ? `${pathname.replace(/\?.*$/, "")}?view=create` : undefined}
          registerRefresh={(fn) => {
            refreshListRef.current = fn;
          }}
        />
      ) : null}

      <ImageImportGuideModal
        open={showImageImportGuideModal}
        onClose={() => setShowImageImportGuideModal(false)}
      />

      {toast ? (
        <div className="pointer-events-none fixed bottom-6 right-6 z-50">
          <div
            className={`rounded-xl px-4 py-3 text-sm font-semibold text-white shadow-lg ${
            toast.type === "success" ? "bg-[var(--success)]" : "bg-[var(--danger)]"
            }`}
          >
            {toast.text}
          </div>
        </div>
      ) : null}
    </div>
  );
}

```


---

## File: `src/components/admin/products/editor/ProductEditorSections.tsx`

```tsx
"use client";

import { ChevronDown, AlertCircle } from "lucide-react";
import { ProductFormSectionIssuesPanel } from "@/components/admin/ProductFormSectionIssuesPanel";
import { SECTIONS } from "@/components/admin/products/editor/adminProductForm.validation";
import type { SectionId, SectionIssue } from "@/components/admin/products/editor/adminProductForm.types";
import { BasicInfoSection, type BasicInfoSectionProps } from "./sections/BasicInfoSection";
import { ScheduleSection, type ScheduleSectionProps } from "./sections/ScheduleSection";
import {
  RemainingAccordionSections,
  type RemainingAccordionSectionsProps,
} from "./sections/RemainingAccordionSections";

/** basic / schedule은 전용 컴포넌트, 나머지는 RemainingAccordionSections에서 분기 */
export const SECTION_COMPONENTS = {
  basic: BasicInfoSection,
  schedule: ScheduleSection,
} as const;

export type ProductEditorSectionsProps = {
  sectionIssuesBySection: Record<SectionId, SectionIssue[]>;
  openSections: Record<string, boolean>;
  toggleSection: (id: SectionId) => void;
  openSectionAndScrollTo: (sectionId: SectionId, anchorId?: string) => void;
  basicInfoProps: BasicInfoSectionProps;
  scheduleProps: ScheduleSectionProps;
  remainingAccordionProps: Omit<RemainingAccordionSectionsProps, "sectionId">;
};

export function ProductEditorSections({
  sectionIssuesBySection,
  openSections,
  toggleSection,
  openSectionAndScrollTo,
  basicInfoProps,
  scheduleProps,
  remainingAccordionProps,
}: ProductEditorSectionsProps) {
  return (
    <>
      {SECTIONS.map((section) => {
        const id = section.id;
        const issues = sectionIssuesBySection[id] ?? [];
        const requiredCount = issues.filter((i) => i.severity === "required").length;
        const recommendedCount = issues.filter((i) => i.severity === "recommended").length;
        const badgeLabel =
          requiredCount === 0 && recommendedCount === 0
            ? "완료"
            : requiredCount > 0
              ? `필수 ${requiredCount}개`
              : `권장 ${recommendedCount}개`;
        const badgeVariant =
          requiredCount > 0 ? "required" : recommendedCount > 0 ? "recommended" : "complete";
        return (
          <div
            key={id}
            id={`form-section-${id}`}
            className="overflow-hidden rounded-lg border border-[var(--border)] bg-[var(--surface)] ring-1 ring-[var(--border)]"
          >
            <button
              type="button"
              onClick={() => toggleSection(id as SectionId)}
              className="flex w-full items-center justify-between gap-2 px-4 py-3 text-left font-semibold text-[var(--primary)] hover:bg-[var(--primary-soft)]"
            >
              <span className="flex items-center gap-2">
                {requiredCount > 0 ? (
                  <AlertCircle className="h-4 w-4 shrink-0 text-[var(--danger)]" aria-hidden />
                ) : null}
                {section.title}
              </span>
              <span className="flex items-center gap-2 shrink-0">
                <span
                  className={`rounded-full px-2 py-0.5 text-[10px] font-semibold ${
                    badgeVariant === "complete"
                      ? "bg-[var(--success)]/20 text-[var(--success)]"
                      : badgeVariant === "required"
                        ? "bg-[var(--danger)]/20 text-[var(--danger)]"
                        : "bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-300"
                  }`}
                >
                  {badgeLabel}
                </span>
                <ChevronDown
                  className={`h-5 w-5 shrink-0 transition ${openSections[id] ? "rotate-180" : ""}`}
                />
              </span>
            </button>
            <div
              className={openSections[id] ? "block" : "hidden"}
              aria-hidden={!openSections[id]}
            >
              <div className="border-t border-[var(--divider)] p-4">
                {issues.length > 0 ? (
                  <ProductFormSectionIssuesPanel
                    sectionId={id}
                    sectionIssues={issues}
                    onIssueClick={(anchorId) =>
                      openSectionAndScrollTo(id as SectionId, anchorId ?? undefined)
                    }
                  />
                ) : null}
                {id === "basic" ? (
                  <BasicInfoSection {...basicInfoProps} />
                ) : id === "schedule" ? (
                  <ScheduleSection {...scheduleProps} />
                ) : (
                  <RemainingAccordionSections
                    sectionId={id as RemainingAccordionSectionsProps["sectionId"]}
                    {...remainingAccordionProps}
                  />
                )}
              </div>
            </div>
          </div>
        );
      })}
    </>
  );
}

```


---

## File: `src/components/admin/products/editor/sections/BasicInfoSection.tsx`

```tsx
"use client";

import type { Dispatch, SetStateAction } from "react";
import type { ProductFormState } from "@/types/adminProductForm";
import type { SelectedEventRef } from "@/types/product";
import { MultiImageUploadField } from "@/components/admin/MultiImageUploadField";
import { normalizeProductImageUrl } from "@/lib/media/normalizeProductImageUrl";
import { BOOKMARKLET_EXTRACT_IMAGE_URLS } from "@/lib/bookmarkletExtractImageUrls";

export type BasicInfoSectionProps = {
  form: ProductFormState;
  setForm: Dispatch<SetStateAction<ProductFormState>>;
  setTitleExtractPaste: (v: string) => void;
  setTitleCandidates: (v: string[]) => void;
  setShowTitleExtractModal: (open: boolean) => void;
  selectedEvent: SelectedEventRef | null;
  addProductImageToSelectedEvent: (url: string) => boolean;
  showToast: (type: "success" | "error" | "warning", message: string) => void;
  previewImageFile: File | null;
  setPreviewImageFile: (f: File | null) => void;
  openCoverRecommendModal: () => void;
  setShowImageImportGuideModal: (open: boolean) => void;
};

export function BasicInfoSection({
  form,
  setForm,
  setTitleExtractPaste,
  setTitleCandidates,
  setShowTitleExtractModal,
  selectedEvent,
  addProductImageToSelectedEvent,
  showToast,
  previewImageFile,
  setPreviewImageFile,
  openCoverRecommendModal,
  setShowImageImportGuideModal,
}: BasicInfoSectionProps) {
  return (
        <div className="flex flex-col gap-3">
          <div className="flex flex-wrap items-center gap-2">
          <input
            value={form.title}
            onChange={(event) => setForm((prev) => ({ ...prev, title: event.target.value }))}
            required
            placeholder="상품명"
            id="field-product-name"
            className="min-w-0 flex-1 rounded-lg border border-[var(--border)] bg-[var(--surface)] px-3 py-2 text-sm text-[var(--text-primary)] outline-none focus:border-[var(--primary)] focus:ring-2 focus:ring-[var(--primary-soft)]"
          />
          <button
            type="button"
            onClick={() => {
              setTitleExtractPaste("");
              setTitleCandidates([]);
              setShowTitleExtractModal(true);
            }}
            className="shrink-0 rounded-lg border border-[var(--primary)]/50 bg-[var(--primary-soft)] px-3 py-2 text-sm font-medium text-[var(--primary)] hover:bg-[var(--primary-soft)]/80"
          >
            상품명 추출
          </button>
          </div>
          <div>
            <label className="mb-1 block text-xs font-semibold text-[var(--text-secondary)]">한 줄 소개 (상세 상단 요약)</label>
            <input
              value={form.one_liner}
              onChange={(event) => setForm((prev) => ({ ...prev, one_liner: event.target.value }))}
              placeholder="비우면 상품 설명 첫 줄 사용"
              id="form-field-basic-one_liner"
              className="w-full rounded-lg border border-[var(--border)] bg-[var(--surface)] px-3 py-2 text-sm text-[var(--text-primary)] outline-none focus:border-[var(--primary)] focus:ring-2 focus:ring-[var(--primary-soft)]"
            />
          </div>
            <div className="space-y-3 rounded-xl border border-[var(--border)] bg-[var(--surface-muted)] p-4">
              <p className="text-xs font-semibold text-[var(--text-primary)]">여행 오버뷰 카드 (숙소·지역·기간)</p>
              <p className="text-xs text-[var(--text-muted)]">
                상세 페이지 첫 화면에 표시되는 카드 값입니다. 비우면 기존 자동 추출(meta_info, theme, duration)을 사용합니다.
              </p>
              <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap">
                <div className="space-y-1 min-w-0 flex-1">
                  <label className="block text-xs font-medium text-[var(--text-secondary)]">숙소</label>
                  <input
                    value={form.overview_accommodation}
                    onChange={(e) =>
                      setForm((prev) => ({ ...prev, overview_accommodation: e.target.value }))
                    }
                    placeholder="예: 상담 시 안내, 전일정4성"
                    className="w-full rounded-lg border border-[var(--border)] bg-[var(--surface)] px-3 py-2 text-sm text-[var(--text-primary)] outline-none focus:border-[var(--primary)] focus:ring-2 focus:ring-[var(--primary-soft)]"
                  />
                </div>
                <div className="space-y-1 min-w-0 flex-1">
                  <label className="block text-xs font-medium text-[var(--text-secondary)]">지역</label>
                  <input
                    value={form.overview_region}
                    onChange={(e) =>
                      setForm((prev) => ({ ...prev, overview_region: e.target.value }))
                    }
                    placeholder="예: 호주, 동남아"
                    className="w-full rounded-lg border border-[var(--border)] bg-[var(--surface)] px-3 py-2 text-sm text-[var(--text-primary)] outline-none focus:border-[var(--primary)] focus:ring-2 focus:ring-[var(--primary-soft)]"
                  />
                </div>
                <div className="space-y-1 min-w-0 flex-1">
                  <label className="block text-xs font-medium text-[var(--text-secondary)]">기간</label>
                  <input
                    value={form.overview_duration}
                    onChange={(e) =>
                      setForm((prev) => ({ ...prev, overview_duration: e.target.value }))
                    }
                    placeholder="예: 6일, 3박4일"
                    className="w-full rounded-lg border border-[var(--border)] bg-[var(--surface)] px-3 py-2 text-sm text-[var(--text-primary)] outline-none focus:border-[var(--primary)] focus:ring-2 focus:ring-[var(--primary-soft)]"
                  />
                </div>
              </div>
            </div>
          <div className="space-y-2 md:col-span-2">
            <p className="text-xs font-semibold text-[var(--text-secondary)]">일정 테마 구성비 (상세 오버뷰 차트)</p>
            <p className="text-xs text-[var(--text-muted)]">
              2개 이상 입력 시 상세 페이지에 도넛 차트로 표시됩니다. 미입력 시 카테고리·테마 기반으로 자동 생성됩니다.
            </p>
            <div className="space-y-2">
              {form.theme_chart_json.map((item, idx) => (
                <div
                  key={idx}
                  className="space-y-2 rounded-lg border border-[var(--border)] bg-[var(--surface-muted)] p-2"
                >
                  <input
                    type="text"
                    value={item.label}
                    onChange={(e) =>
                      setForm((prev) => ({
                        ...prev,
                        theme_chart_json: prev.theme_chart_json.map((x, i) =>
                          i === idx ? { ...x, label: e.target.value } : x,
                        ),
                      }))
                    }
                    placeholder="항목명 (예: 자연)"
                    className="flex-1 min-w-[80px] rounded border border-[var(--border)] px-2 py-1.5 text-sm outline-none focus:border-[var(--primary)]"
                  />
                  <input
                    type="number"
                    min={0}
                    max={100}
                    value={item.percent}
                    onChange={(e) => {
                      const v = parseInt(e.target.value, 10);
                      if (!Number.isNaN(v))
                        setForm((prev) => ({
                          ...prev,
                          theme_chart_json: prev.theme_chart_json.map((x, i) =>
                            i === idx ? { ...x, percent: Math.max(0, Math.min(100, v)) } : x,
                          ),
                        }));
                    }}
                    placeholder="%"
                    className="w-16 rounded border border-[var(--border)] px-2 py-1.5 text-sm outline-none focus:border-[var(--primary)]"
                  />
                  <span className="text-xs text-[var(--text-muted)]">%</span>
                  <button
                    type="button"
                    onClick={() =>
                      setForm((prev) => ({
                        ...prev,
                        theme_chart_json: prev.theme_chart_json.filter((_, i) => i !== idx),
                      }))
                    }
                    className="rounded border border-[var(--border)] bg-[var(--surface)] px-2 py-1 text-xs text-[var(--text-secondary)] hover:bg-[var(--surface-muted)]"
                  >
                    삭제
                  </button>
                </div>
              ))}
              <button
                type="button"
                onClick={() =>
                  setForm((prev) => ({
                    ...prev,
                    theme_chart_json: [...prev.theme_chart_json, { label: "", percent: 0 }],
                  }))
                }
                className="rounded-lg border border-dashed border-[var(--border)] bg-[var(--surface)] px-3 py-2 text-xs font-medium text-[var(--text-secondary)] hover:bg-[var(--surface-muted)]"
              >
                + 항목 추가
              </button>
            </div>
          </div>
          <div className="space-y-2">
            <p className="text-xs font-semibold text-[var(--text-secondary)]">상품 상태 (카드/상세 태그)</p>
            <div className="flex flex-wrap gap-2">
              {[
                { value: "AVAILABLE", label: "예약 가능" },
                { value: "LIMITED", label: "잔여 한정" },
                { value: "SOLD_OUT", label: "마감" },
                { value: "CONSULT_REQUIRED", label: "상담 후 안내" },
              ].map((opt) => (
                <button
                  key={opt.value}
                  type="button"
                  onClick={() =>
                    setForm((prev) => ({ ...prev, status: opt.value as ProductFormState["status"] }))
                  }
                  className={`rounded-full px-3 py-1.5 text-xs font-semibold transition ${
                    form.status === opt.value
                      ? "bg-[var(--primary)] text-[var(--on-primary)]"
                      : "border border-[var(--border)] bg-[var(--surface)] text-[var(--text-secondary)] hover:bg-[var(--surface-muted)]"
                  }`}
                >
                  {opt.label}
                </button>
              ))}
            </div>
          </div>
          <div className="space-y-1 md:col-span-2" id="field-product-cover-image" tabIndex={0}>
            <div className="mb-3 rounded-lg border border-[var(--border)] bg-[var(--surface-muted)] p-3">
              <p className="mb-2 text-xs font-semibold text-[var(--text-secondary)]">대표 이미지</p>
              {form.image_url?.trim() || form.images_json.length > 0 ? (
                <div className="flex flex-wrap items-center gap-3">
                  <div className="relative h-14 w-20 shrink-0 overflow-hidden rounded border-2 border-[var(--primary)] bg-[var(--surface-muted)]">
                    <img
                      src={normalizeProductImageUrl(form.image_url?.trim() || form.images_json[0] || "")}
                      alt="대표"
                      className="h-full w-full object-cover"
                    />
                  </div>
                  <div>
                    <p className="text-xs text-[var(--text-primary)]">
                      현재 대표: {form.image_url?.trim() ? "지정됨" : "첫 번째 이미지"}
                    </p>
                    <button
                      type="button"
                      onClick={openCoverRecommendModal}
                      className="mt-1 rounded border border-[var(--primary)]/50 bg-[var(--primary-soft)] px-2 py-1 text-xs font-medium text-[var(--primary)] hover:bg-[var(--primary-soft)]/80"
                    >
                      대표 이미지 추천 보기
                    </button>
                  </div>
                </div>
              ) : (
                <div className="flex flex-wrap items-center gap-2">
                  <span className="text-xs text-[var(--text-muted)]">대표 이미지 미지정</span>
                  <button
                    type="button"
                    onClick={openCoverRecommendModal}
                    className="rounded border border-[var(--primary)]/50 bg-[var(--primary-soft)] px-2 py-1 text-xs font-medium text-[var(--primary)] hover:bg-[var(--primary-soft)]/80"
                  >
                    대표 이미지 추천 보기
                  </button>
                </div>
              )}
            </div>
            <p className="text-xs font-semibold text-[var(--text-primary)]">상품 이미지 (여러 장)</p>
            <MultiImageUploadField
              value={form.images_json}
              primaryImageUrl={form.image_url?.trim() || form.images_json[0] || undefined}
              onChange={(urls) =>
                setForm((prev) => ({
                  ...prev,
                  images_json: urls,
                  image_url: prev.image_url?.trim() || (urls[0] ?? ""),
                }))
              }
              selectedEvent={selectedEvent}
              onAddToEvent={(url) => {
                const added = addProductImageToSelectedEvent(url);
                if (added) showToast("success", "이벤트에 이미지 추가됨");
                else if (selectedEvent) showToast("warning", "이미 해당 이벤트에 등록된 이미지입니다.");
              }}
            />
            <div className="flex flex-wrap items-center gap-2">
              <label className="cursor-pointer rounded-lg border border-[var(--border)] bg-[var(--surface)] px-3 py-2 text-sm font-medium text-[var(--text-secondary)] transition hover:bg-[var(--surface-muted)]">
                미리보기용 이미지 파일 선택
                <input
                  type="file"
                  accept="image/*"
                  className="sr-only"
                  onChange={(e) => {
                    const file = e.target.files?.[0];
                    setPreviewImageFile(file ?? null);
                  }}
                />
              </label>
              {previewImageFile && (
                <span className="text-xs text-[var(--text-secondary)]">
                  {previewImageFile.name}
                  <button
                    type="button"
                    onClick={() => setPreviewImageFile(null)}
                    className="ml-1 text-[var(--danger)] hover:underline"
                  >
                    해제
                  </button>
                </span>
              )}
            </div>
          </div>
          <div className="space-y-1 md:col-span-2">
            <p className="text-xs font-semibold text-[var(--success)]">관리자 전용 | 상품 원본주소</p>
            <div className="flex flex-wrap items-center gap-2">
              <input
                value={form.product_source_url}
                onChange={(event) => setForm((prev) => ({ ...prev, product_source_url: event.target.value }))}
                placeholder="상품 원본주소 (관리자 확인용 URL)"
                className="min-w-0 flex-1 rounded-lg border border-[var(--success)]/30 bg-[var(--success-bg)]/40 px-3 py-2 text-sm outline-none focus:border-[var(--primary)] focus:ring-2 focus:ring-[var(--primary-soft)]"
              />
              <button
                type="button"
                onClick={async () => {
                  try {
                    await navigator.clipboard.writeText(BOOKMARKLET_EXTRACT_IMAGE_URLS);
                    showToast("success", "북마클릿이 복사되었습니다. 사용법은 [!] 버튼을 참고하세요.");
                  } catch {
                    showToast("error", "클립보드 복사에 실패했습니다. 브라우저 권한을 확인해 주세요.");
                  }
                }}
                className="shrink-0 rounded-lg border border-[var(--primary)]/50 bg-[var(--primary-soft)] px-3 py-2 text-sm font-medium text-[var(--primary)] hover:bg-[var(--primary-soft)]/80"
              >
                이미지 추출 도구
              </button>
              <button
                type="button"
                onClick={() => setShowImageImportGuideModal(true)}
                className="shrink-0 rounded-lg border border-[var(--border)] bg-[var(--surface)] px-2.5 py-2 text-xs font-semibold text-[var(--text-secondary)] hover:bg-[var(--surface-muted)]"
                title="이미지 자동 등록 사용법"
              >
                [!]
              </button>
            </div>
            <p className="text-[11px] text-[var(--text-muted)]">
              1) 버튼 눌러 북마클릿 복사 → 2) 브라우저 북마크 URL에 붙여넣기 → 3) 모두투어 등 원본 페이지에서 북마클릿 실행 → URL 복사됨 → 4) 아래 상품 이미지 또는 이벤트 이미지 입력란에 붙여넣기
            </p>
          </div>
                  </div>
  );
}

```


---

## File: `src/components/admin/products/editor/sections/RemainingAccordionSections.tsx`

```tsx
"use client";

import { useState, type Dispatch, type SetStateAction } from "react";
import type { ProductFormState, TermsTemplateType } from "@/types/adminProductForm";
import type { ProductTaxonomyWithUsage } from "@/types/productTaxonomy";
import type { RegionTreeNode } from "@/types/productTaxonomy";
import { AirlineLogo } from "@/components/airlines/AirlineLogo";
import { HintDisclosure } from "@/components/admin/common/HintDisclosure";
import { TERMS_TEMPLATE_OPTIONS } from "@/components/admin/products/editor/adminProductTerms.options";
import {
  INCLUDED_TEMPLATES,
  TERMS_TEMPLATES,
  DESCRIPTION_TEMPLATES,
} from "@/components/admin/products/editor/adminProductTemplates";
import { useTemplateInsert } from "@/components/admin/products/editor/hooks/useTemplateInsert";

export type TermsTemplateMap = Record<TermsTemplateType, string>;

export type RemainingAccordionSectionsProps = {
  sectionId: "taxonomy" | "price" | "description" | "included" | "flight" | "terms";
  form: ProductFormState;
  setForm: Dispatch<SetStateAction<ProductFormState>>;
  destinationTree: RegionTreeNode[];
  destinationPath: RegionTreeNode[];
  selectedLevel1Id: string;
  setSelectedLevel1Id: Dispatch<SetStateAction<string>>;
  selectedLevel2Id: string;
  setSelectedLevel2Id: Dispatch<SetStateAction<string>>;
  themeTree: RegionTreeNode[];
  themePath: RegionTreeNode[];
  selectedThemeLevel1Id: string;
  setSelectedThemeLevel1Id: Dispatch<SetStateAction<string>>;
  selectedThemeLevel2Id: string;
  setSelectedThemeLevel2Id: Dispatch<SetStateAction<string>>;
  activeProductLineOptions: ProductTaxonomyWithUsage[];
  activeCampaignOptions: ProductTaxonomyWithUsage[];
  selectedCampaigns: string[];
  toggleCampaign: (name: string) => void;
  formatPriceWithCommas: (raw: string) => string;
  termsTemplates: TermsTemplateMap;
  setTermsTemplates: Dispatch<SetStateAction<TermsTemplateMap>>;
  selectedTermsTemplateContent: string;
  isTermsTemplatesPanelOpen: boolean;
  setIsTermsTemplatesPanelOpen: Dispatch<SetStateAction<boolean>>;
  saveTermsTemplates: () => Promise<void>;
  isTermsTemplatesLoading: boolean;
  isTermsTemplatesSaving: boolean;
  termsTemplatesErrorMessage: string;
};


export function RemainingAccordionSections(props: RemainingAccordionSectionsProps) {
  const {
    sectionId,
    form,
    setForm,
    destinationTree,
    destinationPath,
    selectedLevel1Id,
    setSelectedLevel1Id,
    selectedLevel2Id,
    setSelectedLevel2Id,
    themeTree,
    themePath,
    selectedThemeLevel1Id,
    setSelectedThemeLevel1Id,
    selectedThemeLevel2Id,
    setSelectedThemeLevel2Id,
    activeProductLineOptions,
    activeCampaignOptions,
    selectedCampaigns,
    toggleCampaign,
    formatPriceWithCommas,
    termsTemplates,
    setTermsTemplates,
    selectedTermsTemplateContent,
    isTermsTemplatesPanelOpen,
    setIsTermsTemplatesPanelOpen,
    saveTermsTemplates,
    isTermsTemplatesLoading,
    isTermsTemplatesSaving,
    termsTemplatesErrorMessage,
  } = props;

  const { insertText, insertIncludedTemplate } = useTemplateInsert(setForm);
  const [includedTemplateSelect, setIncludedTemplateSelect] = useState("");
  const [termsSnippetSelect, setTermsSnippetSelect] = useState("");
  const [descriptionSnippetSelect, setDescriptionSnippetSelect] = useState("");

  switch (sectionId) {
    case "taxonomy":
      return (
        <div className="flex flex-col gap-6" id="form-field-taxonomy-category">
          <div className="space-y-2">
            <p className="text-xs font-semibold text-[var(--text-primary)]">지역 (destination)</p>
            <p className="text-[11px] text-[var(--text-muted)]">상품에 연결할 지역 1개. 대분류 → 중분류 → 소분류 순으로 선택합니다. DB taxonomy 축으로 저장됩니다.</p>
            <div className="space-y-4">
              {destinationTree.length === 0 ? (
                <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-[var(--text-muted)] ring-1 ring-slate-200">
                  지역을 먼저 추가해 주세요 (카테고리/테마 관리에서 추가)
                </span>
              ) : (
                <>
                  {/* 대분류 */}
                  <div className="space-y-1.5">
                    <span className="text-xs font-semibold text-[var(--text-muted)]">대분류</span>
                    <div className="flex flex-wrap gap-2">
                      <button
                        type="button"
                        onClick={() => {
                          setForm((prev) => ({ ...prev, destination_id: "", category: "" }));
                          setSelectedLevel1Id("");
                          setSelectedLevel2Id("");
                        }}
                        className={`rounded-full px-3 py-1 text-xs font-semibold transition ${
                          !form.destination_id && !selectedLevel1Id
                            ? "bg-amber-100 text-amber-800 ring-1 ring-amber-300"
                            : "bg-[var(--surface)] text-[var(--text-secondary)] ring-1 ring-[var(--border)] hover:bg-[var(--surface-muted)]"
                        }`}
                      >
                        미선택
                      </button>
                      {destinationTree.map((node) => {
                        const selected = (destinationPath[0]?.id === node.id) || (!form.destination_id && selectedLevel1Id === node.id);
                        const hasChildren = node.children && node.children.length > 0;
                        return (
                          <button
                            key={node.id}
                            type="button"
                            onClick={() => {
                              if (hasChildren) {
                                setSelectedLevel1Id(node.id);
                                setSelectedLevel2Id("");
                                setForm((prev) => ({ ...prev, destination_id: "", category: "" }));
                              } else {
                                setSelectedLevel1Id("");
                                setSelectedLevel2Id("");
                                setForm((prev) => ({ ...prev, destination_id: node.id, category: node.name }));
                              }
                            }}
                            className={`rounded-full px-3 py-1 text-xs font-semibold transition ${
                              selected && !form.destination_id
                                ? "bg-amber-100 text-amber-800 ring-1 ring-amber-300"
                                : destinationPath[0]?.id === node.id
                                  ? "bg-amber-50 text-amber-700 ring-1 ring-amber-200"
                                  : "bg-[var(--surface)] text-[var(--text-secondary)] ring-1 ring-[var(--border)] hover:bg-[var(--surface-muted)]"
                            }`}
                          >
                            {node.name}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                  {/* 중분류 (대분류 선택 시에만) */}
                  {(() => {
                    const level1Node = destinationPath[0] ?? destinationTree.find((n) => n.id === selectedLevel1Id);
                    const showMid = level1Node && (level1Node.children?.length ?? 0) > 0;
                    if (!showMid) return null;
                    const midChildren = level1Node.children ?? [];
                    return (
                      <div className="space-y-1.5">
                        <span className="text-xs font-semibold text-[var(--text-muted)]">중분류</span>
                        <div className="flex flex-wrap gap-2">
                          {midChildren.map((node) => {
                            const selected = (destinationPath[1]?.id === node.id) || (!form.destination_id && selectedLevel2Id === node.id);
                            const hasChildren = node.children && node.children.length > 0;
                            return (
                              <button
                                key={node.id}
                                type="button"
                                onClick={() => {
                                  if (hasChildren) {
                                    setSelectedLevel2Id(node.id);
                                    setForm((prev) => ({ ...prev, destination_id: "", category: "" }));
                                  } else {
                                    setSelectedLevel1Id("");
                                    setSelectedLevel2Id("");
                                    setForm((prev) => ({ ...prev, destination_id: node.id, category: node.name }));
                                  }
                                }}
                                className={`rounded-full px-3 py-1 text-xs font-semibold transition ${
                                  selected && !form.destination_id
                                    ? "bg-amber-100 text-amber-800 ring-1 ring-amber-300"
                                    : destinationPath[1]?.id === node.id
                                      ? "bg-amber-50 text-amber-700 ring-1 ring-amber-200"
                                      : "bg-[var(--surface)] text-[var(--text-secondary)] ring-1 ring-[var(--border)] hover:bg-[var(--surface-muted)]"
                                }`}
                              >
                                {node.name}
                              </button>
                            );
                          })}
                        </div>
                      </div>
                    );
                  })()}
                  {/* 소분류 (중분류 선택 시에만) */}
                  {(() => {
                    const level1Node = destinationPath[0] ?? destinationTree.find((n) => n.id === selectedLevel1Id);
                    const level2Node = destinationPath[1] ?? (level1Node?.children?.find((n) => n.id === selectedLevel2Id));
                    const showSmall = level2Node && (level2Node.children?.length ?? 0) > 0;
                    if (!showSmall) return null;
                    const smallChildren = level2Node.children ?? [];
                    return (
                      <div className="space-y-1.5">
                        <span className="text-xs font-semibold text-[var(--text-muted)]">소분류</span>
                        <div className="flex flex-wrap gap-2">
                          {smallChildren.map((node) => {
                            const selected = form.destination_id === node.id;
                            return (
                              <button
                                key={node.id}
                                type="button"
                                onClick={() => {
                                  setSelectedLevel1Id("");
                                  setSelectedLevel2Id("");
                                  setForm((prev) => ({ ...prev, destination_id: node.id, category: node.name }));
                                }}
                                className={`rounded-full px-3 py-1 text-xs font-semibold transition ${
                                  selected
                                    ? "bg-amber-100 text-amber-800 ring-1 ring-amber-300"
                                    : "bg-[var(--surface)] text-[var(--text-secondary)] ring-1 ring-[var(--border)] hover:bg-[var(--surface-muted)]"
                                }`}
                              >
                                {node.name}
                              </button>
                            );
                          })}
                        </div>
                      </div>
                    );
                  })()}
                </>
              )}
            </div>
          </div>
          <div className="space-y-2" id="form-field-taxonomy-theme">
            <p className="text-xs font-semibold text-[var(--text-primary)]">테마</p>
            <p className="text-[11px] text-[var(--text-muted)]">대분류 → 중분류 순으로 선택합니다. 1개 선택.</p>
            <div className="space-y-4">
              {themeTree.length === 0 ? (
                <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-[var(--text-muted)] ring-1 ring-slate-200">
                  테마를 먼저 추가해 주세요 (카테고리/테마 관리에서 추가)
                </span>
              ) : (
                <>
                  <div className="space-y-1.5">
                    <span className="text-xs font-semibold text-[var(--text-muted)]">대분류</span>
                    <div className="flex flex-wrap gap-2">
                      <button
                        type="button"
                        onClick={() => {
                          setForm((prev) => ({ ...prev, theme: "" }));
                          setSelectedThemeLevel1Id("");
                          setSelectedThemeLevel2Id("");
                        }}
                        className={`rounded-full px-3 py-1 text-xs font-semibold transition ${
                          !form.theme.trim() && !selectedThemeLevel1Id
                            ? "bg-amber-100 text-amber-800 ring-1 ring-amber-300"
                            : "bg-[var(--surface)] text-[var(--text-secondary)] ring-1 ring-[var(--border)] hover:bg-[var(--surface-muted)]"
                        }`}
                      >
                        미선택
                      </button>
                      {themeTree.map((node) => {
                        const selected = (themePath[0]?.id === node.id) || (!form.theme.trim() && selectedThemeLevel1Id === node.id);
                        const hasChildren = node.children && node.children.length > 0;
                        return (
                          <button
                            key={node.id}
                            type="button"
                            onClick={() => {
                              if (hasChildren) {
                                setSelectedThemeLevel1Id(node.id);
                                setSelectedThemeLevel2Id("");
                                setForm((prev) => ({ ...prev, theme: "" }));
                              } else {
                                setSelectedThemeLevel1Id("");
                                setSelectedThemeLevel2Id("");
                                setForm((prev) => ({ ...prev, theme: node.name }));
                              }
                            }}
                            className={`rounded-full px-3 py-1 text-xs font-semibold transition ${
                              selected && !form.theme.trim()
                                ? "bg-amber-100 text-amber-800 ring-1 ring-amber-300"
                                : themePath[0]?.id === node.id
                                  ? "bg-amber-50 text-amber-700 ring-1 ring-amber-200"
                                  : "bg-[var(--surface)] text-[var(--text-secondary)] ring-1 ring-[var(--border)] hover:bg-[var(--surface-muted)]"
                            }`}
                          >
                            {node.name}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                  {(() => {
                    const level1Node = themePath[0] ?? themeTree.find((n) => n.id === selectedThemeLevel1Id);
                    const showMid = level1Node && (level1Node.children?.length ?? 0) > 0;
                    if (!showMid) return null;
                    const midChildren = level1Node.children ?? [];
                    return (
                      <div className="space-y-1.5">
                        <span className="text-xs font-semibold text-[var(--text-muted)]">중분류</span>
                        <div className="flex flex-wrap gap-2">
                          {midChildren.map((node) => {
                            const selected = (themePath[1]?.id === node.id) || (!form.theme.trim() && selectedThemeLevel2Id === node.id);
                            const hasChildren = node.children && node.children.length > 0;
                            return (
                              <button
                                key={node.id}
                                type="button"
                                onClick={() => {
                                  if (hasChildren) {
                                    setSelectedThemeLevel2Id(node.id);
                                    setForm((prev) => ({ ...prev, theme: "" }));
                                  } else {
                                    setSelectedThemeLevel1Id("");
                                    setSelectedThemeLevel2Id("");
                                    setForm((prev) => ({ ...prev, theme: node.name }));
                                  }
                                }}
                                className={`rounded-full px-3 py-1 text-xs font-semibold transition ${
                                  selected && !form.theme.trim()
                                    ? "bg-amber-100 text-amber-800 ring-1 ring-amber-300"
                                    : themePath[1]?.id === node.id
                                      ? "bg-amber-50 text-amber-700 ring-1 ring-amber-200"
                                      : "bg-[var(--surface)] text-[var(--text-secondary)] ring-1 ring-[var(--border)] hover:bg-[var(--surface-muted)]"
                                }`}
                              >
                                {node.name}
                              </button>
                            );
                          })}
                        </div>
                      </div>
                    );
                  })()}
                  {(() => {
                    const level1Node = themePath[0] ?? themeTree.find((n) => n.id === selectedThemeLevel1Id);
                    const level2Node = themePath[1] ?? (level1Node?.children?.find((n) => n.id === selectedThemeLevel2Id));
                    const showSmall = level2Node && (level2Node.children?.length ?? 0) > 0;
                    if (!showSmall) return null;
                    const smallChildren = level2Node.children ?? [];
                    return (
                      <div className="space-y-1.5">
                        <span className="text-xs font-semibold text-[var(--text-muted)]">소분류</span>
                        <div className="flex flex-wrap gap-2">
                          {smallChildren.map((node) => {
                            const selected = form.theme.trim() === node.name;
                            return (
                              <button
                                key={node.id}
                                type="button"
                                onClick={() => {
                                  setSelectedThemeLevel1Id("");
                                  setSelectedThemeLevel2Id("");
                                  setForm((prev) => ({ ...prev, theme: node.name }));
                                }}
                                className={`rounded-full px-3 py-1 text-xs font-semibold transition ${
                                  selected
                                    ? "bg-amber-100 text-amber-800 ring-1 ring-amber-300"
                                    : "bg-[var(--surface)] text-[var(--text-secondary)] ring-1 ring-[var(--border)] hover:bg-[var(--surface-muted)]"
                                }`}
                              >
                                {node.name}
                              </button>
                            );
                          })}
                        </div>
                      </div>
                    );
                  })()}
                  <p className="text-xs text-[var(--text-muted)]">선택된 테마: {form.theme.trim() || "-"}</p>
                </>
              )}
            </div>
          </div>
          <div className="space-y-2">
            <p className="text-xs font-semibold text-[var(--text-primary)]">상품군</p>
            <div className="flex flex-wrap gap-2">
              {activeProductLineOptions.length === 0 ? (
                <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-[var(--text-muted)] ring-1 ring-slate-200">
                  상품군을 먼저 추가해 주세요 (지역·테마 관리)
                </span>
              ) : (
                <>
                  <button
                    type="button"
                    onClick={() => setForm((prev) => ({ ...prev, product_line_id: "" }))}
                    className={`rounded-full px-3 py-1 text-xs font-semibold transition ${
                      !form.product_line_id
                        ? "bg-amber-100 text-amber-800 ring-1 ring-amber-300"
                        : "bg-[var(--surface)] text-[var(--text-secondary)] ring-1 ring-[var(--border)] hover:bg-[var(--surface-muted)]"
                    }`}
                  >
                    미선택
                  </button>
                  {activeProductLineOptions.map((item) => {
                    const selected = form.product_line_id === item.id;
                    return (
                      <button
                        key={item.id}
                        type="button"
                        onClick={() => setForm((prev) => ({ ...prev, product_line_id: item.id }))}
                        className={`rounded-full px-3 py-1 text-xs font-semibold transition ${
                          selected
                            ? "bg-amber-100 text-amber-800 ring-1 ring-amber-300"
                            : "bg-[var(--surface)] text-[var(--text-secondary)] ring-1 ring-[var(--border)] hover:bg-[var(--surface-muted)]"
                        }`}
                      >
                        {item.name}
                      </button>
                    );
                  })}
                </>
              )}
            </div>
          </div>
          <div className="space-y-2">
            <p className="text-xs font-semibold text-[var(--text-primary)]">기획/추천</p>
            <div className="flex flex-wrap gap-2">
              {activeCampaignOptions.length === 0 ? (
                <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-[var(--text-muted)] ring-1 ring-slate-200">
                  기획 항목을 먼저 추가해 주세요 (지역·테마 관리)
                </span>
              ) : (
                activeCampaignOptions.map((item) => {
                  const selected = selectedCampaigns.includes(item.name);
                  return (
                    <button
                      key={item.id}
                      type="button"
                      onClick={() => toggleCampaign(item.name)}
                      className={`rounded-full px-3 py-1 text-xs font-semibold transition ${
                        selected
                          ? "bg-amber-100 text-amber-800 ring-1 ring-amber-300"
                          : "bg-[var(--surface)] text-[var(--text-secondary)] ring-1 ring-[var(--border)] hover:bg-[var(--surface-muted)]"
                      }`}
                    >
                      {item.name}
                    </button>
                  );
                })
              )}
            </div>
            <p className="text-xs text-[var(--text-muted)]">선택된 기획/추천: {selectedCampaigns.join(", ") || "-"}</p>
          </div>
          <div className="rounded-lg border border-blue-100 bg-blue-50/60 px-3 py-2">
            <p className="text-xs font-medium text-blue-900">여행 오버뷰 품질 가이드</p>
            <p className="mt-0.5 text-xs text-blue-800">
              지역·테마는 상세 첫 화면의 여행 오버뷰 &quot;지역&quot; 카드에 반영됩니다. 대표 이미지는 오버뷰 커버로 사용됩니다.
            </p>
          </div>
        </div>
      );
    case "price":
      return (
        <div className="flex flex-col space-y-3 md:space-y-0 md:grid md:grid-cols-2 md:gap-3">
          <input
            value={form.price}
            onChange={(event) =>
              setForm((prev) => ({ ...prev, price: formatPriceWithCommas(event.target.value) }))
            }
            placeholder="가격(숫자)"
            id="field-price-main"
            className="rounded-lg border border-[var(--border)] bg-[var(--surface)] px-3 py-2 text-sm text-[var(--text-primary)] outline-none focus:border-[var(--primary)] focus:ring-2 focus:ring-[var(--primary-soft)]"
          />
          <input
            value={form.duration}
            onChange={(event) => setForm((prev) => ({ ...prev, duration: event.target.value }))}
            placeholder="일정(예: 5일)"
            className="rounded-lg border border-[var(--border)] bg-[var(--surface)] px-3 py-2 text-sm text-[var(--text-primary)] outline-none focus:border-[var(--primary)] focus:ring-2 focus:ring-[var(--primary-soft)]"
          />
          <p className="text-xs text-[var(--text-muted)] md:col-span-2">일정 값은 여행 오버뷰 &quot;기간&quot; 카드에 반영됩니다.</p>
          <div className="space-y-1">
            <label className="block text-xs font-semibold text-[var(--text-secondary)]">가격 기준 문구</label>
            <input
              value={form.price_meta}
              onChange={(event) => setForm((prev) => ({ ...prev, price_meta: event.target.value }))}
              placeholder="예: 1인 기준 (비우면 기본값 1인 기준)"
              className="w-full rounded-lg border border-[var(--border)] bg-[var(--surface)] px-3 py-2 text-sm text-[var(--text-primary)] outline-none focus:border-[var(--primary)] focus:ring-2 focus:ring-[var(--primary-soft)]"
            />
          </div>
          <div className="space-y-2">
            <p className="text-xs font-semibold text-[var(--text-secondary)]">유류할증료 문구</p>
            <div className="flex flex-wrap gap-2">
              {[
                { value: "", label: "표시 안 함" },
                { value: "true", label: "유류할증료 포함" },
                { value: "false", label: "유류할증료 별도" },
              ].map((opt) => (
                <button
                  key={opt.value || "none"}
                  type="button"
                  onClick={() =>
                    setForm((prev) => ({ ...prev, fuel_included: opt.value as "" | "true" | "false" }))
                  }
                  className={`rounded-full px-3 py-1.5 text-xs font-semibold transition ${
                    form.fuel_included === opt.value
                      ? "bg-[var(--primary)] text-[var(--on-primary)]"
                      : "border border-[var(--border)] bg-[var(--surface)] text-[var(--text-secondary)] hover:bg-[var(--surface-muted)]"
                  }`}
                >
                  {opt.label}
                </button>
              ))}
            </div>
          </div>
          <div className="md:col-span-2">
            <label className="mb-1 block text-xs font-semibold text-[var(--text-secondary)]">카드 메타 문구 (일정·지역 옆 표시)</label>
            <input
              value={form.meta_info}
              onChange={(event) => setForm((prev) => ({ ...prev, meta_info: event.target.value }))}
              placeholder="예: 항공 포함"
              className="w-full rounded-lg border border-[var(--border)] bg-[var(--surface)] px-3 py-2 text-sm text-[var(--text-primary)] outline-none focus:border-[var(--primary)] focus:ring-2 focus:ring-[var(--primary-soft)]"
            />
            <p className="mt-1 text-xs text-[var(--text-muted)]">
              이 값은 상세 첫 화면 여행 오버뷰의 &quot;숙소&quot;·&quot;기타&quot; 카드에 반영될 수 있습니다. (예: 전일정4성, 호텔 등)
            </p>
          </div>
          <div className="space-y-2 rounded-lg border border-[var(--border)] bg-[var(--primary-soft)] p-3 md:col-span-2">
            <p className="text-sm font-semibold text-[var(--primary)]">상품 옵션 (기간·룸 등 선택 시 견적)</p>
            <HintDisclosure
              id="price.optionsJsonGuide"
              summary="가격 옵션 JSON 형식 보기"
            >
              {`JSON 형식. 비우면 옵션 미사용.
필수 필드: basePrice, currency, groups 배열.
선택: requiredGroups (필수 선택 그룹 키 배열).

예시:
{"basePrice": 1000000, "currency": "KRW", "requiredGroups": ["period"], "groups": [{"key": "period", "title": "기간", "type": "radio", "items": [{"value": "3n4d", "label": "3박4일", "priceDelta": 0, "isDefault": true}, {"value": "4n5d", "label": "4박5일", "priceDelta": 200000}]}]}`}
            </HintDisclosure>
            <textarea
              value={form.options_json}
              onChange={(event) => setForm((prev) => ({ ...prev, options_json: event.target.value }))}
              rows={8}
              placeholder='{"basePrice": 1000000, "currency": "KRW", "requiredGroups": ["period"], "groups": [{"key": "period", "title": "기간", "type": "radio", "items": [{"value": "3n4d", "label": "3박4일", "priceDelta": 0, "isDefault": true}, {"value": "4n5d", "label": "4박5일", "priceDelta": 200000}]}]}'
              className="w-full rounded-lg border border-[var(--border)] px-3 py-2 font-mono text-xs outline-none focus:border-[var(--primary)] focus:ring-2 focus:ring-[var(--primary-soft)]"
            />
          </div>
                  </div>
      );
    case "description":
      return (
        <div className="flex flex-col space-y-3 md:space-y-0 md:grid md:grid-cols-2 md:gap-3">
          <textarea
            value={form.description}
            onChange={(event) => setForm((prev) => ({ ...prev, description: event.target.value }))}
            required
            rows={4}
            placeholder="상품 설명 (필요 시 직접 작성. 모두투어 import는 자동 반영하지 않습니다.)"
            id="field-product-description"
            className="rounded-lg border border-[var(--border)] bg-[var(--surface)] px-3 py-2 text-sm text-[var(--text-primary)] outline-none focus:border-[var(--primary)] focus:ring-2 focus:ring-[var(--primary-soft)] md:col-span-2"
          />
          <textarea
            value={form.point_benefits}
            onChange={(event) => setForm((prev) => ({ ...prev, point_benefits: event.target.value }))}
            rows={3}
            placeholder="상품 포인트 - 혜택 (줄바꿈 가능)"
            className="rounded-lg border border-[var(--border)] bg-[var(--surface)] px-3 py-2 text-sm text-[var(--text-primary)] outline-none focus:border-[var(--primary)] focus:ring-2 focus:ring-[var(--primary-soft)]"
          />
          <div className="rounded-lg border border-[var(--border)] bg-[var(--surface)]/80 p-3 md:col-span-2">
            <p className="mb-3 text-sm font-semibold text-[var(--text-primary)]">상품 포인트 O/X 선택</p>
            <div className="flex flex-col space-y-3 md:space-y-0 md:grid md:grid-cols-2 md:gap-3">
              {[
                { key: "travel_insurance", label: "상품 포인트 - 여행자보험" },
                { key: "meeting_info", label: "상품 포인트 - 미팅 정보" },
                { key: "point_tourism", label: "상품 포인트 - 관광" },
                { key: "point_guide", label: "상품 포인트 - 인솔자" },
              ].map((field) => {
                const fieldKey = field.key as
                  | "travel_insurance"
                  | "meeting_info"
                  | "point_tourism"
                  | "point_guide";
                const value = form[fieldKey];
                return (
                  <div key={field.key} className="rounded-lg border border-[var(--border)] bg-[var(--surface)] p-3">
                    <p className="mb-2 text-xs font-semibold text-[var(--text-primary)]">{field.label}</p>
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() => setForm((prev) => ({ ...prev, [fieldKey]: "O" }))}
                        className={`rounded-md px-3 py-1.5 text-xs font-semibold transition ${
                          value === "O"
                            ? "bg-emerald-600 text-white"
                            : "border border-[var(--border)] bg-[var(--surface)] text-[var(--text-secondary)] hover:bg-[var(--surface-muted)]"
                        }`}
                      >
                        O
                      </button>
                      <button
                        type="button"
                        onClick={() => setForm((prev) => ({ ...prev, [fieldKey]: "X" }))}
                        className={`rounded-md px-3 py-1.5 text-xs font-semibold transition ${
                          value === "X"
                            ? "bg-rose-600 text-white"
                            : "border border-[var(--border)] bg-[var(--surface)] text-[var(--text-secondary)] hover:bg-[var(--surface-muted)]"
                        }`}
                      >
                        X
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
                  </div>
      );
    case "included":
      return (
        <div className="flex flex-col space-y-3 md:space-y-0 md:grid md:grid-cols-2 md:gap-3">
          <div className="md:col-span-2 space-y-2">
            <p className="text-[11px] text-[var(--text-muted)]">템플릿으로 빠르게 입력할 수 있습니다</p>
            <div className="flex flex-wrap items-center gap-2">
              <select
                value={includedTemplateSelect}
                onChange={(e) => {
                  const id = e.target.value;
                  if (!id) return;
                  const template = INCLUDED_TEMPLATES.find((t) => t.id === id);
                  if (template) insertIncludedTemplate(template, "replace");
                  setIncludedTemplateSelect("");
                }}
                className="rounded-lg border border-[var(--border)] bg-[var(--surface)] px-3 py-2 text-sm text-[var(--text-primary)] outline-none focus:border-[var(--primary)] focus:ring-2 focus:ring-[var(--primary-soft)]"
              >
                <option value="">템플릿 적용</option>
                {INCLUDED_TEMPLATES.map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.label}
                  </option>
                ))}
              </select>
              {INCLUDED_TEMPLATES[0] ? (
                <button
                  type="button"
                  onClick={() => insertIncludedTemplate(INCLUDED_TEMPLATES[0], "append")}
                  className="rounded-lg border border-[var(--border)] bg-[var(--surface)] px-3 py-2 text-xs font-semibold text-[var(--text-secondary)] hover:bg-[var(--surface-muted)]"
                >
                  추가 삽입
                </button>
              ) : null}
            </div>
          </div>
          <textarea
            value={form.included_items}
            onChange={(event) => setForm((prev) => ({ ...prev, included_items: event.target.value }))}
            rows={3}
            placeholder="포함 사항 (자동 추출하지 않습니다. 필요 시 직접 입력해 주세요.)"
            id="field-included"
            className="rounded-lg border border-[var(--border)] bg-[var(--surface)] px-3 py-2 text-sm text-[var(--text-primary)] outline-none focus:border-[var(--primary)] focus:ring-2 focus:ring-[var(--primary-soft)]"
          />
          <textarea
            value={form.excluded_items}
            onChange={(event) => setForm((prev) => ({ ...prev, excluded_items: event.target.value }))}
            rows={3}
            placeholder="불포함 사항 (자동 추출하지 않습니다. 필요 시 직접 입력해 주세요.)"
            id="field-excluded"
            className="rounded-lg border border-[var(--border)] bg-[var(--surface)] px-3 py-2 text-sm text-[var(--text-primary)] outline-none focus:border-[var(--primary)] focus:ring-2 focus:ring-[var(--primary-soft)]"
          />
          <div className="flex flex-col gap-3 sm:flex-row sm:items-start md:col-span-2">
            <div className="flex-1">
              <label className="mb-1 block text-xs font-semibold text-[var(--text-secondary)]">선택관광 목록 (줄바꿈 가능)</label>
              <textarea
                value={form.optional_tours}
                onChange={(event) => setForm((prev) => ({ ...prev, optional_tours: event.target.value }))}
                rows={4}
                placeholder="선택관광 목록 (줄바꿈 가능)"
                className="w-full rounded-lg border border-[var(--border)] bg-[var(--surface)] px-3 py-2 text-sm text-[var(--text-primary)] outline-none focus:border-[var(--primary)] focus:ring-2 focus:ring-[var(--primary-soft)]"
              />
            </div>
            <div className="w-full sm:w-48 shrink-0">
              <label className="mb-1 block text-xs font-semibold text-[var(--text-secondary)]">출발인원 (~명 이상)</label>
              <input
                type="text"
                value={form.min_departure_people}
                onChange={(event) => setForm((prev) => ({ ...prev, min_departure_people: event.target.value }))}
                placeholder="예: 10"
                className="w-full rounded-lg border border-[var(--border)] bg-[var(--surface)] px-3 py-2 text-sm text-[var(--text-primary)] outline-none focus:border-[var(--primary)] focus:ring-2 focus:ring-[var(--primary-soft)]"
              />
            </div>
          </div>
                  </div>
      );
    case "flight":
      return (
        <div className="flex flex-col space-y-3 md:space-y-0 md:grid md:grid-cols-2 md:gap-3">
          <div className="space-y-3 rounded-lg border border-[var(--border)] bg-[var(--primary-soft)] p-3 md:col-span-2">
            <p className="text-sm font-semibold text-[var(--primary)]">항공편 정보</p>
            <p className="text-xs text-[var(--text-secondary)]">
              출발/도착 공항·편명은 상세 첫 화면 여행 오버뷰의 &quot;항공&quot; 카드에 자동 반영됩니다.
            </p>
            <p className="text-xs text-[var(--text-muted)]">
              현재는 라이선스 문제로 실제 항공사 로고 이미지는 사용하지 않고, 아이콘 + 텍스트만 표시됩니다. 추후
              라이선스 획득 시 이 프리뷰 영역과 상세페이지에 로고가 자동 업데이트됩니다.
            </p>
            <div className="flex flex-col space-y-3 md:space-y-0 md:grid md:grid-cols-2 md:gap-3">
              <div className="space-y-2 rounded-lg border border-[var(--border)] bg-[var(--surface)] p-3">
                <p className="text-xs font-semibold text-[var(--text-primary)]">출발 항공편</p>
                <div className="flex flex-col space-y-2 md:space-y-0 md:grid md:grid-cols-2 md:gap-2">
                  <input
                    value={form.departure_from_airport}
                    onChange={(event) =>
                      setForm((prev) => ({ ...prev, departure_from_airport: event.target.value }))
                    }
                    placeholder="출발공항 (예: 인천 ICN)"
                    className="rounded-lg border border-[var(--border)] px-3 py-2 text-xs outline-none focus:border-[var(--primary)] focus:ring-2 focus:ring-[var(--primary-soft)]"
                  />
                  <input
                    value={form.departure_to_airport}
                    onChange={(event) =>
                      setForm((prev) => ({ ...prev, departure_to_airport: event.target.value }))
                    }
                    placeholder="도착공항 (예: 미야자키 KMI)"
                    className="rounded-lg border border-[var(--border)] px-3 py-2 text-xs outline-none focus:border-[var(--primary)] focus:ring-2 focus:ring-[var(--primary-soft)]"
                  />
                  <input
                    value={form.departure_from_date}
                    onChange={(event) =>
                      setForm((prev) => ({ ...prev, departure_from_date: event.target.value }))
                    }
                    placeholder="출발일자 (예: 2026.02.20(금))"
                    className="rounded-lg border border-[var(--border)] px-3 py-2 text-xs outline-none focus:border-[var(--primary)] focus:ring-2 focus:ring-[var(--primary-soft)]"
                  />
                  <input
                    value={form.departure_to_date}
                    onChange={(event) =>
                      setForm((prev) => ({ ...prev, departure_to_date: event.target.value }))
                    }
                    placeholder="도착일자 (예: 2026.02.20(금))"
                    className="rounded-lg border border-[var(--border)] px-3 py-2 text-xs outline-none focus:border-[var(--primary)] focus:ring-2 focus:ring-[var(--primary-soft)]"
                  />
                  <input
                    value={form.departure_from_time}
                    onChange={(event) =>
                      setForm((prev) => ({ ...prev, departure_from_time: event.target.value }))
                    }
                    placeholder="출발시각 (예: 09:40)"
                    className="rounded-lg border border-[var(--border)] px-3 py-2 text-xs outline-none focus:border-[var(--primary)] focus:ring-2 focus:ring-[var(--primary-soft)]"
                  />
                  <input
                    value={form.departure_to_time}
                    onChange={(event) =>
                      setForm((prev) => ({ ...prev, departure_to_time: event.target.value }))
                    }
                    placeholder="도착시각 (예: 11:20)"
                    className="rounded-lg border border-[var(--border)] px-3 py-2 text-xs outline-none focus:border-[var(--primary)] focus:ring-2 focus:ring-[var(--primary-soft)]"
                  />
                </div>
                <div className="space-y-1">
                  <div className="flex items-center gap-3">
                    <input
                      value={form.departure_flight_name}
                      onChange={(event) =>
                        setForm((prev) => ({ ...prev, departure_flight_name: event.target.value }))
                      }
                      placeholder="항공편명 (예: 아시아나항공, 티웨이항공 TW501)"
                      id="form-field-flight-departure_flight_name"
                      className="flex-1 rounded-lg border border-[var(--border)] px-3 py-2 text-xs outline-none focus:border-[var(--primary)] focus:ring-2 focus:ring-[var(--primary-soft)]"
                    />
                    <AirlineLogo airlineText={form.departure_flight_name} size={32} />
                  </div>
                  <input
                    value={form.departure_baggage_limit}
                    onChange={(event) =>
                      setForm((prev) => ({ ...prev, departure_baggage_limit: event.target.value }))
                    }
                    placeholder="수하물 한도 (예: 23 또는 23KG)"
                    className="w-full rounded-lg border border-[var(--border)] px-3 py-2 text-xs outline-none focus:border-[var(--primary)] focus:ring-2 focus:ring-[var(--primary-soft)]"
                  />
                  {/* 현재는 항상 Plane + 텍스트만 표시 (로고 비활성화) */}
                </div>
              </div>

              <div className="space-y-2 rounded-lg border border-[var(--border)] bg-[var(--surface)] p-3">
                <p className="text-xs font-semibold text-[var(--text-primary)]">도착 항공편</p>
                <div className="flex flex-col space-y-2 md:space-y-0 md:grid md:grid-cols-2 md:gap-2">
                  <input
                    value={form.arrival_from_airport}
                    onChange={(event) =>
                      setForm((prev) => ({ ...prev, arrival_from_airport: event.target.value }))
                    }
                    placeholder="출발공항 (예: 미야자키 KMI)"
                    className="rounded-lg border border-[var(--border)] px-3 py-2 text-xs outline-none focus:border-[var(--primary)] focus:ring-2 focus:ring-[var(--primary-soft)]"
                  />
                  <input
                    value={form.arrival_to_airport}
                    onChange={(event) =>
                      setForm((prev) => ({ ...prev, arrival_to_airport: event.target.value }))
                    }
                    placeholder="도착공항 (예: 인천 ICN)"
                    className="rounded-lg border border-[var(--border)] px-3 py-2 text-xs outline-none focus:border-[var(--primary)] focus:ring-2 focus:ring-[var(--primary-soft)]"
                  />
                  <input
                    value={form.arrival_from_date}
                    onChange={(event) =>
                      setForm((prev) => ({ ...prev, arrival_from_date: event.target.value }))
                    }
                    placeholder="출발일자 (예: 2026.02.23(월))"
                    className="rounded-lg border border-[var(--border)] px-3 py-2 text-xs outline-none focus:border-[var(--primary)] focus:ring-2 focus:ring-[var(--primary-soft)]"
                  />
                  <input
                    value={form.arrival_to_date}
                    onChange={(event) =>
                      setForm((prev) => ({ ...prev, arrival_to_date: event.target.value }))
                    }
                    placeholder="도착일자 (예: 2026.02.23(월))"
                    className="rounded-lg border border-[var(--border)] px-3 py-2 text-xs outline-none focus:border-[var(--primary)] focus:ring-2 focus:ring-[var(--primary-soft)]"
                  />
                  <input
                    value={form.arrival_from_time}
                    onChange={(event) =>
                      setForm((prev) => ({ ...prev, arrival_from_time: event.target.value }))
                    }
                    placeholder="출발시각 (예: 12:30)"
                    className="rounded-lg border border-[var(--border)] px-3 py-2 text-xs outline-none focus:border-[var(--primary)] focus:ring-2 focus:ring-[var(--primary-soft)]"
                  />
                  <input
                    value={form.arrival_to_time}
                    onChange={(event) =>
                      setForm((prev) => ({ ...prev, arrival_to_time: event.target.value }))
                    }
                    placeholder="도착시각 (예: 14:10)"
                    className="rounded-lg border border-[var(--border)] px-3 py-2 text-xs outline-none focus:border-[var(--primary)] focus:ring-2 focus:ring-[var(--primary-soft)]"
                  />
                </div>
                <div className="space-y-1">
                  <div className="flex items-center gap-3">
                    <input
                      value={form.arrival_flight_name}
                      onChange={(event) =>
                        setForm((prev) => ({ ...prev, arrival_flight_name: event.target.value }))
                      }
                      placeholder="항공편명 (예: 아시아나항공, 티웨이항공 TW501)"
                      id="form-field-flight-arrival_flight_name"
                      className="flex-1 rounded-lg border border-[var(--border)] px-3 py-2 text-xs outline-none focus:border-[var(--primary)] focus:ring-2 focus:ring-[var(--primary-soft)]"
                    />
                    <AirlineLogo airlineText={form.arrival_flight_name} size={32} />
                  </div>
                  <input
                    value={form.arrival_baggage_limit}
                    onChange={(event) =>
                      setForm((prev) => ({ ...prev, arrival_baggage_limit: event.target.value }))
                    }
                    placeholder="수하물 한도 (예: 23 또는 23KG)"
                    className="w-full rounded-lg border border-[var(--border)] px-3 py-2 text-xs outline-none focus:border-[var(--primary)] focus:ring-2 focus:ring-[var(--primary-soft)]"
                  />
                  {/* 현재는 항상 Plane + 텍스트만 표시 (로고 비활성화) */}
                </div>
              </div>
            </div>
          </div>
                  </div>
      );
    case "terms":
      return (
        <div className="flex flex-col space-y-3 md:space-y-0 md:grid md:grid-cols-2 md:gap-3">
          <div className="md:col-span-2 space-y-2">
            <p className="text-[11px] text-[var(--text-muted)]">템플릿으로 빠르게 입력할 수 있습니다</p>
            <select
              value={termsSnippetSelect}
              onChange={(e) => {
                const id = e.target.value;
                if (!id) return;
                const t = TERMS_TEMPLATES.find((x) => x.id === id);
                if (t) insertText("terms_and_notes", t.content, "replace");
                setTermsSnippetSelect("");
              }}
              className="w-full max-w-xs rounded-lg border border-[var(--border)] bg-[var(--surface)] px-3 py-2 text-sm text-[var(--text-primary)] outline-none focus:border-[var(--primary)] focus:ring-2 focus:ring-[var(--primary-soft)]"
            >
              <option value="">약관 템플릿</option>
              {TERMS_TEMPLATES.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.label}
                </option>
              ))}
            </select>
          </div>
          <div className="space-y-2 rounded-lg border border-[var(--border)] bg-[var(--primary-soft)] p-3 md:col-span-2">
            <p className="text-sm font-semibold text-[var(--primary)]">약관 및 참조사항 템플릿 적용</p>
            <select
              value={form.terms_template_type}
              onChange={(event) =>
                setForm((prev) => ({
                  ...prev,
                  terms_template_type: event.target.value as "" | TermsTemplateType,
                }))
              }
              className="w-full rounded-lg border border-[var(--border)] bg-[var(--surface)] px-3 py-2 text-sm outline-none focus:border-[var(--primary)] focus:ring-2 focus:ring-[var(--primary-soft)]"
            >
              <option value="">직접 입력 (템플릿 미사용)</option>
              {TERMS_TEMPLATE_OPTIONS.map((item) => (
                <option key={item.value} value={item.value}>
                  {item.label}
                </option>
              ))}
            </select>
            {form.terms_template_type ? (
              <div className="rounded-lg border border-[var(--border)] bg-[var(--surface)] p-3">
                <p className="mb-2 text-xs font-semibold text-[var(--text-primary)]">선택 템플릿 미리보기</p>
                <p className="whitespace-pre-line text-xs leading-6 text-[var(--text-secondary)]">
                  {selectedTermsTemplateContent.trim() || "템플릿 내용이 비어 있습니다. 아래에서 수정해 주세요."}
                </p>
              </div>
            ) : null}
            <textarea
              value={form.terms_and_notes}
              onChange={(event) => setForm((prev) => ({ ...prev, terms_and_notes: event.target.value }))}
              rows={4}
              placeholder="예약 조건·환불·취소 규정 등 (운영자가 직접 확인 후 입력해 주세요. 모두투어 import는 자동 반영하지 않습니다.)"
              className="w-full rounded-lg border border-[var(--border)] bg-[var(--surface)] px-3 py-2 text-sm outline-none focus:border-[var(--primary)] focus:ring-2 focus:ring-[var(--primary-soft)]"
            />
          </div>
          <div className="space-y-3 rounded-lg border border-[var(--border)] bg-[var(--surface)]/90 p-3 md:col-span-2">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <p className="text-sm font-semibold text-[var(--text-primary)]">약관 템플릿 관리 (공통)</p>
              <button
                type="button"
                onClick={() => setIsTermsTemplatesPanelOpen((prev) => !prev)}
                className="rounded-lg border border-[var(--border)] bg-[var(--surface)] px-3 py-1.5 text-xs font-semibold text-[var(--text-primary)] hover:bg-[var(--surface-muted)] disabled:opacity-50"
              >
                {isTermsTemplatesPanelOpen ? "접기" : "펼치기"}
              </button>
            </div>
            {!isTermsTemplatesPanelOpen ? (
              <p className="text-xs text-[var(--text-muted)]">
                안전을 위해 기본 접힘 상태입니다. 수정이 필요할 때만 펼쳐서 사용해 주세요.
              </p>
            ) : (
              <>
                <div className="flex justify-end">
                  <button
                    type="button"
                    onClick={saveTermsTemplates}
                    disabled={isTermsTemplatesLoading || isTermsTemplatesSaving}
                    className="rounded-lg border border-[var(--border)] bg-[var(--surface)] px-3 py-1.5 text-xs font-semibold text-[var(--text-primary)] hover:bg-[var(--surface-muted)] disabled:opacity-50"
                  >
                    {isTermsTemplatesSaving ? "저장 중..." : "템플릿 저장"}
                  </button>
                </div>
                {termsTemplatesErrorMessage ? (
                  <p className="text-xs text-rose-600">{termsTemplatesErrorMessage}</p>
                ) : null}
                <div className="flex flex-col space-y-3 md:space-y-0 md:grid md:grid-cols-2 md:gap-3">
                  {TERMS_TEMPLATE_OPTIONS.map((item) => (
                    <div key={item.value} className="space-y-1 rounded-lg border border-[var(--border)] bg-slate-50 p-2.5">
                      <p className="text-xs font-semibold text-[var(--text-primary)]">{item.label}</p>
                      <textarea
                        value={termsTemplates[item.value]}
                        onChange={(event) =>
                          setTermsTemplates((prev) => ({
                            ...prev,
                            [item.value]: event.target.value,
                          }))
                        }
                        rows={5}
                        placeholder={`${item.label} 약관 템플릿을 입력하세요.`}
                        className="w-full rounded-md border border-[var(--border)] bg-[var(--surface)] px-2.5 py-2 text-xs leading-5 outline-none focus:border-[var(--primary)] focus:ring-2 focus:ring-[var(--primary-soft)]"
                      />
                    </div>
                  ))}
                </div>
              </>
            )}
          </div>
          <input
            value={form.meta_title}
            onChange={(event) => setForm((prev) => ({ ...prev, meta_title: event.target.value }))}
            placeholder="SEO 메타 타이틀 (선택). 스페이스로 구분한 키워드는 상품 상세페이지에 해시태그(#키워드)로 노출됩니다. 예: 태국 파크골프 치앙마이"
            id="field-seo-title"
            className="rounded-lg border border-[var(--border)] bg-[var(--surface)] px-3 py-2 text-sm text-[var(--text-primary)] outline-none focus:border-[var(--primary)] focus:ring-2 focus:ring-[var(--primary-soft)] md:col-span-2"
          />
          <textarea
            value={form.meta_description}
            onChange={(event) => setForm((prev) => ({ ...prev, meta_description: event.target.value }))}
            rows={3}
            placeholder="SEO 메타 설명 (선택, 예시: 타깃층 문제해결 + 차별화된 혜택/신뢰 요소 + CTA포함)"
            id="field-seo-desc"
            className="rounded-lg border border-[var(--border)] bg-[var(--surface)] px-3 py-2 text-sm text-[var(--text-primary)] outline-none focus:border-[var(--primary)] focus:ring-2 focus:ring-[var(--primary-soft)] md:col-span-2"
          />
          <input
            value={form.sort_order}
            onChange={(event) => setForm((prev) => ({ ...prev, sort_order: event.target.value }))}
            placeholder="노출 순서 (숫자 작을수록 먼저)"
            className="rounded-lg border border-[var(--border)] bg-[var(--surface)] px-3 py-2 text-sm text-[var(--text-primary)] outline-none focus:border-[var(--primary)] focus:ring-2 focus:ring-[var(--primary-soft)]"
          />
          <label className="flex items-center gap-2 text-sm text-[var(--text-primary)]">
            <input
              type="checkbox"
              checked={form.is_active}
              onChange={(event) => setForm((prev) => ({ ...prev, is_active: event.target.checked }))}
                          className="h-4 w-4 accent-[var(--primary)]"
            />
            상품 노출 활성화
          </label>
        </div>
      );
    default:
      return null;
  }
}

```


---

## File: `src/components/admin/products/editor/adminProductForm.types.ts`

```typescript
/**
 * Admin product form - 공통 타입/섹션 이슈 타입
 * ProductFormState 등은 @/types/adminProductForm 재사용
 */

import type { ProductFormState as AdminProductFormState } from "@/types/adminProductForm";

export type {
  ProductFormState,
  ProductFormDraft,
  TermsTemplateType,
} from "@/types/adminProductForm";

export type SectionId =
  | "basic"
  | "taxonomy"
  | "price"
  | "description"
  | "included"
  | "schedule"
  | "flight"
  | "terms";

export type IssueSeverity = "required" | "recommended";

export type FormIssue = {
  sectionId: SectionId;
  severity: IssueSeverity;
  message: string;
  anchorId?: string;
};

export type SectionIssue = FormIssue & {
  fieldKey: string;
};

export type SectionConfig = {
  id: SectionId;
  title: string;
  description?: string;
  getIssues: (form: AdminProductFormState) => SectionIssue[];
};

/** 저장 payload (serializer 출력) */
export type AdminProductSavePayload = Record<string, unknown>;

```


---

## File: `src/components/admin/products/editor/adminProductForm.defaults.ts`

```typescript
/**
 * Admin product form - 신규 등록 시 초기 form state
 */

export { createEmptyProductFormState as createEmptyAdminProductFormState } from "@/types/adminProductForm";

```


---

## File: `src/components/admin/products/editor/adminProductForm.serializer.ts`

```typescript
/**
 * Admin product form → API 저장 payload 변환
 * PR8.11: 저장 직전 serialize 적용으로 이미지 규칙 일관성 확보
 * PR9: create/update 동일 규칙, API 정수 계약(toSafeInteger) 적용
 */

import type { ProductFormState } from "@/types/adminProductForm";
import { normalizeImageList } from "@/lib/products/images";
import { serializeStructuredDaysToSchedule } from "@/lib/products/mapProductToTimelineModel";
import { serializeItineraryImages } from "@/lib/images/serializeItineraryImages";
import { parseDetailedSchedule } from "./adminProductForm.helpers";
import type { AdminProductSavePayload } from "./adminProductForm.types";

/** PostgreSQL integer 호환: 유한 정수만, 범위 초과 시 null */
function toSafeInteger(value: unknown): number | null {
  if (value == null) return null;
  const n = typeof value === "number" ? value : Number(value);
  if (!Number.isFinite(n)) return null;
  const int = Math.round(n);
  if (int < -2147483648 || int > 2147483647) return null;
  return int;
}

export type SerializeAdminProductFormOptions = {
  /** 편집 모드일 때 레거시 포함·불포함 보정 적용 */
  editingId?: string | null;
  /** 미할당 이미지 URL (Modetour 등). serialize 시 event와 중복 제거에 사용 */
  unassignedImageUrls?: string[];
};

/**
 * 폼 상태를 API POST/PATCH body로 변환.
 * 저장 결과가 기존과 동일하도록 필드/타입 규칙 유지.
 */
export function serializeAdminProductForm(
  form: ProductFormState,
  options?: SerializeAdminProductFormOptions,
): AdminProductSavePayload {
  const normalizedIncludedItems = form.included_items.trim();
  const normalizedExcludedItems = form.excluded_items.trim();
  const normalizedOptionalTours = form.optional_tours.trim();
  const normalizedTermsAndNotes = form.terms_and_notes.trim();
  const shouldRepairLegacyDetailMix =
    Boolean(options?.editingId) &&
    !normalizedIncludedItems &&
    !normalizedExcludedItems &&
    (normalizedOptionalTours.length > 0 || normalizedTermsAndNotes.length > 0);
  const resolvedIncludedItems = shouldRepairLegacyDetailMix
    ? normalizedOptionalTours
    : normalizedIncludedItems;
  const resolvedExcludedItems = shouldRepairLegacyDetailMix
    ? normalizedTermsAndNotes
    : normalizedExcludedItems;
  const resolvedOptionalTours = shouldRepairLegacyDetailMix ? "" : normalizedOptionalTours;
  const resolvedTermsAndNotes = shouldRepairLegacyDetailMix ? "" : normalizedTermsAndNotes;

  const normalizedPrice = form.price.replace(/,/g, "").replace(/~/g, "").trim();
  const normalizedImages = normalizeImageList(form.images_json);
  const primaryImageUrl = form.image_url.trim() || normalizedImages[0] || "";

  const serialized = serializeItineraryImages({
    v2Days: form.itinerary_v2_json?.days ?? [],
    structuredDays: form.itinerary_days_json ?? [],
    unassignedImageUrls: options?.unassignedImageUrls ?? [],
  });

  const payload: AdminProductSavePayload = {
    title: form.title.trim(),
    description: form.description,
    meta_title: form.meta_title.trim() === "" ? null : form.meta_title.trim(),
    meta_description: form.meta_description.trim() === "" ? null : form.meta_description.trim(),
    point_benefits: form.point_benefits.trim() === "" ? null : form.point_benefits.trim(),
    point_tourism: form.point_tourism,
    point_guide: form.point_guide,
    meeting_info: form.meeting_info,
    travel_insurance: form.travel_insurance,
    included_items: resolvedIncludedItems === "" ? null : resolvedIncludedItems,
    excluded_items: resolvedExcludedItems === "" ? null : resolvedExcludedItems,
    departure_from_airport:
      form.departure_from_airport.trim() === "" ? null : form.departure_from_airport.trim(),
    departure_from_date: form.departure_from_date.trim() === "" ? null : form.departure_from_date.trim(),
    departure_from_time: form.departure_from_time.trim() === "" ? null : form.departure_from_time.trim(),
    departure_to_airport: form.departure_to_airport.trim() === "" ? null : form.departure_to_airport.trim(),
    departure_to_date: form.departure_to_date.trim() === "" ? null : form.departure_to_date.trim(),
    departure_to_time: form.departure_to_time.trim() === "" ? null : form.departure_to_time.trim(),
    departure_flight_name:
      form.departure_flight_name.trim() === "" ? null : form.departure_flight_name.trim(),
    departure_baggage_limit:
      form.departure_baggage_limit.trim() === "" ? null : form.departure_baggage_limit.trim(),
    arrival_from_airport:
      form.arrival_from_airport.trim() === "" ? null : form.arrival_from_airport.trim(),
    arrival_from_date: form.arrival_from_date.trim() === "" ? null : form.arrival_from_date.trim(),
    arrival_from_time: form.arrival_from_time.trim() === "" ? null : form.arrival_from_time.trim(),
    arrival_to_airport: form.arrival_to_airport.trim() === "" ? null : form.arrival_to_airport.trim(),
    arrival_to_date: form.arrival_to_date.trim() === "" ? null : form.arrival_to_date.trim(),
    arrival_to_time: form.arrival_to_time.trim() === "" ? null : form.arrival_to_time.trim(),
    arrival_flight_name: form.arrival_flight_name.trim() === "" ? null : form.arrival_flight_name.trim(),
    arrival_baggage_limit:
      form.arrival_baggage_limit.trim() === "" ? null : form.arrival_baggage_limit.trim(),
    detailed_schedule:
      form.itinerary_days_json.length > 0
        ? serializeStructuredDaysToSchedule(form.itinerary_days_json)
        : (form.detailed_schedule.trim() === "" ? null : form.detailed_schedule.trim()),
    optional_tours: resolvedOptionalTours === "" ? null : resolvedOptionalTours,
    min_departure_people: form.min_departure_people.trim() === "" ? null : form.min_departure_people.trim(),
    terms_template_type: form.terms_template_type === "" ? null : form.terms_template_type,
    terms_and_notes: resolvedTermsAndNotes === "" ? null : resolvedTermsAndNotes,
    product_source_url: form.product_source_url.trim() === "" ? null : form.product_source_url.trim(),
    image_url: primaryImageUrl,
    images_json: normalizedImages.length > 0 ? normalizedImages : undefined,
    category: String(form.category ?? "").trim(),
    destination_id: form.destination_id.trim() === "" ? null : form.destination_id.trim(),
    theme: (form.theme ?? "").trim() === "" ? null : String(form.theme).trim(),
    product_line_id: form.product_line_id.trim() === "" ? null : form.product_line_id.trim(),
    campaigns: ((): string[] | null => {
      const s = form.campaigns.trim();
      if (!s) return null;
      const arr = s.split(/[,\s]+/).map((v) => v.trim()).filter(Boolean);
      return arr.length > 0 ? arr : null;
    })(),
    price: normalizedPrice === "" ? null : toSafeInteger(Number(normalizedPrice)),
    duration: form.duration.trim() === "" ? null : form.duration,
    itinerary: form.itinerary.trim() === "" ? null : form.itinerary,
    inclusions: form.inclusions.trim() === "" ? null : form.inclusions,
    is_active: form.is_active,
    sort_order: form.sort_order.trim() === "" ? null : toSafeInteger(Number(form.sort_order)),
    status:
      form.status && ["AVAILABLE", "LIMITED", "SOLD_OUT", "CONSULT_REQUIRED"].includes(form.status)
        ? form.status
        : undefined,
    one_liner: form.one_liner.trim() === "" ? null : form.one_liner.trim(),
    price_meta: form.price_meta.trim() === "" ? null : form.price_meta.trim(),
    meta_info: form.meta_info.trim() === "" ? null : form.meta_info.trim(),
    fuel_included:
      form.fuel_included === ""
        ? undefined
        : form.fuel_included === "true"
          ? true
          : form.fuel_included === "false"
            ? false
            : undefined,
    options: (() => {
      const raw = form.options_json.trim();
      if (!raw) return undefined;
      try {
        const parsed = JSON.parse(raw) as Record<string, unknown>;
        if (
          parsed &&
          typeof parsed === "object" &&
          Array.isArray(parsed.groups) &&
          parsed.groups.length > 0
        ) {
          return parsed;
        }
        return undefined;
      } catch {
        return undefined;
      }
    })(),
    itinerary_media_json: (() => {
      const media = form.itinerary_media_json;
      const dayCount =
        serialized.structuredDays.length > 0
          ? serialized.structuredDays.length
          : form.itinerary_days_json.length > 0
            ? form.itinerary_days_json.length
            : parseDetailedSchedule(form.detailed_schedule).length;
      const cleaned = Object.fromEntries(
        Object.entries(media).filter(([key, v]) => {
          if (typeof v !== "string" || !v.trim()) return false;
          const n = parseInt(key, 10);
          return !Number.isNaN(n) && n >= 1 && n <= dayCount;
        }),
      );
      return Object.keys(cleaned).length > 0 ? cleaned : undefined;
    })(),
    itinerary_days_json:
      serialized.structuredDays.length > 0 ? serialized.structuredDays : null,
    itinerary_v2_json:
      serialized.v2Days.length > 0 ? { days: serialized.v2Days } : null,
    theme_chart_json: (() => {
      const items = form.theme_chart_json.filter(
        (i) => i.label?.trim() && typeof i.percent === "number",
      );
      return items.length >= 2 ? { items } : null;
    })(),
    overview_accommodation:
      form.overview_accommodation.trim() === "" ? null : form.overview_accommodation.trim(),
    overview_region: form.overview_region.trim() === "" ? null : form.overview_region.trim(),
    overview_duration: form.overview_duration.trim() === "" ? null : form.overview_duration.trim(),
  };

  return payload;
}

```


---

## File: `src/components/admin/products/editor/adminProductForm.deserializer.ts`

```typescript
/**
 * API/Product → Admin product form state 변환
 * 편집 진입 시 서버 응답을 폼에 주입하는 로직
 * PR8.11: 로드 직후 hydrate 적용으로 editor state 일관성 확보
 */

import type { Product } from "@/types/product";
import type { ProductFormState, TermsTemplateType } from "@/types/adminProductForm";
import { normalizeImageList } from "@/lib/products/images";
import {
  getTimelineModelFromSchedule,
  timelineModelToStructuredDays,
} from "@/lib/products/mapProductToTimelineModel";
import { hydrateItineraryImages } from "@/lib/images/hydrateItineraryImages";
import { normalizeOXValue } from "./adminProductForm.helpers";

/**
 * 상품 API 응답을 폼 상태로 변환.
 * 편집 진입 시 기존에 보이던 값이 그대로 보이도록 필드/fallback 규칙 유지.
 */
export function deserializeAdminProductToForm(product: Product): ProductFormState {
  const includedItems = product.included_items?.trim() ?? "";
  const excludedItems = product.excluded_items?.trim() ?? "";
  const optionalTours = product.optional_tours?.trim() ?? "";
  const termsAndNotes = product.terms_and_notes?.trim() ?? "";
  const shouldRepairLegacyDetailMix =
    !includedItems && !excludedItems && (optionalTours.length > 0 || termsAndNotes.length > 0);

  return {
    title: product.title ?? "",
    description: product.description ?? "",
    product_source_url: product.product_source_url ?? "",
    point_benefits: product.point_benefits ?? "",
    point_tourism: normalizeOXValue(product.point_tourism),
    point_guide: normalizeOXValue(product.point_guide),
    meeting_info: normalizeOXValue(product.meeting_info),
    travel_insurance: normalizeOXValue(product.travel_insurance),
    included_items: shouldRepairLegacyDetailMix ? optionalTours : product.included_items ?? "",
    excluded_items: shouldRepairLegacyDetailMix ? termsAndNotes : product.excluded_items ?? "",
    departure_from_airport: product.departure_from_airport ?? "",
    departure_from_date: product.departure_from_date ?? "",
    departure_from_time: product.departure_from_time ?? "",
    departure_to_airport: product.departure_to_airport ?? "",
    departure_to_date: product.departure_to_date ?? "",
    departure_to_time: product.departure_to_time ?? "",
    departure_flight_name: product.departure_flight_name ?? "",
    departure_baggage_limit: product.departure_baggage_limit ?? "",
    arrival_from_airport: product.arrival_from_airport ?? "",
    arrival_from_date: product.arrival_from_date ?? "",
    arrival_from_time: product.arrival_from_time ?? "",
    arrival_to_airport: product.arrival_to_airport ?? "",
    arrival_to_date: product.arrival_to_date ?? "",
    arrival_to_time: product.arrival_to_time ?? "",
    arrival_flight_name: product.arrival_flight_name ?? "",
    arrival_baggage_limit: product.arrival_baggage_limit ?? "",
    detailed_schedule: product.detailed_schedule ?? "",
    optional_tours: shouldRepairLegacyDetailMix ? "" : product.optional_tours ?? "",
    min_departure_people: product.min_departure_people ?? "",
    terms_template_type:
      (product.terms_template_type as "" | TermsTemplateType | undefined) ?? "",
    terms_and_notes: shouldRepairLegacyDetailMix ? "" : product.terms_and_notes ?? "",
    meta_title: product.meta_title ?? "",
    meta_description: product.meta_description ?? "",
    image_url: product.image_url ?? "",
    images_json: normalizeImageList(product.images_json),
    category: product.category ?? "여행상품",
    destination_id: (product.destination_id ?? "").toString().trim(),
    theme: (() => {
      const t = product.theme ?? "";
      const first = t.split(/[,\n|]+/).map((s) => s.trim()).filter(Boolean)[0];
      return first ?? "";
    })(),
    product_line_id: (product.product_line_id ?? "").toString().trim(),
    campaigns: ((): string => {
      const arr =
        product.campaigns ??
        (product as { campaigns_json?: string[] }).campaigns_json ??
        [];
      return Array.isArray(arr) ? arr.filter((v): v is string => typeof v === "string").join(",") : "";
    })(),
    price: typeof product.price === "number" ? product.price.toLocaleString("ko-KR") : "",
    duration: product.duration ?? "",
    itinerary: product.itinerary ?? "",
    inclusions: product.inclusions ?? "",
    is_active: product.is_active ?? true,
    sort_order: typeof product.sort_order === "number" ? String(product.sort_order) : "",
    status:
      product.status === "AVAILABLE" ||
      product.status === "LIMITED" ||
      product.status === "SOLD_OUT" ||
      product.status === "CONSULT_REQUIRED"
        ? product.status
        : "AVAILABLE",
    one_liner: product.one_liner ?? "",
    price_meta: product.price_meta ?? "",
    fuel_included:
      product.fuel_included === true ? "true" : product.fuel_included === false ? "false" : "",
    meta_info: product.meta_info ?? "",
    options_json: product.options ? JSON.stringify(product.options, null, 2) : "",
    itinerary_media_json: product.itinerary_media_json ?? {},
    ...((): Pick<ProductFormState, "itinerary_days_json" | "itinerary_v2_json"> => {
      const hydrated = hydrateItineraryImages({
        v2Days: product.itinerary_v2_json?.days ?? [],
        structuredDays: product.itinerary_days_json ?? [],
        unassignedImageUrls: [],
      });
      return {
        itinerary_days_json:
          hydrated.structuredDays.length > 0
            ? hydrated.structuredDays
            : timelineModelToStructuredDays(
                getTimelineModelFromSchedule(product.detailed_schedule ?? ""),
              ),
        itinerary_v2_json: { days: hydrated.v2Days },
      };
    })(),
    legacy_itinerary_text: "",
    theme_chart_json: product.theme_chart_json?.items ?? [],
    overview_accommodation: product.overview_accommodation ?? "",
    overview_region: product.overview_region ?? "",
    overview_duration: product.overview_duration ?? "",
  };
}

```


---

## File: `src/components/admin/products/editor/adminProductForm.validation.ts`

```typescript
/**
 * Admin product form - 섹션별 검증 및 저장 전 필수 이슈 수집
 * 기존 에러 메시지/필드 기준 그대로 유지
 */

import type { ProductFormState } from "@/types/adminProductForm";
import {
  hasRealText,
  hasValidNumber,
  hasValidPriceOptionJson,
  hasCoverImage,
  hasNonEmptyArray,
} from "@/lib/products/formCompletion";
import { parseDetailedSchedule } from "./adminProductForm.helpers";
import type { SectionConfig, SectionIssue, FormIssue } from "./adminProductForm.types";

function hasValidPriceOption(form: ProductFormState): boolean {
  return hasValidPriceOptionJson(form.options_json);
}

export const SECTIONS: SectionConfig[] = [
  {
    id: "basic",
    title: "기본 정보",
    getIssues(form) {
      const issues: SectionIssue[] = [];
      if (!hasRealText(form.title)) {
        issues.push({
          sectionId: "basic",
          fieldKey: "title",
          message: "상품명을 입력해 주세요.",
          anchorId: "field-product-name",
          severity: "required",
        });
      }
      if (!hasCoverImage(form.image_url, form.images_json ?? [])) {
        issues.push({
          sectionId: "basic",
          fieldKey: "image",
          message: "대표 이미지를 1장 이상 등록해 주세요.",
          anchorId: "field-product-cover-image",
          severity: "required",
        });
      }
      if (!hasRealText(form.one_liner)) {
        issues.push({
          sectionId: "basic",
          fieldKey: "one_liner",
          message: "한 줄 소개를 입력하면 상세 상단에 표시됩니다.",
          anchorId: "form-field-basic-one_liner",
          severity: "recommended",
        });
      }
      return issues;
    },
  },
  {
    id: "taxonomy",
    title: "카테고리 설정",
    getIssues(form) {
      const issues: SectionIssue[] = [];
      if (!hasRealText(form.category)) {
        issues.push({
          sectionId: "taxonomy",
          fieldKey: "category",
          message: "카테고리(지역)를 선택해 주세요.",
          anchorId: "form-field-taxonomy-category",
          severity: "recommended",
        });
      }
      if (!hasRealText(form.theme)) {
        issues.push({
          sectionId: "taxonomy",
          fieldKey: "theme",
          message: "테마를 선택하면 노출 품질이 좋아집니다.",
          anchorId: "form-field-taxonomy-theme",
          severity: "recommended",
        });
      }
      return issues;
    },
  },
  {
    id: "price",
    title: "가격·노출",
    getIssues(form) {
      const issues: SectionIssue[] = [];
      const hasValidPrice = hasValidNumber(form.price);
      const hasOptions = hasValidPriceOption(form);
      if (!hasValidPrice && !hasOptions) {
        issues.push({
          sectionId: "price",
          fieldKey: "price",
          message: "가격(숫자)을 입력하거나, 가격 옵션 JSON을 등록해 주세요.",
          anchorId: "field-price-main",
          severity: "required",
        });
      }
      return issues;
    },
  },
  {
    id: "description",
    title: "설명·포인트",
    getIssues(form) {
      const issues: SectionIssue[] = [];
      if (!hasRealText(form.description)) {
        issues.push({
          sectionId: "description",
          fieldKey: "description",
          message: "상품 설명을 입력하면 상세 페이지 노출에 유리합니다.",
          anchorId: "field-product-description",
          severity: "recommended",
        });
      }
      return issues;
    },
  },
  {
    id: "included",
    title: "포함·불포함·선택관광",
    getIssues(form) {
      const issues: SectionIssue[] = [];
      const hasIncluded = hasRealText(form.included_items);
      const hasExcluded = hasRealText(form.excluded_items);
      const hasOptional = hasRealText(form.optional_tours);
      if (!hasIncluded && !hasExcluded && !hasOptional) {
        issues.push({
          sectionId: "included",
          fieldKey: "included",
          message: "포함·불포함·선택관광 중 최소 1개 이상 입력을 권장합니다.",
          anchorId: "field-included",
          severity: "recommended",
        });
      }
      return issues;
    },
  },
  {
    id: "schedule",
    title: "상세 일정",
    getIssues(form) {
      const issues: SectionIssue[] = [];
      const v2Days = form.itinerary_v2_json?.days ?? [];
      const structuredDays = form.itinerary_days_json ?? [];
      const scheduleDrafts = parseDetailedSchedule(form.detailed_schedule ?? "");
      const hasV2 = hasNonEmptyArray(v2Days);
      const hasStructured = hasNonEmptyArray(structuredDays);
      const hasLegacyContent =
        hasNonEmptyArray(scheduleDrafts) &&
        scheduleDrafts.some((d) => hasRealText(d.content));
      const hasAnySchedule = hasV2 || hasStructured || hasLegacyContent;
      if (!hasAnySchedule) {
        issues.push({
          sectionId: "schedule",
          fieldKey: "schedule",
          message: "일정(일차)을 최소 1일 이상 입력해 주세요.",
          anchorId: "field-schedule-root",
          severity: "required",
        });
      } else {
        if (hasV2) {
          const emptyDays = v2Days.filter((d) => {
            const hasTitle = hasRealText(d.title) || hasRealText(d.dateText);
            const events = d.events ?? [];
            const hasEvent = events.some(
              (e) => hasRealText(e.heading) || hasRealText(e.description),
            );
            return !hasTitle && !hasEvent;
          });
          if (emptyDays.length > 0) {
            issues.push({
              sectionId: "schedule",
              fieldKey: "schedule_day",
              message: "일부 일차에 제목·날짜 또는 이벤트를 입력해 주세요.",
              anchorId: "field-schedule-root",
              severity: "recommended",
            });
          }
        }
      }
      return issues;
    },
  },
  {
    id: "flight",
    title: "항공편",
    getIssues(form) {
      const issues: SectionIssue[] = [];
      const dep = hasRealText(form.departure_flight_name)
        ? form.departure_flight_name!.trim()
        : "";
      const arr = hasRealText(form.arrival_flight_name)
        ? form.arrival_flight_name!.trim()
        : "";
      if (dep && !/^[A-Z0-9]{2}\s*\d+/i.test(dep.replace(/\s/g, ""))) {
        issues.push({
          sectionId: "flight",
          fieldKey: "departure_flight_name",
          message: "출발 편명 형식(예: OZ 123)을 권장합니다.",
          anchorId: "form-field-flight-departure_flight_name",
          severity: "recommended",
        });
      }
      if (arr && !/^[A-Z0-9]{2}\s*\d+/i.test(arr.replace(/\s/g, ""))) {
        issues.push({
          sectionId: "flight",
          fieldKey: "arrival_flight_name",
          message: "도착 편명 형식(예: OZ 456)을 권장합니다.",
          anchorId: "form-field-flight-arrival_flight_name",
          severity: "recommended",
        });
      }
      return issues;
    },
  },
  {
    id: "terms",
    title: "약관·SEO",
    getIssues(form) {
      const issues: SectionIssue[] = [];
      if (!hasRealText(form.meta_title)) {
        issues.push({
          sectionId: "terms",
          fieldKey: "meta_title",
          message: "SEO 메타 제목을 입력하면 검색 노출에 유리합니다.",
          anchorId: "field-seo-title",
          severity: "recommended",
        });
      }
      if (!hasRealText(form.meta_description)) {
        issues.push({
          sectionId: "terms",
          fieldKey: "meta_description",
          message: "SEO 메타 설명을 입력하면 검색 노출에 유리합니다.",
          anchorId: "field-seo-desc",
          severity: "recommended",
        });
      }
      return issues;
    },
  },
];

/** 필수(required) 이슈만 섹션 순서대로 수집. 저장 전 검증 및 스크롤/포커스용 */
export function collectAllRequiredIssues(form: ProductFormState): SectionIssue[] {
  const out: SectionIssue[] = [];
  for (const section of SECTIONS) {
    const issues = section.getIssues(form).filter((i) => i.severity === "required");
    out.push(...issues);
  }
  return out;
}

/** 섹션별 이슈 전체 수집(required + recommended). 뱃지/저장 실패 점프 재사용 */
export function collectFormIssues(form: ProductFormState): FormIssue[] {
  const out: FormIssue[] = [];
  for (const section of SECTIONS) {
    out.push(...section.getIssues(form));
  }
  return out;
}

```


---

## File: `src/components/admin/products/editor/adminProductPreview.mapper.ts`

```typescript
/**
 * Admin product form → 미리보기용 Product 변환
 * 우측 미리보기 패널이 기대하는 shape 유지
 */

import type { Product } from "@/types/product";
import type { ProductFormState } from "@/types/adminProductForm";
import { formToPreviewProduct } from "@/lib/admin/productPreview";
import {
  hasRealText,
  hasValidNumber,
  hasValidPriceOptionJson,
  hasCoverImage,
  hasNonEmptyArray,
} from "@/lib/products/formCompletion";
import { parseDetailedSchedule } from "./adminProductForm.helpers";

/**
 * 폼 상태를 미리보기용 Product로 변환.
 * imageUrlForPreview: 로컬 선택 이미지 등 대체 URL
 */
export function mapAdminProductFormToPreviewProduct(
  form: ProductFormState,
  imageUrlForPreview: string,
): Product {
  return formToPreviewProduct(form, imageUrlForPreview);
}

export type PreviewWarning = {
  id: string;
  message: string;
  sectionId: "basic" | "price" | "schedule";
};

/** 미리보기 품질 경고: 원인 + 화면 영향. sectionId는 클릭 시 해당 아코디언 열기/스크롤용 */
export function getPreviewWarnings(
  form: ProductFormState,
  hasPreviewImage: boolean,
): PreviewWarning[] {
  const warnings: PreviewWarning[] = [];

  if (!hasRealText(form.category)) {
    warnings.push({
      id: "category",
      message: "카테고리 미입력 → 카드/상세에 카테고리 칩이 비어 보입니다.",
      sectionId: "basic",
    });
  }

  if (!hasValidNumber(form.price) && !hasValidPriceOptionJson(form.options_json)) {
    warnings.push({
      id: "price",
      message: "가격 미입력 또는 0원 → 카드/상세에 '상담 후 견적'으로만 표시됩니다.",
      sectionId: "price",
    });
  }

  if (!hasCoverImage(form.image_url, form.images_json) && !hasPreviewImage) {
    warnings.push({
      id: "image",
      message: "대표 이미지 없음 → 카드/상세에 이미지가 비어 보입니다.",
      sectionId: "basic",
    });
  }

  const scheduleDrafts = parseDetailedSchedule(form.detailed_schedule);
  const hasEmptySchedule =
    !hasNonEmptyArray(form.itinerary_days_json) &&
    (!hasNonEmptyArray(scheduleDrafts) || scheduleDrafts.every((d) => !hasRealText(d.content)));
  if (hasEmptySchedule) {
    warnings.push({
      id: "schedule",
      message: "일정(일차) 비어 있음 → 상세 '일정 안내' 탭에 내용이 없습니다.",
      sectionId: "schedule",
    });
  }

  return warnings;
}

```


---

## File: `src/lib/admin/modetourImport/mapToDraft.ts`

```typescript
import type { ItineraryV2, ItineraryV2Day, ItineraryV2Event } from "@/types/product";
import type { ProductFormState, ProductFormDraft } from "@/types/adminProductForm";
import type { ModetourImportV1, ModetourImportWarning } from "@/types/modetourImport";
import { createEmptyProductFormState } from "@/types/adminProductForm";

// PR16 정책: Modetour import는 설명/포함·불포함/약관 데이터를 자동 주입하지 않는다.
// 운영자가 관리자 편집 화면에서 직접 작성하도록 한다. (일정·이미지·기본 정보만 자동 반영)

/** Import → Draft 변환 결과 (빈 필드만 채우는 merge용 patch) */
export function modetourImportToDraft(input: ModetourImportV1): {
  draft: { version: 1; form: Partial<ProductFormState>; savedAt: number };
  warnings: ModetourImportWarning[];
} {
  const warnings: ModetourImportWarning[] = [];
  const form: Partial<ProductFormState> = {};

  if (input.product?.title?.trim()) {
    form.title = input.product.title.trim();
  }
  if (input.product?.nights != null || input.product?.days != null) {
    const n = input.product.nights ?? 0;
    const d = input.product.days ?? 0;
    form.duration = n > 0 || d > 0 ? `${n}박${d}일` : "";
    form.overview_duration = form.duration;
  }
  if (input.product?.regionText?.trim()) {
    form.overview_region = input.product.regionText.trim();
    form.theme = input.product.regionText.trim();
  }
  if (input.product?.priceText?.trim()) {
    const numMatch = input.product.priceText.replace(/\D/g, "");
    if (numMatch) {
      const num = parseInt(numMatch, 10);
      if (!Number.isNaN(num)) form.price = String(num);
    }
    // price_meta(가격 기준 문구)는 익스텐션에서 추출하지 않음. 필요 시 관리자 폼에서 직접 입력.
  }

  if (input.source?.url?.trim()) {
    form.product_source_url = input.source.url.trim();
  }

  if (input.media?.heroImageUrl?.trim()) {
    form.image_url = input.media.heroImageUrl.trim();
  }
  if (input.media?.galleryImageUrls?.length) {
    form.images_json = input.media.galleryImageUrls.filter((u) => u?.trim());
  }
  if (input.media?.unassignedImageUrls?.length) {
    warnings.push({
      code: "UNASSIGNED_IMAGES",
      message: `미할당 이미지 ${input.media.unassignedImageUrls.length}장은 draft에 반영되지 않습니다.`,
      path: "media.unassignedImageUrls",
    });
  }

  if (input.itinerary?.days?.length) {
    const days: ItineraryV2Day[] = input.itinerary.days.map((d) => {
      const events: ItineraryV2Event[] = (d.events ?? []).map((ev) => {
        const rawUrls = ev.imageUrls ?? [];
        const absoluteUrls = rawUrls
          .map((u) => u?.trim())
          .filter((u) => u && /^https?:\/\//i.test(u));
        return {
          order: ev.order,
          timeText: ev.timeText?.trim() || undefined,
          heading: ev.title?.trim() ?? "",
          description: ev.descriptionText?.trim() || undefined,
          iconKey: undefined,
          images:
            absoluteUrls.length > 0
              ? absoluteUrls.map((url, i) => ({ url, sortOrder: i, isCover: i === 0 }))
              : undefined,
        };
      });
      const dayCoverUrl = d.imageUrls?.[0]?.trim();
      return {
        day: d.dayNumber,
        title: d.title?.trim() || undefined,
        dateText: d.dateText?.trim() || undefined,
        coverImageUrl: dayCoverUrl && /^https?:\/\//i.test(dayCoverUrl) ? dayCoverUrl : undefined,
        events,
      };
    });
    form.itinerary_v2_json = { days };
  }

  const draft: { version: 1; form: Partial<ProductFormState>; savedAt: number } = {
    version: 1,
    form,
    savedAt: Date.now(),
  };

  return { draft, warnings };
}

/** 빈 필드만 patch로 채우기 (문자열/배열/단순 객체). base를 변경하지 않고 새 객체 반환. */
export function mergeDraftOnlyEmpty(
  base: ProductFormDraft,
  patch: { version?: 1; form?: Partial<ProductFormState>; savedAt?: number },
): ProductFormDraft {
  const baseForm = base.form;
  const patchForm = patch.form ?? {};

  function isEmptyString(v: unknown): boolean {
    return typeof v !== "string" || v.trim() === "";
  }
  function isEmptyArray(v: unknown): boolean {
    return !Array.isArray(v) || v.length === 0;
  }
  function isEmptyObject(v: unknown): boolean {
    if (v == null || typeof v !== "object") return true;
    if (Array.isArray(v)) return v.length === 0;
    return Object.keys(v as object).length === 0;
  }

  const mergedForm = { ...baseForm } as ProductFormState;

  for (const key of Object.keys(patchForm) as (keyof ProductFormState)[]) {
    const baseVal = baseForm[key];
    const patchVal = (patchForm as Record<string, unknown>)[key];
    if (patchVal === undefined) continue;

    if (typeof baseVal === "string" && typeof patchVal === "string") {
      if (isEmptyString(baseVal) && !isEmptyString(patchVal)) {
        (mergedForm as Record<string, unknown>)[key] = patchVal;
      }
      continue;
    }
    if (Array.isArray(baseVal) && Array.isArray(patchVal)) {
      if (isEmptyArray(baseVal) && !isEmptyArray(patchVal)) {
        (mergedForm as Record<string, unknown>)[key] = [...patchVal];
      }
      continue;
    }
    if (key === "itinerary_v2_json" && typeof patchVal === "object" && patchVal !== null) {
      const baseV2 = baseForm.itinerary_v2_json;
      const patchV2 = patchVal as ItineraryV2;
      if ((!baseV2?.days?.length || baseV2.days.length === 0) && patchV2?.days?.length) {
        (mergedForm as Record<string, unknown>)[key] = {
          days: patchV2.days.map((d) => ({ ...d, events: [...(d.events ?? [])] })),
        };
      }
      continue;
    }
    if (typeof baseVal === "object" && baseVal !== null && typeof patchVal === "object" && patchVal !== null) {
      if (isEmptyObject(baseVal) && !isEmptyObject(patchVal)) {
        (mergedForm as Record<string, unknown>)[key] =
          Array.isArray(patchVal) ? [...patchVal] : { ...(patchVal as object) };
      }
      continue;
    }
    if (typeof baseVal === "boolean" && typeof patchVal === "boolean") {
      (mergedForm as Record<string, unknown>)[key] = patchVal;
      continue;
    }
  }

  return {
    version: base.version,
    form: mergedForm,
    savedAt: patch.savedAt ?? base.savedAt,
  };
}

```


---

## File: `src/lib/admin/modetourImport/validate.ts`

```typescript
import type { ModetourImportV1, ModetourImportWarning } from "@/types/modetourImport";

function isRecord(v: unknown): v is Record<string, unknown> {
  return typeof v === "object" && v !== null;
}

export function isModetourImportV1(value: unknown): value is ModetourImportV1 {
  if (!isRecord(value)) return false;

  if (value.version !== "modetour-import-v1") return false;

  const source = (value as Record<string, unknown>).source;

  if (!isRecord(source)) return false;

  if (source.provider !== "modetour") return false;

  if (typeof source.url !== "string") return false;

  return true;
}

export function validateModetourImportV1(input: ModetourImportV1): {
  warnings: ModetourImportWarning[];
} {
  const warnings: ModetourImportWarning[] = [];

  if (!input.product?.title?.trim()) {
    warnings.push({
      code: "TITLE_MISSING",
      message: "상품명이 비어 있습니다.",
      path: "product.title",
    });
  }

  try {
    const url = new URL(input.source.url);

    if (!url.hostname.includes("modetour.com")) {
      warnings.push({
        code: "SOURCE_URL_INVALID",
        message: "모두투어 도메인이 아닙니다.",
        path: "source.url",
      });
    }
  } catch {
    warnings.push({
      code: "SOURCE_URL_INVALID",
      message: "source.url 형식이 올바르지 않습니다.",
      path: "source.url",
    });
  }

  const days = input.itinerary?.days ?? [];

  if (days.length === 0) {
    warnings.push({
      code: "ITINERARY_MISSING",
      message: "상세 일정이 비어 있습니다.",
      path: "itinerary.days",
    });
  } else {
    const nums = days
      .map((d) => d.dayNumber)
      .filter((n) => Number.isFinite(n))
      .sort((a, b) => a - b);

    for (let i = 0; i < nums.length; i++) {
      if (nums[i] !== i + 1) {
        warnings.push({
          code: "DAY_SEQUENCE_INVALID",
          message: `Day 번호가 1부터 연속이 아닙니다: ${nums.join(", ")}`,
          path: "itinerary.days[].dayNumber",
        });
        break;
      }
    }

    days.forEach((d, index) => {
      if (!d.events || d.events.length === 0) {
        warnings.push({
          code: "EVENTS_EMPTY",
          message: `Day ${d.dayNumber} 이벤트가 비어 있습니다.`,
          path: `itinerary.days[${index}].events`,
        });
      }
    });
  }

  if (!input.media?.heroImageUrl?.trim()) {
    warnings.push({
      code: "HERO_IMAGE_MISSING",
      message: "대표 이미지가 없습니다.",
      path: "media.heroImageUrl",
    });
  }

  return { warnings };
}

```


---

## File: `src/lib/admin/modetourImport/index.ts`

```typescript
export * from "./validate";
export * from "./mapToDraft";

```


---

## File: `src/components/admin/modetour/ModetourNewProductPage.tsx`

```tsx
"use client";

import { useState, useMemo, useRef } from "react";
import Image from "next/image";
import Link from "next/link";
import type { ModetourImportV1, ModetourImportWarning } from "@/types/modetourImport";
import type { Product } from "@/types/product";
import type { SelectedEventRef } from "@/types/product";
import { createEmptyProductFormState } from "@/types/adminProductForm";
import type { ProductFormState } from "@/types/adminProductForm";
import { serializeAdminProductForm } from "@/components/admin/products/editor/adminProductForm.serializer";
import {
  isModetourImportV1,
  validateModetourImportV1,
  modetourImportToDraft,
  mergeDraftOnlyEmpty,
} from "@/lib/admin/modetourImport";
import { formToPreviewProduct } from "@/lib/admin/productPreview";
import { normalizeProductImageUrl } from "@/lib/media/normalizeProductImageUrl";
import { normalizeEventImages } from "@/components/admin/itinerary/shared/normalizeEventImages";
import {
  type ModetourImageDragItem,
  isValidImageDndPayload,
  isNoOpDrop,
} from "@/components/admin/modetour/modetourImageDnd";
import { validateImagePlacementState, groupImagePlacementIssuesByUrl } from "@/components/admin/modetour/modetourImageValidation";
import { normalizeImageUrl } from "@/lib/images/normalizeImageUrl";
import { getEventImageUrl } from "@/lib/images/getEventImageUrl";
import { dedupeEventImages } from "@/lib/images/dedupeEventImages";
import { hydrateItineraryImages } from "@/lib/images/hydrateItineraryImages";
import { UnassignedImagePool } from "@/components/admin/modetour/UnassignedImagePool";
import { ScheduleVisualEditorV2 } from "@/components/admin/ScheduleVisualEditorV2";
import { getProductDiffSummary } from "@/lib/adminProductDiff";

const SNIPPET_LEN = 200;
const PRODUCTS_LIST_PATH = "/theall_manager_only/products";

function removeFirstMatch(arr: string[], url: string): string[] {
  const index = arr.indexOf(url);
  if (index === -1) return arr;
  return [...arr.slice(0, index), ...arr.slice(index + 1)];
}

type EventImageObj = { url: string; alt?: string; sortOrder?: number; isCover?: boolean };

function insertImageAt(
  images: EventImageObj[],
  image: EventImageObj,
  insertAt: number,
): EventImageObj[] {
  const at = Math.max(0, Math.min(insertAt, images.length));
  return [...images.slice(0, at), image, ...images.slice(at)];
}

function removeImageAt(images: EventImageObj[], index: number): EventImageObj[] {
  if (index < 0 || index >= images.length) return images;
  return [...images.slice(0, index), ...images.slice(index + 1)];
}

function arrayMove<T>(arr: T[], from: number, to: number): T[] {
  const next = [...arr];
  const [removed] = next.splice(from, 1);
  next.splice(to, 0, removed);
  return next;
}

/** target 이미지 배열에 이미 정규화된 url이 있는지 */
function targetHasUrl(images: EventImageObj[] | undefined, normalizedUrl: string): boolean {
  if (!normalizedUrl || !images?.length) return false;
  return images.some((img) => normalizeImageUrl(getEventImageUrl(img)) === normalizedUrl);
}

export default function ModetourNewProductPage() {
  const [jsonText, setJsonText] = useState("");
  const [importData, setImportData] = useState<ModetourImportV1 | null>(null);
  const [warnings, setWarnings] = useState<ModetourImportWarning[]>([]);
  const [parseError, setParseError] = useState<string | null>(null);
  const [mappedDraft, setMappedDraft] = useState<ReturnType<typeof modetourImportToDraft>["draft"] | null>(null);
  const [previewProduct, setPreviewProduct] = useState<Product | null>(null);
  const [previewError, setPreviewError] = useState<string | null>(null);

  /** 편집용 form (일정/이미지 배치 반영). 검증 시 merged.form으로 초기화 */
  const [formState, setFormState] = useState<ProductFormState>(() => createEmptyProductFormState());
  /** 미할당 이미지 풀. 검증 시 importData.media?.unassignedImageUrls로 초기화 */
  const [unassignedImageUrls, setUnassignedImageUrls] = useState<string[]>([]);

  const [activeDayIndex, setActiveDayIndex] = useState(0);
  const [selectedEvent, setSelectedEvent] = useState<SelectedEventRef | null>(null);

  const [isSaving, setIsSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [createdProductId, setCreatedProductId] = useState<string | null>(null);
  const [existingProductId, setExistingProductId] = useState<string | null>(null);

  const initialFormSnapshotRef = useRef<ProductFormState | null>(null);
  const initialUnassignedCountRef = useRef<number>(0);

  const imagePlacementValidation = useMemo(
    () =>
      validateImagePlacementState({
        v2Days: formState.itinerary_v2_json?.days,
        structuredDays: formState.itinerary_days_json,
        unassignedImageUrls,
      }),
    [formState.itinerary_v2_json?.days, formState.itinerary_days_json, unassignedImageUrls],
  );

  const imagePlacementIssuesByUrl = useMemo(
    () => groupImagePlacementIssuesByUrl(imagePlacementValidation.issues),
    [imagePlacementValidation.issues],
  );

  const diffSummary = useMemo(() => {
    const initial = initialFormSnapshotRef.current ?? formState;
    return getProductDiffSummary(initial, formState, {
      initialUnassignedCount: initialUnassignedCountRef.current,
      currentUnassignedCount: unassignedImageUrls.length,
    });
  }, [formState, unassignedImageUrls.length]);

  function handleValidate() {
    setParseError(null);
    setPreviewError(null);
    setMappedDraft(null);
    setPreviewProduct(null);
    setSaveError(null);
    setCreatedProductId(null);
    setExistingProductId(null);

    try {
      const parsed = JSON.parse(jsonText);

      if (!isModetourImportV1(parsed)) {
        setParseError("ModetourImportV1 형식이 아닙니다.");
        return;
      }

      const result = validateModetourImportV1(parsed);
      const { draft: patch, warnings: mapWarnings } = modetourImportToDraft(parsed);

      setImportData(parsed);
      setWarnings([...result.warnings, ...mapWarnings]);
      setMappedDraft(patch);

      const emptyForm = createEmptyProductFormState();
      const emptyDraft = { version: 1 as const, form: emptyForm, savedAt: 0 };
      const merged = mergeDraftOnlyEmpty(emptyDraft, patch);
      const hydrated = hydrateItineraryImages({
        v2Days: merged.form.itinerary_v2_json?.days,
        structuredDays: merged.form.itinerary_days_json,
        unassignedImageUrls: parsed.media?.unassignedImageUrls ?? [],
      });
      setFormState({
        ...merged.form,
        itinerary_v2_json: { days: hydrated.v2Days },
        itinerary_days_json: hydrated.structuredDays,
      });
      setUnassignedImageUrls(hydrated.unassignedImageUrls);
      initialFormSnapshotRef.current = structuredClone({
        ...merged.form,
        itinerary_v2_json: { days: hydrated.v2Days },
        itinerary_days_json: hydrated.structuredDays,
      });
      initialUnassignedCountRef.current = hydrated.unassignedImageUrls.length;

      const imageUrl =
        merged.form.image_url?.trim() ||
        merged.form.images_json?.[0]?.trim() ||
        "";
      try {
        const product = formToPreviewProduct(merged.form, imageUrl);
        setPreviewProduct(product);
      } catch (e) {
        setPreviewError(e instanceof Error ? e.message : "미리보기 생성 실패");
      }
    } catch {
      setParseError("JSON 파싱 실패");
    }
  }

  function handleReset() {
    setJsonText("");
    setImportData(null);
    setWarnings([]);
    setParseError(null);
    setMappedDraft(null);
    setPreviewProduct(null);
    setPreviewError(null);
    setFormState(createEmptyProductFormState());
    setUnassignedImageUrls([]);
    setSaveError(null);
    setCreatedProductId(null);
    setExistingProductId(null);
    initialFormSnapshotRef.current = null;
  }

  function assignUnassignedImageToEvent(params: {
    editorType: "v2" | "structured";
    dayIndex: number;
    eventIndex: number;
    url: string;
    insertAt?: number;
  }) {
    const { editorType, dayIndex, eventIndex, url, insertAt } = params;
    const normalizedUrl = normalizeImageUrl(url);
    if (!normalizedUrl) return;

    setFormState((prev) => {
      if (editorType === "v2") {
        const days = prev.itinerary_v2_json?.days ?? [];
        const day = days[dayIndex];
        if (!day) return prev;
        const events = day.events ?? [];
        const event = events[eventIndex];
        if (!event) return prev;
        const images = event.images ?? [];
        if (targetHasUrl(images, normalizedUrl)) return prev;
        const at = insertAt != null ? Math.min(insertAt, images.length) : images.length;
        let nextImages = [...images.slice(0, at), { url }, ...images.slice(at)];
        nextImages = dedupeEventImages(nextImages);
        const normalized = normalizeEventImages(nextImages);
        const nextEvents = events.map((e, i) =>
          i === eventIndex ? { ...e, images: normalized } : e,
        );
        const nextDays = days.map((d, i) =>
          i === dayIndex ? { ...d, events: nextEvents } : d,
        );
        return {
          ...prev,
          itinerary_v2_json: { ...prev.itinerary_v2_json, days: nextDays },
        };
      }
      const days = prev.itinerary_days_json ?? [];
      const day = days[dayIndex];
      if (!day) return prev;
      const events = day.events ?? [];
      const event = events[eventIndex];
      if (!event) return prev;
      const images = event.images ?? [];
      if (targetHasUrl(images, normalizedUrl)) return prev;
      const at = insertAt != null ? Math.min(insertAt, images.length) : images.length;
      let nextImages = [...images.slice(0, at), { url }, ...images.slice(at)];
      nextImages = dedupeEventImages(nextImages);
      const normalized = normalizeEventImages(nextImages);
      const nextEvents = events.map((e, i) =>
        i === eventIndex ? { ...e, images: normalized } : e,
      );
      const nextDays = days.map((d, i) =>
        i === dayIndex ? { ...d, events: nextEvents } : d,
      );
      return { ...prev, itinerary_days_json: nextDays };
    });
    setUnassignedImageUrls((prev) => removeFirstMatch(prev, url));
  }

  function returnEventImageToUnassigned(params: { url: string }) {
    setUnassignedImageUrls((prev) => [...prev, params.url]);
  }

  function handleAutoAssignImages() {
    const days = formState.itinerary_v2_json?.days ?? [];
    const unassigned = [...unassignedImageUrls];
    let uIndex = 0;
    const nextDays = days.map((day) => ({
      ...day,
      events: (day.events ?? []).map((ev) => {
        const hasImages = (ev.images?.length ?? 0) > 0;
        if (hasImages || uIndex >= unassigned.length) return ev;
        const url = unassigned[uIndex];
        uIndex += 1;
        const newImages = normalizeEventImages([{ url, sortOrder: 0, isCover: true }]);
        const merged = dedupeEventImages([...(ev.images ?? []), ...newImages]);
        return { ...ev, images: normalizeEventImages(merged) };
      }),
    }));
    const consumed = uIndex;
    setFormState((prev) => ({
      ...prev,
      itinerary_v2_json: { ...prev.itinerary_v2_json, days: nextDays },
    }));
    setUnassignedImageUrls((prev) => prev.slice(consumed));
  }

  function reorderWithinEvent(params: {
    editorType: "v2" | "structured";
    dayIndex: number;
    eventIndex: number;
    fromIndex: number;
    toIndex: number;
  }) {
    const { editorType, dayIndex, eventIndex, fromIndex, toIndex } = params;
    if (fromIndex === toIndex) return;
    setFormState((prev) => {
      if (editorType === "v2") {
        const days = prev.itinerary_v2_json?.days ?? [];
        const day = days[dayIndex];
        if (!day) return prev;
        const events = day.events ?? [];
        const event = events[eventIndex];
        if (!event) return prev;
        const images = event.images ?? [];
        if (fromIndex < 0 || fromIndex >= images.length || toIndex < 0 || toIndex >= images.length)
          return prev;
        const reordered = arrayMove(images, fromIndex, toIndex);
        const normalized = normalizeEventImages(reordered);
        const nextEvents = events.map((e, i) =>
          i === eventIndex ? { ...e, images: normalized } : e,
        );
        const nextDays = days.map((d, i) =>
          i === dayIndex ? { ...d, events: nextEvents } : d,
        );
        return { ...prev, itinerary_v2_json: { ...prev.itinerary_v2_json, days: nextDays } };
      }
      const days = prev.itinerary_days_json ?? [];
      const day = days[dayIndex];
      if (!day) return prev;
      const events = day.events ?? [];
      const event = events[eventIndex];
      if (!event) return prev;
      const images = event.images ?? [];
      if (fromIndex < 0 || fromIndex >= images.length || toIndex < 0 || toIndex >= images.length)
        return prev;
      const reordered = arrayMove(images, fromIndex, toIndex);
      const normalized = normalizeEventImages(reordered);
      const nextEvents = events.map((e, i) =>
        i === eventIndex ? { ...e, images: normalized } : e,
      );
      const nextDays = days.map((d, i) =>
        i === dayIndex ? { ...d, events: nextEvents } : d,
      );
      return { ...prev, itinerary_days_json: nextDays };
    });
  }

  function moveImageBetweenEvents(params: {
    sourceEditorType: "v2" | "structured";
    sourceDayIndex: number;
    sourceEventIndex: number;
    sourceImageIndex: number;
    targetEditorType: "v2" | "structured";
    targetDayIndex: number;
    targetEventIndex: number;
    targetInsertAt: number;
  }) {
    const {
      sourceEditorType,
      sourceDayIndex,
      sourceEventIndex,
      sourceImageIndex,
      targetEditorType,
      targetDayIndex,
      targetEventIndex,
      targetInsertAt,
    } = params;

    setFormState((prev) => {
      const getSourceImages = (): EventImageObj[] | null => {
        if (sourceEditorType === "v2") {
          const days = prev.itinerary_v2_json?.days ?? [];
          const day = days[sourceDayIndex];
          const event = day?.events?.[sourceEventIndex];
          return event?.images ?? null;
        }
        const days = prev.itinerary_days_json ?? [];
        const day = days[sourceDayIndex];
        const event = day?.events?.[sourceEventIndex];
        return event?.images ?? null;
      };
      const getTargetImages = (): EventImageObj[] | null => {
        if (targetEditorType === "v2") {
          const days = prev.itinerary_v2_json?.days ?? [];
          const day = days[targetDayIndex];
          const event = day?.events?.[targetEventIndex];
          return event?.images ?? null;
        }
        const days = prev.itinerary_days_json ?? [];
        const day = days[targetDayIndex];
        const event = day?.events?.[targetEventIndex];
        return event?.images ?? null;
      };

      const sourceImages = getSourceImages();
      const targetImages = getTargetImages();
      if (!sourceImages || sourceImageIndex < 0 || sourceImageIndex >= sourceImages.length)
        return prev;
      const imageToMove = sourceImages[sourceImageIndex];
      if (!imageToMove) return prev;

      const movedUrl = normalizeImageUrl(imageToMove.url);
      const afterRemove = removeImageAt(sourceImages, sourceImageIndex);
      const targetBase = targetImages ?? [];
      const insertAt = Math.max(0, Math.min(targetInsertAt, targetBase.length));

      if (targetHasUrl(targetBase, movedUrl)) {
        const normalizedSource = normalizeEventImages(afterRemove);
        if (sourceEditorType === "v2") {
          const days = prev.itinerary_v2_json?.days ?? [];
          const nextDays = days.map((d, i) =>
            i === sourceDayIndex
              ? {
                  ...d,
                  events: (d.events ?? []).map((e, ei) =>
                    ei === sourceEventIndex ? { ...e, images: normalizedSource } : e,
                  ),
                }
              : d,
          );
          return { ...prev, itinerary_v2_json: { ...prev.itinerary_v2_json, days: nextDays } };
        }
        const days = prev.itinerary_days_json ?? [];
        const nextDays = days.map((d, i) =>
          i === sourceDayIndex
            ? {
                ...d,
                events: d.events.map((e, ei) =>
                  ei === sourceEventIndex ? { ...e, images: normalizedSource } : e,
                ),
              }
            : d,
        );
        return { ...prev, itinerary_days_json: nextDays };
      }

      let afterInsert = insertImageAt(targetBase, imageToMove, insertAt);
      afterInsert = dedupeEventImages(afterInsert);
      const normalizedSource = normalizeEventImages(afterRemove);
      const normalizedTarget = normalizeEventImages(afterInsert);

      if (sourceEditorType === "v2" && targetEditorType === "v2") {
        const days = prev.itinerary_v2_json?.days ?? [];
        const nextDays = days.map((d, i) => {
          if (i === sourceDayIndex) {
            const events = d.events ?? [];
            return {
              ...d,
              events: events.map((e, ei) =>
                ei === sourceEventIndex ? { ...e, images: normalizedSource } : e,
              ),
            };
          }
          if (i === targetDayIndex) {
            const events = d.events ?? [];
            return {
              ...d,
              events: events.map((e, ei) =>
                ei === targetEventIndex ? { ...e, images: normalizedTarget } : e,
              ),
            };
          }
          return d;
        });
        return { ...prev, itinerary_v2_json: { ...prev.itinerary_v2_json, days: nextDays } };
      }

      if (sourceEditorType === "structured" && targetEditorType === "structured") {
        const days = prev.itinerary_days_json ?? [];
        const nextDays = days.map((d, i) => {
          if (i === sourceDayIndex) {
            return {
              ...d,
              events: d.events.map((e, ei) =>
                ei === sourceEventIndex ? { ...e, images: normalizedSource } : e,
              ),
            };
          }
          if (i === targetDayIndex) {
            return {
              ...d,
              events: d.events.map((e, ei) =>
                ei === targetEventIndex ? { ...e, images: normalizedTarget } : e,
              ),
            };
          }
          return d;
        });
        return { ...prev, itinerary_days_json: nextDays };
      }

      if (sourceEditorType === "v2" && targetEditorType === "structured") {
        const v2Days = prev.itinerary_v2_json?.days ?? [];
        const structDays = prev.itinerary_days_json ?? [];
        const nextV2Days = v2Days.map((d, i) =>
          i === sourceDayIndex
            ? {
                ...d,
                events: (d.events ?? []).map((e, ei) =>
                  ei === sourceEventIndex ? { ...e, images: normalizedSource } : e,
                ),
              }
            : d,
        );
        const nextStructDays = structDays.map((d, i) =>
          i === targetDayIndex
            ? {
                ...d,
                events: d.events.map((e, ei) =>
                  ei === targetEventIndex ? { ...e, images: normalizedTarget } : e,
                ),
              }
            : d,
        );
        return {
          ...prev,
          itinerary_v2_json: { ...prev.itinerary_v2_json, days: nextV2Days },
          itinerary_days_json: nextStructDays,
        };
      }

      if (sourceEditorType === "structured" && targetEditorType === "v2") {
        const structDays = prev.itinerary_days_json ?? [];
        const v2Days = prev.itinerary_v2_json?.days ?? [];
        const nextStructDays = structDays.map((d, i) =>
          i === sourceDayIndex
            ? {
                ...d,
                events: d.events.map((e, ei) =>
                  ei === sourceEventIndex ? { ...e, images: normalizedSource } : e,
                ),
              }
            : d,
        );
        const nextV2Days = v2Days.map((d, i) =>
          i === targetDayIndex
            ? {
                ...d,
                events: (d.events ?? []).map((e, ei) =>
                  ei === targetEventIndex ? { ...e, images: normalizedTarget } : e,
                ),
              }
            : d,
        );
        return {
          ...prev,
          itinerary_days_json: nextStructDays,
          itinerary_v2_json: { ...prev.itinerary_v2_json, days: nextV2Days },
        };
      }

      return prev;
    });
  }

  function handleDropOnEvent(
    payload: ModetourImageDragItem,
    destination: {
      editorType: "v2" | "structured";
      dayIndex: number;
      eventIndex: number;
      insertAt?: number;
    },
  ) {
    if (!payload || !isValidImageDndPayload(payload)) return;
    const normalizedUrl = normalizeImageUrl(payload.url);
    if (!normalizedUrl) return;

    const destEditorType = destination.editorType;
    const destDayIndex = destination.dayIndex;
    const destEventIndex = destination.eventIndex;
    const destInsertAt =
      destination.insertAt != null
        ? Math.max(0, destination.insertAt)
        : (() => {
            const days =
              destEditorType === "v2"
                ? formState.itinerary_v2_json?.days
                : formState.itinerary_days_json;
            const day = days?.[destDayIndex];
            const images = day?.events?.[destEventIndex]?.images ?? [];
            return images.length;
          })();

    const destDays = destEditorType === "v2" ? formState.itinerary_v2_json?.days : formState.itinerary_days_json;
    const destDay = destDays?.[destDayIndex];
    const destEvent = destDay?.events?.[destEventIndex];
    if (!destDay || !destEvent) return;

    if (payload.source === "unassigned") {
      if (targetHasUrl(destEvent.images ?? [], normalizedUrl)) {
        setUnassignedImageUrls((prev) => removeFirstMatch(prev, payload.url));
      } else {
        assignUnassignedImageToEvent({
          editorType: destEditorType,
          dayIndex: destDayIndex,
          eventIndex: destEventIndex,
          url: payload.url,
          insertAt: destInsertAt,
        });
      }
      return;
    }

    if (payload.source === "event") {
      const sourceEditorType = payload.editorType;
      const sourceDayIndex = payload.dayIndex;
      const sourceEventIndex = payload.eventIndex;
      const sourceImageIndex = payload.imageIndex;
      const sourceDays = sourceEditorType === "v2" ? formState.itinerary_v2_json?.days : formState.itinerary_days_json;
      const sourceDay = sourceDays?.[sourceDayIndex];
      const sourceEvent = sourceDay?.events?.[sourceEventIndex];
      const sourceImages = sourceEvent?.images ?? [];
      if (!sourceDay || !sourceEvent) return;
      if (sourceImageIndex < 0 || sourceImageIndex >= sourceImages.length) return;

      const sameEvent =
        sourceEditorType === destEditorType &&
        sourceDayIndex === destDayIndex &&
        sourceEventIndex === destEventIndex;

      if (sameEvent) {
        if (
          isNoOpDrop({
            source: {
              editorType: sourceEditorType,
              dayIndex: sourceDayIndex,
              eventIndex: sourceEventIndex,
              imageIndex: sourceImageIndex,
            },
            target: {
              editorType: destEditorType,
              dayIndex: destDayIndex,
              eventIndex: destEventIndex,
              insertAt: destInsertAt,
            },
            sourceImagesLength: sourceImages.length,
          })
        )
          return;
        const fromIndex = sourceImageIndex;
        let toIndex = destInsertAt;
        if (toIndex > fromIndex) toIndex -= 1;
        if (fromIndex === toIndex) return;
        reorderWithinEvent({
          editorType: sourceEditorType,
          dayIndex: sourceDayIndex,
          eventIndex: sourceEventIndex,
          fromIndex,
          toIndex,
        });
      } else {
        moveImageBetweenEvents({
          sourceEditorType,
          sourceDayIndex,
          sourceEventIndex,
          sourceImageIndex,
          targetEditorType: destEditorType,
          targetDayIndex: destDayIndex,
          targetEventIndex: destEventIndex,
          targetInsertAt: destInsertAt,
        });
      }
    }
  }

  async function handleCreateProduct() {
    if (!importData || !previewProduct) return;

    const validation = validateImagePlacementState({
      v2Days: formState.itinerary_v2_json?.days,
      structuredDays: formState.itinerary_days_json,
      unassignedImageUrls,
    });
    if (validation.hasError) {
      const firstError = validation.errors[0];
      setSaveError(firstError?.message ?? "이미지 배치 오류가 있어 저장할 수 없습니다.");
      return;
    }

    const sourceUrl = importData.source?.url?.trim() ?? "";
    const formForSerialize: ProductFormState = {
      ...formState,
      product_source_url: sourceUrl || formState.product_source_url,
    };
    const payload = serializeAdminProductForm(formForSerialize, {
      unassignedImageUrls,
    }) as Record<string, unknown>;

    // API 필수값 보정: 상품명·이미지 URL만 필수. 설명은 비어 있어도 생성 가능(편집에서 입력)
    const title =
      (payload.title as string)?.trim() ||
      importData.product?.title?.trim() ||
      previewProduct.title?.trim() ||
      "";
    const description =
      (payload.description as string)?.trim() ||
      importData.product?.summary?.trim() ||
      previewProduct.description?.trim() ||
      previewProduct.one_liner?.trim() ||
      "";
    const imageUrl =
      (payload.image_url as string)?.trim() ||
      importData.media?.heroImageUrl?.trim() ||
      (Array.isArray(importData.media?.galleryImageUrls) ? (importData.media.galleryImageUrls[0] as string) : undefined)?.trim() ||
      previewProduct.image_url?.trim() ||
      (Array.isArray(payload.images_json) ? (payload.images_json[0] as string) : undefined)?.trim() ||
      "";

    if (!title || !imageUrl) {
      setSaveError("상품명과 이미지 URL이 필요합니다. Import 데이터를 확인하세요.");
      return;
    }

    payload.title = title;
    payload.description = description || "";
    payload.image_url = imageUrl;

    setIsSaving(true);
    setSaveError(null);
    setCreatedProductId(null);
    setExistingProductId(null);

    try {
      const response = await fetch("/api/admin/products", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const result = (await response.json()) as {
        message?: string;
        id?: string;
        existingId?: string;
      };

      if (response.status === 409) {
        setSaveError(result.message ?? "이미 같은 원본 URL로 생성된 상품이 있습니다.");
        setExistingProductId(result.existingId ?? null);
        return;
      }

      if (!response.ok) {
        setSaveError(result.message ?? "상품 생성에 실패했습니다.");
        return;
      }

      if (result.id) {
        setCreatedProductId(result.id);
      }
    } catch {
      setSaveError("상품 생성 중 오류가 발생했습니다.");
    } finally {
      setIsSaving(false);
    }
  }

  const dayCount = importData?.itinerary?.days?.length ?? 0;
  const eventCount =
    importData?.itinerary?.days?.reduce(
      (acc, day) => acc + (day.events?.length ?? 0),
      0,
    ) ?? 0;
  const imageCount =
    (importData?.media?.galleryImageUrls?.length ?? 0) +
    (importData?.media?.heroImageUrl ? 1 : 0);

  return (
    <div className="w-full px-6 py-8 md:px-10">
      <h1 className="text-xl font-semibold text-slate-100">상품 등록(모두)</h1>
      <p className="mt-2 text-sm text-slate-300">
        모두투어 상품 페이지에서 추출한 JSON을 붙여넣어 등록합니다.
      </p>
      <p className="mt-1 text-xs text-slate-400">
        일정·이미지·기본 정보만 자동 반영됩니다. 설명/포함·불포함/예약·환불 규정은 편집에서 직접 입력해 주세요.
      </p>

      <div className="mt-6">
        <textarea
          className="h-48 w-full rounded-lg border border-slate-700 bg-slate-900 p-3 text-sm text-slate-200 placeholder:text-slate-500"
          placeholder="Chrome Extension에서 복사한 JSON을 붙여넣으세요"
          value={jsonText}
          onChange={(e) => setJsonText(e.target.value)}
        />

        <div className="mt-3 flex gap-3">
          <button
            type="button"
            onClick={handleValidate}
            className="rounded-lg border border-[var(--primary)] bg-[var(--primary)] px-4 py-2 text-sm font-semibold text-[var(--on-primary)] hover:opacity-90"
          >
            검증하기
          </button>
          <button
            type="button"
            onClick={handleReset}
            className="rounded-lg border border-slate-600 bg-slate-700 px-4 py-2 text-sm font-semibold text-slate-200 hover:bg-slate-600"
          >
            초기화
          </button>
        </div>

        {parseError && (
          <div className="mt-4 text-red-400" role="alert">
            {parseError}
          </div>
        )}

        {previewError && (
          <div className="mt-4 text-amber-400" role="alert">
            미리보기: {previewError}
          </div>
        )}

        {warnings.length > 0 && (
          <div className="mt-6">
            <h3 className="font-semibold text-yellow-400">검증 경고</h3>
            <ul className="mt-2 list-inside list-disc space-y-1 text-sm text-yellow-200">
              {warnings.map((w, i) => (
                <li key={`${w.code}-${i}`}>
                  [{w.code}] {w.message}
                </li>
              ))}
            </ul>
          </div>
        )}

        {importData && (
          <div className="mt-8 rounded-lg border border-slate-700 p-4">
            <h3 className="mb-3 font-semibold text-slate-200">Import 요약</h3>
            <div className="space-y-2 text-sm text-slate-300">
              <div>상품명: {importData.product?.title ?? "-"}</div>
              <div>
                여행 기간: {importData.product?.nights ?? "?"}박{" "}
                {importData.product?.days ?? "?"}일
              </div>
              <div>Day 수: {dayCount}</div>
              <div>이벤트 수: {eventCount}</div>
              <div>이미지 수: {imageCount}</div>
            </div>
          </div>
        )}

        {previewProduct && (
          <div className="mt-8 rounded-lg border border-slate-700 bg-slate-900/50 p-5">
            <h3 className="mb-4 font-semibold text-slate-200">미리보기</h3>

            <div className="space-y-4 text-sm">
              <div>
                <span className="font-medium text-slate-400">제목</span>
                <p className="mt-0.5 text-slate-100">{previewProduct.title || "-"}</p>
              </div>

              {previewProduct.one_liner && (
                <div>
                  <span className="font-medium text-slate-400">요약</span>
                  <p className="mt-0.5 text-slate-300">{previewProduct.one_liner}</p>
                </div>
              )}

              {(previewProduct.overview_region || previewProduct.duration) && (
                <div className="flex flex-wrap gap-4">
                  {previewProduct.overview_region && (
                    <span className="text-slate-300">지역: {previewProduct.overview_region}</span>
                  )}
                  {previewProduct.duration && (
                    <span className="text-slate-300">기간: {previewProduct.duration}</span>
                  )}
                </div>
              )}

              {previewProduct.image_url && (
                <div className="relative aspect-[21/9] w-full max-w-2xl overflow-hidden rounded-lg bg-slate-800">
                  <Image
                    src={normalizeProductImageUrl(previewProduct.image_url)}
                    alt={previewProduct.title || "대표 이미지"}
                    fill
                    className="object-cover"
                    sizes="(max-width: 768px) 100vw, 672px"
                  />
                </div>
              )}

              {(previewProduct.included_items || previewProduct.excluded_items) && (
                <div className="grid gap-4 sm:grid-cols-2">
                  {previewProduct.included_items && (
                    <div>
                      <span className="font-medium text-slate-400">포함</span>
                      <p className="mt-0.5 whitespace-pre-wrap text-slate-300">
                        {previewProduct.included_items.length > SNIPPET_LEN
                          ? `${previewProduct.included_items.slice(0, SNIPPET_LEN)}…`
                          : previewProduct.included_items}
                      </p>
                    </div>
                  )}
                  {previewProduct.excluded_items && (
                    <div>
                      <span className="font-medium text-slate-400">불포함</span>
                      <p className="mt-0.5 whitespace-pre-wrap text-slate-300">
                        {previewProduct.excluded_items.length > SNIPPET_LEN
                          ? `${previewProduct.excluded_items.slice(0, SNIPPET_LEN)}…`
                          : previewProduct.excluded_items}
                      </p>
                    </div>
                  )}
                </div>
              )}

              {previewProduct.terms_and_notes && (
                <div>
                  <span className="font-medium text-slate-400">약관/취소/유의사항</span>
                  <p className="mt-0.5 whitespace-pre-wrap text-slate-300">
                    {previewProduct.terms_and_notes.length > SNIPPET_LEN * 2
                      ? `${previewProduct.terms_and_notes.slice(0, SNIPPET_LEN * 2)}…`
                      : previewProduct.terms_and_notes}
                  </p>
                </div>
              )}

              {previewProduct.itinerary_v2_json?.days?.length ? (
                <div>
                  <span className="font-medium text-slate-400">일정</span>
                  <ul className="mt-2 space-y-3">
                    {previewProduct.itinerary_v2_json.days.map((day, index) => (
                      <li key={`day-${day.day}-${index}`} className="rounded border border-slate-700 bg-slate-800/50 p-3">
                        <div className="font-medium text-slate-200">
                          Day {day.day}
                          {day.title ? ` - ${day.title}` : ""}
                          {day.dateText ? ` (${day.dateText})` : ""}
                        </div>
                        <ul className="mt-2 space-y-1 pl-2 text-slate-400">
                          {(day.events ?? []).slice(0, 2).map((ev, i) => (
                            <li key={i}>
                              {ev.timeText ? `${ev.timeText} ` : ""}
                              {ev.heading || "(제목 없음)"}
                            </li>
                          ))}
                          {(day.events?.length ?? 0) > 2 && (
                            <li className="text-slate-500">… 외 {(day.events?.length ?? 0) - 2}개</li>
                          )}
                        </ul>
                      </li>
                    ))}
                  </ul>
                </div>
              ) : null}
            </div>

            {/* 미할당 이미지 풀 + 일정 편집 (이미지 배치 DnD) */}
            <div className="mt-8 space-y-4 rounded-lg border border-slate-700 bg-slate-900/50 p-4">
              <h3 className="font-semibold text-slate-200">일정 이미지 배치</h3>
              {imagePlacementValidation.issues.length > 0 && (
                <div
                  className={`rounded-lg border px-3 py-2 text-sm ${
                    imagePlacementValidation.hasError
                      ? "border-red-800 bg-red-900/40 text-red-200"
                      : "border-amber-700 bg-amber-900/30 text-amber-200"
                  }`}
                  role="alert"
                >
                  {imagePlacementValidation.hasError ? (
                    <p className="font-medium">오류가 있어 저장할 수 없습니다.</p>
                  ) : (
                    <p className="font-medium">저장 전 확인해 주세요.</p>
                  )}
                  <p className="mt-0.5 text-xs opacity-90">
                    오류 {imagePlacementValidation.errors.length}건
                    {imagePlacementValidation.warnings.length > 0 &&
                      ` / 경고 ${imagePlacementValidation.warnings.length}건`}
                  </p>
                  <ul className="mt-1 list-inside list-disc space-y-0.5 text-xs opacity-95">
                    {imagePlacementValidation.errors.slice(0, 5).map((e, i) => (
                      <li key={`e-${i}`}>{e.message}</li>
                    ))}
                    {imagePlacementValidation.warnings.slice(0, 3).map((w, i) => (
                      <li key={`w-${i}`}>{w.message}</li>
                    ))}
                  </ul>
                </div>
              )}
              <p className="text-xs text-slate-400">
                미할당 이미지를 드래그하여 각 일정 이벤트에 배치할 수 있습니다. 이벤트에서 삭제 시 미할당 풀로 돌아갑니다.
              </p>
              <UnassignedImagePool
                imageUrls={unassignedImageUrls}
                title={`미할당 이미지 (${unassignedImageUrls.length}장)`}
                className="mb-4"
              />
              <ScheduleVisualEditorV2
                form={{
                  itinerary_v2_json: formState.itinerary_v2_json ?? { days: [] },
                  legacy_itinerary_text: formState.legacy_itinerary_text ?? "",
                  images_json: formState.images_json,
                  image_url: formState.image_url,
                }}
                setForm={(updater: React.SetStateAction<any>) => {
                  setFormState((prev) => {
                    const formSlice = {
                      itinerary_v2_json: prev.itinerary_v2_json ?? { days: [] },
                      legacy_itinerary_text: prev.legacy_itinerary_text ?? "",
                      images_json: prev.images_json,
                      image_url: prev.image_url,
                    };
                    const nextSlice =
                      typeof updater === "function" ? (updater as (p: typeof formSlice) => typeof formSlice)(formSlice) : updater;
                    return { ...prev, ...nextSlice };
                  });
                }}
                previewProductImageUrl={formState.image_url?.trim() || ""}
                activeDayIndex={activeDayIndex}
                setActiveDayIndex={setActiveDayIndex}
                selectedEvent={selectedEvent}
                onSelectEvent={setSelectedEvent}
                modetourDnDEnabled
                onDropExternalImage={handleDropOnEvent}
                onReturnImageToPool={(url) => returnEventImageToUnassigned({ url })}
                imagePlacementIssuesByUrl={imagePlacementIssuesByUrl}
                showPlacementWarnings={true}
                onAutoAssignImages={handleAutoAssignImages}
                unassignedImageCount={unassignedImageUrls.length}
              />
            </div>

            {/* 저장 시 반영될 변경사항 요약 */}
            {importData && previewProduct && diffSummary.changed && (
              <div
                className="rounded-lg border border-emerald-700/50 bg-emerald-900/20 px-4 py-3 text-sm text-slate-200"
                role="region"
                aria-label="저장 시 반영될 변경사항"
              >
                <p className="mb-2 font-semibold">저장 시 반영될 변경사항</p>
                <ul className="list-inside list-disc space-y-0.5 text-slate-300">
                  {diffSummary.sections.flatMap((s) =>
                    s.items.map((item, i) => (
                      <li key={`${s.key}-${i}`}>{item}</li>
                    )),
                  )}
                </ul>
              </div>
            )}

            {/* 상품 생성 액션 */}
            <div className="mt-6 flex flex-col gap-4 border-t border-slate-700 pt-4">
              <button
                type="button"
                onClick={handleCreateProduct}
                disabled={
                  !importData ||
                  !previewProduct ||
                  isSaving ||
                  !!parseError ||
                  imagePlacementValidation.hasError
                }
                className="rounded-lg border border-emerald-600 bg-emerald-600 px-4 py-2 text-sm font-semibold text-white hover:bg-emerald-500 disabled:cursor-not-allowed disabled:opacity-50"
              >
                {isSaving ? "생성 중…" : "상품 생성"}
              </button>

              {saveError && (
                <div
                  className="rounded-lg border border-red-800 bg-red-900/50 px-4 py-3 text-sm text-red-200"
                  role="alert"
                >
                  {saveError}
                  {existingProductId && (
                    <div className="mt-2">
                      <Link
                        href={`${PRODUCTS_LIST_PATH}?editingId=${existingProductId}`}
                        className="inline-block rounded border border-red-600 bg-red-800 px-3 py-1.5 text-sm font-medium text-white hover:bg-red-700"
                      >
                        기존 상품으로 이동
                      </Link>
                    </div>
                  )}
                </div>
              )}

              {createdProductId && !saveError && (
                <div className="rounded-lg border border-emerald-800 bg-emerald-900/30 px-4 py-3 text-sm text-emerald-200">
                  <p className="font-medium">생성 완료</p>
                  <p className="mt-1 text-slate-300">상품이 등록되었습니다.</p>
                  <div className="mt-3 flex gap-3">
                    <Link
                      href={`/products/${createdProductId}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="rounded border border-sky-600 bg-sky-700 px-3 py-1.5 text-sm font-medium text-white hover:bg-sky-600"
                    >
                      미리보기
                    </Link>
                    <Link
                      href={`${PRODUCTS_LIST_PATH}?editingId=${createdProductId}`}
                      className="rounded border border-emerald-600 bg-emerald-700 px-3 py-1.5 text-sm font-medium text-white hover:bg-emerald-600"
                    >
                      상품 편집으로 이동
                    </Link>
                    <Link
                      href={PRODUCTS_LIST_PATH}
                      className="rounded border border-slate-600 bg-slate-700 px-3 py-1.5 text-sm font-medium text-slate-200 hover:bg-slate-600"
                    >
                      상품 목록으로 이동
                    </Link>
                  </div>
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

```


---

## File: `src/app/admin/products/new-modetour/page.tsx`

```tsx
import ModetourNewProductPage from "@/components/admin/modetour/ModetourNewProductPage";

export default function Page() {
  return <ModetourNewProductPage />;
}

```


---

## File: `src/app/theall_manager_only/products/new-modetour/page.tsx`

```tsx
import ModetourNewProductPage from "@/components/admin/modetour/ModetourNewProductPage";

export default function Page() {
  return <ModetourNewProductPage />;
}

```


---

## File: `src/app/products/page.tsx`

```tsx
import SiteHeader from "@/components/site-chrome/SiteHeader";
import ProductsHero from "@/components/product-detail/ProductsHero";
import { PageContainer } from "@/components/layout/PageContainer";
import { NavigationContextHeader } from "@/components/navigation/NavigationContextHeader";
import {
  buildProductsBreadcrumbItems,
  getProductsNavFallbackHref,
} from "@/components/navigation/breadcrumb-config";
import { ProductsPageContent } from "@/components/products/ProductsPageContent";
import { loadProductsListingContext } from "@/lib/products/loadProductsListingContext";
import {
  resolveLandingParams,
  hasLandingParams,
} from "@/lib/productFiltersLanding";
import { getCollectionCampaignNamesForListing } from "@/lib/products/getCollectionCampaignNamesForListing";

type ProductsPageProps = {
  searchParams?: Promise<{
    q?: string;
    tourType?: string;
    region?: string;
    theme?: string;
    product_line?: string;
    sort?: string;
    collection?: string;
    destination?: string;
    city?: string;
  }>;
};

export default async function ProductsPage({ searchParams }: ProductsPageProps) {
  const query = (await searchParams) ?? {};
  const searchKeyword = typeof query.q === "string" ? query.q.trim() : "";
  const tourType = typeof query.tourType === "string" ? query.tourType.trim() : "";
  const golfPresetActive = tourType === "golf-park";
  const presetCategories = golfPresetActive ? ["골프투어", "파크골프투어"] : undefined;
  const listingCtx = await loadProductsListingContext("products_index");
  const {
    products,
    categories,
    themes,
    productLines,
    regionTree,
    themeTree,
    taxonomyNameMap,
    hubDestinations,
    hubThemes,
  } = listingCtx;

  const landingResolved =
    hasLandingParams(query) ? await resolveLandingParams(query) : null;
  const initialFiltersFromServer = landingResolved?.initialFilters ?? null;
  const initialKeywordFromLanding = landingResolved?.initialKeyword ?? "";

  const collectionCampaignNames = await getCollectionCampaignNamesForListing();

  return (
    <div className="min-h-screen bg-gradient-to-b from-[var(--surface-muted)] to-[var(--surface)] text-[var(--text-primary)]">
      <SiteHeader activeTab="products" searchQuery={searchKeyword} golfPresetActive={golfPresetActive} />

      <main className="flex w-full flex-col py-6 sm:py-10 md:py-14">
        <PageContainer size="wide" className="flex flex-col gap-6">
          <NavigationContextHeader
            items={buildProductsBreadcrumbItems("index", { currentLabel: "여행상품" })}
            pageTitle="여행상품"
            fallbackHref={getProductsNavFallbackHref("index")}
            withMarginBottom={false}
          />
          <ProductsHero variant={golfPresetActive ? "golf" : "package"} />

          {products.length === 0 ? (
            <section className="rounded-2xl bg-[var(--surface)] p-8 shadow-[var(--shadow-soft)] ring-1 ring-[var(--border)] type-small text-[var(--text-muted)] sm:rounded-3xl">
              현재 등록된 상품이 없습니다. 관리자 페이지에서 상품을 등록해 주세요.
            </section>
          ) : (
            <ProductsPageContent
              products={products}
              taxonomyNameMap={taxonomyNameMap}
              regionOptions={categories}
              regionTree={regionTree}
              themeOptions={themes}
              themeTree={themeTree}
              productLineOptions={productLines}
              initialKeyword={initialKeywordFromLanding || searchKeyword}
              presetCategories={presetCategories}
              presetLabel={golfPresetActive ? "골프/파크골프" : undefined}
              listing={{
                initialFiltersFromServer,
                regionTaxonomies: hubDestinations,
                themeTaxonomies: hubThemes,
                mobileListToolbarBelowBackHeader: true,
                collectionCampaignNames,
              }}
            />
          )}
        </PageContainer>
      </main>
    </div>
  );
}

```


---

## File: `src/app/products/region/[slug]/page.tsx`

```tsx
import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { getTaxonomyNameBySlug } from "@/lib/productTaxonomies";
import { getProductLandingData } from "@/lib/productLanding";
import ProductLandingPage from "@/components/products/landing/ProductLandingPage";
import {
  buildProductsBreadcrumbItems,
  getProductsNavFallbackHref,
} from "@/components/navigation/breadcrumb-config";
import { ProductsPageContent } from "@/components/products/ProductsPageContent";
import SiteHeader from "@/components/site-chrome/SiteHeader";
import { loadProductRegionLandingMetadata } from "@/lib/landing/productSlugLandingMetadata";
import { loadProductsRegionLandingPageBundle } from "@/lib/landing/loadProductsSlugLandingPage";
import { getCollectionCampaignNamesForListing } from "@/lib/products/getCollectionCampaignNamesForListing";

type RegionLandingProps = {
  params: Promise<{ slug: string }>;
};

export async function generateMetadata({ params }: RegionLandingProps): Promise<Metadata> {
  const { slug } = await params;
  const trimmed = slug?.trim() ?? "";
  return loadProductRegionLandingMetadata(trimmed);
}

/**
 * 지역 랜딩: /products/region/[slug]
 * 랜딩 데이터가 유효하면 새 랜딩 UI 렌더, 아니면 기존대로 /products?region={name} redirect.
 */
export default async function ProductsRegionSlugPage({ params }: RegionLandingProps) {
  const { slug } = await params;
  const trimmedSlug = slug?.trim();
  if (!trimmedSlug) {
    redirect("/products");
  }

  const landingData = await getProductLandingData({ type: "region", slug: trimmedSlug });
  const name = await getTaxonomyNameBySlug("category", trimmedSlug);

  if (landingData && landingData.taxonomyName && landingData.hero?.primaryCtaHref) {
    const [{ dataWithChildren, listing, initialFiltersFromServer, initialRegionDescendants }, collectionCampaignNames] =
      await Promise.all([
        loadProductsRegionLandingPageBundle(trimmedSlug, landingData),
        getCollectionCampaignNamesForListing(),
      ]);
    const {
      products,
      categories,
      themes,
      productLines,
      regionTree,
      themeTree,
      taxonomyNameMap,
    } = listing;

    return (
      <>
        <SiteHeader activeTab="products" />
        <ProductLandingPage
          data={dataWithChildren}
          navigationContext={{
            items: buildProductsBreadcrumbItems("region", {
              currentLabel: landingData.taxonomyName,
            }),
            pageTitle: landingData.taxonomyName,
            fallbackHref: getProductsNavFallbackHref("region"),
          }}
        />
        <section
          className="min-h-screen border-t border-[var(--border)] bg-gradient-to-b from-[var(--surface-muted)] to-[var(--surface)] pt-10 mt-12 sm:mt-16"
          aria-labelledby="products-section-heading"
        >
          {/* 랜딩 상단과 동일한 가로 폭·패딩 체계(max-w-6xl, px-3 sm:px-6 md:px-10)로 정렬 */}
          <div className="mx-auto w-full max-w-6xl px-3 py-8 sm:px-6 sm:py-10 md:px-10 md:py-14">
            <div className="flex flex-col gap-8">
              <h2
                id="products-section-heading"
                className="section-heading type-h2 text-[var(--foreground)] first:mt-0"
              >
                {landingData.taxonomyName} 여행 상품 전체 보기
              </h2>
              <p className="section-description type-small text-[var(--text-muted)] -mt-4">
                조건을 변경하여 다양한 상품을 비교해보세요.
              </p>
              <ProductsPageContent
                products={products}
                taxonomyNameMap={taxonomyNameMap}
                regionOptions={categories}
                regionTree={regionTree}
                themeOptions={themes}
                themeTree={themeTree}
                productLineOptions={productLines}
                listing={{
                  initialFiltersFromServer,
                  basePath: `/products/region/${trimmedSlug}`,
                  filterContextLabel: `현재 '${landingData.taxonomyName}' 기준으로 상품을 보여주고 있습니다.`,
                  initialRegionDescendants,
                  cardLayout: "related",
                  mobileListToolbarBelowBackHeader: true,
                  collectionCampaignNames,
                }}
              />
            </div>
          </div>
        </section>
      </>
    );
  }

  if (!name) {
    redirect("/products");
  }
  redirect(`/products?region=${encodeURIComponent(name)}`);
}

```


---

## File: `src/app/products/theme/[slug]/page.tsx`

```tsx
import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { getTaxonomyNameBySlug } from "@/lib/productTaxonomies";
import { getProductLandingData } from "@/lib/productLanding";
import ProductLandingPage from "@/components/products/landing/ProductLandingPage";
import {
  buildProductsBreadcrumbItems,
  getProductsNavFallbackHref,
} from "@/components/navigation/breadcrumb-config";
import { ProductsPageContent } from "@/components/products/ProductsPageContent";
import SiteHeader from "@/components/site-chrome/SiteHeader";
import { loadProductThemeLandingMetadata } from "@/lib/landing/productSlugLandingMetadata";
import { loadProductsThemeLandingPageBundle } from "@/lib/landing/loadProductsSlugLandingPage";
import { getCollectionCampaignNamesForListing } from "@/lib/products/getCollectionCampaignNamesForListing";

type ThemeLandingProps = {
  params: Promise<{ slug: string }>;
};

export async function generateMetadata({ params }: ThemeLandingProps): Promise<Metadata> {
  const { slug } = await params;
  const trimmed = slug?.trim() ?? "";
  return loadProductThemeLandingMetadata(trimmed);
}

/**
 * 테마 랜딩: /products/theme/[slug]
 * 랜딩 데이터가 유효하면 새 랜딩 UI 렌더, 아니면 기존대로 /products?theme={name} redirect.
 */
export default async function ProductsThemeSlugPage({ params }: ThemeLandingProps) {
  const { slug } = await params;
  const trimmedSlug = slug?.trim();
  if (!trimmedSlug) {
    redirect("/products");
  }

  const landingData = await getProductLandingData({ type: "theme", slug: trimmedSlug });
  const name = await getTaxonomyNameBySlug("theme", trimmedSlug);

  if (landingData && landingData.taxonomyName && landingData.hero?.primaryCtaHref) {
    const [{ dataWithChildren, listing, initialFiltersFromServer, initialThemeDescendantNames }, collectionCampaignNames] =
      await Promise.all([
        loadProductsThemeLandingPageBundle(trimmedSlug, landingData),
        getCollectionCampaignNamesForListing(),
      ]);
    const {
      products,
      categories,
      themes,
      productLines,
      regionTree,
      themeTree,
      taxonomyNameMap,
    } = listing;

    return (
      <>
        <SiteHeader activeTab="products" />
        <ProductLandingPage
          data={dataWithChildren}
          navigationContext={{
            items: buildProductsBreadcrumbItems("theme", {
              currentLabel: landingData.taxonomyName,
            }),
            pageTitle: landingData.taxonomyName,
            fallbackHref: getProductsNavFallbackHref("theme"),
          }}
        />
        <section
          className="min-h-screen border-t border-[var(--border)] bg-gradient-to-b from-[var(--surface-muted)] to-[var(--surface)] pt-10 mt-12 sm:mt-16"
          aria-labelledby="products-section-heading"
        >
          {/* 랜딩 상단과 동일한 가로 폭·패딩 체계(max-w-6xl, px-3 sm:px-6 md:px-10)로 정렬 */}
          <div className="mx-auto w-full max-w-6xl px-3 py-8 sm:px-6 sm:py-10 md:px-10 md:py-14">
            <div className="flex flex-col gap-8">
              <h2
                id="products-section-heading"
                className="section-heading type-h2 text-[var(--foreground)] first:mt-0"
              >
                {landingData.taxonomyName} 여행 상품 전체 보기
              </h2>
              <p className="section-description type-small text-[var(--text-muted)] -mt-4">
                조건을 변경하여 다양한 상품을 비교해보세요.
              </p>
              <ProductsPageContent
                products={products}
                taxonomyNameMap={taxonomyNameMap}
                regionOptions={categories}
                regionTree={regionTree}
                themeOptions={themes}
                themeTree={themeTree}
                productLineOptions={productLines}
                listing={{
                  initialFiltersFromServer,
                  basePath: `/products/theme/${trimmedSlug}`,
                  filterContextLabel: `현재 '${landingData.taxonomyName}' 테마 기준 결과입니다.`,
                  initialThemeDescendantNames,
                  cardLayout: "related",
                  mobileListToolbarBelowBackHeader: true,
                  collectionCampaignNames,
                }}
              />
            </div>
          </div>
        </section>
      </>
    );
  }

  if (!name) {
    redirect("/products");
  }
  redirect(`/products?theme=${encodeURIComponent(name)}`);
}

```


---

## File: `src/app/destinations/[slug]/page.tsx`

```tsx
import { notFound } from "next/navigation";
import Link from "next/link";
import type { Metadata } from "next";
import SiteHeader from "@/components/site-chrome/SiteHeader";
import { PageContainer } from "@/components/layout/PageContainer";
import { SectionBlock } from "@/components/layout/SectionBlock";
import { SectionHeader } from "@/components/layout/SectionHeader";
import { LandingDetailHero } from "@/components/landing/LandingDetailHero";
import { HubBrowseCard } from "@/components/landing/HubBrowseCard";
import { LandingSubCardsSection } from "@/components/landing/LandingSubCardsSection";
import { GuideCardGrid } from "@/components/guides/GuideCardGrid";
import { ReviewHighlightCard } from "@/components/home/ReviewHighlightCard";
import { HubFilterSidebar } from "@/components/hub/HubFilterSidebar";
import CuratedBlock from "@/components/home/CuratedBlock";
import { ProductsPageContent } from "@/components/products/ProductsPageContent";
import {
  getDestinationBySlugForPublicLanding,
  getHubDestinations,
  getSelfAndDescendantIdsAndNames,
} from "@/lib/productTaxonomies";
import { getProducts } from "@/lib/products";
import { getLandingSubnodes } from "@/lib/landingSubnodes";
import { buildDestinationFallbackImageMap } from "@/lib/landing/buildDestinationFallbackImageMap";
import { loadProductsListingContextForDestinationDetail } from "@/lib/products/loadProductsListingContext";
import { getCollectionCampaignNamesForListing } from "@/lib/products/getCollectionCampaignNamesForListing";
import { getDestinationLandingHref } from "@/lib/hubLandingLinks";
import { BreadcrumbWrapper } from "@/components/navigation/BreadcrumbWrapper";
import {
  getTaxonomyMetadataFallback,
  getTaxonomyHeroImageFallback,
} from "@/lib/landingMetadata";

const RELATED_PRODUCTS_LIMIT = 12;

type Props = { params: Promise<{ slug: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  const destination = await getDestinationBySlugForPublicLanding(slug);
  if (!destination) return { title: "Not Found" };
  const { title, description } = getTaxonomyMetadataFallback(destination);
  return {
    title: `${title} | 더올투어`,
    description: description || `${title} 지역 여행·골프·패키지 상품을 만나보세요.`,
  };
}

export default async function DestinationLandingPage({ params }: Props) {
  const { slug } = await params;
  const destination = await getDestinationBySlugForPublicLanding(slug);
  if (!destination) notFound();

  const [products, subnodes, allDestinations, collectionCampaignNames] = await Promise.all([
    getProducts(),
    getLandingSubnodes("destination", slug),
    getHubDestinations(),
    getCollectionCampaignNamesForListing(),
  ]);
  const {
    categories,
    themes,
    productLines,
    regionTree,
    themeTree,
    taxonomyNameMap,
    destinationGuides,
    reviewHighlights,
  } = await loadProductsListingContextForDestinationDetail(
    products,
    allDestinations,
    destination.id,
  );
  const initialFiltersFromServer = {
    region: destination.name,
    theme: null,
    product_line: null,
    q: null,
    sort: "" as const,
    collection: null,
  };
  const initialRegionDescendants = getSelfAndDescendantIdsAndNames(
    allDestinations,
    destination.name,
  );

  const parentId = destination.id.trim();
  const childDestinations = allDestinations
    .filter((d) => (d.parent_id ?? "").trim() === parentId)
    .sort((a, b) => {
      const sa = a.sort_order ?? 9999;
      const sb = b.sort_order ?? 9999;
      if (sa !== sb) return sa - sb;
      return (a.name ?? "").localeCompare(b.name ?? "", "ko");
    });
  const childFallbackImages = buildDestinationFallbackImageMap(childDestinations, products);

  const nameLower = destination.name.trim().toLowerCase();
  const related = products
    .filter((p) => p.category?.trim().toLowerCase() === nameLower)
    .slice(0, RELATED_PRODUCTS_LIMIT);

  const heroTitle = destination.landing_title?.trim() || destination.name;
  const heroDescription =
    destination.landing_description?.trim() ||
    destination.card_description?.trim() ||
    `${destination.name} 지역의 여행·골프·패키지 상품을 소개합니다.`;
  const heroImage = getTaxonomyHeroImageFallback(destination);

  return (
    <div className="min-h-screen bg-[var(--theall-page-bg)] text-[var(--foreground)]">
      <SiteHeader />

      <main className="flex w-full flex-col py-6 sm:py-10 md:py-14">
        <PageContainer size="wide" className="flex flex-col gap-8">
          <BreadcrumbWrapper
            items={[
              { label: "홈", href: "/" },
              { label: "여행지", href: "/destinations" },
              { label: heroTitle },
            ]}
          />
          <LandingDetailHero
            title={heroTitle}
            description={heroDescription}
            imageUrl={heroImage}
          />

          <div className="flex flex-col gap-8 lg:flex-row lg:items-start">
            <div className="hidden w-72 shrink-0 lg:block">
              <HubFilterSidebar
                regionOptions={categories}
                regionTree={regionTree}
                themeOptions={themes}
                themeTree={themeTree}
                productLineOptions={productLines}
                initialFilters={{ region: destination.name }}
              />
            </div>
            <div className="min-w-0 flex-1">
          {childDestinations.length > 0 ? (
            <SectionBlock surface="none" padding="md">
              <SectionHeader
                title="도시·지역 선택"
                description="원하는 도시·지역을 선택해 보세요."
                align="left"
              />
              <ul className="mt-6 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
                {childDestinations.map((d) => {
                  const cardImageUrl =
                    d.card_image_url?.trim() ||
                    childFallbackImages.get(d.id) ||
                    childFallbackImages.get(d.name.trim().toLowerCase()) ||
                    undefined;
                  return (
                    <li key={d.id}>
                      <HubBrowseCard
                        item={{ ...d, card_image_url: cardImageUrl ?? d.card_image_url }}
                        href={getDestinationLandingHref(d)}
                        showImage={true}
                      />
                    </li>
                  );
                })}
              </ul>
            </SectionBlock>
          ) : null}

          <LandingSubCardsSection
            contextTitle={destination.name}
            nodes={subnodes}
          />

          {destinationGuides.length > 0 ? (
            <SectionBlock surface="none" padding="md">
              <SectionHeader
                eyebrow="TRAVEL GUIDE"
                title={`${destination.name} 여행 가이드`}
                description="이 지역과 관련된 가이드를 만나보세요."
                align="left"
              />
              <div className="mt-6">
                <GuideCardGrid guides={destinationGuides} />
              </div>
              <div className="mt-4">
                <Link
                  href="/guides"
                  className="type-btn inline-flex rounded-xl border border-[var(--border-strong)] bg-[var(--surface)] px-5 py-2.5 text-[var(--primary)] transition hover:bg-[var(--primary-soft)]"
                >
                  가이드 더 보기
                </Link>
              </div>
            </SectionBlock>
          ) : null}

          {related.length > 0 ? (
            <>
              <CuratedBlock
                title={`${destination.name} 대표 상품`}
                description={`${destination.name} 지역과 연결된 상품입니다.`}
                products={related}
                surface="none"
                featuredLanding
                hubLandingLayout
              />
              <div
                className="border-b border-[var(--border)] my-8 sm:my-10"
                aria-hidden
              />
            </>
          ) : null}

          {reviewHighlights.length > 0 ? (
            <SectionBlock surface="none" padding="md">
              <SectionHeader
                eyebrow="TRAVEL REVIEWS"
                title="여행자들의 실제 후기"
                description="실제 여행객들의 생생한 후기를 만나보세요."
                align="left"
              />
              <ul className="mt-6 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
                {reviewHighlights.map((review) => (
                  <li key={review.id}>
                    <ReviewHighlightCard review={review} />
                  </li>
                ))}
              </ul>
              <div className="mt-4">
                <Link
                  href="/reviews"
                  className="type-btn inline-flex rounded-xl border border-[var(--border-strong)] bg-[var(--surface)] px-5 py-2.5 text-[var(--primary)] transition hover:bg-[var(--primary-soft)]"
                >
                  후기 전체 보기
                </Link>
              </div>
            </SectionBlock>
          ) : null}

            </div>
          </div>

          {/* 랜딩 직하단: 전체 상품 필터·리스트 (/products/region/[slug]와 동일 구조) */}
          <section
            className="min-h-screen border-t-2 border-[var(--border-strong)] bg-gradient-to-b from-[var(--surface-muted)] to-[var(--surface)] pt-12 mt-16 shadow-[0_-1px_0_0_color-mix(in_srgb,var(--border)_80%,transparent)] sm:mt-20 sm:pt-14"
            aria-labelledby="products-section-heading"
          >
            <div className="mx-auto w-full max-w-6xl px-3 py-8 sm:px-6 sm:py-10 md:px-10 md:py-14">
              <div className="flex flex-col gap-8">
                <h2
                  id="products-section-heading"
                  className="section-heading type-h2 text-[var(--foreground)] first:mt-0"
                >
                  {destination.name} 여행 상품 전체 보기
                </h2>
                <p className="section-description type-small text-[var(--text-muted)] -mt-4">
                  조건을 변경하여 다양한 상품을 비교해보세요.
                </p>
                <ProductsPageContent
                  products={products}
                  taxonomyNameMap={taxonomyNameMap}
                  regionOptions={categories}
                  regionTree={regionTree}
                  themeOptions={themes}
                  themeTree={themeTree}
                  productLineOptions={productLines}
                  listing={{
                    initialFiltersFromServer,
                    basePath: `/destinations/${slug}`,
                    filterContextLabel: `현재 '${destination.name}' 기준으로 상품을 보여주고 있습니다.`,
                    initialRegionDescendants,
                    cardLayout: "related",
                    collectionCampaignNames,
                  }}
                />
              </div>
            </div>
          </section>
        </PageContainer>
      </main>
    </div>
  );
}

```


---

## File: `src/app/themes/[slug]/page.tsx`

```tsx
import { notFound } from "next/navigation";
import Link from "next/link";
import type { Metadata } from "next";
import SiteHeader from "@/components/site-chrome/SiteHeader";
import { PageContainer } from "@/components/layout/PageContainer";
import { SectionBlock } from "@/components/layout/SectionBlock";
import { SectionHeader } from "@/components/layout/SectionHeader";
import { LandingDetailHero } from "@/components/landing/LandingDetailHero";
import { LandingSubCardsSection } from "@/components/landing/LandingSubCardsSection";
import { HubFilterSidebar } from "@/components/hub/HubFilterSidebar";
import CuratedBlock from "@/components/home/CuratedBlock";
import { ProductsPageContent } from "@/components/products/ProductsPageContent";
import { GuideCardGrid } from "@/components/guides/GuideCardGrid";
import { ReviewHighlightCard } from "@/components/home/ReviewHighlightCard";
import {
  getThemeBySlugForPublicLanding,
  getHubThemes,
  parseThemeTokens,
  getSelfAndDescendantIdsAndNames,
} from "@/lib/productTaxonomies";
import { getProducts } from "@/lib/products";
import { loadProductsListingContextForThemeDetail } from "@/lib/products/loadProductsListingContext";
import { getLandingSubnodes } from "@/lib/landingSubnodes";
import { getThemeLandingHref } from "@/lib/hubLandingLinks";
import { BreadcrumbWrapper } from "@/components/navigation/BreadcrumbWrapper";
import {
  getTaxonomyMetadataFallback,
  getTaxonomyHeroImageFallback,
} from "@/lib/landingMetadata";
import { HubBrowseCard } from "@/components/landing/HubBrowseCard";
import { getCollectionCampaignNamesForListing } from "@/lib/products/getCollectionCampaignNamesForListing";
import type { ProductTaxonomy } from "@/types/productTaxonomy";
import type { Product } from "@/types/product";

const RELATED_PRODUCTS_LIMIT = 12;

/** 카드 이미지 미설정 시 해당 테마 상품 대표 이미지로 채움. */
function buildThemeFallbackImageMap(
  themes: ProductTaxonomy[],
  products: Product[],
): Map<string, string> {
  const map = new Map<string, string>();
  for (const t of themes) {
    const nameLower = t.name.trim().toLowerCase();
    if (map.has(nameLower)) continue;
    const first = products.find(
      (p) =>
        p.image_url?.trim() &&
        parseThemeTokens(p.theme).map((x) => x.trim().toLowerCase()).includes(nameLower),
    );
    if (first?.image_url?.trim()) map.set(nameLower, first.image_url.trim());
  }
  return map;
}

type Props = { params: Promise<{ slug: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  const theme = await getThemeBySlugForPublicLanding(slug);
  if (!theme) return { title: "Not Found" };
  const { title, description } = getTaxonomyMetadataFallback(theme);
  return {
    title: `${title} | 더올투어`,
    description:
      description ||
      `${title} 테마의 여행·골프·패키지 상품을 만나보세요.`,
  };
}

export default async function ThemeLandingPage({ params }: Props) {
  const { slug } = await params;
  const theme = await getThemeBySlugForPublicLanding(slug);
  if (!theme) notFound();

  const [products, subnodes, allThemes, collectionCampaignNames] = await Promise.all([
    getProducts(),
    getLandingSubnodes("theme", slug),
    getHubThemes(),
    getCollectionCampaignNamesForListing(),
  ]);
  const {
    categories,
    themes: themeNames,
    productLines,
    regionTree,
    themeTree,
    taxonomyNameMap,
    themeGuides,
    reviewHighlights,
  } = await loadProductsListingContextForThemeDetail(products, allThemes, theme.id);
  const initialFiltersFromServer = {
    region: null,
    theme: theme.name,
    product_line: null,
    q: null,
    sort: "" as const,
    collection: null,
  };
  const initialThemeDescendantNames = getSelfAndDescendantIdsAndNames(
    allThemes,
    theme.name,
  ).names;

  const parentId = theme.id.trim();
  const childThemes = allThemes
    .filter((t) => (t.parent_id ?? "").trim() === parentId)
    .sort((a, b) => {
      const sa = a.sort_order ?? 9999;
      const sb = b.sort_order ?? 9999;
      if (sa !== sb) return sa - sb;
      return (a.name ?? "").localeCompare(b.name ?? "", "ko");
    });
  const childFallbackImages = buildThemeFallbackImageMap(childThemes, products);

  const themeNameLower = theme.name.trim().toLowerCase();
  const related = products
    .filter((p) => {
      const tokens = parseThemeTokens(p.theme).map((t) =>
        t.trim().toLowerCase(),
      );
      return tokens.includes(themeNameLower);
    })
    .slice(0, RELATED_PRODUCTS_LIMIT);

  const heroTitle = theme.landing_title?.trim() || theme.name;
  const heroDescription =
    theme.landing_description?.trim() ||
    theme.card_description?.trim() ||
    `${theme.name} 테마의 여행·골프·패키지 상품을 소개합니다.`;
  const heroImage = getTaxonomyHeroImageFallback(theme);

  return (
    <div className="min-h-screen bg-[var(--theall-page-bg)] text-[var(--foreground)]">
      <SiteHeader />

      <main className="flex w-full flex-col py-6 sm:py-10 md:py-14">
        <PageContainer size="wide" className="flex flex-col gap-8">
          <BreadcrumbWrapper
            items={[
              { label: "홈", href: "/" },
              { label: "테마", href: "/themes" },
              { label: heroTitle },
            ]}
          />
          <LandingDetailHero
            title={heroTitle}
            description={heroDescription}
            imageUrl={heroImage}
          />

          <div className="flex flex-col gap-8 lg:flex-row lg:items-start">
            <div className="hidden w-72 shrink-0 lg:block">
              <HubFilterSidebar
                regionOptions={categories}
                regionTree={regionTree}
                themeOptions={themeNames}
                themeTree={themeTree}
                productLineOptions={productLines}
                initialFilters={{ theme: theme.name }}
              />
            </div>
            <div className="min-w-0 flex-1">
          {childThemes.length > 0 ? (
            <SectionBlock surface="none" padding="md">
              <SectionHeader
                title="세부 테마 선택"
                description="원하는 테마를 선택해 보세요."
                align="left"
              />
              <ul className="mt-6 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
                {childThemes.map((t) => {
                  const nameKey = t.name.trim().toLowerCase();
                  const cardImageUrl =
                    t.card_image_url?.trim() ||
                    childFallbackImages.get(nameKey) ||
                    undefined;
                  return (
                    <li key={t.id}>
                      <HubBrowseCard
                        item={{ ...t, card_image_url: cardImageUrl ?? t.card_image_url }}
                        href={getThemeLandingHref(t)}
                        showImage={true}
                      />
                    </li>
                  );
                })}
              </ul>
            </SectionBlock>
          ) : null}

          <LandingSubCardsSection
            contextTitle={theme.name}
            nodes={subnodes}
          />

          {themeGuides.length > 0 ? (
            <SectionBlock surface="none" padding="md">
              <SectionHeader
                eyebrow="TRAVEL GUIDE"
                title={`${theme.name} 가이드`}
                description="이 테마와 관련된 가이드를 만나보세요."
                align="left"
              />
              <div className="mt-6">
                <GuideCardGrid guides={themeGuides} />
              </div>
              <div className="mt-4">
                <Link
                  href="/guides"
                  className="type-btn inline-flex rounded-xl border border-[var(--border-strong)] bg-[var(--surface)] px-5 py-2.5 text-[var(--primary)] transition hover:bg-[var(--primary-soft)]"
                >
                  가이드 더 보기
                </Link>
              </div>
            </SectionBlock>
          ) : null}

          {related.length > 0 ? (
            <>
              <CuratedBlock
                title={`${theme.name} 대표 상품`}
                description={`${theme.name} 테마와 연결된 상품입니다.`}
                products={related}
                surface="none"
                featuredLanding
                hubLandingLayout
              />
              <div
                className="border-b border-[var(--border)] my-8 sm:my-10"
                aria-hidden
              />
            </>
          ) : null}

          {reviewHighlights.length > 0 ? (
            <SectionBlock surface="none" padding="md">
              <SectionHeader
                eyebrow="TRAVEL REVIEWS"
                title="여행자들의 실제 후기"
                description="실제 여행객들의 생생한 후기를 만나보세요."
                align="left"
              />
              <ul className="mt-6 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
                {reviewHighlights.map((review) => (
                  <li key={review.id}>
                    <ReviewHighlightCard review={review} />
                  </li>
                ))}
              </ul>
              <div className="mt-4">
                <Link
                  href="/reviews"
                  className="type-btn inline-flex rounded-xl border border-[var(--border-strong)] bg-[var(--surface)] px-5 py-2.5 text-[var(--primary)] transition hover:bg-[var(--primary-soft)]"
                >
                  후기 전체 보기
                </Link>
              </div>
            </SectionBlock>
          ) : null}

            </div>
          </div>

          {/* 랜딩 직하단: 전체 상품 필터·리스트 (/products/theme/[slug]와 동일 구조) */}
          <section
            className="min-h-screen border-t-2 border-[var(--border-strong)] bg-gradient-to-b from-[var(--surface-muted)] to-[var(--surface)] pt-12 mt-16 shadow-[0_-1px_0_0_color-mix(in_srgb,var(--border)_80%,transparent)] sm:mt-20 sm:pt-14"
            aria-labelledby="products-section-heading"
          >
            <div className="mx-auto w-full max-w-6xl px-3 py-8 sm:px-6 sm:py-10 md:px-10 md:py-14">
              <div className="flex flex-col gap-8">
                <h2
                  id="products-section-heading"
                  className="section-heading type-h2 text-[var(--foreground)] first:mt-0"
                >
                  {theme.name} 테마 상품 전체 보기
                </h2>
                <p className="section-description type-small text-[var(--text-muted)] -mt-4">
                  조건을 변경하여 다양한 상품을 비교해보세요.
                </p>
                <ProductsPageContent
                  products={products}
                  taxonomyNameMap={taxonomyNameMap}
                  regionOptions={categories}
                  regionTree={regionTree}
                  themeOptions={themeNames}
                  themeTree={themeTree}
                  productLineOptions={productLines}
                  listing={{
                    initialFiltersFromServer,
                    basePath: `/themes/${slug}`,
                    filterContextLabel: `현재 '${theme.name}' 기준으로 상품을 보여주고 있습니다.`,
                    initialThemeDescendantNames,
                    cardLayout: "related",
                    collectionCampaignNames,
                  }}
                />
              </div>
            </div>
          </section>
        </PageContainer>
      </main>
    </div>
  );
}

```


---

## File: `src/app/search/page.tsx`

```tsx
import { Suspense } from "react";
import { PageContainer } from "@/components/layout/PageContainer";
import { searchProductsByParams } from "@/lib/search/searchProducts";
import { getSearchFilterOptions } from "@/lib/search/getSearchFilterOptions";
import { getSearchRecommendations } from "@/lib/search/getSearchRecommendations";
import { parseSearchParams } from "@/lib/search/searchQueryParams";
import { buildSearchQueryString } from "@/lib/search/searchQueryParams";
import SearchResultsHeader from "@/components/search/SearchResultsHeader";
import SearchFilters from "@/components/search/SearchFilters";
import SearchResults from "@/components/search/SearchResults";
import SearchResultsContainer from "@/components/search/SearchResultsContainer";
import SearchEmpty from "@/components/search/SearchEmpty";
import RelatedTaxonomySection from "@/components/search/RelatedTaxonomySection";
import RelatedProductsSection from "@/components/search/RelatedProductsSection";
import SiteHeader from "@/components/site-chrome/SiteHeader";

type SearchPageProps = {
  searchParams: Promise<{
    q?: string;
    destination?: string;
    theme?: string;
    product_line?: string;
    sort?: string;
    page?: string;
  }>;
};

export default async function SearchPage({ searchParams }: SearchPageProps) {
  const params = await searchParams;
  const state = parseSearchParams(params as Record<string, string | string[] | undefined>);

  const hasCondition = state.q || state.destination || state.theme || state.product_line;

  const [result, filterOptions] = await Promise.all([
    hasCondition
      ? searchProductsByParams({
          q: state.q,
          destination: state.destination ?? null,
          theme: state.theme ?? null,
          product_line: state.product_line ?? null,
          sort: state.sort,
          page: state.page ?? 1,
        })
      : Promise.resolve({ items: [], totalCount: 0, page: 1, pageSize: 24, totalPages: 0 }),
    getSearchFilterOptions(),
  ]);

  const recommendations = hasCondition
    ? await getSearchRecommendations({
        q: state.q,
        destination: state.destination ?? null,
        theme: state.theme ?? null,
        product_line: state.product_line ?? null,
        products: result.items,
      })
    : { destinations: [], themes: [], products: [] };

  const products = result.items;
  const totalCount = result.totalCount;
  const totalPages = result.totalPages;
  const currentPage = result.page;

  return (
    <>
      <SiteHeader />
      <div className="min-h-screen bg-[var(--theall-page-bg)] text-[var(--foreground)]">
        <main className="py-6 sm:py-10 md:py-14">
          <PageContainer size="wide" className="flex flex-col gap-6">
            <SearchResultsHeader
              current={state}
              totalCount={totalCount}
              totalPages={totalPages}
              currentPage={currentPage}
            />

            {hasCondition && (
              <SearchFilters current={state} options={filterOptions} />
            )}

            {!hasCondition && (
              <div className="rounded-2xl bg-[var(--surface)] p-8 text-center shadow-[var(--shadow-soft)] ring-1 ring-[var(--border)]">
                <p className="font-semibold text-[var(--text-primary)]">검색 결과</p>
                <p className="mt-2 type-small text-[var(--text-muted)]">
                  검색어를 입력하거나 지역/테마 필터를 선택해 주세요.
                </p>
                <p className="mt-4 type-small text-[var(--text-muted)]">
                  상단 Hero 검색창에서 키워드를 입력하면 결과를 볼 수 있습니다.
                </p>
              </div>
            )}

            <Suspense
              fallback={
                <div className="type-small text-[var(--text-muted)]">검색 결과를 불러오는 중...</div>
              }
            >
              {hasCondition && totalCount === 0 && (
                <SearchEmpty keyword={state.q} current={state} />
              )}
              {hasCondition && products.length > 0 && totalPages > 1 && (
                <SearchResultsContainer
                  key={`search-${buildSearchQueryString(state)}`}
                  initialItems={products}
                  initialPage={currentPage}
                  totalPages={totalPages}
                  query={state}
                />
              )}
              {hasCondition && products.length > 0 && totalPages <= 1 && (
                <SearchResults products={products} />
              )}
            </Suspense>

            {hasCondition && (
              <>
                {recommendations.destinations.length > 0 && (
                  <RelatedTaxonomySection
                    items={recommendations.destinations}
                    taxonomyType="destination"
                    query={state.q}
                  />
                )}
                {recommendations.themes.length > 0 && (
                  <RelatedTaxonomySection
                    items={recommendations.themes}
                    taxonomyType="theme"
                    query={state.q}
                  />
                )}
                {recommendations.products.length > 0 && (
                  <RelatedProductsSection
                    title={totalCount > 0 ? "이런 상품도 있어요" : "추천 여행 상품"}
                    products={recommendations.products}
                  />
                )}
              </>
            )}
          </PageContainer>
        </main>
      </div>
    </>
  );
}

```


---

## File: `src/app/guides/[slug]/page.tsx`

```tsx
import { notFound } from "next/navigation";
import Link from "next/link";
import type { Metadata } from "next";
import SiteHeader from "@/components/site-chrome/SiteHeader";
import { PageContainer } from "@/components/layout/PageContainer";
import { SectionBlock } from "@/components/layout/SectionBlock";
import { SectionHeader } from "@/components/layout/SectionHeader";
import {
  getGuideBySlug,
  getRelatedGuidesForBlogBridge,
  getGuideNotionViewUrl,
  getAdjacentPublishedGuidesBySlug,
} from "@/lib/guides";
import { getProducts, getGuideBridgeRecommendations } from "@/lib/products";
import { getTaxonomyById } from "@/lib/productTaxonomies";
import { GuideCardGrid } from "@/components/guides/GuideCardGrid";
import { GuideBridgeHeroCtas } from "@/components/guides/GuideBridgeHeroCtas";
import { HeroVisual } from "@/components/landing/HeroVisual";
import { BreadcrumbWrapper } from "@/components/navigation/BreadcrumbWrapper";
import { LANDING_HERO_FALLBACK_IMAGE } from "@/lib/landingMetadata";
import ProductCard from "@/components/products/ProductCard";
import { ProductCardGridSection } from "@/components/products/ProductCardGridSection";
import {
  buildGuideBridgeSelectionLine,
  buildProductExperienceSummary,
  productToProductCardProps,
} from "@/lib/productCardProps";
import type { Product } from "@/types/product";
import { ChevronRight } from "lucide-react";
import { cn } from "@/lib/cn";

const SITE_URL = (process.env.NEXT_PUBLIC_SITE_URL ?? "https://thealltour.com").replace(/\/$/, "");

function toAbsoluteUrl(pathOrUrl: string): string {
  if (/^https?:\/\//i.test(pathOrUrl)) return pathOrUrl;
  const p = pathOrUrl.startsWith("/") ? pathOrUrl : `/${pathOrUrl}`;
  return `${SITE_URL}${p}`;
}

type Props = { params: Promise<{ slug: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  const guide = await getGuideBySlug(slug);
  if (!guide) return { title: "가이드 | 더올투어" };

  const baseTitle =
    guide.seo_title?.trim() ||
    guide.title_override?.trim() ||
    guide.title ||
    "여행 가이드";
  const title = `${baseTitle} | 여행 가이드 | 더올투어`;
  const description =
    guide.seo_description?.trim() ||
    guide.summary?.trim() ||
    `${baseTitle} 여행 준비와 관련 여행 정보를 더올투어에서 확인해 보세요.`;
  const ogImage =
    guide.cover_image_url?.trim() ||
    guide.guide_thumbnail_url?.trim() ||
    guide.thumbnail_url?.trim() ||
    null;
  const canonicalUrl = toAbsoluteUrl(`/guides/${encodeURIComponent(slug)}`);

  return {
    title,
    description,
    alternates: { canonical: canonicalUrl },
    openGraph: {
      type: "article",
      url: canonicalUrl,
      siteName: "더올투어",
      title,
      description,
      images: ogImage ? [{ url: toAbsoluteUrl(ogImage) }] : [],
      locale: "ko_KR",
    },
    twitter: {
      card: "summary_large_image",
      title,
      description,
      images: ogImage ? [toAbsoluteUrl(ogImage)] : [],
    },
  };
}

function productsFilterHrefForTag(tag: string) {
  return `/products?q=${encodeURIComponent(tag.trim())}`;
}

type ExplorationCard = {
  key: string;
  title: string;
  subtitle: string;
  href: string;
};

export default async function GuideDetailPage({ params }: Props) {
  const { slug } = await params;
  const guide = await getGuideBySlug(slug);
  if (!guide) notFound();

  const allProducts = await getProducts();

  const [bridgeRec, relatedGuides, destinationTax, themeTax, adjacent] = await Promise.all([
    getGuideBridgeRecommendations(guide, { totalLimit: 12 }),
    getRelatedGuidesForBlogBridge(guide, 4),
    guide.destination_id ? getTaxonomyById(guide.destination_id) : null,
    guide.theme_id ? getTaxonomyById(guide.theme_id) : null,
    getAdjacentPublishedGuidesBySlug(slug),
  ]);

  const displayTitle = guide.title_override?.trim() || guide.title;
  const coverUrl =
    guide.cover_image_url?.trim() ||
    guide.guide_thumbnail_url?.trim() ||
    guide.thumbnail_url?.trim() ||
    "";

  const notionFullUrl = getGuideNotionViewUrl(guide).trim();

  const secondaryLinks: { label: string; href: string }[] = [];
  if (guide.landing_url?.trim()) secondaryLinks.push({ label: "외부 상세 보기", href: guide.landing_url.trim() });
  if (guide.guide_pdf_url?.trim()) secondaryLinks.push({ label: "PDF 다운로드", href: guide.guide_pdf_url.trim() });

  /** 점수 양수 primary 우선; 없으면 폴백만 있는 경우 all 상단 사용 */
  const topPicks =
    bridgeRec.primary.length > 0 ? bridgeRec.primary : bridgeRec.all.slice(0, 3);

  const morePicks: Product[] = [];
  const usedIds = new Set(topPicks.map((p) => p.id));
  if (bridgeRec.primary.length > 0) {
    for (const p of bridgeRec.secondary) {
      if (morePicks.length >= 6) break;
      if (!usedIds.has(p.id)) {
        usedIds.add(p.id);
        morePicks.push(p);
      }
    }
    for (const p of bridgeRec.all) {
      if (morePicks.length >= 6) break;
      if (!usedIds.has(p.id)) {
        usedIds.add(p.id);
        morePicks.push(p);
      }
    }
  } else {
    for (const p of bridgeRec.all.slice(3)) {
      if (morePicks.length >= 6) break;
      if (!usedIds.has(p.id)) {
        usedIds.add(p.id);
        morePicks.push(p);
      }
    }
  }

  const explorationCards: ExplorationCard[] = [];
  if (destinationTax?.name?.trim()) {
    const n = destinationTax.name.trim();
    explorationCards.push({
      key: "region",
      title: "지역으로 더 알아보기",
      subtitle: `${n} 여행 더 알아보기`,
      href: `/products?region=${encodeURIComponent(n)}`,
    });
  }
  if (themeTax?.name?.trim()) {
    const n = themeTax.name.trim();
    explorationCards.push({
      key: "theme",
      title: "테마로 더 알아보기",
      subtitle: `${n} 여행 더 알아보기`,
      href: `/products?theme=${encodeURIComponent(n)}`,
    });
  }
  const firstTag = guide.tags?.find((t) => t?.trim());
  if (firstTag && explorationCards.length < 3) {
    explorationCards.push({
      key: "tag",
      title: "키워드로 더 알아보기",
      subtitle: `「${firstTag.trim()}」 여행 더 알아보기`,
      href: productsFilterHrefForTag(firstTag),
    });
  }

  const prev = adjacent.prev?.slug?.trim() ? adjacent.prev : null;
  const next = adjacent.next?.slug?.trim() ? adjacent.next : null;
  const showRelatedGrid = relatedGuides.length >= 3;

  /** `/destinations`·`/themes` LandingHero와 동일 min-height */
  const guideHeroMinHeight = "min-h-[240px] sm:min-h-[300px] md:min-h-[340px]";
  const heroImageUrl = coverUrl.trim() ? coverUrl : LANDING_HERO_FALLBACK_IMAGE;
  const heroEyebrow =
    guide.category?.trim() || destinationTax?.name?.trim() || "여행 가이드";
  const publishedLine = guide.published_at
    ? new Date(guide.published_at).toLocaleDateString("ko-KR", {
        year: "numeric",
        month: "long",
        day: "numeric",
      })
    : null;

  return (
    <div className="min-h-screen bg-[var(--theall-page-bg)] text-[var(--foreground)]">
      <SiteHeader />

      <main className="flex w-full flex-col py-5 sm:py-10 md:py-14">
        <PageContainer size="wide" className="flex flex-col gap-5 md:gap-8">
          <BreadcrumbWrapper
            items={[
              { label: "홈", href: "/" },
              { label: "여행가이드", href: "/blog" },
              { label: displayTitle },
            ]}
          />

          {/* 1. 히어로 — 허브(/destinations, /themes)와 동일 HeroVisual 레이어·높이·그라데이션 */}
          <HeroVisual
            imageUrl={heroImageUrl}
            imageAlt={displayTitle ? `${displayTitle} 여행 가이드` : "여행 가이드"}
            priority
            minHeightClassName={guideHeroMinHeight}
            className="sm:rounded-3xl"
            contentClassName="max-w-[640px] gap-2"
          >
            <p className="hero-text-shadow-body text-sm font-semibold text-white/92">{heroEyebrow}</p>
            <h1 className="hero-text-shadow-title text-xl font-bold leading-tight text-white sm:text-2xl md:text-3xl">
              {`${displayTitle} 여행 가이드`}
            </h1>
            {guide.summary?.trim() ? (
              <p className="hero-text-shadow-body line-clamp-3 max-w-2xl text-sm leading-relaxed text-white/90 sm:text-base">
                {guide.summary.trim()}
              </p>
            ) : publishedLine ? (
              <p className="hero-text-shadow-body max-w-2xl text-sm text-white/90 sm:text-base">
                {publishedLine}
              </p>
            ) : (
              <p className="hero-text-shadow-body max-w-2xl text-sm text-white/90 sm:text-base">
                원문과 함께 여행 정보를 이어서 확인해 보세요.
              </p>
            )}
            <GuideBridgeHeroCtas notionUrl={notionFullUrl || null} />
          </HeroVisual>

          {/* 요약·카테고리·태그는 히어로에 이미 노출되어 중복 제거. 보조 링크만 유지 */}
          {secondaryLinks.length > 0 ? (
            <div className="flex flex-wrap gap-x-4 gap-y-2 px-1 sm:px-0">
              {secondaryLinks.map(({ label, href }) => (
                <a
                  key={href}
                  href={href}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="type-caption font-medium text-[var(--primary)] underline-offset-2 hover:underline"
                >
                  {label}
                </a>
              ))}
            </div>
          ) : null}

          {/* 4. 가이드에 맞닿은 여행 (앵커) */}
          <section
            id="recommended-products"
            className="max-sm:scroll-mt-[100px] sm:scroll-mt-24 rounded-2xl border-2 border-[color-mix(in_srgb,var(--primary)_22%,transparent)] bg-[color-mix(in_srgb,var(--primary)_6%,var(--surface))] p-3.5 pt-3.5 shadow-[var(--shadow-soft-strong)] ring-1 ring-[var(--border)] sm:rounded-3xl sm:p-6 sm:pt-5 md:p-7 md:pt-7"
            aria-labelledby="recommended-products-heading"
          >
            <SectionHeader
              titleId="recommended-products-heading"
              title="이 가이드에서 본 여행을 직접 경험해보세요"
              align="left"
            />

            {topPicks.length > 0 ? (
              <div
                className={cn(
                  "mt-3 space-y-2 sm:mt-5 sm:space-y-2.5",
                  morePicks.length > 0 && "border-b border-[var(--border)] pb-4 sm:border-b sm:pb-6",
                )}
              >
                <h3 className="text-sm font-semibold leading-snug tracking-tight text-[var(--text-muted)] sm:text-[15px]">
                  가장 먼저 살펴볼 여행
                </h3>
                <p className="text-xs leading-snug text-[var(--text-muted)] sm:text-[13px]">
                  가장 많이 선택되는 일정부터 확인해보세요.
                </p>
                <ProductCardGridSection
                  desktopGridCols={3}
                  className="w-full max-w-[1344px]"
                  guideBridgeTopPicksLayout
                >
                  {topPicks.map((product, index) => (
                    <ProductCard
                      key={product.id}
                      {...productToProductCardProps(product, {
                        layout: "related",
                        analyticsSource: "landing",
                        analyticsSection: `guide_bridge_top_${slug}`,
                        topPickLabel: index === 0 ? "가장 많이 선택된" : undefined,
                        experienceSummary: buildProductExperienceSummary(product),
                        emphasizeFirstOnMobile: index === 0,
                        guideBridgeNarrowCopy: true,
                        selectionHighlightLine: buildGuideBridgeSelectionLine(product),
                      })}
                    />
                  ))}
                </ProductCardGridSection>
              </div>
            ) : (
              <p className="mt-4 type-small text-[var(--text-muted)]">
                아직 표시할 여행이 없습니다. 아래에서 지역·테마로 더 찾아보세요.
              </p>
            )}

            {morePicks.length > 0 ? (
              <div className="mt-4 space-y-2 pt-1 sm:mt-6 sm:space-y-2.5 sm:pt-0">
                <h3 className="text-xs font-normal leading-snug text-[var(--text-subtle)] sm:text-[13px] sm:text-[var(--text-muted)]">
                  비슷한 여행을 함께 비교해보세요
                </h3>
                <ProductCardGridSection
                  desktopGridCols={3}
                  className="w-full max-w-[1344px]"
                  guideBridgeMobileTightGap
                >
                  {morePicks.map((product) => (
                    <ProductCard
                      key={product.id}
                      {...productToProductCardProps(product, {
                        layout: "related",
                        analyticsSource: "landing",
                        analyticsSection: `guide_bridge_more_${slug}`,
                        experienceSummary: buildProductExperienceSummary(product),
                        guideBridgeNarrowCopy: true,
                        selectionHighlightLine: buildGuideBridgeSelectionLine(product),
                      })}
                    />
                  ))}
                </ProductCardGridSection>
              </div>
            ) : null}

            <div className="mt-3 sm:mt-4">
              <Link
                href="/products"
                className="type-btn inline-flex items-center gap-2 rounded-xl bg-[var(--surface)] px-5 py-2.5 font-semibold text-[var(--primary)] ring-1 ring-[var(--border-strong)] transition hover:bg-[var(--primary-soft)]"
              >
                전체 여행 더 알아보기
                <ChevronRight className="h-4 w-4" aria-hidden />
              </Link>
            </div>
          </section>

          {/* 5. 관련 탐색 (카드형) */}
          {explorationCards.length > 0 ? (
            <SectionBlock surface="muted" padding="md" className="!py-3.5 sm:!py-6 md:!py-8">
              <SectionHeader
                title="관심 있는 여행을 더 찾아보세요"
                description="지역·테마·키워드별로 목록을 열어 더 알아보실 수 있어요."
                descriptionClassName="text-xs font-normal text-[var(--text-subtle)] sm:text-[13px]"
                align="left"
              />
              <ul className="mt-4 grid gap-3 sm:mt-5 sm:grid-cols-2 sm:gap-4 lg:grid-cols-3">
                {explorationCards.map((card) => (
                  <li key={card.key}>
                    <Link
                      href={card.href}
                      className="flex h-full flex-col rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-4 shadow-[var(--shadow-soft)] transition hover:border-[var(--primary)]/40 hover:shadow-md sm:p-5"
                    >
                      <span className="text-xs font-semibold text-[var(--primary)] sm:text-[13px]">{card.title}</span>
                      <span className="mt-2 text-sm font-semibold leading-snug text-[var(--foreground)] sm:text-base">
                        {card.subtitle}
                      </span>
                      <span className="mt-3 inline-flex items-center gap-1 text-sm font-semibold text-[var(--primary)]">
                        더 알아보기
                        <ChevronRight className="h-4 w-4 shrink-0" aria-hidden />
                      </span>
                    </Link>
                  </li>
                ))}
              </ul>
            </SectionBlock>
          ) : null}

          {/* 6. 가이드 탐색: 이전/다음 · 전체 · (조건) 연관 가이드 — 한 카드로 묶음 */}
          <SectionBlock surface="none" padding="none" className="!space-y-0">
            <div className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-4 shadow-[var(--shadow-soft)] ring-1 ring-[var(--border)]/50 sm:rounded-3xl sm:p-5 md:p-6">
              <SectionHeader title="가이드 더 보기" align="left" className="!space-y-1 sm:pb-0" />
              <div className="mt-3 flex flex-col gap-4 sm:mt-4 sm:gap-5">
                <div className="flex flex-col gap-3 sm:flex-row sm:items-stretch sm:justify-between sm:gap-4">
                  <div className="min-h-[3rem] flex-1 sm:max-w-[42%]">
                    {prev ? (
                      <Link
                        href={`/guides/${encodeURIComponent(prev.slug!.trim())}`}
                        className="flex h-full flex-col justify-center rounded-xl border border-[var(--border)] bg-[var(--surface-muted)]/60 p-4 transition hover:bg-[var(--surface-muted)]"
                      >
                        <span className="type-caption text-[var(--text-muted)]">이전 가이드</span>
                        <span className="mt-1 font-semibold text-[var(--foreground)]">
                          {prev.title_override?.trim() || prev.title}
                        </span>
                      </Link>
                    ) : (
                      <div className="type-caption text-[var(--text-muted)] sm:pt-2">이전 가이드가 없습니다.</div>
                    )}
                  </div>
                  <div className="flex flex-1 flex-col items-center justify-center gap-2 sm:max-w-[28%]">
                    <Link
                      href="/blog"
                      className="type-btn inline-flex rounded-xl border border-[var(--border-strong)] bg-[var(--surface-muted)]/40 px-5 py-2.5 font-semibold text-[var(--primary)] transition hover:bg-[var(--primary-soft)]"
                    >
                      가이드 전체 보기
                    </Link>
                  </div>
                  <div className="min-h-[3rem] flex-1 text-right sm:max-w-[42%]">
                    {next ? (
                      <Link
                        href={`/guides/${encodeURIComponent(next.slug!.trim())}`}
                        className="flex h-full flex-col items-end justify-center rounded-xl border border-[var(--border)] bg-[var(--surface-muted)]/60 p-4 text-right transition hover:bg-[var(--surface-muted)]"
                      >
                        <span className="type-caption text-[var(--text-muted)]">다음 가이드</span>
                        <span className="mt-1 font-semibold text-[var(--foreground)]">
                          {next.title_override?.trim() || next.title}
                        </span>
                      </Link>
                    ) : (
                      <div className="type-caption text-[var(--text-muted)] sm:pt-2 sm:text-right">다음 가이드가 없습니다.</div>
                    )}
                  </div>
                </div>

                {showRelatedGrid ? (
                  <div className="border-t border-[var(--divider)] pt-4 sm:pt-5">
                    <h3 className="text-sm font-semibold text-[var(--foreground)] sm:text-base">비슷한 주제의 가이드</h3>
                    <p className="mt-1 text-xs text-[var(--text-muted)] sm:text-sm">
                      같은 지역·테마와 연결된 글이에요.
                    </p>
                    <div className="mt-3 sm:mt-4">
                      <GuideCardGrid guides={relatedGuides} gridCols="3" />
                    </div>
                  </div>
                ) : null}
              </div>
            </div>
          </SectionBlock>
        </PageContainer>
      </main>
    </div>
  );
}

```


---

## File: src/components/admin/AdminInquiryTable.tsx (보강: 문의 스냅샷 내 견적 표시용 formatPrice)

`	sx
"use client";

import { Fragment } from "react";
import type { Inquiry, QuoteSnapshot, ConsultationStatus, BookingStatus } from "@/types/inquiry";
import { useAdminInquiryTable, type StatusFilter, type InquirySortOption } from "@/components/admin/hooks/useAdminInquiryTable";
import { parseHostname } from "@/lib/analytics/attribution";

function formatDate(dateText: string) {
  const date = new Date(dateText);
  if (Number.isNaN(date.getTime())) return "-";
  return date.toLocaleString("ko-KR");
}

function formatPrice(n: number | null | undefined): string {
  if (n == null || !Number.isFinite(n)) return "-";
  return `${n >= 0 ? "" : "-"}${Math.abs(n).toLocaleString()}원`;
}

const CONSULTATION_LABELS: Record<ConsultationStatus, string> = {
  new: "신규",
  contacted: "상담중",
  closed: "상담종료",
};

const BOOKING_LABELS: Record<BookingStatus, string> = {
  none: "미확정",
  reserved: "예약확정",
  completed: "여행완료",
  canceled: "취소",
};

function QuoteSnapshotSection({ snapshot }: { snapshot: QuoteSnapshot }) {
  const hasOptions =
    (snapshot.selectedOptions && Object.keys(snapshot.selectedOptions).length > 0) ||
    (snapshot.quoteSummary?.breakdown?.length ?? 0) > 0;
  const hasSummary =
    snapshot.quoteSummary &&
    (snapshot.quoteSummary.total != null ||
      snapshot.quoteSummary.basePrice != null ||
      (snapshot.quoteSummary.breakdown?.length ?? 0) > 0);

  if (!hasOptions && !hasSummary && !snapshot.inquiredAt) return null;

  return (
    <div className="rounded-lg border border-[var(--border)] bg-[var(--surface-muted)] p-4 text-sm">
      <h4 className="mb-3 font-semibold text-[var(--text-primary)]">고객 선택 구성</h4>
      {hasOptions ? (
        <ul className="mb-3 list-inside list-disc space-y-1 text-[var(--text-muted)]">
          {(snapshot.quoteSummary?.breakdown?.length ?? 0) > 0
            ? snapshot.quoteSummary!.breakdown.map((b, i) => (
                <li key={i}>
                  {b.groupLabel} · {b.optionLabel}
                </li>
              ))
            : snapshot.selectedOptions
              ? Object.entries(snapshot.selectedOptions).map(([k, v]) => (
                  <li key={k}>
                    {k}: {v}
                  </li>
                ))
              : null}
        </ul>
      ) : null}
      {hasSummary && snapshot.quoteSummary ? (
        <div className="space-y-1 border-t border-[var(--divider)] pt-3 text-[var(--text-secondary)]">
          {snapshot.quoteSummary.basePrice != null ? (
            <p>예상 기본가: {formatPrice(snapshot.quoteSummary.basePrice)}</p>
          ) : null}
          {(snapshot.quoteSummary.breakdown?.length ?? 0) > 0
            ? snapshot.quoteSummary.breakdown!.map((b, i) => (
                <p key={i}>
                  예상 옵션 · {b.groupLabel} – {b.optionLabel}: {formatPrice(b.priceDelta)}
                </p>
              ))
            : null}
          {snapshot.quoteSummary.total != null ? (
            <p className="font-semibold text-[var(--text-primary)]">예상 합계: {formatPrice(snapshot.quoteSummary.total)}</p>
          ) : null}
        </div>
      ) : null}
      {snapshot.inquiredAt ? (
        <p className="mt-2 text-xs text-[var(--text-subtle)]">
          문의 시각: {formatDate(snapshot.inquiredAt)}
        </p>
      ) : null}
    </div>
  );
}

export default function AdminInquiryTable() {
  const api = useAdminInquiryTable();

  if (api.isLoading) {
    return (
      <div className="space-y-3 px-4 py-6">
        <div className="h-9 w-80 animate-pulse rounded-lg bg-[var(--surface-muted)]" />
        <div className="h-56 animate-pulse rounded-xl bg-[var(--surface-muted)]" />
        <p className="text-sm text-[var(--text-muted)]">문의 목록을 불러오는 중입니다...</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-end justify-between gap-3 px-4 pt-4">
        <div className="flex flex-wrap items-end gap-3">
          <label className="flex min-w-64 flex-col gap-2 text-xs font-semibold text-[var(--text-muted)]">
            검색(이름/연락처/문의내용)
            <input
              type="text"
              value={api.searchQuery}
              onChange={(event) => {
                api.setSearchQuery(event.target.value);
                api.setPage(1);
              }}
              placeholder="검색어를 입력하세요"
              className="rounded-lg border border-[var(--border)] bg-[var(--surface)] px-3 py-2 text-sm text-[var(--text-primary)] outline-none transition focus:border-[var(--primary)] focus:ring-2 focus:ring-[var(--primary-soft)]"
            />
          </label>
          <label className="flex flex-col gap-2 text-xs font-semibold text-[var(--text-muted)]">
            상태 필터
            <select
              value={api.statusFilter}
              onChange={(event) => {
                api.setStatusFilter(event.target.value as StatusFilter);
                api.setPage(1);
              }}
              className="rounded-lg border border-[var(--border)] bg-[var(--surface)] px-3 py-2 text-sm text-[var(--text-primary)] outline-none transition focus:border-[var(--primary)] focus:ring-2 focus:ring-[var(--primary-soft)]"
            >
              <option value="all">전체</option>
              <option value="new">신규 문의</option>
              <option value="contacted">상담중</option>
              <option value="closed">상담종료</option>
              <option value="reserved">예약확정</option>
              <option value="completed">여행완료</option>
              <option value="pending">미처리 (미종료·미예약)</option>
            </select>
          </label>
          <label className="flex flex-col gap-2 text-xs font-semibold text-[var(--text-muted)]">
            정렬
            <select
              value={api.sortBy}
              onChange={(event) => {
                api.setSortBy(event.target.value as InquirySortOption);
                api.setPage(1);
              }}
              className="rounded-lg border border-[var(--border)] bg-[var(--surface)] px-3 py-2 text-sm text-[var(--text-primary)] outline-none transition focus:border-[var(--primary)] focus:ring-2 focus:ring-[var(--primary-soft)]"
            >
              <option value="pending_first">미완료 우선</option>
              <option value="recent">최신순</option>
              <option value="oldest">오래된순</option>
              <option value="name">이름순</option>
            </select>
          </label>
          <label className="flex flex-col gap-2 text-xs font-semibold text-[var(--text-muted)]">
            페이지 크기
            <select
              value={api.pageSize}
              onChange={(event) => {
                api.setPageSize(Number(event.target.value));
                api.setPage(1);
              }}
              className="rounded-lg border border-[var(--border)] bg-[var(--surface)] px-3 py-2 text-sm text-[var(--text-primary)] outline-none transition focus:border-[var(--primary)] focus:ring-2 focus:ring-[var(--primary-soft)]"
            >
              <option value={10}>10</option>
              <option value={20}>20</option>
              <option value={30}>30</option>
              <option value={50}>50</option>
            </select>
          </label>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={() => api.loadInquiries({ silent: true })}
            disabled={api.isRefreshing}
            className="rounded-lg border border-[var(--border)] bg-[var(--surface)] px-3 py-2 text-sm font-medium text-[var(--primary)] transition hover:bg-[var(--primary-soft)] disabled:cursor-not-allowed"
          >
            {api.isRefreshing ? "새로고침 중..." : "새로고침"}
          </button>
        </div>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-2 px-4 text-xs text-[var(--text-muted)]">
        <p>
          전체 {api.total}건 · 미처리 {api.pendingCount}건 · 예약확정 {api.reservedCount}건 · 여행완료 {api.completedCount}건
        </p>
      </div>

      {api.errorMessage ? (
        <div className="flex items-center justify-between gap-3 rounded-xl bg-[var(--danger-bg)] px-4 py-3 text-sm text-[var(--danger)] ring-1 ring-[var(--danger)]/30">
          <span>{api.errorMessage}</span>
          <button
            type="button"
            onClick={() => api.loadInquiries({ silent: true, resetSelection: false })}
            className="rounded-md border border-[var(--danger)]/50 bg-[var(--surface)] px-2.5 py-1 text-xs font-semibold text-[var(--danger)] hover:bg-[var(--surface-muted)]"
          >
            다시 시도
          </button>
        </div>
      ) : null}
      <div className="overflow-x-auto">
        <table className="w-full min-w-[980px] border-collapse text-sm">
          <thead className="sticky top-0 z-10 bg-[var(--primary-soft)] text-[var(--primary)]">
            <tr>
              <th className="w-[100px] px-4 py-3 text-left font-semibold">상담 상태</th>
              <th className="w-[100px] px-4 py-3 text-left font-semibold">여행 상태</th>
              <th className="w-[120px] px-4 py-3 text-left font-semibold">고객명</th>
              <th className="w-[150px] px-4 py-3 text-left font-semibold">연락처</th>
              <th className="w-[220px] px-4 py-3 text-left font-semibold">유입 상품</th>
              <th className="px-4 py-3 text-left font-semibold">최초유입</th>
              <th className="min-w-[320px] px-4 py-3 text-left font-semibold">문의 내용</th>
              <th className="w-[180px] px-4 py-3 text-left font-semibold">문의일시</th>
              <th className="w-[100px] px-4 py-3 text-left font-semibold">선택 구성</th>
              <th className="w-[200px] px-4 py-3 text-left font-semibold">액션</th>
            </tr>
          </thead>
          <tbody>
            {api.inquiries.length === 0 ? (
              <tr className="border-t border-[var(--divider)]">
                <td colSpan={10} className="px-4 py-6 text-center text-[var(--text-muted)]">
                  조건에 맞는 문의가 없습니다.
                </td>
              </tr>
            ) : (
              api.inquiries.map((inquiry) => {
                const consultationStatus = (inquiry.consultation_status ?? "new") as ConsultationStatus;
                const bookingStatus = (inquiry.booking_status ?? "none") as BookingStatus;
                const isExpanded = api.expandedRows.includes(inquiry.id);
                const canReserve = bookingStatus === "none" && inquiry.customer_profile_id;
                const canCompleteTrip = bookingStatus === "reserved";

                return (
                  <Fragment key={inquiry.id}>
                    <tr
                      className={`border-t border-[var(--divider)] ${
                        consultationStatus !== "closed" ? "bg-[var(--warning-bg)]/30 hover:bg-[var(--warning-bg)]/50" : "hover:bg-[var(--surface-muted)]"
                      }`}
                    >
                      <td className="px-4 py-3">
                        <span
                          className={`inline-flex rounded-full px-2 py-0.5 text-xs font-semibold ${
                            consultationStatus === "new"
                              ? "bg-[var(--primary-soft)] text-[var(--primary)]"
                              : consultationStatus === "contacted"
                                ? "bg-amber-100 text-amber-800"
                                : "bg-[var(--success-bg)] text-[var(--success)]"
                          }`}
                        >
                          {CONSULTATION_LABELS[consultationStatus]}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <span
                          className={`inline-flex rounded-full px-2 py-0.5 text-xs font-semibold ${
                            bookingStatus === "none"
                              ? "bg-[var(--text-muted)]/20 text-[var(--text-secondary)]"
                              : bookingStatus === "reserved"
                                ? "bg-blue-100 text-blue-800"
                                : bookingStatus === "completed"
                                  ? "bg-[var(--success-bg)] text-[var(--success)]"
                                  : "bg-[var(--danger-bg)] text-[var(--danger)]"
                          }`}
                        >
                          {BOOKING_LABELS[bookingStatus]}
                        </span>
                      </td>
                      <td className="px-4 py-3 font-medium text-[var(--primary)]">{inquiry.name}</td>
                      <td className="px-4 py-3 tabular-nums">{inquiry.phone}</td>
                      <td className="px-4 py-3">
                        {inquiry.product_title ? (
                          <div className="space-y-1">
                            <p className="font-medium text-[var(--text-secondary)]">{inquiry.product_title}</p>
                            {inquiry.source_path ? (
                              <p className="text-xs text-[var(--text-subtle)]">{inquiry.source_path}</p>
                            ) : null}
                          </div>
                        ) : (
                          <span className="text-xs text-[var(--text-subtle)]">일반 문의</span>
                        )}
                      </td>
                      <td className="px-4 py-3">
                        {inquiry.acquisition_source_label != null || inquiry.first_touch ? (
                          <div
                            className="min-w-0 max-w-[200px] space-y-1"
                            title={[
                              inquiry.acquisition_summary,
                              inquiry.inquiry_page_url,
                              inquiry.first_touch?.firstReferrer,
                            ]
                              .filter(Boolean)
                              .join(" · ") || undefined}
                          >
                            <p className="truncate font-medium text-[var(--text-primary)]">
                              {inquiry.acquisition_source_label ??
                                inquiry.first_touch?.utm_source ??
                                (inquiry.first_touch?.firstReferrer
                                  ? parseHostname(inquiry.first_touch.firstReferrer) ?? inquiry.first_touch.firstReferrer
                                  : null) ??
                                "direct"}
                            </p>
                            <p className="flex items-center gap-1">
                              <span
                                className={`inline-flex rounded-full px-2 py-0.5 text-xs font-semibold ${
                                  inquiry.acquisition_channel === "paid"
                                    ? "bg-amber-100 text-amber-800"
                                    : inquiry.acquisition_channel === "social"
                                      ? "bg-blue-100 text-blue-800"
                                      : inquiry.acquisition_channel === "organic"
                                        ? "bg-[var(--primary-soft)] text-[var(--primary)]"
                                        : inquiry.acquisition_channel === "referral"
                                          ? "bg-slate-100 text-slate-700"
                                          : "bg-[var(--text-muted)]/20 text-[var(--text-secondary)]"
                                }`}
                              >
                                {inquiry.acquisition_channel ?? inquiry.first_touch?.utm_medium ?? "-"}
                              </span>
                            </p>
                            <p className="truncate text-xs text-[var(--text-subtle)]" title={inquiry.acquisition_summary ?? undefined}>
                              {inquiry.first_landing_path ?? inquiry.acquisition_summary ?? "-"}
                            </p>
                          </div>
                        ) : (
                          <span className="text-xs text-[var(--text-subtle)]">미확인</span>
                        )}
                      </td>
                      <td className="px-4 py-3">
                        <p className={isExpanded ? "whitespace-pre-wrap text-sm leading-6" : "line-clamp-2 text-sm leading-6"}>
                          {inquiry.content}
                        </p>
                        {inquiry.content.length > 70 ? (
                          <button
                            type="button"
                            onClick={() => api.toggleExpand(inquiry.id)}
                            className="mt-1 text-xs font-semibold text-[var(--primary)] hover:underline"
                          >
                            {isExpanded ? "접기" : "더보기"}
                          </button>
                        ) : null}
                      </td>
                      <td className="px-4 py-3 text-xs tabular-nums text-[var(--text-muted)]">
                        {formatDate(inquiry.created_at ?? "")}
                      </td>
                      <td className="px-4 py-3">
                        {inquiry.quote_snapshot ? (
                          <button
                            type="button"
                            onClick={() =>
                              api.setExpandedQuoteId(api.expandedQuoteId === inquiry.id ? null : inquiry.id)
                            }
                            className="text-xs font-semibold text-[var(--primary)] hover:underline"
                          >
                            {api.expandedQuoteId === inquiry.id ? "접기" : "보기"}
                          </button>
                        ) : (
                          <span className="text-[var(--text-subtle)]">-</span>
                        )}
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex flex-wrap gap-1">
                          {consultationStatus === "new" && (
                            <button
                              type="button"
                              disabled={api.pendingId === inquiry.id}
                              onClick={() => api.updateConsultationStatus(inquiry.id, "contacted")}
                              className="rounded border border-amber-300 bg-amber-50 px-2 py-1 text-xs font-medium text-amber-800 hover:bg-amber-100 disabled:opacity-50"
                            >
                              상담중
                            </button>
                          )}
                          {consultationStatus === "contacted" && (
                            <button
                              type="button"
                              disabled={api.pendingId === inquiry.id}
                              onClick={() => api.updateConsultationStatus(inquiry.id, "closed")}
                              className="rounded border border-[var(--success)]/50 bg-[var(--success-bg)] px-2 py-1 text-xs font-medium text-[var(--success)] hover:opacity-90 disabled:opacity-50"
                            >
                              상담종료
                            </button>
                          )}
                          {canReserve && (
                            <button
                              type="button"
                              disabled={api.pendingId === inquiry.id}
                              onClick={() => api.openReserveModal(inquiry)}
                              className="rounded border border-blue-300 bg-blue-50 px-2 py-1 text-xs font-medium text-blue-800 hover:bg-blue-100 disabled:opacity-50"
                            >
                              예약 확정
                            </button>
                          )}
                          {canCompleteTrip && (
                            <button
                              type="button"
                              disabled={api.pendingId === inquiry.id}
                              onClick={() => api.completeTrip(inquiry.id)}
                              className="rounded border border-[var(--success)]/50 bg-[var(--success-bg)] px-2 py-1 text-xs font-medium text-[var(--success)] hover:opacity-90 disabled:opacity-50"
                            >
                              여행 완료
                            </button>
                          )}
                          <button
                            type="button"
                            disabled={api.deletePendingId === inquiry.id || api.pendingId === inquiry.id}
                            onClick={() => api.deleteInquiry(inquiry.id)}
                            className="rounded border border-red-300 bg-red-50 px-2 py-1 text-xs font-medium text-red-800 hover:bg-red-100 disabled:opacity-50"
                          >
                            삭제
                          </button>
                        </div>
                      </td>
                    </tr>
                    {inquiry.quote_snapshot && api.expandedQuoteId === inquiry.id ? (
                      <tr className="border-t border-[var(--divider)] bg-[var(--surface-muted)]">
                        <td colSpan={10} className="px-4 py-3">
                          <QuoteSnapshotSection snapshot={inquiry.quote_snapshot} />
                        </td>
                      </tr>
                    ) : null}
                  </Fragment>
                );
              })
            )}
          </tbody>
        </table>
      </div>
      <div className="flex items-center justify-between px-4 pb-4 pt-1 text-sm text-[var(--text-muted)]">
        <p>
          총 {api.total}건 중 {api.total === 0 ? 0 : (api.safePage - 1) * api.pageSize + 1}
          -
          {Math.min(api.safePage * api.pageSize, api.total)}건 표시
        </p>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => api.movePage(api.safePage - 1)}
            disabled={api.safePage <= 1}
            className="rounded border border-[var(--border)] bg-[var(--surface)] px-3 py-1 text-xs text-[var(--text-primary)] disabled:cursor-not-allowed disabled:opacity-50"
          >
            이전
          </button>
          <span className="text-xs font-semibold text-[var(--text-primary)]">
            {api.safePage} / {api.totalPages}
          </span>
          <button
            type="button"
            onClick={() => api.movePage(api.safePage + 1)}
            disabled={api.safePage >= api.totalPages}
            className="rounded border border-[var(--border)] bg-[var(--surface)] px-3 py-1 text-xs text-[var(--text-primary)] disabled:cursor-not-allowed disabled:opacity-50"
          >
            다음
          </button>
        </div>
      </div>

      {api.reserveModalInquiryId ? (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
          role="dialog"
          aria-modal="true"
          aria-labelledby="reserve-modal-title"
        >
          <div className="w-full max-w-md rounded-xl border border-[var(--border)] bg-[var(--surface)] p-6 shadow-lg">
            <h2 id="reserve-modal-title" className="text-lg font-semibold text-[var(--text-primary)]">
              예약 확정
            </h2>
            <p className="mt-1 text-xs text-[var(--text-muted)]">
              출발일·귀국일을 입력한 뒤 저장하세요. 문의에 있는 상품 정보가 예약에 반영됩니다.
            </p>
            <div className="mt-4 space-y-3">
              <label className="block">
                <span className="text-xs font-semibold text-[var(--text-muted)]">출발일</span>
                <input
                  type="date"
                  value={api.reserveDeparture}
                  onChange={(e) => api.setReserveDeparture(e.target.value)}
                  className="mt-1 w-full rounded-lg border border-[var(--border)] bg-[var(--surface)] px-3 py-2 text-sm"
                />
              </label>
              <label className="block">
                <span className="text-xs font-semibold text-[var(--text-muted)]">귀국일</span>
                <input
                  type="date"
                  value={api.reserveReturn}
                  onChange={(e) => api.setReserveReturn(e.target.value)}
                  className="mt-1 w-full rounded-lg border border-[var(--border)] bg-[var(--surface)] px-3 py-2 text-sm"
                />
              </label>
            </div>
            <div className="mt-6 flex gap-2">
              <button
                type="button"
                onClick={api.closeReserveModal}
                className="rounded-lg border border-[var(--border)] bg-[var(--surface)] px-4 py-2 text-sm font-medium text-[var(--text-primary)]"
              >
                취소
              </button>
              <button
                type="button"
                onClick={() => api.submitReserveBooking()}
                disabled={api.isSubmittingReserve}
                className="rounded-lg border border-[var(--primary)] bg-[var(--primary)] px-4 py-2 text-sm font-medium text-[var(--on-primary)] disabled:opacity-50"
              >
                {api.isSubmittingReserve ? "저장 중..." : "저장"}
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}

`
