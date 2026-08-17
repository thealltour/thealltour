import "server-only";

import { supabaseAdmin } from "@/lib/supabaseAdmin";
import type { Guide } from "@/types/guide";
import { extractNotionPageId, fetchNotionPageMeta } from "@/lib/notion";
import { extractNotionCoverUrl as extractNotionCoverUrlOrUndefined, extractNotionTitleFromProperties } from "@/lib/notion/types";
import { uploadImageFromUrl } from "@/lib/images/uploadImageFromUrl";
import { isLikelySignedNotionImageUrl } from "@/lib/guides/imageUrl";

/** notion/types.ts의 공용 헬퍼는 `undefined`를 반환하므로, 이 파일의 기존 `null` 반환 계약에 맞춰 얇게 래핑 */
function extractNotionCoverUrl(pageMeta: Parameters<typeof extractNotionCoverUrlOrUndefined>[0]): string | null {
  return extractNotionCoverUrlOrUndefined(pageMeta)?.trim() || null;
}

function isStableUrl(value?: string | null): boolean {
  const raw = value?.trim();
  if (!raw) return false;
  return !isLikelySignedNotionImageUrl(raw);
}

export async function syncGuideFromNotion(guideId: string): Promise<Guide | null> {
  const { data: guideRow, error } = await supabaseAdmin
    .from("guides")
    .select("*")
    .eq("id", guideId)
    .maybeSingle();

  if (error || !guideRow) {
    return null;
  }

  const notionUrl = (guideRow.notion_url as string | null) ?? null;
  const notionPageId =
    (guideRow.notion_page_id as string | null) ?? (notionUrl ? extractNotionPageId(notionUrl) : null);

  if (!notionPageId) {
    return null;
  }

  const page = await fetchNotionPageMeta(notionPageId);
  const lastEdited = page.last_edited_time ? new Date(page.last_edited_time) : null;

  // Notion 기본 title 추출 (title 속성 또는 페이지 아이콘 제목 등)
  const notionTitle = extractNotionTitleFromProperties(page.properties);

  const updates: Record<string, unknown> = {
    notion_page_id: notionPageId,
    last_synced_at: new Date().toISOString(),
  };

  if (lastEdited) {
    updates.notion_last_edited_time = lastEdited.toISOString();
  }

  if (!guideRow.title_override && notionTitle) {
    updates.title_override = notionTitle;
  }

  const notionCoverUrl = extractNotionCoverUrl(page);
  const currentCoverUrl =
    typeof guideRow.cover_image_url === "string" ? guideRow.cover_image_url.trim() : "";
  const shouldMirrorNotionCover = Boolean(notionCoverUrl && !isStableUrl(currentCoverUrl));

  if (shouldMirrorNotionCover && notionCoverUrl) {
    const mirrored = await uploadImageFromUrl(notionCoverUrl);
    if (mirrored.success) {
      updates.cover_image_url = mirrored.url;
    } else if (!currentCoverUrl) {
      // 업로드 실패 시에도 노션 커버를 마지막 폴백으로 보존
      updates.cover_image_url = notionCoverUrl;
    }
  } else if (!currentCoverUrl && notionCoverUrl) {
    updates.cover_image_url = notionCoverUrl;
  }

  const { data: updated, error: updateError } = await supabaseAdmin
    .from("guides")
    .update(updates)
    .eq("id", guideId)
    .select("*")
    .maybeSingle();

  if (updateError || !updated) {
    return null;
  }

  return updated as unknown as Guide;
}

export async function getGuideBySlug(slug: string): Promise<Guide | null> {
  const { data, error } = await supabaseAdmin
    .from("guides")
    .select("*")
    .eq("slug", slug)
    .maybeSingle();

  if (error || !data) return null;
  return data as unknown as Guide;
}

