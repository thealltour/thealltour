import "server-only";

import { createHmac, timingSafeEqual } from "crypto";

export function verifyTextbeeWebhookSignature(
  rawBody: string,
  signatureHeader: string | null,
  secret: string | undefined,
): boolean {
  if (!secret?.trim()) {
    return process.env.NODE_ENV !== "production";
  }
  if (!signatureHeader?.trim()) return false;

  const expected = createHmac("sha256", secret.trim()).update(rawBody).digest("hex");
  const received = signatureHeader.trim();

  try {
    const a = Buffer.from(expected, "utf8");
    const b = Buffer.from(received, "utf8");
    if (a.length !== b.length) return false;
    return timingSafeEqual(a, b);
  } catch {
    return false;
  }
}

export type TextbeeWebhookPayload = {
  event?: string;
  webhookEvent?: string;
  timestamp?: string;
  data?: {
    _id?: string;
    sender?: string;
    message?: string;
    receivedAt?: string;
    [key: string]: unknown;
  };
  smsId?: string;
  sender?: string;
  message?: string;
  receivedAt?: string;
};

export function parseTextbeeReceivedEvent(payload: TextbeeWebhookPayload): {
  providerMessageId: string;
  sender: string;
  message: string;
  receivedAt: string;
} | null {
  const event = (payload.event ?? payload.webhookEvent ?? "").toUpperCase();
  if (event && event !== "MESSAGE_RECEIVED") return null;

  const data = payload.data;
  const providerMessageId = String(data?._id ?? payload.smsId ?? "").trim();
  const sender = String(data?.sender ?? payload.sender ?? "").trim();
  const message = String(data?.message ?? payload.message ?? "").trim();
  const receivedAtRaw = String(data?.receivedAt ?? payload.receivedAt ?? "").trim();
  const receivedAt = receivedAtRaw || new Date().toISOString();

  if (!providerMessageId || !sender) return null;
  return { providerMessageId, sender, message, receivedAt };
}
