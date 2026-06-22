import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { requireMemberSession } from "@/lib/apiAuth";
import {
  createRewardRedemption,
  mapRedemptionServiceError,
} from "@/server/services/rewards/redemptions";

const PAGE_SIZE = 50;

export async function GET() {
  const auth = await requireMemberSession();
  if (auth.res) return auth.res;
  const userId = auth.session.memberId;

  const { data: rows, error } = await supabaseAdmin
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

type CreateBody = {
  catalogId?: string;
  shippingName?: string;
  shippingPhone?: string;
  shippingZip?: string;
  shippingAddress1?: string;
  shippingAddress2?: string;
  contactTime?: string;
  userMessage?: string;
};

export async function POST(request: Request) {
  const auth = await requireMemberSession();
  if (auth.res) return auth.res;
  const userId = auth.session.memberId;

  let body: CreateBody;
  try {
    body = (await request.json()) as CreateBody;
  } catch {
    return NextResponse.json({ message: "요청 형식이 올바르지 않습니다." }, { status: 400 });
  }

  const catalogId = body.catalogId?.trim();
  const shippingName = body.shippingName?.trim();
  const shippingPhone = body.shippingPhone?.trim();
  const shippingAddress1 = body.shippingAddress1?.trim();

  if (!catalogId || !shippingName || !shippingPhone || !shippingAddress1) {
    return NextResponse.json(
      { message: "catalogId, shippingName, shippingPhone, shippingAddress1는 필수입니다." },
      { status: 400 },
    );
  }

  try {
    const result = await createRewardRedemption(
      {
        userId,
        catalogId,
        shippingName,
        shippingPhone,
        shippingAddress1,
        shippingAddress2: body.shippingAddress2?.trim() || null,
        shippingZip: body.shippingZip?.trim() || null,
        contactTime: body.contactTime?.trim(),
        userMessage: body.userMessage?.trim(),
      },
      supabaseAdmin,
    );
    return NextResponse.json(
      { id: result.id, message: "리워드 교환 신청이 접수되었습니다." },
      { status: 201 },
    );
  } catch (error) {
    const mapped = mapRedemptionServiceError(error);
    return NextResponse.json({ message: mapped.message }, { status: mapped.status });
  }
}
