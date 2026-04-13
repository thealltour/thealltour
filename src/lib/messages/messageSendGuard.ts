import { normalizeReceiverPhone } from "@/lib/notifications/sendAligoRelay";

export function createMessageFingerprint(input: { inquiryId: string; phone: string; text: string }): string {
  const phone = normalizeReceiverPhone(input.phone);
  const body = input.text.trim();
  return `${input.inquiryId}|${phone}|${body}`;
}

export function isDuplicateSendCandidate(params: {
  nextFingerprint: string;
  lastSentFingerprint?: string | null;
  lastSentAt?: string | null;
  cooldownMs: number;
}): boolean {
  const { nextFingerprint, lastSentFingerprint, lastSentAt, cooldownMs } = params;
  if (!lastSentFingerprint || !lastSentAt) return false;
  if (nextFingerprint !== lastSentFingerprint) return false;
  const t = Date.parse(lastSentAt);
  if (Number.isNaN(t)) return false;
  return Date.now() - t < cooldownMs;
}

/** 짧은 시간 내 동일 본문 재발송 방지 기본값(ms) */
export const DEFAULT_SEND_COOLDOWN_MS = 20_000;
