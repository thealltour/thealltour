import { NextResponse } from "next/server";
import { revalidateTag } from "next/cache";
import { supabase } from "@/lib/supabase";
import { TERMS_TEMPLATE_TYPES, type TermsTemplateType } from "@/lib/termsTemplates";

type TermsTemplateBody = Partial<Record<TermsTemplateType, string>>;

export async function GET() {
  const { data, error } = await supabase
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
  const body = (await request.json()) as TermsTemplateBody;
  const rows = TERMS_TEMPLATE_TYPES.map((type) => ({
    type,
    content: (body[type] ?? "").trim(),
  }));

  const { error } = await supabase
    .from("product_terms_templates")
    .upsert(rows, { onConflict: "type", ignoreDuplicates: false });

  if (error) {
    return NextResponse.json({ message: "약관 템플릿 저장에 실패했습니다." }, { status: 500 });
  }

  revalidateTag("products", "max");
  return NextResponse.json({ message: "약관 템플릿이 저장되었습니다." });
}
