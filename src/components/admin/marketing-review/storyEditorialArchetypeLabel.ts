/**
 * UI-only labels for Story editorialArchetype values.
 * Does not alter stored archetype strings.
 */

const ARCHETYPE_LABELS_KO: Record<string, string> = {
  contrast: "대비형",
  hidden_detail: "숨은 디테일",
  expectation_vs_reality: "기대 vs 실제",
  alternative: "대안형",
  better_alternative: "대안형",
  cultural_curiosity: "문화 호기심",
  discovery: "발견형",
  experience_fit: "취향 적합",
  who_is_it_for: "누구에게 맞나",
  practical: "실용형",
  worth_it_or_not: "가치 판단",
  who_should_avoid: "피해야 할 사람",
  hidden_cost: "숨은 비용",
  decision_rule: "결정 규칙",
  common_mistake: "흔한 실수",
  tradeoff: "트레이드오프",
  myth_busting: "통념 깨기",
  before_you_book: "예약 전 체크",
  premium_or_overpriced: "프리미엄 vs 과금",
  convenience_vs_experience: "편의 vs 경험",
  family_fit: "가족 적합",
  parent_travel_fit: "부모님 여행 적합",
  couple_fit: "커플 적합",
};

/** Normalize for lookup only — returned display still uses original when unmapped. */
function normalizeArchetypeKey(raw: string): string {
  return raw.trim().toLowerCase().replace(/[\s-]+/g, "_");
}

/**
 * Human-friendly Korean label when mapped; otherwise the raw archetype string.
 * Empty/null → null (caller may render a placeholder badge).
 */
export function formatStoryEditorialArchetypeLabel(
  editorialArchetype: string | null | undefined,
): string | null {
  if (editorialArchetype == null) return null;
  const trimmed = editorialArchetype.trim();
  if (!trimmed) return null;
  const mapped = ARCHETYPE_LABELS_KO[normalizeArchetypeKey(trimmed)];
  return mapped ?? trimmed;
}

/** Parse `archetype:foo` fragments from agendaFitNotes without mutating storage. */
export function parseArchetypeFromAgendaFitNotes(
  agendaFitNotes: string | null | undefined,
): string | null {
  if (!agendaFitNotes || typeof agendaFitNotes !== "string") return null;
  const match = agendaFitNotes.match(/(?:^|\|\s*)archetype:([^\s|]+)/i);
  const value = match?.[1]?.trim();
  return value || null;
}
