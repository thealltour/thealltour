export const MAX_PORTONE_PAYMENT_ID_LENGTH = 40;

export type PortOneTransactionPrefix = "dep" | "full" | "bal" | "ord";

const PAYMENT_ID_PATTERN = /^[A-Za-z0-9_-]+$/;

/** KG이니시스 등 PG merchant_uid 길이 제한(40자) 준수 */
export function assertPortOnePaymentIdLength(id: string): void {
  const trimmed = id.trim();
  if (!trimmed || trimmed.length > MAX_PORTONE_PAYMENT_ID_LENGTH) {
    throw new Error("INVALID_PORTONE_PAYMENT_ID_LENGTH");
  }
  if (!PAYMENT_ID_PATTERN.test(trimmed)) {
    throw new Error("INVALID_PORTONE_PAYMENT_ID_FORMAT");
  }
}

export function isValidPortOnePaymentId(id: string): boolean {
  try {
    assertPortOnePaymentIdLength(id);
    return true;
  } catch {
    return false;
  }
}

/**
 * PortOne paymentId / DB external_payment_id 전용 (상품 UUID와 분리).
 * 형식: {prefix}-{timestamp}-{random5} → 약 23~26자
 */
export function createPortOneTransactionId(
  prefix: PortOneTransactionPrefix = "ord",
): string {
  const random = Math.random().toString(36).substring(2, 7);
  const id = `${prefix}-${Date.now()}-${random}`;
  assertPortOnePaymentIdLength(id);
  return id;
}

/** 클라이언트·서버 공통 — prepare 요청 transaction_id 검증 */
export function resolvePortOneTransactionId(
  candidate: string | undefined | null,
  fallbackPrefix: PortOneTransactionPrefix,
): string {
  const trimmed = candidate?.trim();
  if (trimmed && isValidPortOnePaymentId(trimmed)) {
    return trimmed;
  }
  return createPortOneTransactionId(fallbackPrefix);
}
