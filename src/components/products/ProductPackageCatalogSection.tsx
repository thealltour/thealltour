"use client";

import { useMemo } from "react";
import type { PackageCatalog } from "@/types/product";
import { hasPackageCatalogContent } from "@/lib/admin/packageCatalog";
import { normalizeProductImageUrl } from "@/lib/media/normalizeProductImageUrl";

export type ProductPackageCatalogSectionProps = {
  catalog?: PackageCatalog | null;
};

function CatalogImages({ urls, alt }: { urls: string[]; alt: string }) {
  const images = urls
    .map((url) => normalizeProductImageUrl(url))
    .filter((url) => /^https?:\/\//i.test(url))
    .slice(0, 6);
  if (images.length === 0) return null;
  return (
    <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-3">
      {images.map((url) => (
        <div key={url} className="overflow-hidden rounded-lg bg-slate-100">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={url} alt={alt} className="h-28 w-full object-cover" loading="lazy" />
        </div>
      ))}
    </div>
  );
}

export function ProductPackageCatalogSection({ catalog }: ProductPackageCatalogSectionProps) {
  const data = useMemo(() => catalog ?? null, [catalog]);
  if (!hasPackageCatalogContent(data)) return null;

  const hotels = data?.hotels ?? [];
  const attractions = data?.attractions ?? [];
  const tours = data?.optionalTours ?? [];
  const notes = data?.referenceNotes?.trim() ?? "";

  return (
    <section className="space-y-6" aria-label="패키지 상세 안내">
      {hotels.length > 0 ? (
        <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm ring-1 ring-slate-100/50 md:p-5">
          <h2 className="mb-2 text-lg font-bold text-[var(--primary)]">예정 호텔</h2>
          <p className="mb-3 text-sm text-slate-500">
            출발 전 확정되는 후보 숙소입니다. 실제 투숙 호텔은 일정표에서 확인해 주세요.
          </p>
          <div className="flex flex-wrap gap-2">
            {hotels.map((hotel, index) => (
              <span
                key={`${hotel.name}-${index}`}
                className="rounded-full border border-[var(--border)] bg-[var(--surface)] px-3 py-1.5 text-sm text-[var(--text-primary)]"
              >
                {hotel.name}
              </span>
            ))}
          </div>
        </div>
      ) : null}

      {attractions.length > 0 ? (
        <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm ring-1 ring-slate-100/50 md:p-5">
          <h2 className="mb-4 text-lg font-bold text-[var(--primary)]">관광지 정보</h2>
          <div className="space-y-5">
            {attractions.map((item, index) => (
              <article key={`${item.name}-${index}`}>
                <h3 className="text-base font-semibold text-slate-900">{item.name}</h3>
                {item.description ? (
                  <p className="mt-2 whitespace-pre-wrap break-words text-sm leading-7 text-slate-700">
                    {item.description}
                  </p>
                ) : null}
                <CatalogImages urls={item.imageUrls} alt={item.name} />
              </article>
            ))}
          </div>
        </div>
      ) : null}

      {tours.length > 0 ? (
        <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm ring-1 ring-slate-100/50 md:p-5">
          <h2 className="mb-4 text-lg font-bold text-[var(--primary)]">선택 관광</h2>
          <div className="space-y-5">
            {tours.map((tour, index) => (
              <article key={`${tour.name}-${index}`}>
                <div className="flex flex-wrap items-baseline gap-2">
                  <h3 className="text-base font-semibold text-slate-900">{tour.name}</h3>
                  {tour.included ? (
                    <span className="text-xs font-medium text-emerald-700">상품 포함</span>
                  ) : null}
                </div>
                {tour.priceText ? (
                  <p className="mt-1 text-sm font-medium text-slate-800">{tour.priceText}</p>
                ) : null}
                {tour.description ? (
                  <p className="mt-2 whitespace-pre-wrap break-words text-sm leading-7 text-slate-700">
                    {tour.description}
                  </p>
                ) : null}
                {tour.scheduleText ? (
                  <p className="mt-2 text-sm leading-6 text-slate-600">{tour.scheduleText}</p>
                ) : null}
                {tour.alternativeText ? (
                  <p className="mt-1 text-sm leading-6 text-slate-600">{tour.alternativeText}</p>
                ) : null}
                <CatalogImages urls={tour.imageUrls} alt={tour.name} />
              </article>
            ))}
          </div>
        </div>
      ) : null}

      {notes ? (
        <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm ring-1 ring-slate-100/50 md:p-5">
          <h2 className="mb-3 text-lg font-bold text-[var(--primary)]">참고사항</h2>
          <p className="whitespace-pre-wrap break-words text-sm leading-7 text-slate-700">{notes}</p>
        </div>
      ) : null}
    </section>
  );
}
