import { asString } from "@/lib/marketing/context/json";
import type { PublicationContext } from "@/lib/marketing/context/types";

export type AiPublicationRow = {
  id?: unknown;
  content_id?: unknown;
  channel?: unknown;
  external_post_id?: unknown;
  external_url?: unknown;
  status?: unknown;
  scheduled_at?: unknown;
  published_at?: unknown;
  last_checked_at?: unknown;
};

export function mapAiPublicationRow(row: AiPublicationRow): PublicationContext | null {
  const id = asString(row.id);
  const contentId = asString(row.content_id);
  const channel = asString(row.channel);
  if (!id || !contentId || !channel) return null;
  return {
    id,
    contentId,
    channel,
    externalPostId: asString(row.external_post_id),
    externalUrl: asString(row.external_url),
    status: asString(row.status) ?? "scheduled",
    scheduledAt: asString(row.scheduled_at),
    publishedAt: asString(row.published_at),
    lastCheckedAt: asString(row.last_checked_at),
  };
}
