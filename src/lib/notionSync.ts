import { supabase } from "@/lib/supabase";
import type { Guide } from "@/types/guide";
import { extractNotionPageId, fetchNotionPageMeta } from "@/lib/notion";

export async function syncGuideFromNotion(guideId: string): Promise<Guide | null> {
  const { data: guideRow, error } = await supabase
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
  let notionTitle = "";
  const properties = page.properties ?? {};
  for (const value of Object.values(properties) as any[]) {
    if (value?.type === "title" && Array.isArray(value.title) && value.title[0]?.plain_text) {
      notionTitle = value.title.map((t: any) => t.plain_text).join("") ?? "";
      break;
    }
  }

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

  const { data: updated, error: updateError } = await supabase
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
  const { data, error } = await supabase
    .from("guides")
    .select("*")
    .eq("slug", slug)
    .maybeSingle();

  if (error || !data) return null;
  return data as unknown as Guide;
}

