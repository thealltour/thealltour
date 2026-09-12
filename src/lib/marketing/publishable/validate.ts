/**
 * Deterministic publishability checks — no second LLM critic.
 */

import { isOutlineHeaderLine } from "@/lib/marketing/assets/shortform/narrationSegments";
import type {
  PublishableValidationIssue,
  PublishableValidationResult,
} from "@/lib/marketing/publishable/contracts";

const EVIDENCE_UUID_RE =
  /\[[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\]/gi;
const BARE_UUID_RE =
  /\b[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\b/gi;
const ASSIGNMENT_ID_RE = /\b(asg_|assignmentId|assignment id|contentAssignment)\b/i;
const INTERNAL_TERM_RE =
  /\b(assignment evidence|Key verified facts|Travel relevance for audience|Useful takeaway without product|CTA aligned to commercialIntent|commercialIntent|contentPlan|governance)\b/i;

const SLOP_PATTERNS: Array<{ re: RegExp; label: string }> = [
  { re: /요즘\s+.+(?:주목|화제).+(?:받고\s*있습니다|입니다)/, label: "요즘 주목" },
  { re: /단순한\s+.+\s*를\s*넘어/, label: "단순한 A를 넘어" },
  { re: /특별한\s+경험을\s+선사/, label: "특별한 경험 선사" },
  { re: /완벽한\s+선택입니다/, label: "완벽한 선택" },
  { re: /새로운\s+기준/, label: "새로운 기준" },
  { re: /놓치지\s*마세요/, label: "놓치지 마세요" },
];

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

export function validatePublishableText(
  body: string,
  options?: { requireNonEmpty?: boolean },
): PublishableValidationResult {
  const issues: PublishableValidationIssue[] = [];
  const trimmed = body.trim();

  if (options?.requireNonEmpty !== false && !trimmed) {
    issues.push({ code: "empty_body", message: "Publishable body is empty" });
  }

  if (/\[object Object\]/i.test(trimmed)) {
    issues.push({ code: "object_leak", message: "Contains [object Object]" });
  }

  if (EVIDENCE_UUID_RE.test(trimmed) || BARE_UUID_RE.test(trimmed)) {
    issues.push({ code: "evidence_id_leak", message: "Contains evidence UUID" });
  }

  if (ASSIGNMENT_ID_RE.test(trimmed)) {
    issues.push({ code: "assignment_id_leak", message: "Contains assignment identifier" });
  }

  const lines = trimmed.split(/\n/).map((l) => l.trim()).filter(Boolean);
  if (lines.some((l) => isOutlineHeaderLine(l)) || INTERNAL_TERM_RE.test(trimmed)) {
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

  return { ok: issues.length === 0, issues };
}
