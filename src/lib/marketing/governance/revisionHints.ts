import type { GovernanceReason, GovernanceReasonCode } from "@/lib/marketing/governance/types";

const REVISION_HINTS: Partial<Record<GovernanceReasonCode, string>> = {
  EXACT_DUPLICATE: "기존 문구와 동일하므로 새로운 각도로 재작성 필요",
  NORMALIZED_DUPLICATE: "표현만 다른 기존 문구와 동일하므로 새로운 각도로 재작성 필요",
  AGENDA_OVERUSED: "최근 동일 agenda 사용 빈도가 높아 다른 agenda 선택 필요",
  SEMANTIC_SIMILARITY_HIGH: "과거 콘텐츠와 의미 유사도가 높아 hook/angle 변경 필요",
  SAME_CHANNEL_RECENT_SIMILAR: "같은 채널에 최근 유사한 콘텐츠가 있어 hook/angle 변경 필요",
  CHANNEL_DAILY_LIMIT: "해당 채널의 일일 게시 한도에 도달했으므로 일정 조정 또는 다른 채널 검토가 필요",
  SEMANTIC_SIMILARITY_REVIEW: "과거 콘텐츠와 의미가 비슷하므로 hook 또는 사례를 바꿔 재작성하는 것이 필요",
  AGENDA_RECENT_REPEAT: "최근 동일 agenda를 반복 사용했으므로 다른 주제나 각도를 선택하는 것이 필요",
};

export function revisionHintsForReasons(reasons: GovernanceReason[]): string[] {
  const hints: string[] = [];
  const seen = new Set<string>();
  for (const reason of reasons) {
    const hint = REVISION_HINTS[reason.code];
    if (!hint || seen.has(hint)) continue;
    seen.add(hint);
    hints.push(hint);
  }
  return hints;
}
