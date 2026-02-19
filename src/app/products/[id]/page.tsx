import Image from "next/image";
import Link from "next/link";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import ProductDetailTabs from "@/components/ProductDetailTabs";
import { getProductById } from "@/lib/products";
import { getTermsTemplateContent } from "@/lib/termsTemplates";

type ProductDetailPageProps = {
  params: Promise<{ id: string }>;
};

function buildSeoDescription(input: string) {
  return input.replace(/\s+/g, " ").trim().slice(0, 155);
}

export async function generateMetadata({ params }: ProductDetailPageProps): Promise<Metadata> {
  const { id } = await params;
  const product = await getProductById(id);

  if (!product) {
    return {
      title: "패키지상품 | 더올투어",
      description: "더올투어 패키지상품 정보를 확인해 보세요.",
    };
  }

  const title = product.meta_title?.trim() || `${product.title} | ${product.category} 패키지 | 더올투어`;
  const description =
    product.meta_description?.trim() ||
    buildSeoDescription(
      `${product.title} ${product.category} ${product.theme ?? ""} ${product.description} 더올투어 맞춤 여행 상담 가능`,
    );

  return {
    title,
    description,
    openGraph: {
      title,
      description,
      images: [{ url: product.image_url }],
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

function hasFlightCardData(flight: FlightCardData) {
  return Boolean(
    flight.fromAirport?.trim() ||
      flight.fromDate?.trim() ||
      flight.fromTime?.trim() ||
      flight.toAirport?.trim() ||
      flight.toDate?.trim() ||
      flight.toTime?.trim() ||
      flight.flightName?.trim(),
  );
}

function renderFlightCard(title: string, flight: FlightCardData) {
  if (!hasFlightCardData(flight)) return null;

  return (
    <article className="rounded-2xl border border-[#dbeafe] bg-white px-5 py-4 shadow-sm">
      <p className="mb-3 text-xs font-semibold text-[#1d4ed8]">{title}</p>
      <div className="grid gap-3 md:grid-cols-[1fr_auto_1fr] md:items-center">
        <div className="space-y-1">
          <p className="text-xl font-extrabold text-[#0f172a]">{flight.fromAirport || "-"}</p>
          <p className="text-sm text-slate-600">{flight.fromDate || "-"}</p>
          <p className="text-3xl font-black tracking-tight text-[#0f172a]">{flight.fromTime || "-"}</p>
        </div>
        <div className="flex min-w-[190px] flex-col items-center gap-1 text-center">
          <p className="text-sm font-semibold text-slate-700">{flight.flightName || "항공편"}</p>
          <div className="w-full px-1">
            <div className="h-[2px] w-full bg-slate-300" />
          </div>
        </div>
        <div className="space-y-1 text-left md:text-right">
          <p className="text-xl font-extrabold text-[#0f172a]">{flight.toAirport || "-"}</p>
          <p className="text-sm text-slate-600">{flight.toDate || "-"}</p>
          <p className="text-3xl font-black tracking-tight text-[#0f172a]">{flight.toTime || "-"}</p>
        </div>
      </div>
    </article>
  );
}

export default async function ProductDetailPage({ params }: ProductDetailPageProps) {
  const { id } = await params;
  const product = await getProductById(id);

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
  const quoteHref = {
    pathname: "/quote",
    query: {
      product_id: product.id,
      product_title: product.title,
      source_path: `/products/${product.id}`,
    },
  };

  return (
    <div className="min-h-screen bg-gradient-to-b from-[#f3f8ff] to-white px-6 py-10 pb-28 md:px-10">
      <main className="mx-auto w-full max-w-5xl space-y-8">
        <div className="flex items-center justify-between">
          <Link
            href="/products"
            className="rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700 transition hover:bg-slate-50"
          >
            ← 상품 목록으로
          </Link>
          <Link
            href={quoteHref}
            className="rounded-lg bg-[#2563eb] px-4 py-2 text-sm font-semibold text-white transition hover:bg-[#1d4ed8]"
          >
            이 상품 문의하기
          </Link>
        </div>

        <section className="overflow-hidden rounded-3xl bg-white shadow-md ring-1 ring-[#dbeafe]">
          <Image
            src={product.image_url}
            alt={`${product.title} 상세 이미지`}
            width={1400}
            height={900}
            sizes="(max-width: 1024px) 100vw, 1024px"
            priority
            className="h-[340px] w-full object-cover md:h-[460px]"
          />
          <div className="space-y-5 p-6 md:p-8">
            <span className="inline-block rounded-full bg-[#eff6ff] px-3 py-1 text-xs font-semibold text-[#1d4ed8]">
              {product.category}
            </span>
            <h1 className="text-3xl font-bold text-[#0f172a] md:text-4xl">{product.title}</h1>
            <p className="whitespace-pre-line text-sm leading-7 text-slate-600 md:text-base">
              {product.description}
            </p>
            <div className="flex flex-wrap gap-3 pt-1">
              {formattedPrice ? (
                <span className="rounded-lg bg-[#eff6ff] px-3 py-2 text-sm font-semibold text-[#1e3a8a]">
                  예상가 {formattedPrice}원
                </span>
              ) : null}
              {product.duration ? (
                <span className="rounded-lg bg-[#f8fafc] px-3 py-2 text-sm font-medium text-slate-700 ring-1 ring-slate-200">
                  일정 {product.duration}
                </span>
              ) : null}
              <span className="rounded-lg bg-[#f0fdf4] px-3 py-2 text-sm font-medium text-emerald-700 ring-1 ring-emerald-200">
                상담 후 최종 견적 확정
              </span>
            </div>
            <div className="rounded-xl bg-[#f8fbff] p-4 ring-1 ring-[#dbeafe]">
              <h2 className="mb-2 text-lg font-bold text-[#1e3a8a]">상담 안내</h2>
              <p className="text-sm leading-7 text-slate-700">
                문의를 남겨주시면 일정/예산/동행구성에 맞춰 맞춤 동선과 견적 옵션을 안내드립니다.
              </p>
            </div>
            {renderFlightCard("출발 항공편", departureFlight)}
            {renderFlightCard("도착 항공편", arrivalFlight)}

            <ProductDetailTabs
              pointBenefits={product.point_benefits}
              pointTourism={product.point_tourism}
              pointGuide={product.point_guide}
              meetingInfo={product.meeting_info}
              travelInsurance={product.travel_insurance}
              includedItems={resolvedIncludedItems}
              excludedItems={resolvedExcludedItems}
              detailedSchedule={product.detailed_schedule ?? product.itinerary}
              optionalTours={resolvedOptionalTours}
              termsAndNotes={resolvedTermsAndNotes}
            />
          </div>
        </section>
      </main>
      <div className="fixed inset-x-0 bottom-0 z-30 border-t border-slate-200 bg-white/95 p-3 backdrop-blur md:hidden">
        <Link
          href={quoteHref}
          className="flex w-full items-center justify-center rounded-xl bg-[#1d4ed8] px-4 py-3 text-sm font-semibold text-white"
        >
          이 상품 바로 상담하기
        </Link>
      </div>
    </div>
  );
}
