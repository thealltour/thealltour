import { NextResponse } from "next/server";
import { requireAdminSession } from "@/lib/apiAuth";
import { resolveCustomerProfileForMember } from "@/lib/bookings/searchBookingCustomers";

type Body = {
  member_id?: string;
  customer_profile_id?: string;
};

/** 회원만 있는 경우 customer_profile 생성·연결 후 반환 */
export async function POST(request: Request) {
  const auth = await requireAdminSession();
  if (!auth.ok) return auth.res;

  let body: Body;
  try {
    body = (await request.json()) as Body;
  } catch {
    return NextResponse.json({ message: "요청 형식이 올바르지 않습니다." }, { status: 400 });
  }

  if (body.customer_profile_id?.trim()) {
    return NextResponse.json({
      customer_profile_id: body.customer_profile_id.trim(),
      member_id: body.member_id?.trim() || null,
    });
  }

  const memberId = body.member_id?.trim();
  if (!memberId) {
    return NextResponse.json({ message: "member_id 또는 customer_profile_id가 필요합니다." }, { status: 400 });
  }

  try {
    const resolved = await resolveCustomerProfileForMember(memberId);
    return NextResponse.json(resolved);
  } catch (error) {
    const message = error instanceof Error ? error.message : "고객 프로필 연결에 실패했습니다.";
    return NextResponse.json({ message }, { status: 400 });
  }
}
