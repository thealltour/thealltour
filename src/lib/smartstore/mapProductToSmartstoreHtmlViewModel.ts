import type { Product } from "@/types/product";
import type { ResolvedProductNoticesForDetail } from "@/lib/noticeTemplates";
import { resolveProductDetailBodyFields } from "@/lib/products/resolveProductDetailBodyFields";
import { mapProductToTimelineModel, type TimelineModel } from "@/lib/products/mapProductToTimelineModel";
import { normalizeProductImageUrl } from "@/lib/media/normalizeProductImageUrl";
import { getPrimaryImageUrl, normalizeImageList } from "@/lib/products/images";
import { parseBulletLines } from "@/lib/smartstore/smartstoreHtml.helpers";
import type { SmartstoreHtmlViewModel } from "@/lib/smartstore/smartstoreHtml.types";
import {
  acceptSmartstoreHttpsImageUrl,
  sanitizeSmartstoreUserText,
  sanitizeSmartstoreLines,
} from "@/lib/smartstore/smartstoreHtml.safety";

function formatPriceKR(price?: number): string | undefined {
  if (typeof price !== "number" || !Number.isFinite(price)) return undefined;
  return new Intl.NumberFormat("ko-KR").format(price);
}

function toSmartstoreImageUrl(raw: string): string {
  const normalized = normalizeProductImageUrl(raw.trim());
  return acceptSmartstoreHttpsImageUrl(normalized) ?? "";
}

function refineTimelineForSmartstore(model: TimelineModel): TimelineModel {
  return {
    days: model.days.map((day) => {
      const title = day.title?.trim() ? sanitizeSmartstoreUserText(day.title.trim()) : undefined;
      const dateText = day.dateText?.trim() ? sanitizeSmartstoreUserText(day.dateText.trim()) : undefined;
      const dayImgRaw = day.imageUrl?.trim();
      const dayImg = dayImgRaw ? toSmartstoreImageUrl(dayImgRaw) : "";
      const events = (day.events ?? []).map((ev) => {
        const heading = ev.heading?.trim() ? sanitizeSmartstoreUserText(ev.heading.trim()) : ev.heading;
        const description = ev.description?.trim()
          ? sanitizeSmartstoreUserText(ev.description.trim())
          : ev.description;
        const images = (ev.images ?? [])
          .map((im) => {
            const url = typeof im?.url === "string" ? im.url.trim() : "";
            if (!url) return null;
            const ok = toSmartstoreImageUrl(url);
            if (!ok) return null;
            return { ...im, url: ok };
          })
          .filter((x): x is NonNullable<typeof x> => x != null);
        return {
          ...ev,
          heading,
          description,
          images: images.length > 0 ? images : undefined,
        };
      });
      return {
        ...day,
        title: title || undefined,
        dateText: dateText || undefined,
        imageUrl: dayImg || undefined,
        events,
      };
    }),
  };
}

/**
 * DB Product + 상세와 동일하게 해석된 공지 → 스마트스토어 HTML ViewModel
 * (https 이미지·텍스트 정제는 이 단계에서 수행)
 */
export function mapProductToSmartstoreHtmlViewModel(
  product: Product,
  notices: ResolvedProductNoticesForDetail,
): SmartstoreHtmlViewModel {
  const { resolvedIncludedItems, resolvedExcludedItems, resolvedOptionalTours } =
    resolveProductDetailBodyFields(product);

  const heroRaw = getPrimaryImageUrl(product).trim();
  const heroImageUrl = heroRaw ? toSmartstoreImageUrl(heroRaw) : "";

  const list = normalizeImageList(product.images_json);
  const galleryRaw = list.filter((u) => u.trim() !== heroRaw);
  const galleryImageUrls = galleryRaw
    .map((u) => toSmartstoreImageUrl(u))
    .filter((u): u is string => u.length > 0)
    .slice(0, 4);

  const timelineBase = mapProductToTimelineModel(product);
  const timelineSanitized = refineTimelineForSmartstore(timelineBase);
  const seenGallery = new Set<string>([...galleryImageUrls, heroImageUrl].filter(Boolean));
  const itineraryExtras: string[] = [];
  for (const day of timelineSanitized.days.slice(0, 2)) {
    if (itineraryExtras.length >= 2) break;
    const dayUrl = day.imageUrl?.trim();
    if (dayUrl && !seenGallery.has(dayUrl)) {
      seenGallery.add(dayUrl);
      itineraryExtras.push(dayUrl);
    }
    for (const ev of day.events ?? []) {
      if (itineraryExtras.length >= 2) break;
      const imgs = ev.images ?? [];
      for (const im of imgs) {
        const u = typeof im.url === "string" ? im.url.trim() : "";
        if (u && !seenGallery.has(u)) {
          seenGallery.add(u);
          itineraryExtras.push(u);
          break;
        }
      }
    }
  }

  const allGallery = [...galleryImageUrls, ...itineraryExtras].slice(0, 6);

  const oneLinerRaw =
    product.one_liner?.trim() ||
    product.description?.trim().split(/\n/)[0]?.slice(0, 200) ||
    product.title;
  const oneLiner = sanitizeSmartstoreUserText(oneLinerRaw || "");

  const detailedScheduleText = sanitizeSmartstoreUserText(
    (product.detailed_schedule ?? product.itinerary ?? "").trim(),
  );

  const title = sanitizeSmartstoreUserText(product.title?.trim() || "상품");

  return {
    productId: product.id,
    title: title || "상품",
    oneLiner,
    heroImageUrl,
    galleryImageUrls: allGallery,
    priceText: formatPriceKR(product.price),
    priceMeta: sanitizeSmartstoreUserText(product.price_meta?.trim() || "1인 기준") || "1인 기준",
    durationText: product.duration?.trim()
      ? sanitizeSmartstoreUserText(product.duration.trim()) || undefined
      : undefined,
    regionText: (() => {
      const r = product.theme?.trim() || product.overview_region?.trim();
      if (!r) return undefined;
      const t = sanitizeSmartstoreUserText(r);
      return t || undefined;
    })(),
    categoryText: product.category?.trim()
      ? sanitizeSmartstoreUserText(product.category.trim()) || undefined
      : undefined,
    minDeparturePeopleText: product.min_departure_people?.trim() || undefined,
    fuelIncluded: typeof product.fuel_included === "boolean" ? product.fuel_included : undefined,
    includedLines: sanitizeSmartstoreLines(parseBulletLines(resolvedIncludedItems)),
    excludedLines: sanitizeSmartstoreLines(parseBulletLines(resolvedExcludedItems)),
    optionalLines: sanitizeSmartstoreLines(parseBulletLines(resolvedOptionalTours ?? "")),
    bookingConditionLines: sanitizeSmartstoreLines(parseBulletLines(notices.bookingConditions)),
    bookingNotesLines: sanitizeSmartstoreLines(parseBulletLines(notices.bookingNotes)),
    timeline: timelineSanitized.days.length > 0 ? timelineSanitized : null,
    detailedScheduleText,
  };
}
