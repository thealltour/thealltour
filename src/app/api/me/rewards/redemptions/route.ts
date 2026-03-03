import { NextResponse } from "next/server";
import { supabase } from "@/lib/supabase";
import { requireMemberSession } from "@/lib/apiAuth";

const PAGE_SIZE = 50;

export async function GET() {
  const auth = await requireMemberSession();
  if (auth.res) return auth.res;
  const userId = auth.session.memberId;

  const { data: rows, error } = await supabase
    .from("reward_redemptions")
    .select(`
      id,
      catalog_id,
      point_amount,
      status,
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
      reward_catalog ( title )
    `)
    .eq("user_id", userId)
    .order("created_at", { ascending: false })
    .limit(PAGE_SIZE);

  if (error) {
    return NextResponse.json({ message: "내역을 불러올 수 없습니다." }, { status: 500 });
  }

  const list = (rows ?? []).map((r: Record<string, unknown>) => {
    const catalog = r.reward_catalog as { title?: string } | null;
    return {
      id: r.id,
      catalog_id: r.catalog_id,
      catalog_title: catalog?.title ?? null,
      point_amount: r.point_amount,
      status: r.status,
      requested_at: r.requested_at,
      decided_at: r.decided_at,
      shipped_at: r.shipped_at,
      completed_at: r.completed_at,
      admin_memo: r.admin_memo,
      user_message: r.user_message,
      shipping_name: r.shipping_name,
      shipping_phone: r.shipping_phone,
      shipping_address1: r.shipping_address1,
      shipping_address2: r.shipping_address2,
      shipping_zip: r.shipping_zip,
      tracking_carrier: r.tracking_carrier,
      tracking_number: r.tracking_number,
      created_at: r.created_at,
    };
  });

  return NextResponse.json(list);
}
