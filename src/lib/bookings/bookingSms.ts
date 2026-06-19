import "server-only";

import { applySmsTemplate, getSmsTemplateByCategory } from "@/lib/sms/smsTemplates";
import { sendAdminSms } from "@/lib/sms/sendAdminSms";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

type BookingSmsContext = {
  bookingId: string;
  inquiryId?: string | null;
  receiver: string;
  name?: string;
  booking_number: string;
  product_title?: string;
  departure_date?: string;
  traveler_count?: number;
  review_link?: string;
  reward_hint?: string;
};

const DEFAULT_CONFIRMED = `[더올투어 예약확정]
{{name}}님, 예약이 확정되었습니다.

예약번호: {{booking_number}}
상품: {{product_title}}
출발일: {{departure_date}}
인원: {{traveler_count}}명

감사합니다.`;

const DEFAULT_COMPLETED = `[더올투어 여행완료]
{{name}}님, 여행이 완료되었습니다.

예약번호: {{booking_number}}
{{reward_hint}}

감사합니다.`;

function applyBookingTemplate(
  body: string,
  ctx: BookingSmsContext,
): string {
  let out = applySmsTemplate(body, {
    name: ctx.name,
    phone: ctx.receiver,
    product_title: ctx.product_title,
  });
  const extras: Record<string, string> = {
    booking_number: ctx.booking_number,
    departure_date: ctx.departure_date ?? "",
    traveler_count: String(ctx.traveler_count ?? ""),
    review_link: ctx.review_link ?? "",
    reward_hint: ctx.reward_hint ?? "마이페이지에서 리워드 신청이 가능합니다.",
  };
  for (const [key, value] of Object.entries(extras)) {
    out = out.replaceAll(`{{${key}}}`, value);
  }
  return out;
}

export async function sendBookingConfirmedSms(ctx: BookingSmsContext): Promise<boolean> {
  if (!ctx.receiver?.trim()) return false;

  const tpl = await getSmsTemplateByCategory("booking_confirmed");
  const message = applyBookingTemplate(tpl?.body ?? DEFAULT_CONFIRMED, ctx);

  const result = await sendAdminSms({
    receiver: ctx.receiver,
    message,
    inquiryId: ctx.inquiryId != null ? String(ctx.inquiryId) : null,
    actorName: "시스템",
  });

  if (result.ok) {
    await supabaseAdmin
      .from("travel_bookings")
      .update({ booking_confirmed_sms_sent_at: new Date().toISOString() })
      .eq("id", ctx.bookingId);
  }
  return result.ok;
}

export async function sendTripCompletedSms(ctx: BookingSmsContext): Promise<boolean> {
  if (!ctx.receiver?.trim()) return false;

  const tpl = await getSmsTemplateByCategory("trip_completed");
  const message = applyBookingTemplate(tpl?.body ?? DEFAULT_COMPLETED, ctx);

  const result = await sendAdminSms({
    receiver: ctx.receiver,
    message,
    inquiryId: ctx.inquiryId != null ? String(ctx.inquiryId) : null,
    actorName: "시스템",
  });

  if (result.ok) {
    await supabaseAdmin
      .from("travel_bookings")
      .update({ trip_completed_sms_sent_at: new Date().toISOString() })
      .eq("id", ctx.bookingId);
  }
  return result.ok;
}
