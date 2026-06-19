import { NextResponse } from "next/server";
import { requireMemberSession } from "@/lib/apiAuth";
import { findCustomerProfilesByMemberId } from "@/lib/customerAccountLinks";
import { getTravelBookingByNumber } from "@/lib/bookings/completeTravelBooking";

export async function GET(
  _request: Request,
  context: { params: Promise<{ bookingNumber: string }> },
) {
  const auth = await requireMemberSession();
  if (auth.res) return auth.res;
  const memberId = auth.session.memberId;
  const { bookingNumber } = await context.params;

  const booking = await getTravelBookingByNumber(bookingNumber);
  if (!booking) {
    return NextResponse.json({ message: "예약을 찾을 수 없습니다." }, { status: 404 });
  }

  const b = booking as Record<string, unknown>;
  if (b.member_id === memberId) {
    return NextResponse.json(booking);
  }

  const profiles = await findCustomerProfilesByMemberId(memberId);
  const profileIds = new Set(profiles.map((p) => p.id));
  if (typeof b.customer_profile_id === "string" && profileIds.has(b.customer_profile_id)) {
    return NextResponse.json(booking);
  }

  return NextResponse.json({ message: "접근 권한이 없습니다." }, { status: 403 });
}
