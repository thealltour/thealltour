import { extractJsonObject } from "@/lib/marketing/bot/organization/envelope";
import type {
  ContentDraftRequest,
  ContentStrategistOutput,
  GovernanceReviewRequest,
  GovernanceReviewResult,
} from "@/lib/marketing/bot/organization/handoffs";

/** Hermes oneshot timeout for Marketing Cron specialist profiles. */
export const MARKETING_CRON_HERMES_TIMEOUT_MS = 180_000;

export const MARKETING_CRON_JOB_ID = "daily-marketing-plan";
export const MARKETING_DEPARTMENT_ID = "marketing";

export function buildContentDraftPrompt(payload: ContentDraftRequest): string {
  return `JSON only. ContentDraftRequest를 근거로 Threads 초안. 없는 혜택/일정 만들지 마. 게시하지 마. Cron 만들지 마.\n${JSON.stringify(payload)}\nshape: {"title":"","body":"","channel":"threads","agenda":null,"sourceReferences":[]}`;
}

export function buildGovernanceReviewPrompt(payload: GovernanceReviewRequest): string {
  return `JSON only. 이 초안을 검사하고 ALLOW/REVIEW/BLOCK만. 게시하지 마. 자동 승인 금지.\n${JSON.stringify(payload)}\nshape: {"decision":"ALLOW","riskScore":0,"reasons":[],"revisionHints":[],"humanApprovalRequired":false,"semanticAvailable":true}`;
}

export function parseContentStrategistOutput(raw: string): ContentStrategistOutput {
  const value = extractJsonObject(raw) as ContentStrategistOutput;
  if (!value.body) throw new Error("content-strategist returned no body");
  return {
    title: value.title ?? null,
    body: String(value.body),
    channel: value.channel || "threads",
    agenda: value.agenda ?? null,
    sourceReferences: Array.isArray(value.sourceReferences) ? value.sourceReferences.map(String) : [],
  };
}

export function parseGovernanceAuditorOutput(raw: string): GovernanceReviewResult {
  try {
    const value = extractJsonObject(raw) as Record<string, unknown>;
    const decision = String(value.decision ?? value.governanceDecision ?? "").toUpperCase();
    if (decision === "ALLOW" || decision === "REVIEW" || decision === "BLOCK") {
      return {
        decision,
        riskScore: Number(value.riskScore ?? 0),
        reasons: Array.isArray(value.reasons)
          ? value.reasons.map(String)
          : Array.isArray(value.reasonCodes)
            ? value.reasonCodes.map(String)
            : [],
        revisionHints: Array.isArray(value.revisionHints) ? value.revisionHints.map(String) : [],
        humanApprovalRequired: Boolean(value.humanApprovalRequired) || decision === "REVIEW",
        semanticAvailable: value.semanticAvailable !== false,
      };
    }
  } catch {
    // fall through
  }
  const decision = /\bBLOCK\b/i.test(raw)
    ? "BLOCK"
    : /\bREVIEW\b/i.test(raw)
      ? "REVIEW"
      : /\bALLOW\b/i.test(raw)
        ? "ALLOW"
        : "";
  if (decision !== "ALLOW" && decision !== "REVIEW" && decision !== "BLOCK") {
    throw new Error("governance-auditor returned no ALLOW/REVIEW/BLOCK");
  }
  return {
    decision,
    riskScore: 0,
    reasons: [],
    revisionHints: [],
    humanApprovalRequired: decision === "REVIEW",
    semanticAvailable: !/semanticAvailable["']?\s*[:=]\s*false/i.test(raw),
  };
}

/**
 * Cron specialist prompts are JSON-only oneshot — no Hermes tool invocation.
 * Documented for migration safety audits (STEP 2-5.4B).
 */
export const MARKETING_CRON_SPECIALIST_USES_HERMES_TOOLS = false;
