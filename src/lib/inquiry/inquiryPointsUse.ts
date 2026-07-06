export function normalizePointsUseRequested(raw: unknown): number {
  if (raw === null || raw === undefined || raw === "") return 0;
  const amount = typeof raw === "number" ? raw : Number.parseInt(String(raw).replace(/[^\d]/g, ""), 10);
  if (!Number.isFinite(amount) || amount <= 0) return 0;
  return Math.floor(amount);
}

export function validateInquiryPointsUse(params: {
  pointsUseRequested: number;
  pointBalance: number;
}): { ok: true } | { ok: false; message: string } {
  const { pointsUseRequested, pointBalance } = params;
  if (pointsUseRequested <= 0) return { ok: true };
  if (pointBalance <= 0) {
    return { ok: false, message: "사용 가능한 포인트가 없습니다." };
  }
  if (pointsUseRequested > pointBalance) {
    return { ok: false, message: "요청 포인트가 보유 잔액을 초과합니다." };
  }
  return { ok: true };
}

export function resolveDefaultPointsUseAmount(balance: number, quoteTotal: number | null | undefined): number {
  if (balance <= 0) return 0;
  if (quoteTotal != null && Number.isFinite(quoteTotal) && quoteTotal > 0) {
    return Math.min(balance, Math.floor(quoteTotal));
  }
  return balance;
}
