"use client";

import { VenueInfoPills } from "@/components/products/venues/VenueInfoPills";
import { hasVenueInfoItems } from "@/lib/admin/golfCourses";
import type { HotelInfoItem } from "@/types/product";

export type ProductHotelInfoSectionProps = {
  hotels: HotelInfoItem[] | null | undefined;
};

export function ProductHotelInfoSection({ hotels }: ProductHotelInfoSectionProps) {
  if (!hasVenueInfoItems(hotels)) return null;

  return (
    <section
      className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm ring-1 ring-slate-100/50 md:p-5"
      aria-label="호텔 정보"
      data-testid="product-hotel-info-section"
    >
      <h2 className="mb-4 text-lg font-bold text-[var(--primary)]">호텔 정보</h2>
      <VenueInfoPills items={hotels} kindLabel="호텔" />
    </section>
  );
}
