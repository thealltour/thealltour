"use client";

import { VenueInfoPills } from "@/components/products/venues/VenueInfoPills";
import { hasVenueInfoItems } from "@/lib/admin/golfCourses";
import type { AttractionInfoItem } from "@/types/product";

export type ProductAttractionInfoSectionProps = {
  attractions: AttractionInfoItem[] | null | undefined;
};

export function ProductAttractionInfoSection({ attractions }: ProductAttractionInfoSectionProps) {
  if (!hasVenueInfoItems(attractions)) return null;

  return (
    <section
      className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm ring-1 ring-slate-100/50 md:p-5"
      aria-label="관광 정보"
      data-testid="product-attraction-info-section"
    >
      <h2 className="mb-4 text-lg font-bold text-[var(--primary)]">관광 정보</h2>
      <VenueInfoPills items={attractions} kindLabel="관광지" />
    </section>
  );
}
