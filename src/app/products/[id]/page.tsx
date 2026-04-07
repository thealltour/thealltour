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
