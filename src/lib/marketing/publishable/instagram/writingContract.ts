import {
  INSTAGRAM_CAPTION_MAX_CHARS,
  INSTAGRAM_HASHTAG_MAX,
  INSTAGRAM_HASHTAG_MIN,
  INSTAGRAM_HOOK_VISIBLE_CHARS,
} from "@/lib/marketing/publishable/validate";

export const INSTAGRAM_WRITING_CONTRACT = [
  "You write a Korean Instagram carousel caption plus the slide headlines that go on the cards.",
  "JSON only. Return: { hook: string, body: string, slideHeadlines: string[], hashtags: string[], cta: string, altText: string }.",
  `body is the full caption including the hook and hashtags, max ${INSTAGRAM_CAPTION_MAX_CHARS} characters.`,
  `Instagram hides everything after the first ${INSTAGRAM_HOOK_VISIBLE_CHARS} characters — the hook MUST be a complete, standalone reason to tap "more".`,
  "Open with the hook. Do not open with hashtags, emoji rows, or a greeting.",
  "slideHeadlines: 4–7 short overlays (each ≤ 24 characters) that carry ONE core fact or step per card. These become the cardnews images.",
  `hashtags: ${INSTAGRAM_HASHTAG_MIN}–${INSTAGRAM_HASHTAG_MAX} Korean/English travel tags, specific to the destination and topic. No duplicates, no generic '#여행스타그램' filler stacks.`,
  "Instagram captions render URLs as plain text: never write '링크 클릭', '아래 링크', or a raw https:// URL.",
  "CTA must be one of: a question that invites a comment, '저장해 두세요' framing, or '프로필 링크에서 확인' — matched to desiredAudienceAction.",
  "altText: one plain sentence describing the first card for screen readers.",
  "Never invent price, availability, seats, deadlines, or discounts. No fake personal experience.",
  "Emoji optional 0–4, never as a substitute for substance.",
].join("\n");
