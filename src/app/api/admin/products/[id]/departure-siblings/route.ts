import { NextResponse } from "next/server";
import { requireAdminSession } from "@/lib/apiAuth";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import type { AdminDepartureSibling } from "@/lib/products/departureSiblings";

/** 편집기 "같은 상품의 다른 출발지" 목록. 비노출 상품도 포함한다 */
export async function GET(
  _request: Request,
  context: { params: Promise<{ id: string }> },
) {
  const auth = await requireAdminSession();
  if (!auth.ok) return auth.res;

  const { id } = await context.params;
  const current = await supabaseAdmin
    .from("products")
    .select("id, departure_group_id")
    .eq("id", id)
    .maybeSingle();
  if (current.error) {
    return NextResponse.json({ siblings: [], message: current.error.message });
  }
  const groupId = (current.data as { departure_group_id?: string | null } | null)?.departure_group_id;
  if (!groupId) return NextResponse.json({ siblings: [] });

  const { data, error } = await supabaseAdmin
    .from("products")
    .select("id, title, departure_city, is_active")
    .eq("departure_group_id", groupId)
    .neq("id", id);
  if (error) {
    return NextResponse.json({ message: `형제 상품 조회에 실패했습니다. (${error.message})` }, { status: 500 });
  }

  const siblings: AdminDepartureSibling[] = (data ?? []).map((row) => ({
    id: String(row.id),
    title: String(row.title ?? ""),
    departure_city: typeof row.departure_city === "string" ? row.departure_city : null,
    is_active: row.is_active === true,
  }));
  return NextResponse.json({ siblings });
}
