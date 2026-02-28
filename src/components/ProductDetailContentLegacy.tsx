"use client";

import Image from "next/image";
import Link from "next/link";
import ProductDetailTabsLegacy from "@/components/ProductDetailTabsLegacy";
import AlertCard from "@/components/ui/AlertCard";

export type FlightCardData = {
  fromAirport?: string;
  fromDate?: string;
  fromTime?: string;
  toAirport?: string;
  toDate?: string;
  toTime?: string;
  flightName?: string;
};

function hasFlightCardData(flight: FlightCardData): boolean {
  return Boolean(
    flight.fromAirport?.trim() ||
      flight.fromDate?.trim() ||
      flight.fromTime?.trim() ||
      flight.toAirport?.trim() ||
      flight.toDate?.trim() ||
      flight.toTime?.trim() ||
      flight.flightName?.trim()
  );
}

function renderFlightCard(title: string, flight: FlightCardData) {
  if (!hasFlightCardData(flight)) return null;
  return (
    <article className="rounded-2xl border border-[#dbeafe] bg-white px-5 py-4 shadow-sm">
      <p className="mb-3 text-xs font-semibold text-[#1d4ed8]">{title}</p>
      <div className="grid gap-3 md:grid-cols-[1fr_auto_1fr] md:items-center">
        <div className="space-y-1">
          <p className="text-xl font-extrabold text-[#0f172a]">{flight.fromAirport ?? "-"}</p>
          <p className="text-sm text-slate-600">{flight.fromDate ?? "-"}</p>
          <p className="text-3xl font-black tracking-tight text-[#0f172a]">{flight.fromTime ?? "-"}</p>
        </div>
        <div className="flex min-w-[190px] flex-col items-center gap-1 text-center">
          <p className="text-sm font-semibold text-slate-700">{flight.flightName ?? "항공편"}</p>
          <div className="w-full px-1">
            <div className="h-[2px] w-full bg-slate-300" />
          </div>
        </div>
        <div className="space-y-1 text-left md:text-right">
          <p className="text-xl font-extrabold text-[#0f172a]">{flight.toAirport ?? "-"}</p>
          <p className="text-sm text-slate-600">{flight.toDate ?? "-"}</p>
          <p className="text-3xl font-black tracking-tight text-[#0f172a]">{flight.toTime ?? "-"}</p>
        </div>
      </div>
    </article>
  );
}

function formatPrice(price?: number): string | null {
  if (typeof price !== "number") return null;
  return new Intl.NumberFormat("ko-KR").format(price);
}

function parseMetaTitleAsHashtags(metaTitle?: string): string[] {
  if (!metaTitle?.trim()) return [];
  return metaTitle
    .trim()
    .split(/\s+/)
    .map((s) => s.trim())
    .filter((s) => s.length > 0);
}

export type ProductDetailContentLegacyProps = {
  productId: string;
  title?: string;
  description?: string;
  imageUrl?: string;
  imageAlt?: string;
  category?: string;
  theme?: string;
  price?: number;
  duration?: string;
  metaTitle?: string;
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
  departureFlight?: FlightCardData;
  arrivalFlight?: FlightCardData;
  kakaoHref?: string;
};

export default function ProductDetailContentLegacy({
  productId,
  title = "",
  description = "",
  imageUrl = "",
  imageAlt,
  category = "",
  theme = "",
  price,
  duration = "",
  metaTitle = "",
  pointBenefits = "",
  pointTourism = "",
  pointGuide = "",
  meetingInfo = "",
  travelInsurance = "",
  includedItems = "",
  excludedItems = "",
  detailedSchedule = "",
  optionalTours = "",
  minDeparturePeople = "",
  termsAndNotes = "",
  departureFlight = {},
  arrivalFlight = {},
  kakaoHref = "https://pf.kakao.com",
}: ProductDetailContentLegacyProps) {
  const formattedPrice = formatPrice(price);
  const hashtags = parseMetaTitleAsHashtags(metaTitle);
  const shortDescription = description?.trim().split(/\n/)[0]?.slice(0, 200) ?? title;

  return (
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

        <div className="space-y-6">
          <section className="overflow-hidden rounded-3xl bg-white shadow-md ring-1 ring-[#dbeafe]">
            <div className="relative h-[340px] w-full md:h-[460px]">
              <Image
                src={imageUrl || "/thealltour-logo.png"}
                alt={imageAlt ?? `${title || "상품"} 상세 이미지`}
                fill
                sizes="(max-width: 1024px) 100vw, 1024px"
                className="object-cover"
                priority
              />
            </div>
            <div className="p-6 md:p-8">
              <div className="flex flex-wrap items-center gap-2">
                {category ? (
                  <span className="inline-flex items-center rounded-full bg-[#eff6ff] px-3 py-1 text-xs font-semibold text-[#1e3a8a] ring-1 ring-[#dbeafe]">
                    {category}
                  </span>
                ) : null}
                {theme ? (
                  <span className="inline-flex items-center rounded-full bg-slate-100 px-3 py-1 text-xs font-medium text-slate-600">
                    {theme}
                  </span>
                ) : null}
                {hashtags.map((tag) => (
                  <span
                    key={tag}
                    className="inline-flex items-center rounded-full bg-slate-100 px-3 py-1 text-xs text-slate-600"
                  >
                    #{tag}
                  </span>
                ))}
              </div>
              <h1 className="mt-4 font-card-title text-2xl font-bold leading-tight text-[#0f172a] md:text-3xl">
                {title || "상품명"}
              </h1>
              <p className="mt-2 line-clamp-2 text-sm leading-relaxed text-slate-600 md:text-base">
                {shortDescription}
              </p>
              <div className="mt-4 rounded-2xl border border-[#dbeafe] bg-[#f8fbff] p-4 ring-1 ring-[#dbeafe]">
                {formattedPrice ? (
                  <p className="font-price-strong text-xl font-bold text-[#1e3a8a] md:text-2xl">
                    ₩{formattedPrice}~
                  </p>
                ) : (
                  <p className="font-price-strong text-xl font-semibold text-slate-600 md:text-2xl">
                    상담 후 견적 안내
                  </p>
                )}
                <p className="mt-1 text-xs text-slate-500">1인 기준 · 유류할증료는 상담 시 안내</p>
              </div>
              <div className="mt-4 flex flex-wrap gap-3">
                <Link
                  href={`/quote?productId=${encodeURIComponent(productId)}`}
                  className="inline-flex items-center justify-center rounded-xl bg-[#1e3a8a] px-5 py-3 text-sm font-semibold text-white shadow-md transition hover:bg-[#1d4ed8] hover:shadow-lg"
                >
                  견적 문의하기
                </Link>
                <a
                  href={kakaoHref}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center justify-center rounded-xl border border-[#d9e1ec] bg-white px-5 py-3 text-sm font-medium text-slate-700 transition hover:bg-slate-50"
                >
                  카톡 상담
                </a>
              </div>
            </div>
          </section>

          <AlertCard variant="info" title="상담 안내">
            문의를 남겨주시면 일정/예산/동행구성에 맞춰 맞춤 동선과 견적 옵션을 안내드립니다.
          </AlertCard>

          {renderFlightCard("출발 항공편", departureFlight)}
          {renderFlightCard("도착 항공편", arrivalFlight)}

          <ProductDetailTabsLegacy
            pointBenefits={pointBenefits}
            pointTourism={pointTourism}
            pointGuide={pointGuide}
            meetingInfo={meetingInfo}
            travelInsurance={travelInsurance}
            includedItems={includedItems}
            excludedItems={excludedItems}
            detailedSchedule={detailedSchedule}
            optionalTours={optionalTours}
            minDeparturePeople={minDeparturePeople}
            termsAndNotes={termsAndNotes}
          />

          <section className="rounded-2xl border border-[#dbeafe] bg-[#f8fbff] p-6 text-center ring-1 ring-[#dbeafe]">
            <p className="mb-4 text-sm text-slate-600">
              일정·인원에 맞는 맞춤 견적이 필요하시면 견적 문의를 이용해 주세요.
            </p>
            <Link
              href={`/quote?productId=${encodeURIComponent(productId)}`}
              className="inline-flex items-center justify-center rounded-xl bg-[#1e3a8a] px-6 py-3 text-sm font-semibold text-white shadow-md transition hover:bg-[#1d4ed8] hover:shadow-lg"
            >
              견적 문의하기
            </Link>
          </section>
        </div>
      </main>
    </div>
  );
}
