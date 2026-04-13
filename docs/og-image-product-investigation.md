# 상품 OG 이미지 조사 (통합 문서)

상품 상세 URL 공유 시 네이버 블로그 등에서 OG 미리보기가 로고/기본 이미지로만 보이는 이슈를 정리한 문서입니다. 아래는 조사 시점에 맞춰 모은 코드이며, **최신 구현은 저장소 `src/`를 기준**으로 합니다.

## 목차

1. [핵심 관찰](#핵심-관찰)
2. [PR 요청문](#pr-요청문)
3. [소스 전문](#1-srcappproductsidpagetsx)

---

## 핵심 관찰

- `generateMetadata`의 `openGraph.images`가 `og-default-v1.png`로 고정되어 있음.
- `opengraph-image` + `getProductSeoData`는 상품 이미지를 쓸 수 있는 구조가 이미 있음.
- 크롤러가 메타 `og:image`를 우선하면 기본 이미지가 노출될 수 있음.

---

## PR 요청문

### 제목

`fix(seo): 상품 상세 공유 시 OG 이미지에 대표 상품 이미지 반영`

### 배경

네이버 블로그 등에서 `/products/[id]` URL 공유 시 미리보기 이미지가 **상품 대표 이미지가 아니라 기본(로고성) 이미지**로 노출됩니다.

### 원인(코드 기준)

- `src/app/products/[id]/page.tsx`의 `generateMetadata`에서 `openGraph.images`가 **항상** `og-default-v1.png`(절대 URL)로 설정됨.
- `getProductSeoData` → `opengraph-image.tsx` → `productOgImageResponse.tsx` 경로에서는 이미 `imageCandidates`로 합성 OG를 만들 수 있음.
- Twitter 메타는 `/products/{id}/twitter-image`를 가리키지만 Open Graph는 기본 PNG를 가리켜 플랫폼별 불일치가 남음.

### 목표

- 상품 URL 공유 시 대표 상품 이미지가 OG로 인식되도록 한다.
- 이미지 후보 선정은 `getProductSeoData`와 단일 소스로 맞춘다.
- 이미지가 없을 때만 사이트/브랜드 기본 OG로 폴백한다.

### 제안 작업

1. `generateMetadata`의 `openGraph.images`를 절대 URL의 `/products/[id]/opengraph-image` 등으로 연결.
2. `og:image` width/height(1200×630)와 실제 산출물 일치.
3. 네이버/카카오/페이스북 스크래퍼로 재수집 검증.

### 완료 조건

- 유효한 `image_url` / `images_json`이 있는 상품은 공유 시 상품이 드러나는 미리보기가 나온다.
- 이미지 없는 상품은 안전한 폴백 유지.
- 빌드·린트 통과.

### 관련 구현 파일

- `page.tsx`, `getProductSeoData.ts`, `opengraph-image.tsx`, `productOgImageResponse.tsx`, (참고) `layout.tsx`, `normalizeProductImageUrl.ts`

---

# 소스 전문

## 1. `src/app/products/[id]/page.tsx`

**원본:** `src/app/products/[id]/page.tsx`

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
import { THEALL_WORDMARK_IMAGE_SRC } from "@/lib/brandAssets";
import { getProductSeoData } from "@/lib/products/getProductSeoData";
import { getSiteBaseUrl, toAbsoluteUrl } from "@/lib/seo/getSiteSeoDefaults";
import { resolveProductNoticesForDetailPage } from "@/lib/noticeTemplates";
import { resolveProductDetailBodyFields } from "@/lib/products/resolveProductDetailBodyFields";

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
  const { resolvedIncludedItems, resolvedExcludedItems, resolvedOptionalTours } =
    resolveProductDetailBodyFields(product);
  const {
    bookingNotes: resolvedBookingNotes,
    travelNotes: resolvedTravelNotes,
    bookingConditions: resolvedBookingConditions,
    refundPolicy: resolvedRefundPolicy,
  } = await resolveProductNoticesForDetailPage(product);
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
                    bookingNotes={resolvedBookingNotes}
                    travelNotes={resolvedTravelNotes}
                    bookingConditions={resolvedBookingConditions}
                    refundPolicy={resolvedRefundPolicy}
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
                status={statusV2}
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
          product={product}
          experimentKey="review_highlight_variant"
          variant={reviewExperimentVariant}
        />
      </div>
      </ProductQuoteProvider>
    </ConsultModalProvider>
  );
}

```

## 2. `src/types/product.ts`

**원본:** `src/types/product.ts`

```ts
import type { ProductCampaignCardMeta } from "@/types/productCampaignCard";

/** 모두투어 등 계절·주말·성수기 구간가 (KRW 정수). 비어 있으면 필드 생략 또는 null */
export type SeasonalPriceBands = {
  offSeason?: number | null;
  weekend?: number | null;
  peakSeason?: number | null;
};

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

/** 일정 이벤트 이미지 1건 (모두투어 검수 status·수집 휴리스틱 메타) */
export type ItineraryEventImage = {
  url: string;
  alt?: string;
  sortOrder?: number;
  isCover?: boolean;
  status?: "active" | "deleted" | "unassigned";
  isThumbnailCandidate?: boolean;
  isLogoCandidate?: boolean;
  isLowResolution?: boolean;
};

/** [STEP 0] 구조화 일정 이벤트 1개 (시간대·아이콘 지원) */
export type ItineraryStructuredEvent = {
  heading: string;
  description?: string;
  timeOfDay?: "오전" | "오후" | "저녁" | "종일";
  iconKey?: string;
  /** 이벤트별 이미지 URL 목록 (대표·정렬 포함) */
  images?: ItineraryEventImage[];
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
  images?: ItineraryEventImage[];
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
  /** 비수기·주말·성수기 구간가 (jsonb). 없으면 undefined — 목록/상세는 기존 price 사용 */
  seasonal_price_bands?: SeasonalPriceBands | null;
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
  /** 레거시 단일 약관/유의. 상세 노출은 예약 유의사항 폴백에만 사용(PR-H). */
  terms_and_notes?: string | null;
  /** 예약 시 유의사항 (직접입력; 비면 템플릿·레거시 순) */
  booking_notes?: string | null;
  /** 여행 시 유의사항 (직접입력; 비면 템플릿만) */
  travel_notes?: string | null;
  /** 예약조건 (직접입력; 비면 템플릿만) */
  booking_conditions?: string | null;
  /** 환불·취소 규정 전용 (직접입력; 비면 refund 템플릿만, 타 필드 폴백 없음) */
  refund_policy?: string | null;
  refund_policy_template_type?: string | null;
  /** 예약 유의사항에 적용할 공통 템플릿 키 (product_terms_templates.type) */
  booking_notes_template_type?: string | null;
  travel_notes_template_type?: string | null;
  booking_conditions_template_type?: string | null;
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

## 3. getProductById / getProductByIdFresh 발췌

**원본:** `src/lib/products.ts` (발췌)

```ts
/**
 * 발췌: src/lib/products.ts — 상품 단건 fetch (상세·SEO 공통)
 * 전체 모듈은 저장소 src/lib/products.ts 참고.
 * (import, getProductByIdCached, normalizeProduct 등은 원본에 있음)
 */

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

```

## 4. `src/lib/products/getProductSeoData.ts`

**원본:** `src/lib/products/getProductSeoData.ts`

```ts
import { getProductByIdFresh } from "@/lib/products";
import { getTaxonomyById, parseThemeTokens } from "@/lib/productTaxonomies";
import { normalizeProductImageUrl } from "@/lib/media/normalizeProductImageUrl";
import { getSiteBaseUrl, toAbsoluteUrl } from "@/lib/seo/getSiteSeoDefaults";
import { resolveProductSeoCopyFromProduct } from "@/lib/seo/resolveProductSeoCopy";

const PLACEHOLDER_SUBSTR = "picsum.photos";

export type ProductSeoData = {
  id: string;
  name: string;
  /** `<title>` / OG title용 (메타 필드 또는 합성) */
  browserTitle: string;
  metaDescription: string;
  regionName: string | null;
  themeNames: string[];
  summaryLine: string | null;
  priceLabel: string | null;
  /** OG 페인트용 절대 URL, 우선순위 순 (대표 → 갤러리 → 지역 카드 등) */
  imageCandidates: string[];
  /** ProductOgCard 요약 한 줄 (패턴 매칭 ogSubtitle → summaryLine → 고정 fallback) */
  ogCardSubtitle: string;
};

function isRealProductImageUrl(url: string): boolean {
  const u = url.trim().toLowerCase();
  return u.length > 0 && !u.includes(PLACEHOLDER_SUBSTR);
}

function truncateSeo(s: string, max: number): string {
  const t = s.replace(/\s+/g, " ").trim();
  if (!t) return "";
  return t.length <= max ? t : `${t.slice(0, max - 1)}…`;
}

function addImageCandidate(
  list: string[],
  seen: Set<string>,
  siteUrl: string,
  raw: string | null | undefined,
) {
  if (!raw?.trim()) return;
  const normalized = normalizeProductImageUrl(raw.trim());
  if (!isRealProductImageUrl(normalized)) return;
  const abs = toAbsoluteUrl(siteUrl, normalized);
  if (seen.has(abs)) return;
  seen.add(abs);
  list.push(abs);
}

/**
 * 상품 상세 `page.tsx`의 generateMetadata와 `opengraph-image`가 동일 데이터를 쓰도록 하는 getter.
 */
export async function getProductSeoData(id: string): Promise<ProductSeoData | null> {
  const rawId = id?.trim();
  if (!rawId) return null;

  const product = await getProductByIdFresh(rawId);
  if (!product || product.is_active === false) return null;

  const siteUrl = getSiteBaseUrl();
  const seen = new Set<string>();
  const imageCandidates: string[] = [];

  if (Array.isArray(product.images_json)) {
    for (const u of product.images_json) {
      addImageCandidate(imageCandidates, seen, siteUrl, u);
    }
  }
  addImageCandidate(imageCandidates, seen, siteUrl, product.image_url);

  if (imageCandidates.length === 0 && product.destination_id?.trim()) {
    const tax = await getTaxonomyById(product.destination_id.trim());
    if (tax) {
      addImageCandidate(imageCandidates, seen, siteUrl, tax.card_image_url);
      addImageCandidate(imageCandidates, seen, siteUrl, tax.hero_image_url);
    }
  }

  const themeNames = parseThemeTokens(product.theme);
  const regionName =
    product.overview_region?.trim() || product.category?.trim() || null;

  const seoCopy = resolveProductSeoCopyFromProduct(product);

  let summaryLine = product.one_liner?.trim() || truncateSeo(product.description || "", 100) || null;
  if (!summaryLine && (regionName || themeNames.length > 0)) {
    const themePart = themeNames.slice(0, 2).join(" · ");
    const parts = [regionName, themePart || null].filter(Boolean) as string[];
    if (parts.length > 0) summaryLine = parts.join(" · ");
  }

  const priceLabel =
    typeof product.price === "number" && Number.isFinite(product.price) && product.price > 0
      ? `₩${new Intl.NumberFormat("ko-KR").format(product.price)}~`
      : null;

  const browserTitle =
    product.meta_title?.trim() ||
    `${product.title} | ${product.category} 패키지 | 더올투어`;

  const metaDescriptionFallbackRegion = regionName
    ? `${regionName}에서 즐기는 맞춤형 여행 상품입니다.`
    : "더올투어 맞춤형 여행 상품입니다.";

  const metaDescriptionRaw =
    product.meta_description?.trim() ||
    seoCopy?.description?.trim() ||
    product.one_liner?.trim() ||
    truncateSeo(product.description || "", 155) ||
    metaDescriptionFallbackRegion;

  const metaDescription = truncateSeo(metaDescriptionRaw.replace(/\s+/g, " ").trim(), 155);

  const ogCardSubtitle =
    seoCopy?.ogSubtitle?.trim() || summaryLine?.trim() || "맞춤형 여행";

  return {
    id: product.id,
    name: product.title,
    browserTitle,
    metaDescription,
    regionName,
    themeNames,
    summaryLine,
    priceLabel,
    imageCandidates,
    ogCardSubtitle,
  };
}

```

## 5. `src/app/layout.tsx`

**원본:** `src/app/layout.tsx`

```tsx
import type { Metadata } from "next";
import Script from "next/script";
import "./globals.css";
import {
  THEALL_APPLE_TOUCH_ICON_SRC,
  THEALL_FAVICON_16_SRC,
  THEALL_FAVICON_32_SRC,
  THEALL_WORDMARK_LIGHT_SRC,
} from "@/lib/brandAssets";
import { getSiteBaseUrl } from "@/lib/seo/getSiteSeoDefaults";
import GlobalSiteFooter from "@/components/site-chrome/GlobalSiteFooter";
import KakaoFloatingButton from "@/components/site-chrome/KakaoFloatingButton";
import { ConsultModalProvider } from "@/components/inquiry/ConsultModal";
import { WebVitalsReporter } from "@/components/site-chrome/WebVitalsReporter";
import { FirstTouchInit } from "@/components/site-chrome/FirstTouchInit";

const siteUrl = getSiteBaseUrl();

const organizationJsonLd = {
  "@context": "https://schema.org",
  "@type": "Organization",
  name: "더올투어",
  url: siteUrl,
  logo: `${siteUrl}${THEALL_WORDMARK_LIGHT_SRC}`,
  sameAs: [
    "https://www.instagram.com/",
    "https://blog.naver.com/",
  ],
} as const;

const websiteJsonLd = {
  "@context": "https://schema.org",
  "@type": "WebSite",
  name: "더올투어",
  url: siteUrl,
  potentialAction: {
    "@type": "SearchAction",
    target: `${siteUrl}/products?search={search_term_string}`,
    "query-input": "required name=search_term_string",
  },
} as const;

export const metadata: Metadata = {
  metadataBase: new URL(siteUrl),
  title: {
    default: "\ub354\uc62c\ud22c\uc5b4 | \ub9de\ucda4\ud615 \ud574\uc678\u00b7\uad6d\ub0b4 \uace8\ud504\ud22c\uc5b4",
    template: "%s | \ub354\uc62c\ud22c\uc5b4",
  },
  description:
    "\uac00\uc871\uc5ec\ud589, \ud6a8\ub3c4\uc5ec\ud589, \uace8\ud504\ud22c\uc5b4, \ud14c\ub9c8\uc5ec\ud589\uae4c\uc9c0. \uc0c1\ub2f4\ubd80\ud130 \uc77c\uc815 \uc81c\uc548\uae4c\uc9c0 \ub9de\ucda4\ud615\uc73c\ub85c \ub3c4\uc640\ub4dc\ub9bd\ub2c8\ub2e4.",
  icons: {
    icon: [
      { url: "/favicon.ico", sizes: "any" },
      { url: THEALL_FAVICON_16_SRC, sizes: "16x16", type: "image/png" },
      { url: THEALL_FAVICON_32_SRC, sizes: "32x32", type: "image/png" },
    ],
    shortcut: "/favicon.ico",
    apple: [{ url: THEALL_APPLE_TOUCH_ICON_SRC, sizes: "180x180", type: "image/png" }],
  },
  openGraph: {
    type: "website",
    url: siteUrl,
    siteName: "\ub354\uc62c\ud22c\uc5b4",
    locale: "ko_KR",
    title: "\ub354\uc62c\ud22c\uc5b4 | \ub9de\ucda4\ud615 \ud574\uc678\u00b7\uad6d\ub0b4 \uace8\ud504\ud22c\uc5b4",
    description:
      "\uac00\uc871\uc5ec\ud589, \ud6a8\ub3c4\uc5ec\ud589, \uace8\ud504\ud22c\uc5b4, \ud14c\ub9c8\uc5ec\ud589\uae4c\uc9c0. \uc0c1\ub2f4\ubd80\ud130 \uc77c\uc815 \uc81c\uc548\uae4c\uc9c0 \ub9de\ucda4\ud615\uc73c\ub85c \ub3c4\uc640\ub4dc\ub9bd\ub2c8\ub2e4.",
    images: [
      {
        url: "/opengraph-image",
        width: 1200,
        height: 630,
        alt: "\ub354\uc62c\ud22c\uc5b4 - \ub9de\ucda4\ud615 \uace8\ud504 \ubc0f \ud14c\ub9c8 \uc5ec\ud589",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "\ub354\uc62c\ud22c\uc5b4 | \ub9de\ucda4\ud615 \ud574\uc678\u00b7\uad6d\ub0b4 \uace8\ud504\ud22c\uc5b4",
    description:
      "\uac00\uc871\uc5ec\ud589, \ud6a8\ub3c4\uc5ec\ud589, \uace8\ud504\ud22c\uc5b4, \ud14c\ub9c8\uc5ec\ud589\uae4c\uc9c0. \uc0c1\ub2f4\ubd80\ud130 \uc77c\uc815 \uc81c\uc548\uae4c\uc9c0 \ub9de\ucda4\ud615\uc73c\ub85c \ub3c4\uc640\ub4dc\ub9bd\ub2c8\ub2e4.",
    images: ["/twitter-image"],
  },
};

export const viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover" as const,
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="ko">
      <head>
        {/* 파비콘: metadata 외에 표준 경로 직접 링크 (일부 환경·캐시 호환) */}
        <link rel="icon" href="/favicon.ico" sizes="any" />
        <link rel="icon" type="image/png" sizes="32x32" href={THEALL_FAVICON_32_SRC} />
        <link rel="icon" type="image/png" sizes="16x16" href={THEALL_FAVICON_16_SRC} />
        <link rel="apple-touch-icon" href={THEALL_APPLE_TOUCH_ICON_SRC} />
        {/* GA4 */}
        <Script
          src={`https://www.googletagmanager.com/gtag/js?id=${process.env.NEXT_PUBLIC_GA_ID ?? ""}`}
          strategy="afterInteractive"
        />
        <Script id="ga-init" strategy="afterInteractive">
          {`
            window.dataLayer = window.dataLayer || [];
            function gtag(){dataLayer.push(arguments);}
            gtag('js', new Date());
            gtag('config', '${process.env.NEXT_PUBLIC_GA_ID ?? ""}');
          `}
        </Script>
        {/* LCP: Supabase Storage preconnect */}
        <link
          rel="preconnect"
          href="https://qmswixmwquuazrhfyils.supabase.co"
          crossOrigin=""
        />
        {/* Product images: dns-prefetch */}
        <link rel="dns-prefetch" href="https://img.modetour.com" />
        <Script
          id="organization-jsonld"
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(organizationJsonLd) }}
        />
        <Script
          id="website-jsonld"
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(websiteJsonLd) }}
        />
      </head>
      <body className="flex min-h-screen flex-col bg-background text-foreground antialiased selection:bg-[color:color-mix(in_oklab,var(--primary)_18%,white)] selection:text-foreground">
        <FirstTouchInit />
        <WebVitalsReporter />
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

## 6. `src/lib/media/normalizeProductImageUrl.ts`

**원본:** `src/lib/media/normalizeProductImageUrl.ts`

```ts
/**
 * 상품 이미지 URL 정규화
 *
 * - 모두투어(img.modetour.com) 썸네일 URL: resize_w=157 등 리사이즈 쿼리 제거 → 고해상도 원본 요청
 * - Supabase storage: 옵션 시 render URL 변환
 */
type ImageTransformOptions = {
  width?: number;
  quality?: number;
  mode?: "cover" | "contain" | "fill";
};

/** 모두투어 CDN 썸네일 URL을 고해상도 URL로 변환 (resize_w/resize_h 등 제거). */
function toModetourHighResUrl(url: string): string {
  try {
    const u = new URL(url, "https://x");
    if (u.hostname.toLowerCase() !== "img.modetour.com") return url;
    const drop = new Set([
      "resize", "resize_w", "resize_h", "w", "h", "width", "height",
      "utm_source", "utm_medium", "utm_campaign", "cache", "v", "ver", "t", "timestamp", "quality",
    ]);
    let changed = false;
    u.searchParams.forEach((_, k) => {
      const low = k.toLowerCase();
      if (drop.has(low) || /^_\d+$/.test(low)) {
        u.searchParams.delete(k);
        changed = true;
      }
    });
    return changed ? u.href : url;
  } catch {
    return url;
  }
}

function toSupabaseRenderUrl(url: string, options?: ImageTransformOptions): string {
  const enableRender = process.env.NEXT_PUBLIC_ENABLE_SUPABASE_RENDER === "true";
  if (!enableRender) return url;
  if (!options?.width) return url;
  const match = url.match(
    /^(https?:\/\/[^/]+)\/storage\/v1\/object\/public\/([^/]+)\/(.+)$/,
  );
  if (!match) return url;

  const [, host, bucket, objectPath] = match;
  const base = `${host}/storage/v1/render/image/public/${bucket}/${objectPath}`;
  const params = new URLSearchParams();
  params.set("width", String(Math.max(1, Math.floor(options.width))));
  if (typeof options.quality === "number") {
    params.set("quality", String(Math.max(20, Math.min(100, Math.floor(options.quality)))));
  }
  if (options.mode) {
    params.set("resize", options.mode);
  }
  return `${base}?${params.toString()}`;
}

export function normalizeProductImageUrl(
  url: string | null | undefined,
  options?: ImageTransformOptions,
): string {
  if (!url?.trim()) return "";
  let normalized = url.trim();
  normalized = toModetourHighResUrl(normalized);
  return toSupabaseRenderUrl(normalized, options);
}

```

## 7. `src/app/products/[id]/opengraph-image.tsx`

**원본:** `src/app/products/[id]/opengraph-image.tsx`

```tsx
import { getProductOpenGraphImageResponse } from "@/lib/seo/productOgImageResponse";

export const runtime = "nodejs";

export const size = { width: 1200, height: 630 };

export const contentType = "image/png";

type Props = { params: Promise<{ id: string }> };

export default async function Image({ params }: Props) {
  const { id } = await params;
  return getProductOpenGraphImageResponse(id);
}

```

## 8. `src/lib/seo/productOgImageResponse.tsx`

**원본:** `src/lib/seo/productOgImageResponse.tsx`

```tsx
import { ImageResponse } from "next/og";
import { BrandOgCard } from "@/components/seo/BrandOgCard";
import { ProductOgCard } from "@/components/seo/ProductOgCard";
import { getProductSeoData } from "@/lib/products/getProductSeoData";
import { fetchOgImageAsDataUrl } from "@/lib/seo/fetchOgImageAsDataUrl";
import { loadTheallLogoDataUrl } from "@/lib/seo/loadOgLogo";

const size = { width: 1200, height: 630 } as const;

/**
 * 상품 상세 `opengraph-image` / `twitter-image` 공통 ImageResponse.
 */
export async function getProductOpenGraphImageResponse(id: string): Promise<ImageResponse> {
  const logoDataUrl = await loadTheallLogoDataUrl();
  const seo = await getProductSeoData(id);

  if (!seo) {
    return new ImageResponse(
      (
        <BrandOgCard
          title="여행 상품"
          subtitle="더올투어에서 맞춤 여행을 찾아보세요."
          logoDataUrl={logoDataUrl}
        />
      ),
      { ...size },
    );
  }

  let heroDataUrl: string | null = null;
  for (const url of seo.imageCandidates) {
    heroDataUrl = await fetchOgImageAsDataUrl(url);
    if (heroDataUrl) break;
  }

  const themeLine =
    seo.themeNames.length > 0 ? seo.themeNames.slice(0, 3).join(" · ") : null;

  return new ImageResponse(
    (
      <ProductOgCard
        logoDataUrl={logoDataUrl}
        productTitle={seo.name}
        regionLine={seo.regionName}
        themeLine={themeLine}
        summaryLine={seo.ogCardSubtitle}
        priceLabel={seo.priceLabel}
        heroImageDataUrl={heroDataUrl}
      />
    ),
    { ...size },
  );
}

```


---

*통합 문서. 원본 경로는 각 절 상단에 표기. `src/` 변경 후 본문과 차이 날 수 있음. 갱신: `node scripts/build-og-doc.mjs`*
