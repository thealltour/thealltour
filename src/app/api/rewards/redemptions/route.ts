import { NextResponse } from "next/server";
import { requireMemberSession } from "@/lib/apiAuth";
import { supabase } from "@/lib/supabase";
import {
  createRewardRedemption,
  mapRedemptionServiceError,
} from "@/server/services/rewards/redemptions";

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

/** @deprecated POST /api/me/rewards/redemptions 사용 */
export async function POST(request: Request) {
  const auth = await requireMemberSession();
  if (auth.res) return auth.res;

  let body: Body;
  try {
    body = (await request.json()) as Body;
  } catch {
    return NextResponse.json({ message: "요청 형식이 올바르지 않습니다." }, { status: 400 });
  }

  const shipping = body.shippingInfo;
  const catalogId = body.catalogId?.trim();
  const shippingName = shipping?.shipping_name?.trim();
  const shippingPhone = shipping?.shipping_phone?.trim();
  const shippingAddress1 = shipping?.shipping_address1?.trim();

  if (!catalogId || !shippingName || !shippingPhone || !shippingAddress1) {
    return NextResponse.json(
      { message: "경품 선택과 수령인 이름, 연락처, 주소는 필수입니다." },
      { status: 400 },
    );
  }

  try {
    const result = await createRewardRedemption(
      {
        userId: auth.session.memberId,
        catalogId,
        shippingName,
        shippingPhone,
        shippingAddress1,
        shippingAddress2: shipping?.shipping_address2?.trim() || null,
        shippingZip: shipping?.shipping_zip?.trim() || null,
        userMessage: body.userMessage?.trim(),
      },
      supabase,
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
