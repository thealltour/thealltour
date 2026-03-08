import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { supabase } from "@/lib/supabase";
import { getMemberSessionFromCookies } from "@/lib/memberSession";
import { validateRedemptionPolicy } from "@/lib/rewardPolicyValidation";

/** 요청 body: 레거시 필드명(reward_catalog_id, shipping_address, shipping_note) 및 목표 스키마(catalog_id, shipping_address1, user_message) 모두 수용 */
type Body = {
  reward_catalog_id?: string;
  catalog_id?: string;
  shipping_name?: string;
  shipping_phone?: string;
  shipping_address?: string;
  shipping_address1?: string;
  shipping_address2?: string;
  shipping_zip?: string;
  shipping_note?: string;
  user_message?: string;
};

/** 경품 교환 신청 — reward_redemptions + RESERVE 원장 + 잔액 차감 */
export async function POST(request: Request) {
  const cookieStore = await cookies();
  const session = getMemberSessionFromCookies(cookieStore);
  if (!session) {
    return NextResponse.json({ message: "로그인이 필요합니다." }, { status: 401 });
  }

  let body: Body;
  try {
    body = (await request.json()) as Body;
  } catch {
    return NextResponse.json({ message: "요청 형식이 올바르지 않습니다." }, { status: 400 });
  }

  const catalogId = (body.catalog_id ?? body.reward_catalog_id)?.trim();
  const shippingName = body.shipping_name?.trim();
  const shippingPhone = body.shipping_phone?.trim();
  const shippingAddress1 = (body.shipping_address1 ?? body.shipping_address)?.trim();
  const shippingAddress2 = body.shipping_address2?.trim() || null;
  const shippingZip = body.shipping_zip?.trim() || null;
  const userMessage = (body.user_message ?? body.shipping_note)?.trim() || null;

  if (!catalogId || !shippingName || !shippingPhone || !shippingAddress1) {
    return NextResponse.json(
      { message: "경품 선택과 수령인 이름, 연락처, 주소는 필수입니다." },
      { status: 400 },
    );
  }

  const userId = session.memberId;

  const [memberRes, catalogRes] = await Promise.all([
    supabase.from("members").select("point_balance, points").eq("id", userId).maybeSingle(),
    supabase
      .from("reward_catalog")
      .select("id, title, point_cost, point_price, stock, stock_count, is_active")
      .eq("id", catalogId)
      .maybeSingle(),
  ]);

  if (memberRes.error || !memberRes.data) {
    return NextResponse.json({ message: "회원 정보를 불러올 수 없습니다." }, { status: 500 });
  }
  if (catalogRes.error || !catalogRes.data) {
    return NextResponse.json({ message: "해당 경품을 찾을 수 없습니다." }, { status: 404 });
  }

  const catalog = catalogRes.data as {
    id: string;
    title: string;
    point_cost?: number;
    point_price?: number;
    stock?: number | null;
    stock_count?: number;
    is_active: boolean;
  };
  if (!catalog.is_active) {
    return NextResponse.json({ message: "현재 교환 불가한 경품입니다." }, { status: 400 });
  }
  const stock = catalog.stock ?? catalog.stock_count;
  if (typeof stock === "number" && stock <= 0) {
    return NextResponse.json({ message: "재고가 없습니다." }, { status: 400 });
  }

  const pointCost = Number(catalog.point_cost ?? catalog.point_price ?? 0);
  const member = memberRes.data as { point_balance?: number; points?: number };
  const pointBalance = Number(member.point_balance ?? member.points ?? 0);
  if (pointBalance < pointCost) {
    return NextResponse.json(
      { message: `보유 포인트가 부족합니다. (필요: ${pointCost}P, 보유: ${pointBalance}P)` },
      { status: 400 },
    );
  }

  const policyResult = await validateRedemptionPolicy(userId, pointCost, supabase);
  if (!policyResult.ok) {
    return NextResponse.json({ message: policyResult.message }, { status: 400 });
  }

  const insertRow = {
    user_id: userId,
    catalog_id: catalog.id,
    status: "REQUESTED" as const,
    point_amount: pointCost,
    user_message: userMessage,
    shipping_name: shippingName,
    shipping_phone: shippingPhone,
    shipping_address1: shippingAddress1,
    shipping_address2: shippingAddress2,
    shipping_zip: shippingZip,
  };

  const { data: redemption, error: insErr } = await supabase
    .from("reward_redemptions")
    .insert(insertRow)
    .select("id")
    .maybeSingle();

  if (insErr || !redemption) {
    return NextResponse.json({ message: "교환 신청 생성에 실패했습니다." }, { status: 500 });
  }

  const redemptionId = (redemption as { id: string }).id;

  const { error: ledgerErr } = await supabase.from("point_ledger").insert({
    user_id: userId,
    type: "RESERVE",
    status: "CONFIRMED",
    amount: pointCost,
    reason: "경품 교환 신청",
    ref_type: "REDEMPTION",
    ref_id: redemptionId,
  });

  if (ledgerErr) {
    await supabase.from("reward_redemptions").delete().eq("id", redemptionId);
    return NextResponse.json({ message: "포인트 예약 기록에 실패했습니다." }, { status: 500 });
  }

  const newBalance = pointBalance - pointCost;
  const updatePayload: { point_balance?: number; points?: number } = {};
  if (member.point_balance !== undefined) {
    updatePayload.point_balance = newBalance;
  } else {
    updatePayload.points = newBalance;
  }
  const { error: updateErr } = await supabase.from("members").update(updatePayload).eq("id", userId);

  if (updateErr) {
    await supabase.from("reward_redemptions").delete().eq("id", redemptionId);
    return NextResponse.json({ message: "포인트 차감 반영에 실패했습니다." }, { status: 500 });
  }

  await supabase.from("notifications").insert({
    user_id: userId,
    type: "REWARD_STATUS",
    title: "교환 신청 접수",
    body: "경품 교환 신청이 접수되었습니다. 승인 후 발송됩니다.",
  });

  return NextResponse.json(
    { message: "교환 신청이 완료되었습니다. 승인 후 발송됩니다.", id: redemptionId },
    { status: 201 },
  );
}
