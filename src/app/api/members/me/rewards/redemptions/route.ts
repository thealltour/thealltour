import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { supabase } from "@/lib/supabase";
import { getMemberSessionFromCookies } from "@/lib/memberSession";
import type { RewardRedemptionRequestInput } from "@/types/pointsRewards";

/** 경품 교환 신청 (확정 포인트만 사용 가능) */
export async function POST(request: Request) {
  const cookieStore = await cookies();
  const session = getMemberSessionFromCookies(cookieStore);
  if (!session) {
    return NextResponse.json({ message: "로그인이 필요합니다." }, { status: 401 });
  }

  let body: RewardRedemptionRequestInput;
  try {
    body = (await request.json()) as RewardRedemptionRequestInput;
  } catch {
    return NextResponse.json({ message: "요청 형식이 올바르지 않습니다." }, { status: 400 });
  }

  const { reward_catalog_id, shipping_name, shipping_phone, shipping_address, shipping_note } = body;
  if (!reward_catalog_id?.trim() || !shipping_name?.trim() || !shipping_phone?.trim() || !shipping_address?.trim()) {
    return NextResponse.json(
      { message: "경품 선택과 수령인 이름, 연락처, 주소는 필수입니다." },
      { status: 400 },
    );
  }

  const memberId = session.memberId;

  const [memberRes, catalogRes] = await Promise.all([
    supabase.from("members").select("points").eq("id", memberId).maybeSingle(),
    supabase.from("reward_catalog").select("id,title,point_price,stock_count,is_active").eq("id", reward_catalog_id).maybeSingle(),
  ]);

  if (memberRes.error || !memberRes.data) {
    return NextResponse.json({ message: "회원 정보를 불러올 수 없습니다." }, { status: 500 });
  }
  if (catalogRes.error || !catalogRes.data) {
    return NextResponse.json({ message: "해당 경품을 찾을 수 없습니다." }, { status: 404 });
  }

  const catalog = catalogRes.data as { id: string; title: string; point_price: number; stock_count: number; is_active: boolean };
  if (!catalog.is_active) {
    return NextResponse.json({ message: "현재 교환 불가한 경품입니다." }, { status: 400 });
  }
  if (catalog.stock_count <= 0) {
    return NextResponse.json({ message: "재고가 없습니다." }, { status: 400 });
  }

  const pointBalance = Number((memberRes.data as { points?: number }).points ?? 0);
  const pointPrice = Number(catalog.point_price);
  if (pointBalance < pointPrice) {
    return NextResponse.json(
      { message: `보유 포인트가 부족합니다. (필요: ${pointPrice}P, 보유: ${pointBalance}P)` },
      { status: 400 },
    );
  }

  const insertRow = {
    member_id: memberId,
    reward_catalog_id: catalog.id,
    point_amount: pointPrice,
    status: "requested" as const,
    shipping_name: shipping_name.trim(),
    shipping_phone: shipping_phone.trim(),
    shipping_address: shipping_address.trim(),
    shipping_note: shipping_note?.trim() || null,
  };

  const insertRes = await supabase.from("reward_redemption").insert(insertRow).select("id,status,created_at").maybeSingle();
  if (insertRes.error) {
    return NextResponse.json({ message: "교환 신청에 실패했습니다." }, { status: 500 });
  }

  return NextResponse.json(
    { message: "교환 신청이 완료되었습니다. 승인 후 발송됩니다.", id: insertRes.data?.id },
    { status: 201 },
  );
}
