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
import { formatPriceKR as formatPriceKRCanonical } from "@/lib/pricing/calcQuote";

function formatPriceKR(price?: number): string | undefined {
  return formatPriceKRCanonical(price) ?? undefined;
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
        const thumbnailRaw = ev.thumbnailUrl?.trim();
        const thumbnailUrl = thumbnailRaw ? toSmartstoreImageUrl(thumbnailRaw) : "";
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
          thumbnailUrl: thumbnailUrl || undefined,
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

function detectConcept(product: Product): SmartstoreHtmlViewModel["concept"] {
  const text = [
    product.title,
    ...(product.tags ?? []),
    ...(product.highlights ?? []),
    product.category,
    product.theme,
    product.description,
    product.one_liner,
    product.meta_title,
    product.meta_description,
    product.overview_region,
    product.travelStyle,
  ]
    .filter((value): value is string => typeof value === "string" && value.trim().length > 0)
    .join(" ")
    .toLowerCase();

  const includesAny = (keywords: string[]) => keywords.some((keyword) => text.includes(keyword));

  if (
    includesAny(["골프", "라운딩", "라운드", "cc", "컨트리클럽", "티오프", "tee", "fairway"])
  ) {
    return "골프";
  }
  if (
    includesAny(["효도", "부모님", "어르신", "시니어", "50대", "60대", "70대", "가정의 달"])
  ) {
    return "효도여행";
  }
  if (includesAny(["가족", "아이", "아동", "어린이", "키즈", "3대", "동반"])) {
    return "가족여행";
  }
  if (includesAny(["휴양", "리조트", "풀빌라", "호캉스", "해변", "비치", "스파", "마사지"])) {
    return "휴양";
  }

  return "일반";
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
  const allGallery = [...galleryImageUrls].slice(0, 4);

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
    concept: detectConcept(product),
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
