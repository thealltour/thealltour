/**
 * Deterministic publishability checks — no second LLM critic.
 */

import { isOutlineHeaderLine } from "@/lib/marketing/assets/shortform/narrationSegments";
import type {
  PublishableChannel,
  PublishableValidationIssue,
  PublishableValidationResult,
} from "@/lib/marketing/publishable/contracts";

const EVIDENCE_UUID_RE =
  /\[[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\]/gi;
const BARE_UUID_RE =
  /\b[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\b/gi;
const ASSIGNMENT_ID_RE = /\b(asg_|assignmentId|assignment id|contentAssignment)\b/i;
const INTERNAL_TERM_RE =
  /\b(assignment evidence|Key verified facts|Travel relevance for audience|Useful takeaway without product|CTA aligned to commercialIntent|commercialIntent|contentPlan|governance|ACRB|researchBriefId)\b/i;

const SLOP_PATTERNS: Array<{ re: RegExp; label: string }> = [
  { re: /요즘\s+.+(?:주목|화제).+(?:받고\s*있습니다|입니다)/, label: "요즘 주목" },
  { re: /단순한\s+.+\s*를\s*넘어/, label: "단순한 A를 넘어" },
  { re: /특별한\s+경험을\s+선사/, label: "특별한 경험 선사" },
  { re: /완벽한\s+선택입니다/, label: "완벽한 선택" },
  { re: /새로운\s+기준/, label: "새로운 기준" },
  { re: /놓치지\s*마세요/, label: "놓치지 마세요" },
  { re: /오늘은\s+.+\s*에\s*대해\s*알아보겠습니다/, label: "오늘은 알아보겠습니다" },
  { re: /많은\s+분들이\s+궁금해하시는데요/, label: "많은 분들이 궁금해" },
];

const FAKE_PERSONAL_RE =
  /제가\s*직접\s*(가|타|체험|확인)|직접\s*가보니|제가\s*타보니|제가\s*써보니/;

const FAKE_URGENCY_RE =
  /지금\s*바로|마감\s*임박|단독\s*!|한정\s*수량|오늘만|서둘러\s*예약|남은\s*좌석/;

const PRICE_AVAIL_RE =
  /\d{1,3}(?:,\d{3})+\s*원|₩\s*\d|잔여\s*\d+\s*석|매진\s*임박|특가\s*\d/;

export function stripEvidenceIdsFromText(text: string): string {
  return text
    .replace(EVIDENCE_UUID_RE, "")
    .replace(BARE_UUID_RE, "")
    .replace(/[ \t]{2,}/g, " ")
    .replace(/[ \t]+\n/g, "\n")
    .replace(/\n[ \t]+/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .replace(/[ \t]+([,.])/g, "$1")
    .trim();
}

export function looksLikeInternalPlanningBody(body: string): boolean {
  const lines = body
    .split(/\n/)
    .map((l) => l.trim())
    .filter(Boolean);
  if (lines.length === 0) return true;
  const headerHits = lines.filter((l) => isOutlineHeaderLine(l)).length;
  if (headerHits >= 2) return true;
  if (INTERNAL_TERM_RE.test(body)) return true;
  if (EVIDENCE_UUID_RE.test(body) || BARE_UUID_RE.test(body)) return true;
  return false;
}

export function countPhraseOccurrences(haystack: string, phrase: string): number {
  const needle = phrase.trim();
  if (!needle || needle.length < 4) return 0;
  let count = 0;
  let idx = 0;
  while (idx < haystack.length) {
    const found = haystack.indexOf(needle, idx);
    if (found < 0) break;
    count += 1;
    idx = found + needle.length;
  }
  return count;
}

/** Instagram truncates the caption here; anything after it needs a tap to reveal. */
export const INSTAGRAM_HOOK_VISIBLE_CHARS = 125;
export const INSTAGRAM_CAPTION_MAX_CHARS = 2200;
export const INSTAGRAM_HASHTAG_MIN = 3;
export const INSTAGRAM_HASHTAG_MAX = 12;

/**
 * Threads body hard limit — single source of truth for publishability + review UI.
 * Prefer the preferred band in prompts; never exceed the hard max.
 */
export const THREADS_BODY_MAX_CHARS = 500;
export const THREADS_BODY_PREFERRED_MIN_CHARS = 350;
export const THREADS_BODY_PREFERRED_MAX_CHARS = 450;

/** Captions render links as plain text, so "링크 클릭" is a dead end for the reader. */
const INSTAGRAM_LINK_CTA_RE =
  /(?:아래|하단|본문)?\s*링크\s*(?:를\s*)?(?:클릭|눌러|타고|접속)|링크\s*참고|https?:\/\//;

export function extractInstagramHashtags(caption: string): string[] {
  return (caption.match(/#[^\s#]+/g) ?? []).map((tag) => tag.trim());
}

export function instagramCaptionIssues(caption: string): PublishableValidationIssue[] {
  const issues: PublishableValidationIssue[] = [];
  const trimmed = caption.trim();
  if (!trimmed) return issues;

  if (trimmed.length > INSTAGRAM_CAPTION_MAX_CHARS) {
    issues.push({
      code: "too_long",
      message: `Instagram caption exceeds ${INSTAGRAM_CAPTION_MAX_CHARS} characters`,
    });
  }

  const visible = trimmed.slice(0, INSTAGRAM_HOOK_VISIBLE_CHARS);
  const visibleWithoutTags = visible.replace(/#[^\s#]+/g, "").trim();
  if (visibleWithoutTags.length < 20) {
    issues.push({
      code: "weak_hook",
      message: `First ${INSTAGRAM_HOOK_VISIBLE_CHARS} characters carry no hook before the fold`,
    });
  }

  const hashtags = extractInstagramHashtags(trimmed);
  const unique = new Set(hashtags.map((tag) => tag.toLowerCase()));
  if (hashtags.length < INSTAGRAM_HASHTAG_MIN) {
    issues.push({
      code: "hashtag_policy",
      message: `Needs at least ${INSTAGRAM_HASHTAG_MIN} hashtags for discovery`,
    });
  }
  if (hashtags.length > INSTAGRAM_HASHTAG_MAX) {
    issues.push({
      code: "hashtag_policy",
      message: `More than ${INSTAGRAM_HASHTAG_MAX} hashtags reads as spam`,
    });
  }
  if (unique.size !== hashtags.length) {
    issues.push({ code: "hashtag_policy", message: "Duplicate hashtags" });
  }

  if (INSTAGRAM_LINK_CTA_RE.test(trimmed)) {
    issues.push({
      code: "unclickable_link_cta",
      message: "Instagram captions cannot render clickable links — point to the profile link instead",
    });
  }

  return issues;
}

export function validatePublishableText(
  body: string,
  options?: {
    requireNonEmpty?: boolean;
    channel?: PublishableChannel;
    title?: string | null;
    primaryTopic?: string | null;
    allowHeadings?: boolean;
  },
): PublishableValidationResult {
  const issues: PublishableValidationIssue[] = [];
  const trimmed = body.trim();
  const channel = options?.channel;

  if (options?.requireNonEmpty !== false && !trimmed) {
    issues.push({ code: "empty_body", message: "Publishable body is empty" });
  }

  if (/\[object Object\]/i.test(trimmed)) {
    issues.push({ code: "object_leak", message: "Contains [object Object]" });
  }

  if (/```/.test(trimmed)) {
    issues.push({ code: "json_fence_leak", message: "Contains markdown code fences" });
  }

  if (EVIDENCE_UUID_RE.test(trimmed) || BARE_UUID_RE.test(trimmed)) {
    issues.push({ code: "evidence_id_leak", message: "Contains evidence UUID" });
  }

  if (ASSIGNMENT_ID_RE.test(trimmed)) {
    issues.push({ code: "assignment_id_leak", message: "Contains assignment identifier" });
  }

  const lines = trimmed.split(/\n/).map((l) => l.trim()).filter(Boolean);
  const allowHeadings = options?.allowHeadings === true || channel === "naver_blog";
  if (
    (!allowHeadings && lines.some((l) => isOutlineHeaderLine(l))) ||
    INTERNAL_TERM_RE.test(trimmed)
  ) {
    issues.push({
      code: "internal_heading_leak",
      message: "Contains internal planning headings or system terms",
    });
  }

  for (const pattern of SLOP_PATTERNS) {
    if (pattern.re.test(trimmed)) {
      issues.push({
        code: "template_slop",
        message: `AI-slop pattern detected: ${pattern.label}`,
      });
      break;
    }
  }

  if (FAKE_PERSONAL_RE.test(trimmed)) {
    issues.push({
      code: "fake_personal_experience",
      message: "Fake first-person experience phrasing detected",
    });
  }

  if (channel === "naver_blog") {
    if (!options?.title?.trim()) {
      issues.push({ code: "missing_title", message: "Blog requires selected title" });
    }
    const topic = options?.primaryTopic?.trim();
    if (topic && countPhraseOccurrences(trimmed, topic) >= 8) {
      issues.push({
        code: "keyword_stuffing",
        message: `Primary topic repeated too often: ${topic}`,
      });
    }
    if (!/^#\s+/m.test(trimmed) && !/^##\s+/m.test(trimmed)) {
      // Soft: blog should have at least one markdown heading for structure
      issues.push({
        code: "template_slop",
        message: "Blog body missing useful markdown headings",
      });
    }
  }

  if (channel === "naver_band") {
    if (trimmed.length > 2200) {
      issues.push({ code: "too_long", message: "Band post excessively long" });
    }
  }

  if (channel === "threads") {
    if (trimmed.length > THREADS_BODY_MAX_CHARS) {
      issues.push({
        code: "too_long",
        message: `Threads body exceeds ${THREADS_BODY_MAX_CHARS} characters (${trimmed.length}/${THREADS_BODY_MAX_CHARS})`,
      });
    }
  }

  if (channel === "instagram") {
    issues.push(...instagramCaptionIssues(trimmed));
  }

  if (channel === "kakao_channel") {
    if (trimmed.length > 900) {
      issues.push({ code: "too_long", message: "Kakao Channel post too long" });
    }
    if (trimmed.length > 0 && trimmed.length < 40) {
      issues.push({ code: "too_short", message: "Kakao Channel post too short" });
    }
    if (FAKE_URGENCY_RE.test(trimmed)) {
      issues.push({ code: "fake_urgency", message: "Unverified urgency language" });
    }
    if (PRICE_AVAIL_RE.test(trimmed)) {
      issues.push({
        code: "unsupported_price_availability",
        message: "Unsupported price/availability language",
      });
    }
  }

  return { ok: issues.length === 0, issues };
}

/** Structural differentiation checks — not semantic distance. */
export function assertChannelNativeStructure(input: {
  blogBody?: string | null;
  bandBody?: string | null;
  kakaoBody?: string | null;
}): { ok: boolean; reasons: string[] } {
  const reasons: string[] = [];
  const blog = input.blogBody?.trim() ?? "";
  const band = input.bandBody?.trim() ?? "";
  const kakao = input.kakaoBody?.trim() ?? "";

  if (blog) {
    if (!/^#+\s+/m.test(blog)) reasons.push("blog_missing_headings");
    if (blog.length < 400) reasons.push("blog_too_short_for_search_article");
  }
  if (band) {
    if (band.length > 1800) reasons.push("band_too_long");
    if (!/[?？]/.test(band) && !/어떠|궁금|경험|의견/.test(band)) {
      reasons.push("band_missing_community_cue");
    }
  }
  if (kakao) {
    if (kakao.length > 900) reasons.push("kakao_too_long");
    if (kakao.split(/\n+/).filter(Boolean).length > 12) {
      reasons.push("kakao_too_many_paragraphs");
    }
  }
  if (blog && band && blog === band) reasons.push("blog_band_identical");
  if (blog && kakao && blog === kakao) reasons.push("blog_kakao_identical");
  if (band && kakao && band === kakao) reasons.push("band_kakao_identical");

  return { ok: reasons.length === 0, reasons };
}
