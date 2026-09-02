import { NextResponse } from "next/server";
import { confirmPortOneBookingPayment } from "@/lib/payments/confirmPortOneBookingPayment";
import { getPortOneWebhookSecret } from "@/lib/payments/portone/config";

type WebhookBody = {
  type?: string;
  timestamp?: string;
  data?: {
    paymentId?: string;
    transactionId?: string;
    status?: string;
  };
  paymentId?: string;
};

function extractPaymentId(body: WebhookBody): string | null {
  return body.data?.paymentId?.trim() || body.paymentId?.trim() || null;
}

export async function POST(request: Request) {
  let body: WebhookBody;
  try {
    body = (await request.json()) as WebhookBody;
  } catch {
    return NextResponse.json({ message: "invalid payload" }, { status: 400 });
  }

  const webhookSecret = getPortOneWebhookSecret();
  if (webhookSecret) {
    const headerSecret = request.headers.get("x-portone-signature") ?? request.headers.get("webhook-signature");
    if (headerSecret !== webhookSecret) {
      return NextResponse.json({ message: "invalid signature" }, { status: 401 });
    }
  }

  const paymentId = extractPaymentId(body);
  if (!paymentId) {
    return NextResponse.json({ message: "paymentId required" }, { status: 400 });
  }

  try {
    const result = await confirmPortOneBookingPayment(paymentId);
    if (!result.ok) {
      return NextResponse.json({ ok: false, message: "payment not confirmed yet" }, { status: 202 });
    }
    return NextResponse.json({
      ok: true,
      alreadyProcessed: result.alreadyProcessed ?? false,
      bookingId: result.bookingId,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "webhook failed";
    console.error("[portone webhook]", message);
    return NextResponse.json({ message }, { status: 500 });
  }
}
