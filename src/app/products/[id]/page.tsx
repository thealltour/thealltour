import Image from "next/image";
import Link from "next/link";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import ProductDetailContentLegacy from "@/components/ProductDetailContentLegacy";
import ProductDetailHero from "@/components/ProductDetailHero";
import ProductDetailTabs from "@/components/ProductDetailTabs";
import ProductDetailV2 from "@/components/products/ProductDetailV2";
import {
  ProductDetailStickyDesktop,
  ProductDetailStickyMobile,
} from "@/components/ProductDetailSticky";
import {
  ProductDetailStickyV2Desktop,
  ProductDetailStickyV2Mobile,
} from "@/components/products/ProductDetailStickyV2";
import { ProductQuoteProvider } from "@/components/products/ProductQuoteContext";
import AlertCard from "@/components/ui/AlertCard";
import { ConsultModalProvider } from "@/components/ConsultModal";
import { ENABLE_NEW_PRODUCT_UI } from "@/config/featureFlags";
import { getProductByIdFresh } from "@/lib/products";
import { getSiteSettings } from "@/lib/siteSettings";
import { normalizeProductImageUrl } from "@/lib/media/normalizeProductImageUrl";
import { getTermsTemplateContent } from "@/lib/termsTemplates";

type ProductDetailPageProps = {
  params: Promise<{ id: string }>;
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

export default async function ProductDetailPage({ params }: ProductDetailPageProps) {
  const { id } = await params;
  const product = await getProductByIdFresh(id);

  if (!product) {
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
  const productJsonLd = {
    "@context": "https://schema.org",
    "@type": "Product",
    name: product.title,
    description: buildSeoDescription(product.description),
    image: [productImageUrl],
    category: product.category,
    brand: {
      "@type": "Brand",
      name: "더올투어",
    },
    url: productUrl,
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

  if (!ENABLE_NEW_PRODUCT_UI) {
    return (
      <ProductDetailContentLegacy
        productId={product.id}
        title={product.title}
        description={product.description}
        imageUrl={product.image_url}
        imageAlt={`${product.title} 상세 이미지`}
        category={product.category}
        theme={product.theme}
        price={product.price}
        duration={product.duration}
        metaTitle={product.meta_title}
        pointBenefits={product.point_benefits}
        pointTourism={product.point_tourism}
        pointGuide={product.point_guide}
        meetingInfo={product.meeting_info}
        travelInsurance={product.travel_insurance}
        includedItems={resolvedIncludedItems ?? ""}
        excludedItems={resolvedExcludedItems ?? ""}
        detailedSchedule={product.detailed_schedule ?? product.itinerary ?? ""}
        optionalTours={resolvedOptionalTours ?? ""}
        minDeparturePeople={product.min_departure_people ?? ""}
        termsAndNotes={resolvedTermsAndNotes ?? ""}
        departureFlight={departureFlight}
        arrivalFlight={arrivalFlight}
        kakaoHref={kakaoHref}
      />
    );
  }

  const statusV2 = product.status ?? "AVAILABLE";
  const oneLiner =
    product.one_liner?.trim() ||
    product.description?.trim().split(/\n/)[0]?.slice(0, 200) ||
    product.title;

  return (
    <ConsultModalProvider>
      <ProductQuoteProvider>
      <div className="min-h-screen bg-gradient-to-b from-[#f3f8ff] to-white px-6 py-10 pb-28 md:px-10">
        <main className="mx-auto w-full max-w-6xl">
          <div className="mb-6">
            <Link
              href="/products"
              className="inline-flex items-center gap-1 rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700 transition hover:bg-slate-50"
            >
              ← 상품 목록으로
            </Link>
          </div>

          <div className="flex gap-8 lg:items-start">
            <div className="min-w-0 flex-1 space-y-6">
              <section className="overflow-hidden rounded-3xl bg-white shadow-md ring-1 ring-[#dbeafe]">
                <script
                  type="application/ld+json"
                  dangerouslySetInnerHTML={{ __html: JSON.stringify(productJsonLd) }}
                />
                <div className="p-6 md:p-8">
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
                  />
                </div>
              </section>

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
            />
          </div>
        </main>

        <ProductDetailStickyV2Mobile
          priceFormatted={formattedPrice}
          productId={product.id}
          productTitle={product.title}
          sourcePath={sourcePath}
          kakaoHref={kakaoHref}
          status={statusV2}
          trust={product.trust}
        />
      </div>
      </ProductQuoteProvider>
    </ConsultModalProvider>
  );
}
