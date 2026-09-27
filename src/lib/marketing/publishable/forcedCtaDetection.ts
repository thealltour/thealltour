/**
 * Deterministic forced-CTA detection helpers for channel materializers.
 *
 * Core distinction:
 * - Topic / analysis / question language about an action ("지금 예약할까") is ALLOWED.
 * - Imperative / exhortative instruction to perform that action ("지금 예약하세요") is REJECTED.
 *
 * The bare token sequence "지금 예약" (or 구매/신청/변경) is NOT sufficient evidence of a CTA.
 */

/** Decision-topic action verbs that may appear in analysis without being a CTA. */
const ACTION_VERBS = "예약|구매|신청|변경";

/**
 * Imperative / exhortative continuations after "지금 (바로)? VERB …".
 * Matches channel-authored action commands, not questions or analytical noun phrases.
 */
export const IMPERATIVE_NOW_ACTION_CTA_RE = new RegExp(
  [
    String.raw`지금\s*(?:바로\s*)?(?:${ACTION_VERBS})`,
    String.raw`(?:`,
    // 하세요 / 해 보세요 / 해 보아요
    String.raw`하세요|해\s*보세요|해\s*보아요|`,
    // 해두세요 / 해 두세요 / 해두고 (brochure tone)
    String.raw`해\s*두(?:고|세요)|해두세요|`,
    // 을/를 진행하세요
    String.raw`(?:을|를)?\s*진행하세요|`,
    // 하시면 됩니다
    String.raw`하시면\s*됩니다`,
    String.raw`)`,
  ].join(""),
  "i",
);

/**
 * True when text instructs the reader to perform an immediate action (unauthorized CTA shape).
 * False for questions, comparisons, and analytical mentions of the same verbs.
 */
export function hasImperativeNowActionCta(text: string): boolean {
  return IMPERATIVE_NOW_ACTION_CTA_RE.test(text);
}
