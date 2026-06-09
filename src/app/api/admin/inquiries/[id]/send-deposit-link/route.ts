import { NextResponse } from "next/server";
import { requireAdminSession } from "@/lib/apiAuth";
import { getSiteSettingsLive } from "@/lib/siteSettings";
import { getSiteBaseUrl } from "@/lib/seo/getSiteSeoDefaults";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { sendAligoRelay, AligoRelayError } from "@/lib/notifications/sendAligoRelay";

type RouteContext = { params: Promise<{ id: string }> };

export async function POST(_request: Request, context: RouteContext) {
  const auth = await requireAdminSession();
  if (!auth.ok) return auth.res;

  const { id } = await context.params;
  const inquiryId = id?.trim();
  if (!inquiryId) {
    return NextResponse.json({ message: "문의 ID가 필요합니다." }, { status: 400 });
  }

  const { data: inquiry, error } = await supabaseAdmin
    .from("inquiries")
    .select("id, name, phone, product_title")
    .eq("id", inquiryId)
    .maybeSingle();

  if (error || !inquiry) {
    return NextResponse.json({ message: "문의를 찾을 수 없습니다." }, { status: 404 });
  }

  const settings = await getSiteSettingsLive();
  const siteUrl = getSiteBaseUrl();
  const depositUrl = `${siteUrl}/deposit?inquiryId=${encodeURIComponent(inquiryId)}`;
  const amount = settings.deposit_amount_default?.trim() || "상담 후 안내";
  const productTitle =
    typeof inquiry.product_title === "string" && inquiry.product_title.trim()
      ? inquiry.product_title.trim()
      : "여행 상품";

  const message = `[더올투어] ${String(inquiry.name ?? "고객")}님, ${productTitle} 예약금 안내드립니다.\n예약금: ${amount}\n${depositUrl}`;

  const phone = String(inquiry.phone ?? "").trim();
  if (!phone) {
    return NextResponse.json({ message: "문의에 연락처가 없습니다." }, { status: 400 });
  }

  try {
    const sms = await sendAligoRelay({ receiver: phone, msg: message });
    if (!sms.ok) {
      return NextResponse.json({ message: "예약금 안내 SMS 발송에 실패했습니다." }, { status: 500 });
    }
  } catch (error) {
    const messageText =
      error instanceof AligoRelayError ? error.message : "예약금 안내 SMS 발송에 실패했습니다.";
    return NextResponse.json({ message: messageText }, { status: 500 });
  }

  return NextResponse.json({
    message: "예약금 안내 링크를 발송했습니다.",
    depositUrl,
  });
}
