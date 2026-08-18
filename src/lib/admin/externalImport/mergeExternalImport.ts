import type { ExternalParsedProduct } from "@/lib/admin/externalImport/externalProductSchema";
import type { ExternalParsedMeta } from "@/lib/admin/externalImport/externalProductMetaSchema";
import type { ItineraryBlock } from "@/lib/admin/externalImport/itineraryBlockTypes";
import { enrichAiItineraryWithBlocks } from "@/lib/admin/externalImport/enrichItineraryWithBlocks";
import { mapExternalItineraryToV2 } from "@/lib/admin/externalImport/mapExternalItineraryToV2";
import { hasRichItineraryBlocks } from "@/lib/admin/externalImport/mapExternalItineraryToV2";
import type { ExternalParsedItineraryV2 } from "@/lib/admin/externalImport/externalProductSchema";
import type { ItineraryV2 } from "@/types/product";
import { normalizeSeoMetaTitleKeywords } from "@/lib/products/seoMetaTitleAi";
import { trimOrNull } from "@/lib/admin/stringHelpers";
import type { ThemeChartJson } from "@/lib/admin/themeChartSchema";

export type MergeExternalImportInput = {
  meta: ExternalParsedMeta;
  productGalleryUrls?: string[];
  heroImageUrl?: string | null;
  sourceProductTitle?: string | null;
  seoHashtags?: string[];
  itineraryBlocks?: ItineraryBlock[];
  aiItineraryFallback?: ExternalParsedItineraryV2 | null;
  theme_chart_json?: ThemeChartJson | null;
};

function normalizeGalleryUrls(
  productGalleryUrls: string[] | undefined,
  heroImageUrl: string | null | undefined,
  max = 10,
): { imageUrl: string | null; imagesJson: string[] | null } {
  const seen = new Set<string>();
  const out: string[] = [];

  const push = (raw: string | null | undefined) => {
    const trimmed = raw?.trim();
    if (!trimmed || trimmed.startsWith("data:") || seen.has(trimmed)) return;
    if (/logo|icon|banner|spinner|arrow|badge/i.test(trimmed)) return;
    seen.add(trimmed);
    out.push(trimmed);
  };

  push(heroImageUrl);
  for (const url of productGalleryUrls ?? []) {
    push(url);
    if (out.length >= max) break;
  }

  if (out.length === 0) return { imageUrl: null, imagesJson: null };
  return { imageUrl: out[0], imagesJson: out.slice(0, max) };
}

export function mergeExternalImport(input: MergeExternalImportInput): ExternalParsedProduct {
  const {
    meta,
    productGalleryUrls,
    heroImageUrl,
    sourceProductTitle,
    seoHashtags,
    itineraryBlocks,
    aiItineraryFallback,
    theme_chart_json,
  } = input;

  const gallery = normalizeGalleryUrls(productGalleryUrls, heroImageUrl);

  let itineraryV2: ItineraryV2 | null = null;
  const aiMapped = mapExternalItineraryToV2(aiItineraryFallback);
  if (itineraryBlocks?.length && hasRichItineraryBlocks(itineraryBlocks)) {
    itineraryV2 = enrichAiItineraryWithBlocks(aiItineraryFallback, itineraryBlocks) ?? aiMapped;
  } else if (aiMapped) {
    itineraryV2 = aiMapped;
  }

  const domMetaTitle = normalizeSeoMetaTitleKeywords(seoHashtags);
  const aiMetaTitle = normalizeSeoMetaTitleKeywords(meta.seo_hashtags ?? undefined);

  return {
    ...meta,
    title: trimOrNull(sourceProductTitle) ?? meta.title,
    meta_title: domMetaTitle ?? aiMetaTitle ?? null,
    itinerary_v2_json: itineraryV2 as ExternalParsedProduct["itinerary_v2_json"],
    theme_chart_json: theme_chart_json ?? null,
    image_url: gallery.imageUrl,
    images_json: gallery.imagesJson,
  };
}

export function countGalleryUrls(parsed: ExternalParsedProduct): number {
  return parsed.images_json?.length ?? (parsed.image_url ? 1 : 0);
}
