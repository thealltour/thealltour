import { NextResponse } from "next/server";
import { requireAdminSession } from "@/lib/apiAuth";
import { normalizeInboundSenderPhone, phonesMatchForInquiry } from "@/lib/sms/normalizeInboundPhone";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

function escapeIlike(value: string): string {
  return value.replace(/[%_]/g, "\\$&");
}

export async function GET(request: Request) {
  const auth = await requireAdminSession();
  if (!auth.ok) return auth.res;

  const url = new URL(request.url);
  const q = url.searchParams.get("q")?.trim() ?? "";
  const limitRaw = Number.parseInt(url.searchParams.get("limit") ?? "15", 10);
  const limit = Number.isFinite(limitRaw) && limitRaw > 0 ? Math.min(limitRaw, 30) : 15;

  if (!q) {
    return NextResponse.json({ items: [] });
  }

  const escaped = escapeIlike(q);
  const normalizedPhone = normalizeInboundSenderPhone(q);

  const { data, error } = await supabaseAdmin
    .from("members")
    .select("id, username, name, phone, email, created_at")
    .or(`name.ilike.%${escaped}%,phone.ilike.%${escaped}%,email.ilike.%${escaped}%,username.ilike.%${escaped}%`)
    .order("created_at", { ascending: false })
    .limit(50);

  if (error) {
    return NextResponse.json({ message: "회원 검색에 실패했습니다." }, { status: 500 });
  }

  let rows = data ?? [];

  if (normalizedPhone.length >= 10) {
    const phoneMatches = rows.filter((row) => {
      const phone = typeof row.phone === "string" ? row.phone : "";
      return phonesMatchForInquiry(phone, normalizedPhone);
    });
    const otherMatches = rows.filter((row) => {
      const phone = typeof row.phone === "string" ? row.phone : "";
      return !phonesMatchForInquiry(phone, normalizedPhone);
    });
    rows = [...phoneMatches, ...otherMatches];
  }

  const items = rows.slice(0, limit).map((row) => ({
    id: String(row.id),
    username: typeof row.username === "string" ? row.username : "",
    name: typeof row.name === "string" ? row.name : "이름 없음",
    phone: typeof row.phone === "string" ? row.phone : "",
    email: typeof row.email === "string" ? row.email : "",
    createdAt: typeof row.created_at === "string" ? row.created_at : null,
  }));

  return NextResponse.json({ items });
}
