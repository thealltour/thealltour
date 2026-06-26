import type { ItineraryV2, ItineraryV2Day, ItineraryV2Event } from "@/types/product";
import type { ProductFormState } from "@/types/adminProductForm";
import type { HanatourImportV1, HanatourImportWarning } from "@/types/hanatourImport";

/** Import → Draft 변환 결과 (빈 필드만 채우는 merge용 patch) */
export function hanatourImportToDraft(input: HanatourImportV1): {
  draft: { version: 1; form: Partial<ProductFormState>; savedAt: number };
  warnings: HanatourImportWarning[];
} {
  const warnings: HanatourImportWarning[] = [];
  const form: Partial<ProductFormState> = {};

  if (input.product?.title?.trim()) {
    form.title = input.product.title.trim();
  }
  if (input.product?.nights != null || input.product?.days != null) {
    const n = input.product.nights ?? 0;
    const d = input.product.days ?? 0;
    form.duration = n > 0 || d > 0 ? `${n}박${d}일` : "";
  }
  if (input.product?.regionText?.trim()) {
    const region = input.product.regionText.trim();
    form.theme = region;
    form.category = region;
  }
  if (input.product?.priceText?.trim()) {
    const numMatch = input.product.priceText.replace(/\D/g, "");
    if (numMatch) {
      const num = parseInt(numMatch, 10);
      if (!Number.isNaN(num)) form.price = String(num);
    }
  }

  if (input.source?.url?.trim()) {
    form.product_source_url = input.source.url.trim();
  }

  if (input.media?.heroImageUrl?.trim()) {
    form.image_url = input.media.heroImageUrl.trim();
  }
  if (input.media?.galleryImageUrls?.length) {
    form.images_json = input.media.galleryImageUrls.filter((u) => u?.trim());
  }
  if (input.media?.unassignedImageUrls?.length) {
    warnings.push({
      code: "UNASSIGNED_IMAGES",
      message: `미할당 이미지 ${input.media.unassignedImageUrls.length}장은 draft에 반영되지 않습니다.`,
      path: "media.unassignedImageUrls",
    });
  }

  if (input.itinerary?.days?.length) {
    const days: ItineraryV2Day[] = input.itinerary.days.map((d) => {
      const events: ItineraryV2Event[] = (d.events ?? []).map((ev) => {
        const rawUrls = ev.imageUrls ?? [];
        const absoluteUrls = rawUrls
          .map((u) => u?.trim())
          .filter((u) => u && /^https?:\/\//i.test(u));
        return {
          order: ev.order,
          timeText: ev.timeText?.trim() || undefined,
          heading: ev.title?.trim() ?? "",
          description: ev.descriptionText?.trim() || undefined,
          iconKey: undefined,
          images:
            absoluteUrls.length > 0
              ? absoluteUrls.map((url, i) => ({
                  url,
                  sortOrder: i,
                  isCover: i === 0,
                  status: "active" as const,
                }))
              : undefined,
        };
      });
      const dayCoverUrl = d.imageUrls?.[0]?.trim();
      return {
        day: d.dayNumber,
        title: d.title?.trim() || undefined,
        dateText: d.dateText?.trim() || undefined,
        coverImageUrl: dayCoverUrl && /^https?:\/\//i.test(dayCoverUrl) ? dayCoverUrl : undefined,
        events,
      };
    });
    form.itinerary_v2_json = { days } satisfies ItineraryV2;
  }

  const draft: { version: 1; form: Partial<ProductFormState>; savedAt: number } = {
    version: 1,
    form,
    savedAt: Date.now(),
  };

  return { draft, warnings };
}

export { mergeDraftOnlyEmpty } from "@/lib/admin/modetourImport/mapToDraft";
