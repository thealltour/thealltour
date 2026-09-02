"use client";

import { useMemo, useState, useCallback, useEffect, useRef } from "react";
import { Card } from "@/components/ui/Card";
import { Icon } from "@/components/ui/Icon";
import Tag from "@/components/ui/Tag";
import { Tabs, TabsTrigger } from "@/components/ui/Tabs";
import AlertCard from "@/components/ui/AlertCard";
import { CollapsibleNoticeLines } from "@/components/products/CollapsibleNoticeLines";
import { AutolinkPlainText } from "@/lib/products/autolinkPlainText";
import TrustSignals from "@/components/products/TrustSignals";
import { useProductQuote } from "@/components/products/ProductQuoteContext";
import { ENABLE_PRODUCT_OPTIONS } from "@/config/featureFlags";
import { calculatePaxDiscount } from "@/lib/payments/calculatePaxDiscount";
import { resolveCheckoutBenefitMode } from "@/lib/payments/resolveCheckoutBenefitMode";
import { calcQuote, formatPriceKR } from "@/lib/pricing/calcQuote";
import { EMPTY_SELECTED_OPTIONS, isGroupSelectionMissing } from "@/lib/pricing/selectedOptions";
import type { Product, ProductTrust, ProductOptions } from "@/types/product";
import type { TravelOverviewModel } from "@/lib/products/mapProductToOverview";
import { mapProductToOverview } from "@/lib/products/mapProductToOverview";
import { parseMetaTitleAsHashtags } from "@/lib/products/parseMetaTitleAsHashtags";
import { ThemeChartCard } from "@/components/products/ThemeChartCard";
import { cn } from "@/lib/cn";
import { mapProductToTimelineModel, getTimelineModelFromSchedule } from "@/lib/products/mapProductToTimelineModel";
import { FlightSummarySection } from "@/components/products/FlightSummarySection";
import { ProductIncludeExclude } from "@/components/products/ProductIncludeExclude";
import { ProductSellingPointsSection } from "@/components/products/ProductSellingPointsSection";
import {
  ProductDescriptionSection,
  shouldShowGolfCourseInfo,
  shouldShowProductDescription,
} from "@/components/products/ProductDescriptionSection";
import { ProductPackageCatalogSection } from "@/components/products/ProductPackageCatalogSection";
import { hasPackageCatalogContent } from "@/lib/admin/packageCatalog";
import { formatAirlineLabel } from "@/lib/products/formatAirlineLabel";
import { ProductHotelCard } from "@/components/products/ProductHotelCard";
import { getHotelValue } from "@/lib/products/mapProductToOverview";
import { InteractiveTimelineV2 } from "@/components/products/InteractiveTimelineV2";
import { ProductImageCarousel } from "@/components/products/ProductImageCarousel";
import type { ProductGalleryImage } from "@/components/products/ProductImageGalleryModal";
import { normalizeProductImageUrl } from "@/lib/media/normalizeProductImageUrl";
import { getPrimaryImageUrl } from "@/lib/products/images";
import { hasProductFixedDeparture } from "@/lib/products/productFixedDeparture";
import { ProductItineraryPreview } from "@/components/products/ProductItineraryPreview";
import { ProductHighlightsCard } from "@/components/products/ProductHighlightsCard";
import ProductSummaryInfo from "@/components/products/ProductSummaryInfo";
import { ProductCostSummary } from "@/components/products/ProductCostSummary";
import { ProductGolfMemberBenefit } from "@/components/products/ProductGolfMemberBenefit";
import ProductItineraryTimeline from "@/components/products/ProductItineraryTimeline";
import {
  getLegacyDayPreviewLabel,
  parseDayContentToSections,
} from "@/lib/products/itineraryPreviewLabel";
import { ProductDayScheduleCard } from "@/components/products/ProductDayScheduleCard";
import { parseThemeTokens } from "@/lib/productTaxonomies";
import {
  DETAIL_UNIFIED_PRICE_NOTICE_LINES,
  getSeasonalPriceDisplayModel,
} from "@/lib/products/detailSeasonalPriceDisplay";
import { getDepartureSchedulesMinPrice } from "@/lib/products/normalizeDepartureSchedules";
import { collectProductDepartureDates } from "@/lib/products/productDepartureDates";
import { resolveProductBookingUxMode } from "@/lib/products/resolveProductBookingUx";
import { buildRecommendedAudienceBullets } from "@/lib/products/buildRecommendedAudienceBullets";
import {
  ProductDetailRecommendedAudience,
  SeasonalPriceComparison,
} from "@/components/products/ProductDetailPriceGuide";
import { trackProductDetailViewSummary } from "@/lib/analytics/trackProductClick";

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
  optionalExpenses?: string;
  minDeparturePeople?: string;
  bookingNotes?: string;
  travelNotes?: string;
  bookingConditions?: string;
  /** 환불·취소 규정 전용 텍스트(멀티라인). 비어 있으면 탭에 기본 안내만 표시 */
  refundPolicy?: string;
  onConsultClick?: () => void;
  kakaoHref?: string;
  /** @deprecated unused — Sticky/Header 상담 사용. 전달하지 마세요. */
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
  /** @deprecated 체크아웃 UI는 상시 노출. 무시됩니다. */
  portOneEnabled?: boolean;
};

type ScheduleDay = { label: string; content: string };
type MainTab = "schedule" | "included" | "booking" | "travel" | "refund";

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
  optionalExpenses = "",
  minDeparturePeople = "",
  bookingNotes = "",
  travelNotes = "",
  bookingConditions = "",
  refundPolicy = "",
  onConsultClick,
  kakaoHref = "",
  consultHref: _consultHref = "",
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
  portOneEnabled: _portOneEnabled = false,
}: ProductDetailV2Props) {
  const resolvedOverview = useMemo(() => {
    if (product != null) return mapProductToOverview(product);
    return overviewModel ?? null;
  }, [product, overviewModel]);

  const overviewThemeChart = useMemo(() => {
    const items = resolvedOverview?.chart?.items;
    return items?.length ? items : null;
  }, [resolvedOverview]);

  const overviewKeywords = useMemo(() => {
    const tags = parseMetaTitleAsHashtags(product?.meta_title);
    return { display: tags.slice(0, 5), overflow: Math.max(0, tags.length - 5) };
  }, [product?.meta_title]);
  const hasOverviewAside = overviewKeywords.display.length > 0 || Boolean(overviewThemeChart);

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

    // 대표(image_url)를 캐러셀 첫 장으로 — 목록 썸네일과 상세 히어로 일치
    const primaryUrl = product ? getPrimaryImageUrl(product) : "";
    pushImage(primaryUrl, "대표 이미지");
    if (Array.isArray(product?.images_json)) {
      let extraIndex = 0;
      product.images_json.forEach((url) => {
        const before = list.length;
        pushImage(url, `추가 이미지 ${extraIndex + 1}`);
        if (list.length > before) extraIndex += 1;
      });
    }

    if (Array.isArray(product?.itinerary_v2_json?.days)) {
      product?.itinerary_v2_json.days.forEach((day) => {
        const coverImages = day.coverImages ?? [];
        if (coverImages.length > 0) {
          coverImages.forEach((img, idx) => {
            const url = typeof img === "string" ? img : img?.url;
            pushImage(url, `Day ${day.day} 커버 ${idx + 1}`);
          });
        } else {
          pushImage(day.coverImageUrl, `Day ${day.day}`);
        }
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
  const isSoldOut = statusTag === "SOLD_OUT";
  const ctaLabelOptions = useMemo(
    () => (hasProductFixedDeparture(product) ? { fixedDeparture: true as const } : undefined),
    [product],
  );
  const {
    setQuoteSummary,
    setRequiredGroupsMissing,
    selectedOptions: selectedOptionsFromQuote,
    selectedDeparture,
    selectedDepartureKey,
    setDepartureRequired,
    setDepartureSelectionMissing,
    registerScrollToBooking,
    openBookingSheet,
    travelerCount,
    setPaxDiscountPreview,
  } = useProductQuote();
  const selectedOptions = selectedOptionsFromQuote ?? EMPTY_SELECTED_OPTIONS;

  const [memberLoggedIn, setMemberLoggedIn] = useState(false);
  const [hasPreviousBooking, setHasPreviousBooking] = useState(false);

  useEffect(() => {
    void (async () => {
      const res = await fetch("/api/me/points", { cache: "no-store", credentials: "include" });
      if (!res.ok) {
        setMemberLoggedIn(false);
        setHasPreviousBooking(false);
        return;
      }
      const data = (await res.json()) as {
        authenticated?: boolean;
        hasPreviousBooking?: boolean;
      };
      if (data.authenticated === false) {
        setMemberLoggedIn(false);
        setHasPreviousBooking(false);
        return;
      }
      setMemberLoggedIn(true);
      setHasPreviousBooking(Boolean(data.hasPreviousBooking));
    })();
  }, []);

  const benefitMode = useMemo(
    () =>
      product
        ? resolveCheckoutBenefitMode(product)
        : resolveCheckoutBenefitMode({ category: category ?? null, product_line_id: null }),
    [product, category],
  );
  const isGolfCoupon = benefitMode === "golf_coupon";

  const paxDiscountPreview = useMemo(() => {
    if (!isGolfCoupon || !memberLoggedIn) return null;
    const pax = calculatePaxDiscount({ travelerCount, hasPreviousBooking });
    return { label: pax.label, amount: pax.totalDiscount };
  }, [isGolfCoupon, memberLoggedIn, travelerCount, hasPreviousBooking]);

  useEffect(() => {
    setPaxDiscountPreview(paxDiscountPreview);
  }, [paxDiscountPreview, setPaxDiscountPreview]);

  const detailViewFiredRef = useRef(false);
  useEffect(() => {
    if (!productId || detailViewFiredRef.current) return;
    detailViewFiredRef.current = true;
    trackProductDetailViewSummary({
      productId,
      tourType: product?.category ?? category ?? null,
      region: product?.theme ?? region ?? null,
      bookingUxMode: product ? resolveProductBookingUxMode(product) : null,
      benefitMode,
    });
  }, [productId, product, category, region, benefitMode]);

  const bookingUxMode = useMemo(
    () => (product ? resolveProductBookingUxMode(product) : "calendar_booking"),
    [product],
  );
  const showCalendarBooking = bookingUxMode === "calendar_booking";
  const calendarDepartureDates = useMemo(
    () => (product ? collectProductDepartureDates(product) : []),
    [product],
  );
  const hasDepartures = Boolean(product?.departureSchedules?.length || product?.departures?.length);
  const hasCalendarDepartures = calendarDepartureDates.length > 0;
  const hasOptions = ENABLE_PRODUCT_OPTIONS && options?.groups != null && options.groups.length > 0;
  const departureRequiredForBooking = hasCalendarDepartures || hasDepartures;
  const quote = useMemo(() => {
    const departurePrice = selectedDeparture?.price;
    const optionsForQuote =
      options && departurePrice != null && departurePrice > 0
        ? { ...options, basePrice: departurePrice }
        : options;
    return calcQuote(optionsForQuote, selectedOptions);
  }, [options, selectedOptions, selectedDeparture?.price]);
  const displayPrice = hasOptions && quote.total != null
    ? formatPriceKR(quote.total)
    : priceFormatted;
  const displayDuration = hasOptions && quote.durationLabel ? quote.durationLabel : duration;

  const seasonalModel = useMemo(
    () => getSeasonalPriceDisplayModel(product?.seasonal_price_bands),
    [product?.seasonal_price_bands],
  );
  const departureScheduleMinPrice = useMemo(
    () => getDepartureSchedulesMinPrice(product?.departureSchedules),
    [product?.departureSchedules],
  );
  const showingOptionQuotePrice = Boolean(hasOptions && quote.total != null);
  const showDepartureSchedulePrice =
    departureScheduleMinPrice != null && !showingOptionQuotePrice;
  const showSeasonalBandCard =
    seasonalModel.hasAny && !showingOptionQuotePrice && !showDepartureSchedulePrice;
  const departureSchedulePriceFormatted =
    departureScheduleMinPrice != null
      ? departureScheduleMinPrice.toLocaleString("ko-KR")
      : null;

  const requiredGroupsMissing = useMemo(() => {
    if (!hasOptions || !options?.groups?.length) return false;
    const requiredSet = new Set(options.requiredGroups ?? []);
    return options.groups.some((group) =>
      isGroupSelectionMissing(group, selectedOptions, requiredSet.has(group.key)),
    );
  }, [hasOptions, options, selectedOptions]);

  useEffect(() => {
    setQuoteSummary(hasOptions ? quote : null);
    setRequiredGroupsMissing(hasOptions ? requiredGroupsMissing : false);
  }, [hasOptions, quote, requiredGroupsMissing, setQuoteSummary, setRequiredGroupsMissing]);

  const departureSelectionMissing = departureRequiredForBooking && !selectedDepartureKey;

  useEffect(() => {
    setDepartureRequired(departureRequiredForBooking);
    setDepartureSelectionMissing(departureSelectionMissing);
  }, [departureRequiredForBooking, departureSelectionMissing, setDepartureRequired, setDepartureSelectionMissing]);

  useEffect(() => {
    registerScrollToBooking((target = "panel") => {
      if (target === "checkout") {
        const el = document.getElementById("product-checkout");
        if (el) {
          el.scrollIntoView({ behavior: "smooth", block: "start" });
          el.classList.remove("product-booking-highlight");
          void el.offsetWidth;
          el.classList.add("product-booking-highlight");
          return;
        }
        // checkout 미노출 시 예약 패널로 폴백
        target = "panel";
      }

      if (typeof window !== "undefined" && window.matchMedia("(min-width: 1024px)").matches) {
        const id =
          target === "departure"
            ? "product-departure-section"
            : target === "options"
              ? "product-options-section"
              : "product-booking-panel";
        const el = document.getElementById(id);
        el?.scrollIntoView({ behavior: "smooth", block: "nearest" });
        if (el) {
          el.classList.remove("product-booking-highlight");
          void el.offsetWidth;
          el.classList.add("product-booking-highlight");
        }
        return;
      }
      openBookingSheet(target);
    });
  }, [registerScrollToBooking, openBookingSheet]);

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
  const optionalExpenseLines = useMemo(
    () => parseBulletLines(product?.optional_expenses ?? optionalExpenses),
    [product?.optional_expenses, optionalExpenses],
  );
  const bookingLines = useMemo(() => parseBulletLines(bookingNotes), [bookingNotes]);
  const travelLines = useMemo(() => parseBulletLines(travelNotes), [travelNotes]);
  const bookingConditionLines = useMemo(
    () => parseBulletLines(bookingConditions),
    [bookingConditions],
  );
  const refundLines = useMemo(() => parseBulletLines(refundPolicy), [refundPolicy]);

  useEffect(() => {
    if (process.env.NODE_ENV === "production") return;
    if (bookingNotes && travelNotes && bookingNotes === travelNotes) {
      console.warn("[TERMS DUPLICATION WARNING] bookingNotes === travelNotes");
    }
    if (bookingNotes && bookingConditions && bookingNotes === bookingConditions) {
      console.warn("[TERMS DUPLICATION WARNING] bookingNotes === bookingConditions");
    }
    if (bookingNotes && refundPolicy && bookingNotes === refundPolicy) {
      console.warn("[TERMS DUPLICATION WARNING] bookingNotes === refundPolicy");
    }
    if (travelNotes && refundPolicy && travelNotes === refundPolicy) {
      console.warn("[TERMS DUPLICATION WARNING] travelNotes === refundPolicy");
    }
  }, [bookingNotes, travelNotes, bookingConditions, refundPolicy]);

  const hasSchedule = scheduleDays.length > 0;
  const listClass = "space-y-2 text-base leading-7 text-slate-700";

  /** PR40: 사실 정보(기간/출발/항공/호텔)만 — 가격·포함은 별도 블록 */
  const hasSummaryData = useMemo(() => {
    const d = product?.duration ?? duration;
    const dep = product?.departure ?? product?.overview_region;
    const air = formatAirlineLabel(product ?? undefined);
    const hot = product?.hotel ?? product?.overview_accommodation;
    const style = product?.travelStyle ?? product?.theme;
    const minPeople = product?.min_departure_people ?? minDeparturePeople;
    return Boolean(d || dep || air || hot || style || minPeople);
  }, [product, duration, minDeparturePeople]);

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

  const recommendedAudienceBullets = useMemo(
    () =>
      buildRecommendedAudienceBullets(product, {
        skipHighlightDerived: Boolean(product?.highlights?.length),
      }),
    [product],
  );

  const priceBasisLabel = (priceMeta || "1인 기준").trim() || "1인 기준";
  const priceVolatilityHint = "출발일에 따라 달라질 수 있어요";

  const openIncludedTab = useCallback(() => {
    setActiveTab("included");
    requestAnimationFrame(() => {
      document.getElementById("product-detail-tabs")?.scrollIntoView({
        behavior: "smooth",
        block: "start",
      });
    });
  }, []);

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
            className="mt-2 inline-flex items-center gap-1.5 rounded-full bg-[var(--warning-bg)] px-3 py-1.5 text-sm font-medium text-[var(--warning)] transition hover:bg-[var(--warning-bg)]/70"
          >
            <span className="text-[var(--warning)]">★</span>
            <span>{reviewSummary.averageRating.toFixed(1)}</span>
            <span className="text-slate-500">(후기 {reviewSummary.reviewCount})</span>
          </a>
        )}

        {oneLiner ? (
          <p className="mt-2 whitespace-pre-wrap text-base leading-6 text-slate-600">{oneLiner}</p>
        ) : null}

        {/* Price Summary Card: 캐러셀 위 대표가·구간 비교·추천 대상(PR-F) + 키워드/테마 */}
        <Card
          variant="default"
          className="mt-4 border-[var(--primary-soft)] bg-[var(--primary-soft)] p-5 ring-1 ring-[var(--primary-soft)]"
        >
          <div
            className={cn(
              "grid gap-6",
              hasOverviewAside ? "lg:grid-cols-2 lg:items-start" : undefined,
            )}
          >
            <div className="min-w-0">
              {showDepartureSchedulePrice ? (
                <>
                  <p className="font-price-strong text-xl font-bold text-[var(--primary)] md:text-2xl">
                    ₩{departureSchedulePriceFormatted}~
                  </p>
                  <p className="mt-1 text-sm text-slate-500">
                    {[priceBasisLabel, priceVolatilityHint].join(" · ")}
                  </p>
                  {displayDuration ? (
                    <p className="mt-0.5 text-xs text-slate-400">{displayDuration}</p>
                  ) : null}
                  <p className="mt-2 text-xs leading-relaxed text-slate-500">
                    {DETAIL_UNIFIED_PRICE_NOTICE_LINES[0]}
                  </p>
                </>
              ) : showSeasonalBandCard ? (
                <>
                  <p className="text-base font-semibold text-[#0f172a]">대표 출발가 안내</p>
                  <p className="mt-1 text-sm text-slate-500">
                    {[priceBasisLabel, priceVolatilityHint].join(" · ")}
                  </p>
                  {displayDuration ? (
                    <p className="mt-0.5 text-xs text-slate-400">{displayDuration}</p>
                  ) : null}
                  {product?.seasonal_price_bands ? (
                    <div className="mt-2">
                      <SeasonalPriceComparison bands={product.seasonal_price_bands} />
                    </div>
                  ) : null}
                  <p className="mt-2 text-xs leading-relaxed text-slate-500">
                    {DETAIL_UNIFIED_PRICE_NOTICE_LINES[0]}
                  </p>
                </>
              ) : displayPrice ? (
                <>
                  <p className="font-price-strong text-xl font-bold text-[var(--primary)] md:text-2xl">
                    ₩{displayPrice}~
                  </p>
                  <p className="mt-1 text-sm text-slate-500">
                    {[priceBasisLabel, priceVolatilityHint].join(" · ")}
                  </p>
                  {displayDuration ? (
                    <p className="mt-0.5 text-xs text-slate-400">{displayDuration}</p>
                  ) : null}
                  <p className="mt-2 text-xs leading-relaxed text-slate-500">
                    {DETAIL_UNIFIED_PRICE_NOTICE_LINES[0]}
                  </p>
                </>
              ) : (
                <>
                  <p className="font-price-strong text-xl font-semibold text-slate-600 md:text-2xl">
                    상담 후 견적 안내
                  </p>
                  {(displayDuration || priceMeta) && (
                    <p className="mt-1 text-sm text-slate-500">
                      {[displayDuration, priceMeta].filter(Boolean).join(" · ")}
                    </p>
                  )}
                  <p className="mt-2 text-xs leading-relaxed text-slate-500">
                    {DETAIL_UNIFIED_PRICE_NOTICE_LINES[0]}
                  </p>
                </>
              )}
            </div>
            {hasOverviewAside ? (
              <div className="min-w-0 space-y-3">
                {overviewThemeChart ? (
                  <div className="rounded-lg border border-slate-200/90 bg-white/90 p-3">
                    <ThemeChartCard items={overviewThemeChart} />
                  </div>
                ) : null}
                {overviewKeywords.display.length > 0 ? (
                  <div className="rounded-lg border border-slate-200/90 bg-white/90 p-3">
                    <p className="mb-1.5 text-[10px] font-medium uppercase tracking-wide text-slate-400">
                      핵심 키워드
                    </p>
                    <div className="flex flex-wrap items-center gap-1.5">
                      {overviewKeywords.display.map((tag, index) => (
                        <span
                          key={`overview-seo-${tag}-${index}`}
                          className="inline-flex shrink-0 items-center rounded-full border border-slate-200 bg-white px-2 py-0.5 text-[11px] font-medium text-slate-600"
                        >
                          #{tag}
                        </span>
                      ))}
                      {overviewKeywords.overflow > 0 ? (
                        <span className="inline-flex shrink-0 items-center text-[11px] font-medium text-slate-400">
                          +{overviewKeywords.overflow}
                        </span>
                      ) : null}
                    </div>
                  </div>
                ) : null}
              </div>
            ) : null}
          </div>
        </Card>

        <div className="mt-5">
          <ProductImageCarousel images={galleryImages} showPlaceholderWhenEmpty />
        </div>

        {hasSummaryData && (
          <div className="mt-6">
            <ProductSummaryInfo
              duration={product?.duration ?? duration}
              departure={product?.departure ?? product?.overview_region}
              airline={formatAirlineLabel(product ?? undefined)}
              hotel={product?.hotel ?? product?.overview_accommodation}
              travelStyle={product?.travelStyle ?? product?.theme}
              minDeparturePeople={(product?.min_departure_people ?? minDeparturePeople) || undefined}
            />
          </div>
        )}

        {isGolfCoupon ? (
          <div className="mt-5">
            <ProductGolfMemberBenefit
              memberLoggedIn={memberLoggedIn}
              paxDiscountPreview={paxDiscountPreview}
            />
          </div>
        ) : null}

        <div className="mt-5">
          <ProductCostSummary
            includedLines={includedLines}
            excludedLines={excludedLines}
            optionalExpenseLines={[...optionalExpenseLines, ...optionalLines]}
            fuelIncluded={fuelIncluded}
            onOpenIncludedTab={openIncludedTab}
          />
        </div>

        {highlightsForCard.length > 0 ? (
          <div className="mt-6">
            <ProductHighlightsCard highlights={highlightsForCard} />
          </div>
        ) : null}

        {recommendedAudienceBullets.length > 0 ? (
          <div className="mt-4">
            <ProductDetailRecommendedAudience bullets={recommendedAudienceBullets} />
          </div>
        ) : null}

        {shouldShowProductDescription(product?.description) ||
        shouldShowGolfCourseInfo(product?.golf_course_info) ? (
          <div className="mt-6">
            <ProductDescriptionSection
              description={product?.description}
              golfCourseInfo={product?.golf_course_info}
              golfCourses={product?.golf_courses_json}
            />
          </div>
        ) : null}

        {product?.selling_points_json ? (
          <div className="mt-6">
            <ProductSellingPointsSection sellingPoints={product.selling_points_json} />
          </div>
        ) : null}

        {hasPackageCatalogContent(product?.package_catalog_json) ? (
          <div className="mt-6">
            <ProductPackageCatalogSection catalog={product?.package_catalog_json} />
          </div>
        ) : null}

        <div className="mt-6">
          <TrustSignals trust={trust} />
        </div>
      </section>

      {/* PR42: 상품 핵심 요약 정보 블록 이후 itinerary — 중복 timeline은 Tabs에서도 유지 */}
      {product?.itinerary_days?.length ? (
        <div className="mt-8">
          <ProductItineraryTimeline itinerary={product.itinerary_days} />
        </div>
      ) : null}

      <ProductItineraryPreview
        timelineModel={timelineModel?.days?.length ? timelineModel : null}
        scheduleDays={scheduleDays}
        maxDays={4}
        itinerarySectionId="itinerary-section"
        onViewFullItinerary={() => setActiveTab("schedule")}
        onPreviewDayClick={handlePreviewDayClick}
      />

      <FlightSummarySection product={product ?? null} compact embedded />

      {hotelValue ? <ProductHotelCard hotelName={hotelValue} /> : null}

      {/* Tabs */}
      <section id="product-detail-tabs" className="scroll-mt-24">
        <Tabs value={activeTab} onChange={(v) => setActiveTab(v as MainTab)} className="mb-4 gap-2 overflow-x-auto">
          <TabsTrigger value="schedule">일정 안내</TabsTrigger>
          <TabsTrigger value="included">포함/불포함</TabsTrigger>
          <TabsTrigger value="booking">예약 조건</TabsTrigger>
          <TabsTrigger value="travel">여행 시 유의사항</TabsTrigger>
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
                ctaLabelOptions={ctaLabelOptions}
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
              <p className="text-base text-slate-500">일정 정보 준비 중입니다.</p>
            )}
          </div>
        )}

        {activeTab === "included" && (
          <div className="space-y-4">
            {/* PR25: 포함/불포함 카드 UI */}
            <ProductIncludeExclude
              included={includedLines}
              excluded={excludedLines}
              optionalExpenses={optionalExpenseLines}
            />
            {(includedLines.length === 0 &&
              excludedLines.length === 0 &&
              optionalExpenseLines.length === 0) && (
              <p className="text-base text-slate-500">등록된 포함/불포함 사항이 없습니다.</p>
            )}
            {optionalLines.length > 0 &&
              (product?.package_catalog_json?.optionalTours?.length ?? 0) === 0 && (
              <div>
                <h3 className="mb-3 text-base font-bold text-[var(--primary)]">선택 관광</h3>
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
            {minDeparturePeople?.trim() ? (
              <div className="flex items-start gap-3 rounded-lg border border-slate-200 bg-slate-50/80 px-3 py-3">
                <Icon name="check" decorative size={20} className="mt-0.5 shrink-0 text-emerald-600" />
                <span className="text-base leading-7 text-slate-700 whitespace-normal">
                  출발 인원: {minDeparturePeople.trim()}명 이상 확정 시 출발
                </span>
              </div>
            ) : null}
            <ul className="space-y-3">
              <li className="flex items-start gap-3">
                <Icon name="check" decorative size={20} className="mt-0.5 shrink-0 text-emerald-600" />
                <span className="text-base leading-7 text-slate-700 whitespace-normal">
                  최종 일정·가격은 상담 후 확정됩니다.
                </span>
              </li>
              <li className="flex items-start gap-3">
                <Icon name="check" decorative size={20} className="mt-0.5 shrink-0 text-emerald-600" />
                <span className="text-base leading-7 text-slate-700 whitespace-normal">
                  문의 주시면 맞춤 견적과 예약 절차를 안내해 드립니다.
                </span>
              </li>
            </ul>
            {bookingConditionLines.length > 0 ? (
              <AlertCard variant="info" title="예약조건">
                <ul className="mt-2 space-y-2">
                  {bookingConditionLines.map((line, i) => (
                    <li key={`cond-${i}`} className="flex items-start gap-3">
                      <Icon name="check" decorative size={20} className="mt-0.5 shrink-0 text-emerald-600" />
                      <span className="min-w-0 flex-1 break-words text-base leading-7 text-slate-700 [overflow-wrap:anywhere] whitespace-normal">
                        <AutolinkPlainText text={line} />
                      </span>
                    </li>
                  ))}
                </ul>
              </AlertCard>
            ) : null}
            {bookingLines.length > 0 ? (
              <AlertCard variant="info" title="예약 시 유의사항">
                <CollapsibleNoticeLines lines={bookingLines} listClassName="space-y-1" />
              </AlertCard>
            ) : null}
          </div>
        )}

        {activeTab === "travel" && (
          <div>
            {travelLines.length > 0 ? (
              <AlertCard variant="info" title="여행 시 유의사항">
                <CollapsibleNoticeLines lines={travelLines} />
              </AlertCard>
            ) : (
              <AlertCard variant="neutral" title="여행 시 유의사항">
                <p className="text-base leading-7 text-slate-700">
                  여행 준비물·현지 진행 유의사항은 상담 시 안내해 드립니다.
                </p>
              </AlertCard>
            )}
          </div>
        )}

        {activeTab === "refund" && (
          <div>
            {refundLines.length > 0 ? (
              <AlertCard variant="neutral" title="환불/취소 규정">
                <CollapsibleNoticeLines lines={refundLines} />
              </AlertCard>
            ) : (
              <AlertCard variant="info" title="환불 규정">
                <p className="text-base leading-7 text-slate-700">
                  상품별 상세 환불·취소 규정은 상담 시 안내해 드립니다.
                </p>
              </AlertCard>
            )}
          </div>
        )}
      </section>
    </div>
  );
}
