import { supabase } from "@/lib/supabase";
import type { Notice } from "@/types/notice";

function mapNotice(row: Record<string, unknown>): Notice {
  return {
    id: String(row.id ?? ""),
    title: String(row.title ?? ""),
    content: String(row.content ?? ""),
    is_published: typeof row.is_published === "boolean" ? row.is_published : true,
    sort_order: typeof row.sort_order === "number" ? row.sort_order : null,
    created_at: typeof row.created_at === "string" ? row.created_at : null,
    updated_at: typeof row.updated_at === "string" ? row.updated_at : null,
  };
}

export async function getPublicNotices() {
  const result = await supabase
    .from("notices")
    .select("*")
    .eq("is_published", true)
    .order("sort_order", { ascending: true, nullsFirst: false })
    .order("created_at", { ascending: false, nullsFirst: false });

  if (result.error) return [] as Notice[];
  return (result.data ?? []).map((row) => mapNotice(row as Record<string, unknown>));
}

export async function getNoticeById(id: string) {
  const result = await supabase
    .from("notices")
    .select("*")
    .eq("id", id)
    .eq("is_published", true)
    .maybeSingle();

  if (result.error || !result.data) return null;
  return mapNotice(result.data as Record<string, unknown>);
}
