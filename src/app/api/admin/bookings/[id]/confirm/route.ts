import { NextResponse } from "next/server";
import { requireAdminSession } from "@/lib/apiAuth";
import { sendBookingConfirmedSms } from "@/lib/bookings/bookingSms";
import { getTravelBookingById } from "@/lib/bookings/completeTravelBooking";

/** 예약 확정 SMS 재발송 */
export async function POST(
  request: Request,
  context: { params: Promise<{ id: string }> },
) {
  const auth = await requireAdminSession();
  if (!auth.ok) return auth.res;
  const { id } = await context.params;

  const booking = await getTravelBookingById(id);
  if (!booking) {
    return NextResponse.json({ message: "예약을 찾을 수 없습니다." }, { status: 404 });
  }

  const phone = String(booking.primary_traveler_phone ?? "");
  if (!phone) {
    return NextResponse.json({ message: "발송할 연락처가 없습니다." }, { status: 400 });
  }

  const ok = await sendBookingConfirmedSms({
    bookingId: id,
    inquiryId: booking.inquiry_id as string | null,
    receiver: phone,
    name: String(booking.payer_name ?? ""),
    booking_number: String(booking.booking_number),
    product_title: String(booking.product_title ?? ""),
    departure_date: String(booking.departure_date ?? ""),
    traveler_count: Number(booking.traveler_count ?? 1),
  });

  return NextResponse.json({
    message: ok ? "확정 SMS를 발송했습니다." : "SMS 발송에 실패했습니다.",
    sent: ok,
  });
}
