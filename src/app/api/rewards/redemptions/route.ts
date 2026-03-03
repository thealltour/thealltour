import { NextResponse } from "next/server";
import { supabase } from "@/lib/supabase";
import { requireMemberSession } from "@/lib/apiAuth";
import { validateRedemptionPolicy } from "@/lib/rewardPolicyValidation";

type Body = {
  catalogId?: string;
  shippingInfo?: {
    shipping_name?: string;
    shipping_phone?: string;
    shipping_address1?: string;
    shipping_address2?: string;
    shipping_zip?: string;
  };
  userMessage?: string;
};

/** 교환 신청: RESERVE로 포인트 잠금, reward_redemptions REQUESTED 생성 */
export async function POST(request: Request) {
  const auth = await requireMemberSession();
  if (auth.res) return auth.res;
  const userId = auth.session.memberId;

  let body: Body;
  try {
    body = (await request.json()) as Body;
  } catch {
    return NextResponse.json({ message: "요청 형식이 올바르지 않습니다." }, { status: 400 });
  }

  const catalogId = body.catalogId?.trim();
  const shipping = body.shippingInfo;
  if (!catalogId || !shipping?.shipping_name?.trim() || !shipping?.shipping_phone?.trim() || !shipping?.shipping_address1?.trim()) {
    return NextResponse.json(
      { message: "경품 선택과 수령인 이름, 연락처, 주소는 필수입니다." },
      { status: 400 },
    );
  }

  const [memberRes, catalogRes] = await Promise.all([
    supabase.from("members").select("point_balance").eq("id", userId).maybeSingle(),
    supabase
      .from("reward_catalog")
      .select("id, title, point_cost, stock, is_active")
      .eq("id", catalogId)
      .maybeSingle(),
  ]);

  if (memberRes.error || !memberRes.data) {
    return NextResponse.json({ message: "회원 정보를 불러올 수 없습니다." }, { status: 500 });
  }
  if (catalogRes.error || !catalogRes.data) {
    return NextResponse.json({ message: "해당 경품을 찾을 수 없습니다." }, { status: 404 });
  }

  const catalog = catalogRes.data as { id: string; point_cost: number; stock: number | null; is_active: boolean };
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

  const policyResult = await validateRedemptionPolicy(userId, pointCost, supabase);
  if (!policyResult.ok) {
    return NextResponse.json({ message: policyResult.message }, { status: 400 });
  }

  const insertRedemption = {
    user_id: userId,
    catalog_id: catalog.id,
    status: "REQUESTED" as const,
    point_amount: pointCost,
    user_message: body.userMessage?.trim() || null,
    shipping_name: shipping.shipping_name.trim(),
    shipping_phone: shipping.shipping_phone.trim(),
    shipping_address1: shipping.shipping_address1.trim(),
    shipping_address2: shipping.shipping_address2?.trim() || null,
    shipping_zip: shipping.shipping_zip?.trim() || null,
  };

  const { data: redemption, error: insErr } = await supabase
    .from("reward_redemptions")
    .insert(insertRedemption)
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

  const newBalance = balance - pointCost;
  const { error: updateErr } = await supabase
    .from("members")
    .update({ point_balance: newBalance })
    .eq("id", userId);

  if (updateErr) {
    await supabase.from("reward_redemptions").delete().eq("id", redemptionId);
    return NextResponse.json({ message: "포인트 차감에 실패했습니다." }, { status: 500 });
  }

  await supabase.from("notifications").insert({
    user_id: userId,
    type: "REWARD_STATUS",
    title: "교환 신청 접수",
    body: "경품 교환 신청이 접수되었습니다. 승인 후 발송됩니다.",
  });

  return NextResponse.json(
    { id: redemptionId, message: "교환 신청이 완료되었습니다. 승인 후 발송됩니다." },
    { status: 201 },
  );
}
