import { asString } from "@/lib/marketing/context/json";
import type { ContentHistoryItem } from "@/lib/marketing/context/types";

export type SiteContentRow = {
  id?: unknown;
  title?: unknown;
  content?: unknown;
  summary?: unknown;
  created_at?: unknown;
  updated_at?: unknown;
  product_id?: unknown;
  slug?: unknown;
  is_published?: unknown;
  is_active?: unknown;
  badge?: unknown;
  main_copy_accent?: unknown;
  main_copy_tail?: unknown;
  sub_description?: unknown;
};

export function mapSiteContentToHistory(
  row: SiteContentRow,
  sourceType: Extract<
    ContentHistoryItem["sourceType"],
    "notice" | "guide" | "flyer_draft" | "home_hero_content" | "home_banner" | "mobile_golf_ad_landing"
  >,
  channel: string,
): ContentHistoryItem | null {
  const id = asString(row.id);
  if (!id) return null;
  const createdAt = asString(row.created_at) ?? asString(row.updated_at);
  return {
    id,
    sourceType,
    sourceId: id,
    channel,
    productId: asString(row.product_id),
    title: asString(row.title),
    body: asString(row.content),
    summary: asString(row.summary),
    publishedAt: null,
    createdAt,
    metadata: {
      slug: asString(row.slug),
      isPublished: row.is_published,
      isActive: row.is_active,
    },
    similarityAvailable: false,
  };
}

export function mapHomeHeroRowToHistory(row: SiteContentRow): ContentHistoryItem | null {
  const titleParts = [asString(row.badge), asString(row.main_copy_accent), asString(row.main_copy_tail)].filter(
    (part): part is string => Boolean(part),
  );
  return mapSiteContentToHistory(
    {
      ...row,
      title: titleParts.join(" ") || row.title,
      content: asString(row.sub_description) ?? row.content,
    },
    "home_hero_content",
    "home",
  );
}
