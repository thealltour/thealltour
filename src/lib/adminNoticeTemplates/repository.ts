import "server-only";

import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { TERMS_TEMPLATE_TYPES, type TermsTemplateType } from "@/lib/termsTemplates";
import {
  createEmptyNoticeTemplatesByGroup,
  type NoticeTemplateGroup,
  type NoticeTemplatesByGroup,
} from "@/lib/noticeTemplates";

export type NoticeTemplateUpsertRow = {
  template_group: NoticeTemplateGroup;
  type: TermsTemplateType;
  content: string;
  sort_order: number;
};

export async function loadNoticeTemplateMaps(): Promise<
  { ok: true; maps: NoticeTemplatesByGroup } | { ok: false; message: string }
> {
  const maps = createEmptyNoticeTemplatesByGroup();
  const { data, error } = await supabaseAdmin
    .from("product_notice_templates")
    .select("template_group,type,content,sort_order")
    .order("sort_order", { ascending: true })
    .order("type", { ascending: true });

  if (error) return { ok: false, message: "공지 템플릿 조회에 실패했습니다." };
  if (!data) return { ok: true, maps };

  for (const row of data as { template_group: string; type: string; content: string | null }[]) {
    if (
      row.template_group !== "booking_notes" &&
      row.template_group !== "travel_notes" &&
      row.template_group !== "booking_conditions" &&
      row.template_group !== "refund_policy"
    ) {
      continue;
    }
    const g = row.template_group as NoticeTemplateGroup;
    if (!(TERMS_TEMPLATE_TYPES as readonly string[]).includes(row.type)) continue;
    maps[g][row.type as TermsTemplateType] = row.content?.trim() ?? "";
  }
  return { ok: true, maps };
}

export async function loadLegacyTermsTemplateRows(): Promise<{
  data: { type: string; content: string | null }[] | null;
  errorMessage: string | null;
}> {
  const legacyResult = await supabaseAdmin
    .from("product_terms_templates")
    .select("type,content")
    .order("type", { ascending: true });

  if (legacyResult.error) {
    return { data: null, errorMessage: "레거시 약관 템플릿 조회에 실패했습니다." };
  }
  return { data: legacyResult.data, errorMessage: null };
}

export async function upsertNoticeTemplateRows(
  upsertRows: NoticeTemplateUpsertRow[],
): Promise<{ ok: true } | { ok: false; message: string }> {
  const { error } = await supabaseAdmin
    .from("product_notice_templates")
    .upsert(upsertRows, { onConflict: "template_group,type", ignoreDuplicates: false });

  if (error) {
    return { ok: false, message: "공지 템플릿 저장에 실패했습니다." };
  }
  return { ok: true };
}
