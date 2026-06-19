import { NextRequest, NextResponse } from "next/server";
import { requireAdminSession } from "@/lib/apiAuth";
import { createStandaloneTravelBooking } from "@/lib/bookings/createTravelBooking";
import { resolveCustomerProfileForMember } from "@/lib/bookings/searchBookingCustomers";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import type { BookingPaymentStatus, BookingTravelerInput } from "@/types/travelBooking";

export async function GET(request: NextRequest) {
  const auth = await requireAdminSession();
  if (!auth.ok) return auth.res;

  const { searchParams } = new URL(request.url);
  const status = searchParams.get("status")?.trim();
  const q = searchParams.get("q")?.trim();

  let query = supabaseAdmin
    .from("travel_bookings")
    .select(
      "id, booking_number, booking_status, product_title, traveler_count, payment_status, departure_date, return_date, inquiry_id, member_id, customer_profile_id, primary_traveler_phone, payer_name, created_at",
    )
    .order("created_at", { ascending: false })
    .limit(100);

  if (status) query = query.eq("booking_status", status);
  if (q) query = query.or(`booking_number.ilike.%${q}%,product_title.ilike.%${q}%`);

  const { data, error } = await query;
  if (error) {
    return NextResponse.json({ message: "예약 목록을 불러올 수 없습니다." }, { status: 500 });
  }
  return NextResponse.json(data ?? []);
}

type CreateBody = {
  customer_profile_id?: string;
  member_id?: string;
  product_id?: string;
  product_title?: string;
  departure_date: string;
  return_date: string;
  traveler_count: number;
  payer_name?: string;
  primary_traveler_phone?: string;
  travelers?: BookingTravelerInput[];
  payment?: {
    status?: BookingPaymentStatus;
    method?: string;
    total_amount?: number;
    paid_amount?: number;
  };
  shipping_name?: string;
  shipping_phone?: string;
  shipping_zip?: string;
  shipping_address1?: string;
  shipping_address2?: string;
  send_confirmation_sms?: boolean;
  inquiry_id?: string;
};

export async function POST(request: Request) {
  const auth = await requireAdminSession();
  if (!auth.ok) return auth.res;

  let body: CreateBody;
  try {
    body = (await request.json()) as CreateBody;
  } catch {
    return NextResponse.json({ message: "요청 형식이 올바르지 않습니다." }, { status: 400 });
  }

  if ((!body.customer_profile_id && !body.member_id) || !body.departure_date || !body.return_date) {
    return NextResponse.json(
      { message: "고객 연결(customer_profile_id 또는 member_id), departure_date, return_date는 필수입니다." },
      { status: 400 },
    );
  }

  let customerProfileId = body.customer_profile_id?.trim() ?? "";
  let memberId = body.member_id?.trim() ?? null;

  if (!customerProfileId && memberId) {
    try {
      const resolved = await resolveCustomerProfileForMember(memberId);
      customerProfileId = resolved.customer_profile_id;
      memberId = resolved.member_id;
    } catch (error) {
      const message = error instanceof Error ? error.message : "고객 프로필 연결에 실패했습니다.";
      return NextResponse.json({ message }, { status: 400 });
    }
  }

  try {
    const result = await createStandaloneTravelBooking({
      customer_profile_id: customerProfileId,
      member_id: memberId,
      inquiry_id: body.inquiry_id?.trim() || null,
      product_id: body.product_id,
      product_title: body.product_title,
      departure_date: body.departure_date,
      return_date: body.return_date,
      traveler_count: Math.max(1, Number(body.traveler_count) || 1),
      payer_name: body.payer_name,
      primary_traveler_phone: body.primary_traveler_phone,
      travelers: body.travelers,
      payment: body.payment,
      shipping_name: body.shipping_name,
      shipping_phone: body.shipping_phone,
      shipping_zip: body.shipping_zip,
      shipping_address1: body.shipping_address1,
      shipping_address2: body.shipping_address2,
      send_confirmation_sms: body.send_confirmation_sms,
    });

    return NextResponse.json({ message: "예약이 확정되었습니다.", ...result }, { status: 201 });
  } catch (error) {
    const message = error instanceof Error ? error.message : "예약 생성에 실패했습니다.";
    return NextResponse.json({ message }, { status: 400 });
  }
}
