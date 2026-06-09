import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";
import ProductDetailV2 from "@/components/products/ProductDetailV2";
import { getProductById } from "@/lib/products";
import { getSiteSettings } from "@/lib/siteSettings";
import { resolveProductNoticesForDetailPage } from "@/lib/noticeTemplates";

type DevProductDetailPageProps = {
  params: Promise<{ id: string }>;
};

function formatPrice(price?: number): string | null {
  if (typeof price !== "number") return null;
  return new Intl.NumberFormat("ko-KR").format(price);
}

export default async function DevProductDetailPage({ params }: DevProductDetailPageProps) {
  const { id } = await params;
  const product = await getProductById(id);

  if (!product) {
    notFound();
  }

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
  const {
    bookingNotes: resolvedBookingNotes,
    travelNotes: resolvedTravelNotes,
    bookingConditions: resolvedBookingConditions,
    refundPolicy: resolvedRefundPolicy,
  } = await resolveProductNoticesForDetailPage(product);
  const settings = await getSiteSettings();
  const kakaoHref = settings.kakao_chat_url || settings.kakao_channel_url || "https://pf.kakao.com";
  const formattedPrice = formatPrice(product.price);
  const oneLiner = product.description?.trim().split(/\n/)[0]?.slice(0, 200) ?? product.title;

  return (
    <div className="min-h-screen bg-gradient-to-b from-[#f3f8ff] to-white px-6 py-10 md:px-10">
      <main className="mx-auto w-full max-w-6xl">
        <div className="mb-6">
          <Link
            href="/products"
            className="inline-flex items-center gap-1 rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700 transition hover:bg-slate-50"
          >
            ← 상품 목록
          </Link>
          <span className="ml-3 text-sm text-slate-500">|</span>
          <Link
            href={`/products/${id}`}
            className="ml-3 text-sm font-medium text-slate-600 underline hover:text-slate-800"
          >
            기존 상세 페이지
          </Link>
        </div>

        <section className="overflow-hidden rounded-3xl bg-white shadow-md ring-1 ring-[#dbeafe]">
          <div className="relative h-[280px] w-full md:h-[380px]">
            <Image
              src={product.image_url}
              alt={`${product.title} 상세 이미지`}
              fill
              sizes="(max-width: 1024px) 100vw, 1024px"
              className="object-cover"
              priority
            />
          </div>
          <div className="p-6 md:p-8">
            <p className="mb-4 text-xs font-medium text-slate-500">ProductDetailV2 데모 (기존 상세 변경 없음)</p>
            <ProductDetailV2
              title={product.title}
              region={product.theme}
              category={product.category}
              statusTag="AVAILABLE"
              oneLiner={oneLiner}
              priceFormatted={formattedPrice}
              duration={product.duration}
              priceMeta="1인 기준"
              includedItems={resolvedIncludedItems ?? ""}
              excludedItems={resolvedExcludedItems ?? ""}
              detailedSchedule={product.detailed_schedule ?? product.itinerary ?? ""}
              optionalTours={resolvedOptionalTours ?? ""}
              minDeparturePeople={product.min_departure_people ?? ""}
              bookingNotes={resolvedBookingNotes}
              travelNotes={resolvedTravelNotes}
              bookingConditions={resolvedBookingConditions}
              refundPolicy={resolvedRefundPolicy}
              consultHref={`/quote?product_id=${encodeURIComponent(product.id)}`}
              kakaoHref={kakaoHref}
              options={product.options}
              basePrice={product.price}
              product={product}
              overviewFallbackUrl={product.image_url}
            />
          </div>
        </section>
      </main>
    </div>
  );
}
