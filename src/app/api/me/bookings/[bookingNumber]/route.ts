import { NextResponse } from "next/server";
import { requireMemberSession } from "@/lib/apiAuth";
import { findCustomerProfilesByMemberId } from "@/lib/customerAccountLinks";
import { listBookingPayments, listBookingTravelers } from "@/lib/bookings/completeTravelBooking";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

async function authorizeBooking(memberId: string, booking: Record<string, unknown>) {
  if (booking.member_id === memberId) return true;
  const profiles = await findCustomerProfilesByMemberId(memberId);
  const profileIds = new Set(profiles.map((p) => p.id));
  return typeof booking.customer_profile_id === "string" && profileIds.has(booking.customer_profile_id);
}

async function fetchAuthorizedBooking(memberId: string, param: string) {
  let query = supabaseAdmin.from("travel_bookings").select("*");
  query = UUID_RE.test(param)
    ? query.eq("id", param)
    : query.eq("booking_number", param.trim());

  const { data: booking, error } = await query.maybeSingle();
  if (error || !booking) return null;

  const row = booking as Record<string, unknown>;
  if (!(await authorizeBooking(memberId, row))) return null;
  return row;
}

export async function GET(
  _request: Request,
  context: { params: Promise<{ bookingNumber: string }> },
) {
  const auth = await requireMemberSession();
  if (auth.res) return auth.res;
  const { bookingNumber: param } = await context.params;

  const row = await fetchAuthorizedBooking(auth.session.memberId, param);
  if (!row) {
    return NextResponse.json({ message: "예약을 찾을 수 없습니다." }, { status: 404 });
  }

  const bookingId = String(row.id);
  const [travelers, payments] = await Promise.all([
    listBookingTravelers(bookingId),
    listBookingPayments(bookingId),
  ]);

  return NextResponse.json({
    ...row,
    travelers,
    payments,
  });
}
