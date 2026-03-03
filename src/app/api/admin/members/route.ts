import { NextRequest, NextResponse } from "next/server";
import { supabase } from "@/lib/supabase";
import { requireAdminSession } from "@/lib/apiAuth";

export async function GET(request: NextRequest) {
  const auth = await requireAdminSession();
  if (!auth.ok) return auth.res;

  const { searchParams } = new URL(request.url);
  const search = searchParams.get("search")?.trim();

  let query = supabase
    .from("members")
    .select("id,username,name,phone,email,birth_date,gender,agree_email,point_balance,point_pending,points,created_at")
    .order("created_at", { ascending: false, nullsFirst: false });

  if (search) {
    query = query.or(`email.ilike.%${search}%,phone.ilike.%${search}%,name.ilike.%${search}%,username.ilike.%${search}%`);
  }

  const { data, error } = await query;

  if (error) {
    return NextResponse.json({ message: "회원 목록 조회에 실패했습니다." }, { status: 500 });
  }

  return NextResponse.json(data ?? []);
}
