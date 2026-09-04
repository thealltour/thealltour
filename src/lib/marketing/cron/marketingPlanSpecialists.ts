import { extractJsonObject } from "@/lib/marketing/bot/organization/envelope";
import { parseProviderContentPlan } from "@/lib/marketing/content/validation/validateContentPlan";
import { ContentPlanContractError } from "@/lib/marketing/content/validation/contentPlanContractError";
import type {
  ContentDraftRequest,
  ContentStrategistOutput,
  GovernanceReviewRequest,
  GovernanceReviewResult,
} from "@/lib/marketing/bot/organization/handoffs";
import { resolveMarketingCronHermesTimeoutMs } from "@/lib/marketing/cron/hermesSpawnFailure";

/** Default Hermes oneshot timeout for Marketing Cron specialist profiles. */
export const MARKETING_CRON_HERMES_TIMEOUT_MS_DEFAULT = 180_000;

/** Resolved Hermes oneshot timeout (env MARKETING_CRON_HERMES_TIMEOUT_MS or default 180s). */
export const MARKETING_CRON_HERMES_TIMEOUT_MS = resolveMarketingCronHermesTimeoutMs(
  process.env,
  MARKETING_CRON_HERMES_TIMEOUT_MS_DEFAULT,
);

export const MARKETING_CRON_JOB_ID = "daily-marketing-plan";
export const MARKETING_DEPARTMENT_ID = "marketing";

export function buildContentDraftPrompt(payload: ContentDraftRequest): string {
  return `JSON only. ContentAssignment/ContentDraftRequest를 근거로 contentPlan + Threads 초안. 없는 혜택/일정 만들지 마. 게시하지 마. Cron 만들지 마. Do not re-select the manager agenda.\n${JSON.stringify(payload)}\nshape: {"title":"","body":"","channel":"threads","agenda":null,"sourceReferences":[],"contentPlan":null,"assignmentId":null}`;
}

export function buildGovernanceReviewPrompt(
  payload: GovernanceReviewRequest | import("@/lib/marketing/content/governance/types").StructuredGovernanceReviewRequest,
): string {
  return `JSON only. GovernanceReviewRequest with claims/evidence. Compare draft claims to evidenceRefs. Do not rewrite content. Do not publish.\n${JSON.stringify(payload)}\nshape: {"decision":"ALLOW","riskScore":0,"reasons":[],"revisionHints":[],"requiredRevisions":[],"humanApprovalRequired":false,"semanticAvailable":true}`;
}

export function parseContentStrategistOutput(raw: string): ContentStrategistOutput {
  const value = extractJsonObject(raw) as ContentStrategistOutput;
  if (!value.body) throw new Error("content-strategist returned no body");

  let contentPlan: ContentStrategistOutput["contentPlan"] = null;
  if (value.contentPlan != null) {
    try {
      contentPlan = parseProviderContentPlan(value.contentPlan);
    } catch (error) {
      if (error instanceof ContentPlanContractError) {
        throw new Error(error.toPipelineMessage());
      }
      throw error;
    }
  }

  return {
    title: value.title ?? null,
    body: String(value.body),
    channel: value.channel || "threads",
    agenda: value.agenda ?? null,
    sourceReferences: Array.isArray(value.sourceReferences) ? value.sourceReferences.map(String) : [],
    contentPlan,
    assignmentId: value.assignmentId ?? null,
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
