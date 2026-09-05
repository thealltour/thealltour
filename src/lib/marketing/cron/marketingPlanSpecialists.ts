import {
  extractJsonObject,
  extractJsonObjectResult,
  type JsonExtractFailureClass,
  type JsonExtractMode,
} from "@/lib/marketing/bot/organization/envelope";
import { parseProviderContentPlan } from "@/lib/marketing/content/validation/validateContentPlan";
import { ContentPlanContractError } from "@/lib/marketing/content/validation/contentPlanContractError";
import type { AssignmentEvidenceRef } from "@/lib/marketing/content/types";
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
export const CONTENT_STRATEGIST_RUNTIME_FAILED = "content_strategist_runtime_failed";

/**
 * Hard cap on CS model invocations per production attempt.
 * Attempt 1 + at most ONE of {format repair, grounding repair} — never both.
 */
export const CONTENT_STRATEGIST_MAX_MODEL_INVOCATIONS = 2;

export type ContentStrategistFinalParseMode =
  | JsonExtractMode
  | "format_retry"
  | "grounding_retry";

export type ContentStrategistGroundingFailureClass =
  | "evidence_refs_absent"
  | "evidence_refs_empty";

export type ContentStrategistRuntimeFailureClass =
  | "hermes_api_http_failure"
  | "gateway_misconfigured"
  | "runtime_provider_failure";

export type ContentStrategistParseDiagnostics = {
  contentStrategistAttemptCount: number;
  formatRetryUsed: boolean;
  groundingRetryUsed: boolean;
  firstAttemptFailureClass: string | null;
  groundingFailureClass: ContentStrategistGroundingFailureClass | null;
  finalParseMode: ContentStrategistFinalParseMode | null;
  stdoutLength: number;
  evidenceRefsPresence: "absent" | "empty" | "present" | "unknown";
  evidenceRefsCount: number;
  factsToUseCount: number;
  suppliedEvidenceRefCount: number;
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

/**
 * Hermes/gateway infrastructure failure emitted on stdout (often exit 0).
 * Must not be treated as malformed_json or grounding failure.
 */
export class ContentStrategistRuntimeError extends Error {
  readonly code = CONTENT_STRATEGIST_RUNTIME_FAILED;
  readonly failureClass: ContentStrategistRuntimeFailureClass;
  readonly diagnostics: ContentStrategistParseDiagnostics;

  constructor(input: {
    failureClass: ContentStrategistRuntimeFailureClass;
    message: string;
    diagnostics: ContentStrategistParseDiagnostics;
  }) {
    super(input.message);
    this.name = "ContentStrategistRuntimeError";
    this.failureClass = input.failureClass;
    this.diagnostics = input.diagnostics;
  }

  toPipelineMessage(): string {
    const d = this.diagnostics;
    return [
      CONTENT_STRATEGIST_RUNTIME_FAILED,
      this.failureClass,
      `attempts=${d.contentStrategistAttemptCount}`,
      `stdoutBytes=${d.stdoutLength}`,
    ].join(":");
  }
}

export function isContentStrategistRuntimeError(
  error: unknown,
): error is ContentStrategistRuntimeError {
  return error instanceof ContentStrategistRuntimeError;
}

/**
 * Classify known Hermes/runtime stdout envelopes before JSON extraction (G7-F4/F5).
 * Narrow: does not redesign Hermes; matches observed exit-0 API failure text.
 */
export function classifyContentStrategistRuntimeFailure(
  raw: string,
): ContentStrategistRuntimeFailureClass | null {
  const text = String(raw ?? "").trim();
  if (!text) return null;

  if (/AI_RUNTIME_INFERENCE_GATEWAY_TOKEN is not configured/i.test(text)) {
    return "gateway_misconfigured";
  }
  if (/gateway_misconfigured/i.test(text)) {
    return "gateway_misconfigured";
  }
  // Exact observed envelope: "API call failed after 3 retries: HTTP 503: ..."
  if (/^API call failed after \d+ retries:\s*HTTP\s+\d+/im.test(text)) {
    return "hermes_api_http_failure";
  }
  if (/^API call failed after \d+ retries:/im.test(text)) {
    return "runtime_provider_failure";
  }
  return null;
}

function evidenceRefsPresenceOf(
  plan: ContentStrategistOutput["contentPlan"],
): ContentStrategistParseDiagnostics["evidenceRefsPresence"] {
  if (!plan || !("evidenceRefs" in plan)) return "absent";
  const refs = plan.evidenceRefs;
  if (!Array.isArray(refs)) return "unknown";
  return refs.length > 0 ? "present" : "empty";
}

function evidenceRefsCountOf(plan: ContentStrategistOutput["contentPlan"]): number {
  if (!plan || !Array.isArray(plan.evidenceRefs)) return 0;
  return plan.evidenceRefs.length;
}

function buildDiagnostics(partial: {
  attemptCount: number;
  firstAttemptFailureClass: string | null;
  groundingFailureClass?: ContentStrategistGroundingFailureClass | null;
  finalParseMode: ContentStrategistFinalParseMode | null;
  stdoutLength: number;
  formatRetryUsed: boolean;
  groundingRetryUsed?: boolean;
  contentPlan?: ContentStrategistOutput["contentPlan"];
  suppliedEvidenceRefCount?: number;
}): ContentStrategistParseDiagnostics {
  const plan = partial.contentPlan ?? null;
  return {
    contentStrategistAttemptCount: partial.attemptCount,
    formatRetryUsed: partial.formatRetryUsed,
    groundingRetryUsed: partial.groundingRetryUsed ?? false,
    firstAttemptFailureClass: partial.firstAttemptFailureClass,
    groundingFailureClass: partial.groundingFailureClass ?? null,
    finalParseMode: partial.finalParseMode,
    stdoutLength: partial.stdoutLength,
    evidenceRefsPresence: evidenceRefsPresenceOf(plan),
    evidenceRefsCount: evidenceRefsCountOf(plan),
    factsToUseCount: Array.isArray(plan?.factsToUse) ? plan!.factsToUse!.length : 0,
    suppliedEvidenceRefCount: partial.suppliedEvidenceRefCount ?? 0,
  };
}

/** Deduped assignment evidence from the hydrated draft payload (canonical IDs). */
export function collectSuppliedEvidenceRefs(
  payload: ContentDraftRequest,
): AssignmentEvidenceRef[] {
  const pools = [
    payload.contentAssignment?.evidenceRefs,
    payload.contentPlanScaffold?.evidenceRefs,
    payload.selectedAgenda?.evidenceRefs,
  ];
  const merged: AssignmentEvidenceRef[] = [];
  const seen = new Set<string>();
  for (const pool of pools) {
    if (!Array.isArray(pool)) continue;
    for (const ref of pool) {
      if (!ref?.evidenceId || seen.has(ref.evidenceId)) continue;
      seen.add(ref.evidenceId);
      merged.push(ref);
    }
  }
  return merged;
}

function formatAvailableEvidenceSection(refs: AssignmentEvidenceRef[]): string {
  if (refs.length === 0) {
    return "AVAILABLE_EVIDENCE_REFS:\n(none)";
  }
  return [
    "AVAILABLE_EVIDENCE_REFS:",
    ...refs.map((ref) => `- ${ref.evidenceId}`),
  ].join("\n");
}

const CONTENT_DRAFT_SHAPE =
  'shape: {"title":"","body":"","channel":"threads","agenda":null,"sourceReferences":[],"contentPlan":{"assignmentId":"","factsToUse":[],"evidenceRefs":["<supplied-evidence-id>"]},"assignmentId":null}';

const GROUNDING_RULES = [
  "Grounding rules:",
  "- contentPlan.evidenceRefs is REQUIRED when factsToUse has factual claims.",
  "- If factsToUse contains factual claims, evidenceRefs MUST be a non-empty array of supplied evidence IDs (or full objects copied from contentAssignment.evidenceRefs for those IDs).",
  "- Use ONLY IDs listed in AVAILABLE_EVIDENCE_REFS. Never invent evidence IDs.",
  "- If a factual claim cannot be grounded in supplied evidence, remove/rewrite that claim rather than fabricate evidence.",
].join("\n");

export function buildContentDraftPrompt(payload: ContentDraftRequest): string {
  const supplied = collectSuppliedEvidenceRefs(payload);
  return [
    "JSON only. ContentAssignment/ContentDraftRequest를 근거로 contentPlan + Threads 초안. 없는 혜택/일정 만들지 마. 게시하지 마. Cron 만들지 마. Do not re-select the manager agenda.",
    formatAvailableEvidenceSection(supplied),
    GROUNDING_RULES,
    JSON.stringify(payload),
    CONTENT_DRAFT_SHAPE,
  ].join("\n");
}

/**
 * One bounded format-repair prompt. Same payload/context; JSON-only instruction.
 */
export function buildContentDraftFormatRepairPrompt(
  payload: ContentDraftRequest,
  firstFailureClass?: JsonExtractFailureClass | string | null,
): string {
  const supplied = collectSuppliedEvidenceRefs(payload);
  return [
    "JSON only. Your previous Content Strategist response was INVALID JSON/format.",
    firstFailureClass ? `Failure class: ${firstFailureClass}.` : "Failure class: malformed_json.",
    "Return ONE valid JSON object only. No markdown fences. No prose before or after.",
    "Use only the provided ContentAssignment evidence; do not invent evidence IDs or facts.",
    "Do not re-select the manager agenda. Do not publish. Do not create cron jobs.",
    formatAvailableEvidenceSection(supplied),
    GROUNDING_RULES,
    JSON.stringify(payload),
    CONTENT_DRAFT_SHAPE,
  ].join("\n");
}

/**
 * One bounded grounding-contract repair. Structurally valid JSON; evidenceRefs absent/empty.
 */
export function buildContentDraftGroundingRepairPrompt(
  payload: ContentDraftRequest,
  groundingFailureClass: ContentStrategistGroundingFailureClass,
): string {
  const supplied = collectSuppliedEvidenceRefs(payload);
  return [
    "JSON only. Your previous Content Strategist response was structurally valid JSON, but failed the grounding contract.",
    `Failure class: ${groundingFailureClass}.`,
    "evidenceRefs was absent or empty while factsToUse contained factual claims.",
    "Return the COMPLETE JSON object again. Preserve supported title/body/contentPlan fields where possible.",
    "Set contentPlan.evidenceRefs using ONLY the supplied allowed evidence IDs below (string IDs or full objects from contentAssignment.evidenceRefs).",
    "Do not invent evidence IDs. If a factual claim cannot be supported, remove or rewrite that claim.",
    "No markdown fences. No prose before or after.",
    formatAvailableEvidenceSection(supplied),
    GROUNDING_RULES,
    JSON.stringify(payload),
    CONTENT_DRAFT_SHAPE,
  ].join("\n");
}

export function buildGovernanceReviewPrompt(
  payload: GovernanceReviewRequest | import("@/lib/marketing/content/governance/types").StructuredGovernanceReviewRequest,
): string {
  return `JSON only. GovernanceReviewRequest with claims/evidence. Compare draft claims to evidenceRefs. Do not rewrite content. Do not publish.\n${JSON.stringify(payload)}\nshape: {"decision":"ALLOW","riskScore":0,"reasons":[],"revisionHints":[],"requiredRevisions":[],"humanApprovalRequired":false,"semanticAvailable":true}`;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

/**
 * Resolve model evidenceRefs string IDs → full AssignmentEvidenceRef from supplied set.
 * Unknown IDs fail closed. Does not invent refs when field is absent/empty.
 */
export function resolveProviderEvidenceRefsAgainstSupplied(
  contentPlan: unknown,
  supplied: AssignmentEvidenceRef[],
): unknown {
  if (!isRecord(contentPlan) || !("evidenceRefs" in contentPlan)) {
    return contentPlan;
  }
  const refs = contentPlan.evidenceRefs;
  if (!Array.isArray(refs)) {
    return contentPlan;
  }
  if (refs.length === 0) {
    return contentPlan;
  }

  const byId = new Map(supplied.map((ref) => [ref.evidenceId, ref]));
  const allowedIds = new Set(byId.keys());

  if (refs.every((item) => typeof item === "string")) {
    if (supplied.length === 0) {
      throw new ContentPlanContractError({
        incidentClass: "malformed_model_output",
        validationIssue: "invalid_evidence_shape",
        source: "provider_output",
        message: "Provider returned evidence ID strings but no supplied evidence context is available",
      });
    }
    const resolved: AssignmentEvidenceRef[] = [];
    for (const id of refs) {
      const hit = byId.get(String(id));
      if (!hit) {
        throw new ContentPlanContractError({
          incidentClass: "malformed_model_output",
          validationIssue: "invalid_evidence_shape",
          source: "provider_output",
          message: `Fabricated or unknown evidence ID not in supplied set: ${String(id)}`,
        });
      }
      resolved.push(hit);
    }
    return { ...contentPlan, evidenceRefs: resolved };
  }

  if (supplied.length > 0 && refs.every((item) => isRecord(item))) {
    for (const item of refs) {
      const evidenceId = String((item as Record<string, unknown>).evidenceId ?? "");
      if (evidenceId && !allowedIds.has(evidenceId)) {
        throw new ContentPlanContractError({
          incidentClass: "malformed_model_output",
          validationIssue: "invalid_evidence_shape",
          source: "provider_output",
          message: `Fabricated or unknown evidence ID not in supplied set: ${evidenceId}`,
        });
      }
    }
  }

  return contentPlan;
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
      kind: "runtime";
      failureClass: ContentStrategistRuntimeFailureClass;
      stdoutLength: number;
      message: string;
    }
  | {
      ok: false;
      kind: "semantic";
      error: Error;
      extractMode: JsonExtractMode;
      stdoutLength: number;
      validationIssue?: string;
      contentPlan?: ContentStrategistOutput["contentPlan"];
      factsToUseCount?: number;
    };

export type ParseContentStrategistOptions = {
  /** When provided, string evidence IDs resolve against this set; unknown IDs fail closed. */
  suppliedEvidenceRefs?: AssignmentEvidenceRef[];
};

/**
 * Reuses R-6 generic `extractJsonObjectResult` (no duplicate parser).
 * Separates runtime / format / semantic failures.
 */
export function parseContentStrategistOutputDetailed(
  raw: string,
  options?: ParseContentStrategistOptions,
): ParseContentStrategistDetailedResult {
  const stdoutLength = Buffer.byteLength(String(raw ?? ""), "utf8");

  const runtimeClass = classifyContentStrategistRuntimeFailure(raw);
  if (runtimeClass) {
    return {
      ok: false,
      kind: "runtime",
      failureClass: runtimeClass,
      stdoutLength,
      message: String(raw).trim().slice(0, 400),
    };
  }

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
      const supplied = options?.suppliedEvidenceRefs ?? [];
      const normalizedPlan = resolveProviderEvidenceRefsAgainstSupplied(
        value.contentPlan,
        supplied,
      );
      contentPlan = parseProviderContentPlan(normalizedPlan);
    } catch (error) {
      if (error instanceof ContentPlanContractError) {
        const factsToUse = isRecord(value.contentPlan) && Array.isArray(value.contentPlan.factsToUse)
          ? value.contentPlan.factsToUse.map(String)
          : [];
        return {
          ok: false,
          kind: "semantic",
          error,
          extractMode: extracted.mode,
          stdoutLength,
          validationIssue: error.validationIssue,
          factsToUseCount: factsToUse.length,
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

export function parseContentStrategistOutput(
  raw: string,
  options?: ParseContentStrategistOptions,
): ContentStrategistOutput {
  const detailed = parseContentStrategistOutputDetailed(raw, options);
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
          groundingRetryUsed: false,
          suppliedEvidenceRefCount: options?.suppliedEvidenceRefs?.length ?? 0,
        }),
      });
    }
    if (detailed.kind === "runtime") {
      throw new ContentStrategistRuntimeError({
        failureClass: detailed.failureClass,
        message: detailed.message,
        diagnostics: buildDiagnostics({
          attemptCount: 1,
          firstAttemptFailureClass: detailed.failureClass,
          finalParseMode: null,
          stdoutLength: detailed.stdoutLength,
          formatRetryUsed: false,
          groundingRetryUsed: false,
          suppliedEvidenceRefCount: options?.suppliedEvidenceRefs?.length ?? 0,
        }),
      });
    }
    throw detailed.error instanceof ContentPlanContractError
      ? detailed.error
      : detailed.error;
  }
  return detailed.output;
}

function groundingFailureClassOf(
  detailed: Extract<ParseContentStrategistDetailedResult, { ok: false; kind: "semantic" }>,
): ContentStrategistGroundingFailureClass | null {
  const issue =
    detailed.validationIssue ??
    (detailed.error instanceof ContentPlanContractError
      ? detailed.error.validationIssue
      : null) ??
    "";
  if (issue === "evidence_refs_absent" || /evidence_refs_absent/.test(detailed.error.message)) {
    return "evidence_refs_absent";
  }
  if (issue === "evidence_refs_empty" || /evidence_refs_empty/.test(detailed.error.message)) {
    return "evidence_refs_empty";
  }
  return null;
}

function semanticErrorMessage(error: Error): string {
  if (error instanceof ContentPlanContractError) {
    return error.toPipelineMessage();
  }
  return error.message;
}

/**
 * Invoke CS raw → parse, with at most one bounded repair:
 * - format/JSON failure → format repair
 * - evidence_refs_absent/empty + supplied evidence → grounding repair
 * Never both. Max invocations = CONTENT_STRATEGIST_MAX_MODEL_INVOCATIONS (2).
 * Runtime/gateway stdout failures do not retry.
 */
export async function requestContentStrategistDraftWithFormatRetry(input: {
  payload: ContentDraftRequest;
  invoke: (prompt: string) => string | Promise<string>;
}): Promise<{
  output: ContentStrategistOutput;
  diagnostics: ContentStrategistParseDiagnostics;
}> {
  const supplied = collectSuppliedEvidenceRefs(input.payload);
  const suppliedCount = supplied.length;
  const parseOpts: ParseContentStrategistOptions = { suppliedEvidenceRefs: supplied };

  const raw1 = await input.invoke(buildContentDraftPrompt(input.payload));
  const first = parseContentStrategistOutputDetailed(raw1, parseOpts);

  if (first.ok) {
    return {
      output: first.output,
      diagnostics: buildDiagnostics({
        attemptCount: 1,
        firstAttemptFailureClass: null,
        finalParseMode: first.extractMode,
        stdoutLength: first.stdoutLength,
        formatRetryUsed: false,
        groundingRetryUsed: false,
        contentPlan: first.output.contentPlan,
        suppliedEvidenceRefCount: suppliedCount,
      }),
    };
  }

  if (first.kind === "runtime") {
    throw new ContentStrategistRuntimeError({
      failureClass: first.failureClass,
      message: first.message,
      diagnostics: buildDiagnostics({
        attemptCount: 1,
        firstAttemptFailureClass: first.failureClass,
        finalParseMode: null,
        stdoutLength: first.stdoutLength,
        formatRetryUsed: false,
        groundingRetryUsed: false,
        suppliedEvidenceRefCount: suppliedCount,
      }),
    });
  }

  if (first.kind === "semantic") {
    const groundingClass =
      suppliedCount > 0 ? groundingFailureClassOf(first) : null;

    // Only absent/empty + canonical supplied evidence → one grounding repair.
    if (!groundingClass) {
      throw first.error instanceof ContentPlanContractError
        ? first.error
        : new Error(semanticErrorMessage(first.error));
    }

    const raw2 = await input.invoke(
      buildContentDraftGroundingRepairPrompt(input.payload, groundingClass),
    );
    const second = parseContentStrategistOutputDetailed(raw2, parseOpts);

    if (second.ok) {
      return {
        output: second.output,
        diagnostics: buildDiagnostics({
          attemptCount: 2,
          firstAttemptFailureClass: groundingClass,
          groundingFailureClass: groundingClass,
          finalParseMode: "grounding_retry",
          stdoutLength: second.stdoutLength,
          formatRetryUsed: false,
          groundingRetryUsed: true,
          contentPlan: second.output.contentPlan,
          suppliedEvidenceRefCount: suppliedCount,
        }),
      };
    }

    if (second.kind === "runtime") {
      throw new ContentStrategistRuntimeError({
        failureClass: second.failureClass,
        message: second.message,
        diagnostics: buildDiagnostics({
          attemptCount: 2,
          firstAttemptFailureClass: groundingClass,
          groundingFailureClass: groundingClass,
          finalParseMode: null,
          stdoutLength: second.stdoutLength,
          formatRetryUsed: false,
          groundingRetryUsed: true,
          suppliedEvidenceRefCount: suppliedCount,
        }),
      });
    }

    if (second.kind === "format") {
      // Grounding repair returned non-JSON — fail closed (no chained format retry).
      throw new ContentStrategistFormatError({
        failureClass: second.failureClass,
        message: second.message,
        diagnostics: buildDiagnostics({
          attemptCount: 2,
          firstAttemptFailureClass: groundingClass,
          groundingFailureClass: groundingClass,
          finalParseMode: null,
          stdoutLength: second.stdoutLength,
          formatRetryUsed: false,
          groundingRetryUsed: true,
          suppliedEvidenceRefCount: suppliedCount,
        }),
      });
    }

    // Second semantic failure (still absent/empty, fabricated, etc.) — no further retry.
    const err =
      second.error instanceof ContentPlanContractError
        ? second.error
        : new Error(semanticErrorMessage(second.error));
    err.message = `${semanticErrorMessage(err)};content_strategist_grounding_retry_used=1;first=${groundingClass}`;
    throw err;
  }

  // first.kind === "format" — exactly one bounded format-repair retry.
  const raw2 = await input.invoke(
    buildContentDraftFormatRepairPrompt(input.payload, first.failureClass),
  );
  const second = parseContentStrategistOutputDetailed(raw2, parseOpts);

  if (second.ok) {
    return {
      output: second.output,
      diagnostics: buildDiagnostics({
        attemptCount: 2,
        firstAttemptFailureClass: first.failureClass,
        finalParseMode: "format_retry",
        stdoutLength: second.stdoutLength,
        formatRetryUsed: true,
        groundingRetryUsed: false,
        contentPlan: second.output.contentPlan,
        suppliedEvidenceRefCount: suppliedCount,
      }),
    };
  }

  if (second.kind === "runtime") {
    throw new ContentStrategistRuntimeError({
      failureClass: second.failureClass,
      message: second.message,
      diagnostics: buildDiagnostics({
        attemptCount: 2,
        firstAttemptFailureClass: first.failureClass,
        finalParseMode: null,
        stdoutLength: second.stdoutLength,
        formatRetryUsed: true,
        groundingRetryUsed: false,
        suppliedEvidenceRefCount: suppliedCount,
      }),
    });
  }

  if (second.kind === "semantic") {
    // Format recovered; semantic failed — do NOT chain grounding retry (max 2).
    const err =
      second.error instanceof ContentPlanContractError
        ? second.error
        : new Error(semanticErrorMessage(second.error));
    err.message = `${semanticErrorMessage(err)};content_strategist_format_retry_used=1;first=${first.failureClass}`;
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
      groundingRetryUsed: false,
      suppliedEvidenceRefCount: suppliedCount,
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
