/** 홈 Trust Micro·Full Trust에서 공유하는 사실 기반 신뢰 문구 */

export function normalizeTourismRegNo(value?: string): string | null {
  const trimmed = value?.trim() ?? "";
  if (!trimmed || trimmed === "미정") return null;
  return trimmed;
}

/** Early Trust Micro strip — 검증 가능한 정보만 (가짜 수치·로고 없음) */
export function getHomeTrustMicroItems(tourismRegNo?: string): readonly string[] {
  const items: string[] = [];
  if (normalizeTourismRegNo(tourismRegNo)) {
    items.push("등록 여행사");
  }
  items.push("주요 여행사 제휴", "1:1 맞춤 상담");
  return items;
}
