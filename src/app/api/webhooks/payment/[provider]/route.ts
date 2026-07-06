import { NextResponse } from "next/server";
import { confirmPortOneBookingPayment } from "@/lib/payments/confirmPortOneBookingPayment";

/** PG webhook — provider=portone 은 전용 라우트 사용 권장 */
export async function POST(
  request: Request,
  context: { params: Promise<{ provider: string }> },
) {
  const { provider } = await context.params;

  if (provider === "portone") {
    const { POST: portonePost } = await import("@/app/api/webhooks/payment/portone/route");
    return portonePost(request);
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ message: "invalid payload" }, { status: 400 });
  }

  console.info("[payment webhook stub]", provider, body);
  return NextResponse.json({
    ok: true,
    provider,
    message: "Webhook stub — PG 연동 시 booking_payments 및 payment_status를 업데이트합니다.",
  });
}
