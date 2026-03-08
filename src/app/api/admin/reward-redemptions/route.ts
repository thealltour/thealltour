import { NextResponse } from "next/server";
import { supabase } from "@/lib/supabase";

/** 관리자: 경품 교환 신청 목록 (status 필터 가능) — reward_redemptions 기준 */
export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const status = searchParams.get("status");

  let query = supabase
    .from("reward_redemptions")
    .select(`
      id,
      user_id,
      catalog_id,
      status,
      point_amount,
      requested_at,
      decided_at,
      shipped_at,
      completed_at,
      admin_memo,
      user_message,
      shipping_name,
      shipping_phone,
      shipping_address1,
      shipping_address2,
      shipping_zip,
      tracking_carrier,
      tracking_number,
      created_at,
      updated_at,
      reward_catalog(id, title, point_cost, image_url),
      members(id, name, username, email, phone)
    `)
    .order("created_at", { ascending: false });

  if (status?.trim()) {
    query = query.eq("status", status.trim().toUpperCase());
  }

  const { data, error } = await query;
  if (error) {
    return NextResponse.json({ message: "교환 목록을 불러올 수 없습니다." }, { status: 500 });
  }

  type Catalog = { id: string; title: string; point_cost: number; image_url: string | null };
  type Member = { id: string; name: string; username: string; email: string; phone: string };
  type RawRow = Record<string, unknown> & {
    reward_catalog?: Catalog | Catalog[] | null;
    members?: Member | Member[] | null;
  };

  const rows = (data ?? []) as RawRow[];
  const list = rows.map((r) => {
    const catalog = Array.isArray(r.reward_catalog) ? r.reward_catalog[0] : r.reward_catalog;
    const member = Array.isArray(r.members) ? r.members[0] : r.members;
    return {
      ...r,
      reward_catalog_id: r.catalog_id,
      member_id: r.user_id,
      reward_catalog: catalog
        ? { ...catalog, point_price: (catalog as Catalog).point_cost }
        : null,
      members: member ?? null,
    };
  });

  return NextResponse.json(list);
}
