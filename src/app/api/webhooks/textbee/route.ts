import { NextResponse } from "next/server";
import { processTextbeeInboundWebhook } from "@/lib/sms/textbeeInbound";
import {
  parseTextbeeReceivedEvent,
  verifyTextbeeWebhookSignature,
  type TextbeeWebhookPayload,
} from "@/lib/sms/textbeeWebhook";

export async function POST(request: Request) {
  const rawBody = await request.text();
  const signature =
    request.headers.get("x-signature") ?? request.headers.get("x-textbee-signature");

  const secret = process.env.TEXTBEE_WEBHOOK_SECRET;
  if (!verifyTextbeeWebhookSignature(rawBody, signature, secret)) {
    console.warn("[textbee webhook] invalid signature");
    return NextResponse.json({ message: "Invalid signature" }, { status: 401 });
  }

  let payload: TextbeeWebhookPayload;
  try {
    payload = JSON.parse(rawBody) as TextbeeWebhookPayload;
  } catch {
    return NextResponse.json({ message: "Invalid JSON" }, { status: 400 });
  }

  const parsed = parseTextbeeReceivedEvent(payload);
  if (!parsed) {
    return NextResponse.json({ ok: true, skipped: true });
  }

  const result = await processTextbeeInboundWebhook(payload);
  if (!result.ok) {
    console.error("[textbee webhook] process failed", result.reason);
    return NextResponse.json({ ok: false, reason: result.reason }, { status: 500 });
  }

  return NextResponse.json({
    ok: true,
    duplicate: result.duplicate,
    inboundSmsId: result.duplicate ? undefined : result.inboundSmsId,
    inquiryId: result.duplicate ? undefined : result.inquiryId,
  });
}
