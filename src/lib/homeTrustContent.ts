/** 홈 Trust Micro·Full Trust에서 공유하는 사실 기반 신뢰 문구 */

export function normalizeTourismRegNo(value?: string): string | null {
  const trimmed = value?.trim() ?? "";
  if (!trimmed || trimmed === "미정") return null;
  return trimmed;
}

export type HomeTrustProofIconId = "registered" | "partner" | "consult";

export type HomeTrustProofItem = {
  id: HomeTrustProofIconId;
  /** 390px에서 2줄로 읽히는 핵심 label */
  lines: readonly [string, string];
};

/**
 * Early Trust Proof Strip — Full Trust와 동일한 사실 범위의 요약 3점.
 * 가짜 수치·과장 표현 없음. tourismRegNo는 표시용이며 3점 노출은 항상 유지.
 */
export function getHomeTrustProofItems(_tourismRegNo?: string): readonly HomeTrustProofItem[] {
  return [
    { id: "registered", lines: ["정식 등록", "여행사"] },
    { id: "partner", lines: ["주요 여행사", "공식 제휴"] },
    { id: "consult", lines: ["전문 상담사", "1:1 배정"] },
  ] as const;
}
