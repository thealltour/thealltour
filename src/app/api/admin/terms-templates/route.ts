import { NextResponse } from "next/server";
import { revalidateTag } from "next/cache";
import { CACHE_TAGS, REVALIDATE_MAX } from "@/lib/cacheTags";
import { requireAdminSession } from "@/lib/apiAuth";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { TERMS_TEMPLATE_TYPES, type TermsTemplateType } from "@/lib/termsTemplates";

type TermsTemplateBody = Partial<Record<TermsTemplateType, string>>;

export async function GET() {
  const auth = await requireAdminSession();
  if (!auth.ok) return auth.res;

  const { data, error } = await supabaseAdmin
    .from("product_terms_templates")
    .select("type,content")
    .order("type", { ascending: true });

  if (error) {
    return NextResponse.json({ message: "약관 템플릿 조회에 실패했습니다." }, { status: 500 });
  }

  const result: Record<string, string> = {};
  for (const type of TERMS_TEMPLATE_TYPES) {
    const item = (data ?? []).find((row) => row.type === type);
    result[type] = typeof item?.content === "string" ? item.content : "";
  }

  return NextResponse.json(result);
}

export async function PATCH(request: Request) {
  const auth = await requireAdminSession();
  if (!auth.ok) return auth.res;

  const body = (await request.json()) as TermsTemplateBody;
  const rows = TERMS_TEMPLATE_TYPES.map((type) => ({
    type,
    content: (body[type] ?? "").trim(),
  }));

  const { error } = await supabaseAdmin
    .from("product_terms_templates")
    .upsert(rows, { onConflict: "type", ignoreDuplicates: false });

  if (error) {
    return NextResponse.json({ message: "약관 템플릿 저장에 실패했습니다." }, { status: 500 });
  }

  revalidateTag(CACHE_TAGS.PRODUCTS, REVALIDATE_MAX);
  return NextResponse.json({ message: "약관 템플릿이 저장되었습니다." });
}
