/** 섹션 제목 앞에만 사용. 본문 중간·제목 첫 줄에는 사용하지 않음. 전체 5개 이하 유지. */
export const BLOG_SECTION_EMOJI = {
  intro: "📍",
  summary: "✈️",
  notice: "⚠️",
  target: "💬",
  cta: "👉",
} as const;

/** 과장·판매 압박형 표현 — 제목·본문 생성 시 피함 */
export const BLOG_BANNED_AD_PHRASES =
  /지금\s*당장|무조건|역대급|미친\s*특가|지금\s*바로\s*구매|오늘\s*안에|마감\s*임박|결제하세요|지금\s*바로\s*예약|놓치면\s*후회/i;
