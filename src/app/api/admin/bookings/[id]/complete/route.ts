import { NextResponse } from "next/server";
import { requireAdminSession } from "@/lib/apiAuth";
import { completeTravelBooking, getTravelBookingById } from "@/lib/bookings/completeTravelBooking";
import { sendTripCompletedSms } from "@/lib/bookings/bookingSms";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

export async function POST(
  request: Request,
  context: { params: Promise<{ id: string }> },
) {
  const auth = await requireAdminSession();
  if (!auth.ok) return auth.res;
  const { id } = await context.params;

  let sendSms = true;
  try {
    const body = (await request.json()) as { send_completion_sms?: boolean };
    if (body.send_completion_sms === false) sendSms = false;
  } catch {
    // default send
  }

  try {
    const result = await completeTravelBooking(id);

    if (sendSms) {
      const booking = await getTravelBookingById(id);
      const phone = String(booking?.primary_traveler_phone ?? "");
      if (phone) {
        await sendTripCompletedSms({
          bookingId: id,
          inquiryId: result.inquiry_id,
          receiver: phone,
          name: String(booking?.payer_name ?? ""),
          booking_number: result.booking_number,
          review_link: result.claim_link ?? "",
          reward_hint: "마이페이지에서 리워드(포인트·골프공) 신청이 가능합니다.",
        });
      }
    }

    if (result.customer_profile_id) {
      const { data: link } = await supabaseAdmin
        .from("customer_account_links")
        .select("member_id")
        .eq("customer_profile_id", result.customer_profile_id)
        .limit(1)
        .maybeSingle();
      const memberId = (link as { member_id?: string } | null)?.member_id;
      if (memberId) {
        await supabaseAdmin.from("notifications").insert({
          user_id: memberId,
          type: "ADMIN_MESSAGE",
          title: "여행 완료",
          body: `예약번호 ${result.booking_number} 여행이 완료되었습니다. 마이페이지에서 리워드를 신청해 주세요.`,
        });
      }
    }

    return NextResponse.json({
      message: "여행 완료 처리되었습니다.",
      ...result,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "완료 처리에 실패했습니다.";
    return NextResponse.json({ message }, { status: 400 });
  }
}
