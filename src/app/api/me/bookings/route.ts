import { NextResponse } from "next/server";
import { requireMemberSession } from "@/lib/apiAuth";
import { findCustomerProfilesByMemberId } from "@/lib/customerAccountLinks";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

const LIST_FIELDS =
  "id, booking_number, booking_status, product_title, traveler_count, departure_date, return_date, payment_status, payer_name, primary_traveler_phone, shipping_name, shipping_phone, shipping_zip, shipping_address1, shipping_address2, created_at";

export async function GET() {
  const auth = await requireMemberSession();
  if (auth.res) return auth.res;
  const memberId = auth.session.memberId;

  const profiles = await findCustomerProfilesByMemberId(memberId);
  const profileIds = profiles.map((p) => p.id).filter(Boolean);

  let query = supabaseAdmin
    .from("travel_bookings")
    .select(LIST_FIELDS)
    .order("departure_date", { ascending: false })
    .limit(50);

  if (profileIds.length > 0) {
    query = query.or(`member_id.eq.${memberId},customer_profile_id.in.(${profileIds.join(",")})`);
  } else {
    query = query.eq("member_id", memberId);
  }

  const { data, error } = await query;
  if (error) {
    return NextResponse.json({ message: "예약 목록을 불러올 수 없습니다." }, { status: 500 });
  }

  return NextResponse.json(data ?? []);
}
