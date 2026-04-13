/** 서버에서 내려준 0~1 비율을 퍼센트 문자열로 표시 (재계산 없이 표시용) */
export function formatLandingAnalyticsRate(r: number, fractionDigits: 1 | 2 = 1): string {
  if (!Number.isFinite(r)) return "0%";
  return `${(r * 100).toFixed(fractionDigits)}%`;
}
