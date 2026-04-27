import { NextResponse } from "next/server";
import { requireAdminSession } from "@/lib/apiAuth";
import { LEGAL_NOTICE_TITLES, getLegalDocuments, type LegalDocuments } from "@/lib/legalDocuments";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

type LegalDocumentsBody = Partial<LegalDocuments>;

export async function GET() {
  const auth = await requireAdminSession();
  if (!auth.ok) return auth.res;

  const documents = await getLegalDocuments();
  return NextResponse.json(documents);
}

export async function PATCH(request: Request) {
  const auth = await requireAdminSession();
  if (!auth.ok) return auth.res;

  const body = (await request.json()) as LegalDocumentsBody;
  const entries = [
    { type: "terms" as const, content: (body.terms ?? "").trim() },
    { type: "privacy" as const, content: (body.privacy ?? "").trim() },
  ];

  for (const entry of entries) {
    const title = LEGAL_NOTICE_TITLES[entry.type];
    const existing = await supabaseAdmin
      .from("notices")
      .select("id")
      .eq("title", title)
      .order("created_at", { ascending: false, nullsFirst: false })
      .limit(1)
      .maybeSingle();

    if (!existing.error && existing.data?.id) {
      const updateResult = await supabaseAdmin
        .from("notices")
        .update({ content: entry.content, is_published: false, sort_order: 9999 })
        .eq("id", existing.data.id)
        .select("id")
        .maybeSingle();
      if (updateResult.error || !updateResult.data) {
        return NextResponse.json({ message: "법률 문서 저장에 실패했습니다." }, { status: 500 });
      }
      continue;
    }

    const insertResult = await supabaseAdmin
      .from("notices")
      .insert({
        title,
        content: entry.content,
        is_published: false,
        sort_order: 9999,
      })
      .select("id")
      .maybeSingle();

    if (insertResult.error || !insertResult.data) {
      return NextResponse.json({ message: "법률 문서 저장에 실패했습니다." }, { status: 500 });
    }
  }

  return NextResponse.json({ message: "법률 문서를 저장했습니다." });
}
