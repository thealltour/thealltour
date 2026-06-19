import { NextResponse } from "next/server";
import { requireAdminSession } from "@/lib/apiAuth";
import { getCustomerBookingContext } from "@/lib/bookings/getCustomerBookingContext";

export async function GET(request: Request) {
  const auth = await requireAdminSession();
  if (!auth.ok) return auth.res;

  const url = new URL(request.url);
  const customerProfileId = url.searchParams.get("customer_profile_id")?.trim() ?? "";
  const memberId = url.searchParams.get("member_id")?.trim() || null;

  if (!customerProfileId) {
    return NextResponse.json({ message: "customer_profile_id는 필수입니다." }, { status: 400 });
  }

  try {
    const context = await getCustomerBookingContext({
      customer_profile_id: customerProfileId,
      member_id: memberId,
    });
    return NextResponse.json(context);
  } catch {
    return NextResponse.json({ message: "고객 컨텍스트를 불러올 수 없습니다." }, { status: 500 });
  }
}
