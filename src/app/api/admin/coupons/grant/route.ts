import { NextResponse } from "next/server";
import { requireAdminSession } from "@/lib/apiAuth";
import { COUPON_PACKS, type CouponPackDef } from "@/lib/coupons/couponPacks";
import { grantCouponPack } from "@/server/services/coupons/grantCouponPack";
import type { CouponPackTier } from "@/types/coupons";

type Body = {
  userId: string;
  tier: CouponPackTier;
  reason?: string;
  expiresAt?: string;
};

/** 관리자: 골프투어 쿠폰팩 지급 (포인트 잔액 미반영) */
export async function POST(request: Request) {
  const auth = await requireAdminSession();
  if (!auth.ok) return auth.res;

  let body: Body;
  try {
    body = (await request.json()) as Body;
  } catch {
    return NextResponse.json({ message: "요청 형식이 올바르지 않습니다." }, { status: 400 });
  }

  const userId = body.userId?.trim();
  const tier = body.tier === "RETURNING" ? "RETURNING" : body.tier === "WELCOME" ? "WELCOME" : null;
  if (!userId) {
    return NextResponse.json({ message: "userId는 필수입니다." }, { status: 400 });
  }
  if (!tier) {
    return NextResponse.json({ message: "tier는 WELCOME 또는 RETURNING 이어야 합니다." }, { status: 400 });
  }

  const pack: CouponPackDef = COUPON_PACKS[tier];
  const sourceRefId = `${userId}:${tier}:${Date.now()}`;

  try {
    const result = await grantCouponPack({
      userId,
      tier,
      sourceRefType: pack.refType,
      sourceRefId,
      reason: body.reason?.trim() || pack.reason,
      expiresAt: body.expiresAt?.trim() || null,
      skipIfExists: false,
    });

    if (!result.granted) {
      return NextResponse.json({ message: "이미 동일 소스로 지급된 쿠폰팩이 있습니다." }, { status: 409 });
    }

    return NextResponse.json({
      message: `${pack.buttonLabel}이 지급되었습니다.`,
      packId: result.packId,
      ledgerId: result.ledgerId,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "쿠폰팩 지급에 실패했습니다.";
    return NextResponse.json({ message }, { status: 500 });
  }
}
