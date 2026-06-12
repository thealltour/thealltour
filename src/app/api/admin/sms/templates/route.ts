import { NextResponse } from "next/server";
import { requireAdminSession } from "@/lib/apiAuth";
import { listSmsTemplates } from "@/lib/sms/smsTemplates";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

export async function GET(request: Request) {
  const auth = await requireAdminSession();
  if (!auth.ok) return auth.res;

  try {
    const url = new URL(request.url);
    const includeInactive = url.searchParams.get("all") === "1";
    const items = await listSmsTemplates(!includeInactive);
    return NextResponse.json({ items });
  } catch (e) {
    console.error("[GET /api/admin/sms/templates]", e);
    return NextResponse.json({ items: [] });
  }
}

export async function POST(request: Request) {
  const auth = await requireAdminSession();
  if (!auth.ok) return auth.res;

  const body = (await request.json().catch(() => ({}))) as {
    title?: string;
    body?: string;
    category?: string;
    variables?: string[];
    is_active?: boolean;
    sort_order?: number;
  };

  const title = body.title?.trim() ?? "";
  const tplBody = body.body?.trim() ?? "";
  if (!title || !tplBody) {
    return NextResponse.json({ message: "제목과 본문이 필요합니다." }, { status: 400 });
  }

  const nowIso = new Date().toISOString();
  const { data, error } = await supabaseAdmin
    .from("sms_templates")
    .insert({
      title,
      body: tplBody,
      category: body.category?.trim() || "general",
      variables: body.variables ?? [],
      is_active: body.is_active !== false,
      sort_order: body.sort_order ?? 0,
      updated_at: nowIso,
    })
    .select("id")
    .maybeSingle();

  if (error) {
    if (error.code === "42P01") {
      return NextResponse.json({ message: "sms_templates 테이블이 없습니다." }, { status: 500 });
    }
    return NextResponse.json({ message: "템플릿 저장에 실패했습니다." }, { status: 500 });
  }

  return NextResponse.json({ ok: true, id: data?.id });
}
