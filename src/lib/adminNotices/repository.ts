import "server-only";

import { supabaseAdmin } from "@/lib/supabaseAdmin";
import type { Notice } from "@/types/notice";

export type NoticeWriteInput = {
  title?: string;
  content?: string;
  is_published?: boolean;
  sort_order?: number | null;
};

export function mapNoticeRow(row: Record<string, unknown>): Notice {
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

export async function listNotices(): Promise<{ data: Notice[] | null; errorMessage: string | null }> {
  const result = await supabaseAdmin
    .from("notices")
    .select("*")
    .order("sort_order", { ascending: true, nullsFirst: false })
    .order("created_at", { ascending: false, nullsFirst: false });

  if (result.error) {
    return { data: null, errorMessage: "공지 목록 조회에 실패했습니다." };
  }
  return {
    data: (result.data ?? []).map((row) => mapNoticeRow(row as Record<string, unknown>)),
    errorMessage: null,
  };
}

export async function insertNotice(input: {
  title: string;
  content: string;
  is_published: boolean;
  sort_order: number | null;
}): Promise<{ ok: true } | { ok: false; message: string }> {
  const insertResult = await supabaseAdmin
    .from("notices")
    .insert(input)
    .select("id")
    .maybeSingle();

  if (insertResult.error || !insertResult.data) {
    return { ok: false, message: "공지 등록에 실패했습니다." };
  }
  return { ok: true };
}

export async function updateNotice(
  id: string,
  updates: Record<string, unknown>,
): Promise<{ ok: true } | { ok: false; message: string }> {
  const updateResult = await supabaseAdmin
    .from("notices")
    .update(updates)
    .eq("id", id)
    .select("id")
    .maybeSingle();

  if (updateResult.error || !updateResult.data) {
    return { ok: false, message: "공지 수정에 실패했습니다." };
  }
  return { ok: true };
}

export async function deleteNotice(
  id: string,
): Promise<{ ok: true } | { ok: false; message: string }> {
  const deleteResult = await supabaseAdmin.from("notices").delete().eq("id", id).select("id").maybeSingle();
  if (deleteResult.error || !deleteResult.data) {
    return { ok: false, message: "공지 삭제에 실패했습니다." };
  }
  return { ok: true };
}
