import {
  extractJsonObject,
  extractJsonObjectResult,
  type JsonExtractFailureClass,
  type JsonExtractMode,
} from "@/lib/marketing/bot/organization/envelope";
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

export const CONTENT_STRATEGIST_FORMAT_FAILED = "content_strategist_format_failed";

export type ContentStrategistFinalParseMode = JsonExtractMode | "format_retry";

export type ContentStrategistParseDiagnostics = {
  contentStrategistAttemptCount: number;
  firstAttemptFailureClass: JsonExtractFailureClass | null;
  finalParseMode: ContentStrategistFinalParseMode | null;
  stdoutLength: number;
  evidenceRefsPresence: "absent" | "empty" | "present" | "unknown";
  factsToUseCount: number;
  formatRetryUsed: boolean;
};

/**
 * JSON/format parse failure for Content Strategist structured output.
 * Distinct from content-plan semantic validation (evidence_refs_empty, etc.).
 */
export class ContentStrategistFormatError extends Error {
  readonly code = CONTENT_STRATEGIST_FORMAT_FAILED;
  readonly failureClass: JsonExtractFailureClass;
  readonly diagnostics: ContentStrategistParseDiagnostics;

  constructor(input: {
    failureClass: JsonExtractFailureClass;
    message?: string;
    diagnostics: ContentStrategistParseDiagnostics;
  }) {
    super(
      input.message ??
        `No JSON object in agent output:${input.failureClass}`,
    );
    this.name = "ContentStrategistFormatError";
    this.failureClass = input.failureClass;
    this.diagnostics = input.diagnostics;
  }

  toPipelineMessage(): string {
    const d = this.diagnostics;
    return [
      CONTENT_STRATEGIST_FORMAT_FAILED,
      this.failureClass,
      `attempts=${d.contentStrategistAttemptCount}`,
      `retry=${d.formatRetryUsed ? "1" : "0"}`,
      `stdoutBytes=${d.stdoutLength}`,
    ].join(":");
  }
}

export function isContentStrategistFormatError(error: unknown): error is ContentStrategistFormatError {
  return error instanceof ContentStrategistFormatError;
}

function evidenceRefsPresenceOf(
  plan: ContentStrategistOutput["contentPlan"],
): ContentStrategistParseDiagnostics["evidenceRefsPresence"] {
  if (!plan || !("evidenceRefs" in plan)) return "absent";
  const refs = plan.evidenceRefs;
  if (!Array.isArray(refs)) return "unknown";
  return refs.length > 0 ? "present" : "empty";
}

function buildDiagnostics(partial: {
  attemptCount: number;
  firstAttemptFailureClass: JsonExtractFailureClass | null;
  finalParseMode: ContentStrategistFinalParseMode | null;
  stdoutLength: number;
  formatRetryUsed: boolean;
  contentPlan?: ContentStrategistOutput["contentPlan"];
}): ContentStrategistParseDiagnostics {
  const plan = partial.contentPlan ?? null;
  return {
    contentStrategistAttemptCount: partial.attemptCount,
    firstAttemptFailureClass: partial.firstAttemptFailureClass,
    finalParseMode: partial.finalParseMode,
    stdoutLength: partial.stdoutLength,
    evidenceRefsPresence: evidenceRefsPresenceOf(plan),
    factsToUseCount: Array.isArray(plan?.factsToUse) ? plan!.factsToUse!.length : 0,
    formatRetryUsed: partial.formatRetryUsed,
  };
}

export function buildContentDraftPrompt(payload: ContentDraftRequest): string {
  return `JSON only. ContentAssignment/ContentDraftRequest를 근거로 contentPlan + Threads 초안. 없는 혜택/일정 만들지 마. 게시하지 마. Cron 만들지 마. Do not re-select the manager agenda.\n${JSON.stringify(payload)}\nshape: {"title":"","body":"","channel":"threads","agenda":null,"sourceReferences":[],"contentPlan":null,"assignmentId":null}`;
}

/**
 * One bounded format-repair prompt. Same payload/context; JSON-only instruction.
 */
export function buildContentDraftFormatRepairPrompt(
  payload: ContentDraftRequest,
  firstFailureClass?: JsonExtractFailureClass | string | null,
): string {
  return [
    "JSON only. Your previous Content Strategist response was INVALID JSON/format.",
    firstFailureClass ? `Failure class: ${firstFailureClass}.` : "Failure class: malformed_json.",
    "Return ONE valid JSON object only. No markdown fences. No prose before or after.",
    "Use only the provided ContentAssignment evidence; do not invent evidence IDs or facts.",
    "Do not re-select the manager agenda. Do not publish. Do not create cron jobs.",
    JSON.stringify(payload),
    'shape: {"title":"","body":"","channel":"threads","agenda":null,"sourceReferences":[],"contentPlan":null,"assignmentId":null}',
  ].join("\n");
}

export function buildGovernanceReviewPrompt(
  payload: GovernanceReviewRequest | import("@/lib/marketing/content/governance/types").StructuredGovernanceReviewRequest,
): string {
  return `JSON only. GovernanceReviewRequest with claims/evidence. Compare draft claims to evidenceRefs. Do not rewrite content. Do not publish.\n${JSON.stringify(payload)}\nshape: {"decision":"ALLOW","riskScore":0,"reasons":[],"revisionHints":[],"requiredRevisions":[],"humanApprovalRequired":false,"semanticAvailable":true}`;
}

export type ParseContentStrategistDetailedResult =
  | {
      ok: true;
      output: ContentStrategistOutput;
      extractMode: JsonExtractMode;
      stdoutLength: number;
    }
  | {
      ok: false;
      kind: "format";
      failureClass: JsonExtractFailureClass;
      stdoutLength: number;
      message: string;
    }
  | {
      ok: false;
      kind: "semantic";
      error: Error;
      extractMode: JsonExtractMode;
      stdoutLength: number;
      contentPlan?: ContentStrategistOutput["contentPlan"];
    };

/**
 * Reuses R-6 generic `extractJsonObjectResult` (no duplicate parser).
 * Separates format/JSON failures from content-plan semantic validation.
 */
export function parseContentStrategistOutputDetailed(
  raw: string,
): ParseContentStrategistDetailedResult {
  const stdoutLength = Buffer.byteLength(String(raw ?? ""), "utf8");
  const extracted = extractJsonObjectResult(raw);
  if (!extracted.ok) {
    return {
      ok: false,
      kind: "format",
      failureClass: extracted.failureClass,
      stdoutLength,
      message: `No JSON object in agent output:${extracted.failureClass}`,
    };
  }

  const value = extracted.value as ContentStrategistOutput;
  if (!value || typeof value !== "object" || !("body" in value) || !value.body) {
    return {
      ok: false,
      kind: "semantic",
      error: new Error("content-strategist returned no body"),
      extractMode: extracted.mode,
      stdoutLength,
    };
  }

  let contentPlan: ContentStrategistOutput["contentPlan"] = null;
  if (value.contentPlan != null) {
    try {
      contentPlan = parseProviderContentPlan(value.contentPlan);
    } catch (error) {
      if (error instanceof ContentPlanContractError) {
        return {
          ok: false,
          kind: "semantic",
          error: new Error(error.toPipelineMessage()),
          extractMode: extracted.mode,
          stdoutLength,
        };
      }
      return {
        ok: false,
        kind: "semantic",
        error: error instanceof Error ? error : new Error(String(error)),
        extractMode: extracted.mode,
        stdoutLength,
      };
    }
  }

  return {
    ok: true,
    extractMode: extracted.mode,
    stdoutLength,
    output: {
      title: value.title ?? null,
      body: String(value.body),
      channel: value.channel || "threads",
      agenda: value.agenda ?? null,
      sourceReferences: Array.isArray(value.sourceReferences)
        ? value.sourceReferences.map(String)
        : [],
      contentPlan,
      assignmentId: value.assignmentId ?? null,
    },
  };
}

export function parseContentStrategistOutput(raw: string): ContentStrategistOutput {
  const detailed = parseContentStrategistOutputDetailed(raw);
  if (!detailed.ok) {
    if (detailed.kind === "format") {
      throw new ContentStrategistFormatError({
        failureClass: detailed.failureClass,
        message: detailed.message,
        diagnostics: buildDiagnostics({
          attemptCount: 1,
          firstAttemptFailureClass: detailed.failureClass,
          finalParseMode: null,
          stdoutLength: detailed.stdoutLength,
          formatRetryUsed: false,
        }),
      });
    }
    throw detailed.error;
  }
  return detailed.output;
}

/**
 * Invoke CS raw → parse, with at most one format/JSON repair retry.
 * Does not retry semantic validation, timeouts, or spawn failures (caller throws those).
 */
export async function requestContentStrategistDraftWithFormatRetry(input: {
  payload: ContentDraftRequest;
  invoke: (prompt: string) => string | Promise<string>;
}): Promise<{
  output: ContentStrategistOutput;
  diagnostics: ContentStrategistParseDiagnostics;
}> {
  const raw1 = await input.invoke(buildContentDraftPrompt(input.payload));
  const first = parseContentStrategistOutputDetailed(raw1);

  if (first.ok) {
    const diagnostics = buildDiagnostics({
      attemptCount: 1,
      firstAttemptFailureClass: null,
      finalParseMode: first.extractMode,
      stdoutLength: first.stdoutLength,
      formatRetryUsed: false,
      contentPlan: first.output.contentPlan,
    });
    return { output: first.output, diagnostics };
  }

  if (first.kind === "semantic") {
    throw first.error;
  }

  // Exactly one bounded format-repair retry.
  const raw2 = await input.invoke(
    buildContentDraftFormatRepairPrompt(input.payload, first.failureClass),
  );
  const second = parseContentStrategistOutputDetailed(raw2);

  if (second.ok) {
    const diagnostics = buildDiagnostics({
      attemptCount: 2,
      firstAttemptFailureClass: first.failureClass,
      finalParseMode: "format_retry",
      stdoutLength: second.stdoutLength,
      formatRetryUsed: true,
      contentPlan: second.output.contentPlan,
    });
    return { output: second.output, diagnostics };
  }

  if (second.kind === "semantic") {
    // Format recovered enough to parse JSON, but semantic validation failed — do not
    // treat as format retry exhaustion; surface semantic error with retry noted.
    const err = second.error;
    err.message = `${err.message};content_strategist_format_retry_used=1;first=${first.failureClass}`;
    throw err;
  }

  throw new ContentStrategistFormatError({
    failureClass: second.failureClass,
    message: second.message,
    diagnostics: buildDiagnostics({
      attemptCount: 2,
      firstAttemptFailureClass: first.failureClass,
      finalParseMode: null,
      stdoutLength: second.stdoutLength,
      formatRetryUsed: true,
    }),
  });
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
