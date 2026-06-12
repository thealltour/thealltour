/** textbee 등 수신 SMS 발신번호 정규화 (국내 10~11자리) */
export function normalizeInboundSenderPhone(raw: string): string {
  let digits = (raw ?? "").replace(/\D/g, "");
  if (digits.startsWith("82") && digits.length >= 11) {
    digits = `0${digits.slice(2)}`;
  }
  if (digits.startsWith("82") && digits.length === 10) {
    digits = `0${digits.slice(2)}`;
  }
  return digits.slice(0, 11);
}

/** DB inquiries.phone 과 비교용 — 저장값·수신값 모두 정규화 */
export function phonesMatchForInquiry(storedPhone: string, senderPhone: string): boolean {
  const a = normalizeInboundSenderPhone(storedPhone);
  const b = normalizeInboundSenderPhone(senderPhone);
  if (!a || !b) return false;
  if (a === b) return true;
  if (a.length >= 10 && b.length >= 10 && a.slice(-10) === b.slice(-10)) return true;
  return false;
}
