import { NextResponse } from "next/server";
import { revalidateTag } from "next/cache";
import { CACHE_TAGS, REVALIDATE_MAX } from "@/lib/cacheTags";
import { requireAdminSession } from "@/lib/apiAuth";
import { TERMS_TEMPLATE_TYPES, type TermsTemplateType } from "@/lib/termsTemplates";
import {
  createEmptyNoticeTemplatesByGroup,
  type NoticeTemplateGroup,
  type NoticeTemplatesByGroup,
} from "@/lib/noticeTemplates";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

type LegacyTermsBody = Partial<Record<TermsTemplateType, string>>;

type NoticeTemplatesPatchBody = Partial<{
  booking_notes: LegacyTermsBody;
  travel_notes: LegacyTermsBody;
  booking_conditions: LegacyTermsBody;
  refund_policy: LegacyTermsBody;
}>;

const GROUPS: NoticeTemplateGroup[] = [
  "booking_notes",
  "travel_notes",
  "booking_conditions",
  "refund_policy",
];

function buildLegacyMapFromRows(
  rows: { type: string; content: string | null }[] | null,
): Record<TermsTemplateType, string> {
  const out = createEmptyNoticeTemplatesByGroup().booking_notes;
  for (const type of TERMS_TEMPLATE_TYPES) {
    const item = (rows ?? []).find((row) => row.type === type);
    out[type] = typeof item?.content === "string" ? item.content : "";
  }
  return out;
}

async function loadNoticeMaps(): Promise<
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

export async function GET() {
  const auth = await requireAdminSession();
  if (!auth.ok) return auth.res;

  const [noticeResult, legacyResult] = await Promise.all([
    loadNoticeMaps(),
    supabaseAdmin.from("product_terms_templates").select("type,content").order("type", { ascending: true }),
  ]);

  if (!noticeResult.ok) {
    return NextResponse.json({ message: noticeResult.message }, { status: 500 });
  }

  if (legacyResult.error) {
    return NextResponse.json({ message: "레거시 약관 템플릿 조회에 실패했습니다." }, { status: 500 });
  }

  return NextResponse.json({
    notice: noticeResult.maps,
    legacy: buildLegacyMapFromRows(legacyResult.data),
  });
}

export async function PATCH(request: Request) {
  const auth = await requireAdminSession();
  if (!auth.ok) return auth.res;

  const body = (await request.json()) as NoticeTemplatesPatchBody;
  const upsertRows: {
    template_group: NoticeTemplateGroup;
    type: TermsTemplateType;
    content: string;
    sort_order: number;
  }[] = [];

  for (const group of GROUPS) {
    const partial = body[group];
    if (!partial || typeof partial !== "object") continue;
    for (const type of TERMS_TEMPLATE_TYPES) {
      if (!(type in partial)) continue;
      const raw = partial[type];
      upsertRows.push({
        template_group: group,
        type,
        content: typeof raw === "string" ? raw.trim() : "",
        sort_order: 0,
      });
    }
  }

  if (upsertRows.length === 0) {
    return NextResponse.json({ message: "저장할 템플릿이 없습니다." }, { status: 400 });
  }

  const { error } = await supabaseAdmin
    .from("product_notice_templates")
    .upsert(upsertRows, { onConflict: "template_group,type", ignoreDuplicates: false });

  if (error) {
    return NextResponse.json({ message: "공지 템플릿 저장에 실패했습니다." }, { status: 500 });
  }

  revalidateTag(CACHE_TAGS.PRODUCTS, REVALIDATE_MAX);
  return NextResponse.json({ message: "공지 템플릿이 저장되었습니다." });
}
