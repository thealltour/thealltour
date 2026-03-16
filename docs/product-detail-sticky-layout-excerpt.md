# 상품 상세페이지 2컬럼 레이아웃 / 우측 sticky CTA / 헤더 구조 발췌

> PR: 우측 sticky CTA가 헤더에 가리는 문제 디버깅용  
> 아래 코드는 **그대로 복사 가능한 전체 코드**입니다.

---

## 1. 상품상세페이지 레이아웃 (우측 sticky CTA 2컬럼)

**파일 경로:** `src/app/products/[id]/page.tsx`  
**컴포넌트:** `ProductDetailPage`

```tsx
import Image from "next/image";
import Link from "next/link";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import SiteHeader from "@/components/SiteHeader";
import ProductDetailV2 from "@/components/products/ProductDetailV2";
import { ProductReviewsSection } from "@/components/products/ProductReviewsSection";
import { GuideCard } from "@/components/guides/GuideCard";
import {
  ProductDetailStickyDesktop,
  ProductDetailStickyMobile,
} from "@/components/ProductDetailSticky";
import {
  ProductDetailStickyV2Desktop,
  ProductDetailStickyV2Mobile,
} from "@/components/products/ProductDetailStickyV2";
import { PageContainer } from "@/components/layout/PageContainer";
import { SectionBlock } from "@/components/layout/SectionBlock";
import { SectionHeader } from "@/components/layout/SectionHeader";
import { ProductQuoteProvider } from "@/components/products/ProductQuoteContext";
import AlertCard from "@/components/ui/AlertCard";
import { ConsultModalProvider } from "@/components/ConsultModal";
import { getProductByIdFresh } from "@/lib/products";
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

type ProductDetailPageProps = {
  params: Promise<{ id: string }>;
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
};

function buildSeoDescription(input: string) {
  return input.replace(/\s+/g, " ").trim().slice(0, 155);
}

function toAbsoluteUrl(siteUrl: string, pathOrUrl: string) {
  if (!pathOrUrl) return siteUrl;
  if (/^https?:\/\//i.test(pathOrUrl)) return pathOrUrl;
  const normalizedPath = pathOrUrl.startsWith("/") ? pathOrUrl : `/${pathOrUrl}`;
  return `${siteUrl}${normalizedPath}`;
}

export async function generateMetadata({ params }: ProductDetailPageProps): Promise<Metadata> {
  const { id } = await params;
  const product = await getProductByIdFresh(id);
  const siteUrl = (process.env.NEXT_PUBLIC_SITE_URL ?? "https://thealltour.com").replace(/\/$/, "");
  const productPath = `/products/${id}`;
  const productUrl = `${siteUrl}${productPath}`;

  if (!product) {
    return {
      title: "패키지상품 | 더올투어",
      description: "더올투어 패키지상품 정보를 확인해 보세요.",
      alternates: {
        canonical: productUrl,
      },
    };
  }

  const title = product.meta_title?.trim() || `${product.title} | ${product.category} 패키지 | 더올투어`;
  const description =
    product.meta_description?.trim() ||
    buildSeoDescription(
      `${product.title} ${product.category} ${product.theme ?? ""} ${product.description} 더올투어 맞춤 여행 상담 가능`,
    );
  const ogImage = toAbsoluteUrl(siteUrl, product.image_url?.trim() || "/thealltour-logo.png");

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
      images: [{ url: ogImage }],
      locale: "ko_KR",
    },
    twitter: {
      card: "summary_large_image",
      title,
      description,
      images: [ogImage],
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
  const siteUrl = (process.env.NEXT_PUBLIC_SITE_URL ?? "https://thealltour.com").replace(/\/$/, "");
  const productUrl = `${siteUrl}/products/${product.id}`;
  const productImageUrl = toAbsoluteUrl(siteUrl, product.image_url?.trim() || "/thealltour-logo.png");
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
    fromDate: product.arrival_to_date,
    fromTime: product.arrival_to_time,
    toAirport: product.arrival_to_airport,
    toDate: product.arrival_to_date,
    toTime: product.arrival_to_time,
    flightName: product.arrival_flight_name,
  };
  const settings = await getSiteSettings();
  const kakaoHref = settings.kakao_chat_url || settings.kakao_channel_url || "https://pf.kakao.com";
  const sourcePath = `/products/${product.id}`;
  const relatedGuides =
    product.destination_id?.trim()
      ? await getGuidesByDestinationId(product.destination_id.trim(), 3)
      : [];

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
              <div className="mb-6 md:hidden">
                <Link
                  href="/products"
                  className="inline-flex items-center gap-1 rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700 transition hover:bg-slate-50"
                >
                  ← 상품 목록으로
                </Link>
              </div>

              {/* 좌측 본문 / 우측 sticky CTA 2컬럼 레이아웃 */}
              <div className="flex gap-8 xl:gap-10 lg:items-start">
                <div className="min-w-0 flex-1 space-y-6">
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

                  <ProductReviewsSection
                    productId={product.id}
                    productTitle={product.title}
                    personalizationContext={personalizationContext}
                    experimentKey="review_highlight_variant"
                    variant={reviewExperimentVariant}
                    reviewSort={reviewSort}
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
                          <li key={guide.id}>
                            <GuideCard guide={guide} />
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

                {/* 우측 sticky CTA (Desktop) */}
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

          {/* 하단 모바일 sticky CTA */}
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

## 2. 우측 sticky CTA 컴포넌트

**파일 경로:** `src/components/products/ProductDetailStickyV2.tsx`  
**컴포넌트:** `ProductDetailStickyV2Desktop`, `ProductDetailStickyV2Mobile`

```tsx
"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { cn } from "@/lib/cn";
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

  /** PR7: 스크롤 기반 CTA 강조 (Desktop 전용). Hero 지나면 true */
  const [isScrolled, setIsScrolled] = useState(false);
  /** 본문 깊이 진입 시 true → CTA 시각 강조 */
  const [isDeepScroll, setIsDeepScroll] = useState(false);
  const scrollTickRef = useRef<number | null>(null);
  const lastScrolledRef = useRef(false);
  const lastDeepRef = useRef(false);

  useEffect(() => {
    const SCROLL_THRESHOLD_HERO = 300;
    const SCROLL_THRESHOLD_DEEP = 900;

    const onScroll = () => {
      if (scrollTickRef.current != null) return;
      scrollTickRef.current = requestAnimationFrame(() => {
        scrollTickRef.current = null;
        const y = window.scrollY;
        const scrolled = y > SCROLL_THRESHOLD_HERO;
        const deep = y > SCROLL_THRESHOLD_DEEP;
        if (scrolled !== lastScrolledRef.current) {
          lastScrolledRef.current = scrolled;
          setIsScrolled(scrolled);
        }
        if (deep !== lastDeepRef.current) {
          lastDeepRef.current = deep;
          setIsDeepScroll(deep);
        }
      });
    };

    window.addEventListener("scroll", onScroll, { passive: true });
    return () => {
      window.removeEventListener("scroll", onScroll);
      if (scrollTickRef.current != null) cancelAnimationFrame(scrollTickRef.current);
    };
  }, []);

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

  return (
    <aside
      className="hidden md:block sticky top-24 w-full max-w-[300px] shrink-0"
      aria-label="상품 요약"
    >
      {/* 전환 핵심 그룹: 예상가 + CTA (가격 인지 → 즉시 액션). PR7: deep scroll 시 강조 */}
      <div
        className={cn(
          "rounded-2xl border-2 bg-white p-5 transition-all duration-200",
          isDeepScroll
            ? "border-[#3b82f6] shadow-xl ring-2 ring-[#93c5fd]/50 bg-[#eff6ff]/50"
            : isScrolled
              ? "border-[#93c5fd] shadow-lg ring-2 ring-[#93c5fd]/30"
              : "border-[#93c5fd] shadow-lg ring-1 ring-[#bfdbfe]",
        )}
      >
        <div className="space-y-3">
          <div>
            <p className="text-xs font-medium text-slate-500">예상가</p>
            {displayPrice ? (
              <p className="font-price-strong mt-1 text-2xl font-bold leading-tight text-[#1E3A8A]">
                ₩{displayPrice}~
              </p>
            ) : (
              <p className="mt-1 text-lg font-semibold text-slate-600">상담 후 안내</p>
            )}
            {product && (
              <div className="mt-2 space-y-0.5">
                {(product.duration or product.price_meta) && (
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
          <div
            className={cn(
              "flex flex-col gap-2 pt-0.5 rounded-xl transition-colors duration-200",
              isDeepScroll && "bg-[#dbeafe]/30 -mx-1 px-3 py-2",
            )}
          >
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

  useEffect(() => {
    const nextHeight = compact ? 44 : 56;
    document.documentElement.setAttribute("data-mobile-cta", "on");
    document.documentElement.style.setProperty("--cta-h", `${nextHeight}px`);
    return () => {
      document.documentElement.removeAttribute("data-mobile-cta");
      document.documentElement.style.setProperty("--cta-h", "0px");
    };
  }, [compact]);

  return (
    <div
      className="fixed inset-x-0 bottom-0 z-30 flex items-center gap-3 border-t border-[var(--divider)] bg-[var(--glass-surface)] px-3 backdrop-blur transition-all duration-200 md:hidden"
      style={{
        paddingTop: compact ? "8px" : "12px",
        paddingBottom: compact ? "max(8px, env(safe-area-inset-bottom))" : "max(12px, env(safe-area-inset-bottom))",
      }}
    >
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
  );
}
```

---

## 3. 글로벌 헤더 / sticky header 높이

**파일 경로:** `src/components/SiteHeaderUI.tsx`  
**컴포넌트:** `SiteHeaderUI`

```tsx
"use client";

import { useEffect, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import HeaderQuickConsultCtas from "@/components/HeaderQuickConsultCtas";
import UserMenuDropdown from "@/components/header/UserMenuDropdown";
import { HeaderExpandSearch } from "@/components/HeaderExpandSearch";
import { DesktopMegaMenu } from "@/components/header/DesktopMegaMenu";
import { MobileHeaderMenu } from "@/components/header/MobileHeaderMenu";
import { PageContainer } from "@/components/layout/PageContainer";
import { HEADER_DESKTOP_PRIMARY_NAV_KEYS, HEADER_PRIMARY_NAV_ITEMS, HEADER_PRIMARY_NAV_DEFAULT_HREF } from "@/components/header/headerNav.constants";
import type { HeaderPrimaryNavKey } from "@/components/header.headerNav.constants";
import type { HeaderNavigationData, HeaderPrimaryNavItem } from "@/components/header/headerNav.types";
import { cn } from "@/lib/cn";

export type SiteHeaderUIProps = {
  /** 서버에서 조회한 헤더 네비 데이터. null이면 직접 링크 fallback */
  headerNavigationData?: HeaderNavigationData | null;
  activeTab?: "about" | "quote" | "reviews" | "blog" | "support" | "products" | "signup";
  searchQuery?: string;
  golfPresetActive?: boolean;
  quickConsultHref?: string;
  kakaoConsultHref?: string;
  session: { name: string } | null;
  memberPoints: number | null;
};

/** 데이터 없을 때 사용할 최소 1차 메뉴 (직접 링크) */
function getFallbackPrimaryNav(): HeaderPrimaryNavItem[] {
  return HEADER_PRIMARY_NAV_ITEMS.map(({ key, label }) => ({
    key,
    label,
    href: HEADER_PRIMARY_NAV_DEFAULT_HREF[key as HeaderPrimaryNavKey],
  }));
}

function getNavLinkClass(isActive: boolean) {
  const base =
    "relative shrink-0 whitespace-nowrap type-nav font-medium transition-colors duration-150 py-1 px-0.5 rounded";
  if (isActive) {
    return cn(
      base,
      "text-[var(--foreground)] font-semibold",
      "after:absolute after:left-0 after:right-0 after:bottom-0 after:h-[2px] after:rounded-full after:bg-[var(--primary)]",
    );
  }
  return cn(
    base,
    "text-[var(--text-muted)]",
    "hover:text-[var(--foreground)] hover:bg-[var(--surface-muted)]",
  );
}

export default function SiteHeaderUI({
  headerNavigationData,
  activeTab,
  searchQuery,
  golfPresetActive = false,
  quickConsultHref,
  kakaoConsultHref,
  session,
  memberPoints,
}: SiteHeaderUIProps) {
  const [scrolled, setScrolled] = useState(false);
  const primaryNav = headerNavigationData?.primaryNav?.length
    ? headerNavigationData.primaryNav
    : getFallbackPrimaryNav();

  useEffect(() => {
    function onScroll() {
      setScrolled(window.scrollY > 8);
    }
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  return (
    <header
      className={cn(
        "sticky z-40 transition-all duration-200 safe-top top-[env(safe-area-inset-top)]",
        scrolled
          ? "border-b border-[var(--divider)] bg-[var(--surface)] shadow-[var(--shadow-soft)] backdrop-blur-sm"
          : "border-b border-[var(--divider)] bg-[var(--surface)]",
      )}
    >
      {/* 데스크톱: 상단 유틸바 + 메인 헤더바 */}
      <PageContainer size="wide" className="hidden flex-col py-0 lg:flex">
        {/* 상단 유틸바: 회사소개 ~ 고객센터 */}
        <div className="flex h-10 items-center justify-center gap-x-8 border-b border-[var(--divider)]">
          <nav className="flex items-center gap-x-8 tracking-tight" aria-label="유틸리티 메뉴">
            <Link className={getNavLinkClass(activeTab === "about")} href="/about">
              회사소개
            </Link>
            <Link className={getNavLinkClass(activeTab === "quote")} href="/quote">
              견적문의
            </Link>
            <Link className={getNavLinkClass(activeTab === "reviews")} href="/reviews">
              여행후기
            </Link>
            <Link className={getNavLinkClass(activeTab === "blog")} href="/blog">
              여행가이드
            </Link>
            <Link className={getNavLinkClass(activeTab === "support")} href="/support">
              고객센터
            </Link>
          </nav>
        </div>

        {/* 메인 헤더바: 로고 | 메가메뉴 | 검색(비홈) | 마이페이지/CTA */}
        <div className="flex h-[72px] min-h-[72px] items-center gap-x-10 md:h-[76px] md:min-h-[76px]">
          <Link
            href="/"
            className="flex shrink-0 items-center gap-2.5 rounded-xl px-2 py-2 transition-colors duration-150 hover:bg-[var(--surface-muted)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--focus-ring)]"
            aria-label="더올투어 홈"
          >
            <Image
              src="/thealltour-logo.png"
              alt=""
              width={64}
              height={64}
              sizes="64px"
              className="h-10 w-10 object-contain md:h-11 md:w-11"
            />
            <div className="flex flex-col justify-center leading-tight">
              <span className="heading-display-hero text-[15px] font-bold tracking-tight text-[var(--secondary)] md:text-[17px]">
                더올투어
              </span>
              <span className="mt-0.5 type-caption font-medium tracking-wide text-[var(--text-muted)]">
                Golf & Premium Travel
              </span>
            </div>
          </Link>

          <DesktopMegaMenu primaryNav={primaryNav} />

          <div className="flex flex-1 justify-end items-center gap-x-4">
            <HeaderExpandSearch searchQuery={searchQuery} />

            <div className="flex shrink-0 items-center gap-3">
              {session ? (
                <UserMenuDropdown
                  userName={session.name}
                  points={memberPoints}
                />
              ) : (
                <>
                  <Link
                    className="type-small text-[var(--text-muted)] transition hover:text-[var(--foreground)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--focus-ring)] focus-visible:rounded"
                    href="/login"
                  >
                    로그인
                  </Link>
                  <span className="text-[var(--divider)]" aria-hidden>|</span>
                  <Link
                    className={cn(
                      "type-small transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--focus-ring)] focus-visible:rounded",
                      activeTab === "signup"
                        ? "font-semibold text-[var(--primary)]"
                        : "text-[var(--text-muted)] hover:text-[var(--foreground)]",
                    )}
                    href="/signup"
                  >
                    회원가입
                  </Link>
                </>
              )}
            </div>

            <HeaderQuickConsultCtas
              quickConsultHref={quickConsultHref}
              kakaoConsultHref={kakaoConsultHref}
            />
          </div>
        </div>
      </PageContainer>

      {/* 모바일/태블릿 헤더 */}
      <MobileHeaderMenu
        primaryNav={primaryNav}
        activeTab={activeTab}
        searchQuery={searchQuery}
        session={session}
      />
    </header>
  );
}
```

