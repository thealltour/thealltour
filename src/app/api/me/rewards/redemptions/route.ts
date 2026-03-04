import { NextResponse } from "next/server";
import { supabase } from "@/lib/supabase";
import { requireMemberSession } from "@/lib/apiAuth";
import { validateRedemptionPolicy } from "@/lib/rewardPolicyValidation";

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

/** 회원: 리워드 교환 신청 (REQUESTED + RESERVE + balance 예약 차감) */
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
  const shippingAddress2 = body.shippingAddress2?.trim() || null;
  const shippingZip = body.shippingZip?.trim() || null;
  const contactTime = body.contactTime?.trim();
  const userMessage = body.userMessage?.trim();

  if (!catalogId || !shippingName || !shippingPhone || !shippingAddress1) {
    return NextResponse.json(
      { message: "catalogId, shippingName, shippingPhone, shippingAddress1는 필수입니다." },
      { status: 400 },
    );
  }

  const [memberRes, catalogRes, requestedRes] = await Promise.all([
    supabase.from("members").select("point_balance").eq("id", userId).maybeSingle(),
    supabase
      .from("reward_catalog")
      .select("id, title, point_cost, stock, is_active")
      .eq("id", catalogId)
      .maybeSingle(),
    supabase
      .from("reward_redemptions")
      .select("id", { count: "exact", head: true })
      .eq("user_id", userId)
      .eq("status", "REQUESTED"),
  ]);

  if (memberRes.error || !memberRes.data) {
    return NextResponse.json({ message: "회원 정보를 불러올 수 없습니다." }, { status: 500 });
  }
  if (catalogRes.error || !catalogRes.data) {
    return NextResponse.json({ message: "해당 경품을 찾을 수 없습니다." }, { status: 404 });
  }
  if (requestedRes.error) {
    return NextResponse.json({ message: "중복 신청 검증에 실패했습니다." }, { status: 500 });
  }
  if ((requestedRes.count ?? 0) >= 1) {
    return NextResponse.json({ message: "진행 중인 교환 신청이 있어 추가 신청할 수 없습니다." }, { status: 400 });
  }

  const catalog = catalogRes.data as {
    id: string;
    title: string;
    point_cost: number;
    stock: number | null;
    is_active: boolean;
  };
  if (!catalog.is_active) {
    return NextResponse.json({ message: "현재 교환 불가한 경품입니다." }, { status: 400 });
  }
  if (catalog.stock != null && catalog.stock <= 0) {
    return NextResponse.json({ message: "재고가 없습니다." }, { status: 400 });
  }

  const pointCost = Number(catalog.point_cost ?? 0);
  const balance = Number((memberRes.data as { point_balance?: number }).point_balance ?? 0);
  if (balance < pointCost) {
    return NextResponse.json(
      { message: `보유 포인트가 부족합니다. (필요: ${pointCost}P, 보유: ${balance}P)` },
      { status: 400 },
    );
  }

  const policy = await validateRedemptionPolicy(userId, pointCost, supabase);
  if (!policy.ok) {
    return NextResponse.json({ message: policy.message }, { status: 400 });
  }

  const mergedUserMessage = [userMessage, contactTime ? `연락 가능 시간대: ${contactTime}` : ""]
    .filter(Boolean)
    .join("\n");

  const { data: redemption, error: redemptionErr } = await supabase
    .from("reward_redemptions")
    .insert({
      user_id: userId,
      catalog_id: catalog.id,
      status: "REQUESTED" as const,
      point_amount: pointCost,
      user_message: mergedUserMessage || null,
      shipping_name: shippingName,
      shipping_phone: shippingPhone,
      shipping_zip: shippingZip,
      shipping_address1: shippingAddress1,
      shipping_address2: shippingAddress2,
    })
    .select("id")
    .maybeSingle();

  if (redemptionErr || !redemption) {
    return NextResponse.json({ message: "교환 신청 생성에 실패했습니다." }, { status: 500 });
  }

  const redemptionId = (redemption as { id: string }).id;
  const { error: ledgerErr } = await supabase.from("point_ledger").insert({
    user_id: userId,
    type: "RESERVE",
    status: "CONFIRMED",
    amount: pointCost,
    reason: "리워드 교환 신청",
    ref_type: "REWARD_REDEMPTION",
    ref_id: redemptionId,
  });

  if (ledgerErr) {
    await supabase.from("reward_redemptions").delete().eq("id", redemptionId);
    return NextResponse.json({ message: "포인트 예약 기록에 실패했습니다." }, { status: 500 });
  }

  const { error: memberUpdateErr } = await supabase
    .from("members")
    .update({ point_balance: balance - pointCost })
    .eq("id", userId);

  if (memberUpdateErr) {
    await supabase.from("reward_redemptions").delete().eq("id", redemptionId);
    return NextResponse.json({ message: "포인트 차감 반영에 실패했습니다." }, { status: 500 });
  }

  await supabase.from("notifications").insert({
    user_id: userId,
    type: "REWARD_STATUS",
    title: "리워드 교환 신청 접수",
    body: "승인 후 발송이 진행됩니다.",
  });

  return NextResponse.json(
    { id: redemptionId, message: "리워드 교환 신청이 접수되었습니다." },
    { status: 201 },
  );
}
