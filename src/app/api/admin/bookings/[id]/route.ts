import { NextResponse } from "next/server";
import { requireAdminSession } from "@/lib/apiAuth";
import {
  getTravelBookingById,
  listBookingPayments,
  listBookingTravelers,
} from "@/lib/bookings/completeTravelBooking";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

export async function GET(
  _request: Request,
  context: { params: Promise<{ id: string }> },
) {
  const auth = await requireAdminSession();
  if (!auth.ok) return auth.res;
  const { id } = await context.params;

  const booking = await getTravelBookingById(id);
  if (!booking) {
    return NextResponse.json({ message: "예약을 찾을 수 없습니다." }, { status: 404 });
  }

  const [travelers, payments] = await Promise.all([listBookingTravelers(id), listBookingPayments(id)]);

  let inquiry = null;
  let member = null;
  const inquiryId = booking.inquiry_id as string | null;
  const memberId = booking.member_id as string | null;

  if (inquiryId) {
    const { data } = await supabaseAdmin.from("inquiries").select("id, name, phone, product_title").eq("id", inquiryId).maybeSingle();
    inquiry = data;
  }
  if (memberId) {
    const { data } = await supabaseAdmin.from("members").select("id, name, email, phone").eq("id", memberId).maybeSingle();
    member = data;
  }

  return NextResponse.json({ ...booking, travelers, payments, inquiry, member });
}

export async function PATCH(
  request: Request,
  context: { params: Promise<{ id: string }> },
) {
  const auth = await requireAdminSession();
  if (!auth.ok) return auth.res;
  const { id } = await context.params;

  let body: Record<string, unknown>;
  try {
    body = (await request.json()) as Record<string, unknown>;
  } catch {
    return NextResponse.json({ message: "요청 형식이 올바르지 않습니다." }, { status: 400 });
  }

  const allowed = [
    "departure_date",
    "return_date",
    "product_title",
    "traveler_count",
    "payer_name",
    "primary_traveler_phone",
    "payment_status",
    "payment_method",
    "payment_total_amount",
    "payment_paid_amount",
    "shipping_name",
    "shipping_phone",
    "shipping_zip",
    "shipping_address1",
    "shipping_address2",
  ];

  const payload: Record<string, unknown> = { updated_at: new Date().toISOString() };
  for (const key of allowed) {
    if (key in body) payload[key] = body[key];
  }

  const { error } = await supabaseAdmin.from("travel_bookings").update(payload).eq("id", id);
  if (error) {
    return NextResponse.json({ message: "예약 수정에 실패했습니다." }, { status: 500 });
  }
  return NextResponse.json({ message: "수정되었습니다." });
}
