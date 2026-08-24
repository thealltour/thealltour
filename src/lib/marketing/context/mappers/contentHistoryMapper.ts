import { asRecord, asString } from "@/lib/marketing/context/json";
import type { ContentHistoryItem } from "@/lib/marketing/context/types";

export type ThreadMarketingPostRow = {
  id?: unknown;
  product_id?: unknown;
  published_at?: unknown;
  created_at?: unknown;
  permalink?: unknown;
  target_keyword?: unknown;
  media_id?: unknown;
};

export type AiContentRow = {
  id?: unknown;
  campaign_id?: unknown;
  agenda_id?: unknown;
  primary_product_id?: unknown;
  title?: unknown;
  body?: unknown;
  hook?: unknown;
  created_at?: unknown;
  content_type?: unknown;
  status?: unknown;
};

export function mapThreadMarketingPostToHistory(row: ThreadMarketingPostRow): ContentHistoryItem | null {
  const id = asString(row.id);
  if (!id) return null;
  return {
    id,
    sourceType: "thread_marketing_post",
    sourceId: id,
    channel: "threads",
    productId: asString(row.product_id),
    title: asString(row.target_keyword),
    body: null,
    summary: null,
    publishedAt: asString(row.published_at),
    createdAt: asString(row.created_at),
    metadata: {
      permalink: asString(row.permalink),
      mediaId: asString(row.media_id),
    },
    similarityAvailable: false,
  };
}

export function mapAiContentToHistory(row: AiContentRow): ContentHistoryItem | null {
  const id = asString(row.id);
  if (!id) return null;
  return {
    id,
    sourceType: "ai_content",
    sourceId: id,
    channel: null,
    productId: asString(row.primary_product_id),
    title: asString(row.title),
    body: asString(row.body),
    summary: asString(row.hook),
    publishedAt: null,
    createdAt: asString(row.created_at),
    metadata: asRecord({
      contentType: asString(row.content_type),
      status: asString(row.status),
      campaignId: asString(row.campaign_id),
      agendaId: asString(row.agenda_id),
    }),
    similarityAvailable: false,
  };
}
