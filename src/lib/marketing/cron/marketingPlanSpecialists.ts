import {
  extractJsonObject,
  extractJsonObjectResult,
  type JsonExtractFailureClass,
  type JsonExtractMode,
} from "@/lib/marketing/bot/organization/envelope";
import { parseProviderContentPlan } from "@/lib/marketing/content/validation/validateContentPlan";
import { ContentPlanContractError } from "@/lib/marketing/content/validation/contentPlanContractError";
import type { AssignmentEvidenceRef } from "@/lib/marketing/content/types";
import { allowedEvidenceIdsFromPack } from "@/lib/marketing/content/evidencePack";
import type {
  ContentDraftRequest,
  ContentStrategistOutput,
  GovernanceReviewRequest,
  GovernanceReviewResult,
} from "@/lib/marketing/bot/organization/handoffs";
import { resolveMarketingCronHermesTimeoutMs } from "@/lib/marketing/cron/hermesSpawnFailure";
import {
  ContentStrategistPropositionError,
  ContentStrategistTopicIdentityError,
  validateContentStrategistAgainstTopicIdentity,
} from "@/lib/marketing/cron/contentStrategistTopicIdentity";
import { validateContentProposition } from "@/lib/marketing/content/proposition/validateContentProposition";

/**
 * Default Hermes oneshot timeout for Marketing Cron specialist profiles.
 * 180s routinely expired mid-generation on the Pi and aborted the whole run.
 */
export const MARKETING_CRON_HERMES_TIMEOUT_MS_DEFAULT = 300_000;

/**
 * Channel-scoped Human Review regenerate — an operator is waiting, so it gets more
 * headroom than the batch cron default.
 */
export const CHANNEL_REGENERATE_COMPOSER_TIMEOUT_MS_DEFAULT = 360_000;

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
  | "grounding_retry"
  | "schema_retry";

export type ContentStrategistGroundingFailureClass =
  | "evidence_refs_absent"
  | "evidence_refs_empty";

export type ContentStrategistSchemaFailureClass =
  | "wrong_primitive_type"
  | "schema_malformed";

export type ContentStrategistRuntimeFailureClass =
  | "hermes_api_http_failure"
  | "gateway_misconfigured"
  | "runtime_provider_failure";

export type ContentStrategistParseDiagnostics = {
  contentStrategistAttemptCount: number;
  formatRetryUsed: boolean;
  groundingRetryUsed: boolean;
  schemaRetryUsed: boolean;
  firstAttemptFailureClass: string | null;
  groundingFailureClass: ContentStrategistGroundingFailureClass | null;
  schemaFailureClass: ContentStrategistSchemaFailureClass | null;
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
  schemaFailureClass?: ContentStrategistSchemaFailureClass | null;
  finalParseMode: ContentStrategistFinalParseMode | null;
  stdoutLength: number;
  formatRetryUsed: boolean;
  groundingRetryUsed?: boolean;
  schemaRetryUsed?: boolean;
  contentPlan?: ContentStrategistOutput["contentPlan"];
  suppliedEvidenceRefCount?: number;
}): ContentStrategistParseDiagnostics {
  const plan = partial.contentPlan ?? null;
  return {
    contentStrategistAttemptCount: partial.attemptCount,
    formatRetryUsed: partial.formatRetryUsed,
    groundingRetryUsed: partial.groundingRetryUsed ?? false,
    schemaRetryUsed: partial.schemaRetryUsed ?? false,
    firstAttemptFailureClass: partial.firstAttemptFailureClass,
    groundingFailureClass: partial.groundingFailureClass ?? null,
    schemaFailureClass: partial.schemaFailureClass ?? null,
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
  if (payload.evidencePack) {
    const allowed = new Set(allowedEvidenceIdsFromPack(payload.evidencePack));
    return payload.evidencePack.availableEvidenceRefs.filter((ref) => allowed.has(ref.evidenceId));
  }

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

function formatDeliverableRequirementsSection(
  requirements: ContentDraftRequest["deliverableRequirements"],
): string | null {
  if (!requirements) return null;
  return [
    "DELIVERABLE_REQUIREMENTS (structural — cover every requiredDestination; Completeness Validator owns pass/fail):",
    `- requiredDestinations (${requirements.requiredDestinationCount}): ${
      requirements.requiredDestinations.length
        ? requirements.requiredDestinations.join(", ")
        : "(none)"
    }`,
    `- requiredSections: ${
      requirements.requiredSections.length ? requirements.requiredSections.join(" | ") : "(none)"
    }`,
    `- requiredOutputKinds: ${requirements.requiredOutputKinds.join(", ")}`,
    `- primaryFormatHint: ${requirements.primaryFormatHint ?? "null"}`,
    `- requireSourceReferencesWhenFactual: ${requirements.requireSourceReferencesWhenFactual}`,
  ].join("\n");
}

function formatEvidencePackSection(pack: ContentDraftRequest["evidencePack"]): string | null {
  if (!pack) return null;
  const allowed = pack.items.filter((item) => item.allowedForDraft);
  return [
    "EVIDENCE_PACK (locked; do not invent facts beyond allowed items):",
    ...allowed.map(
      (item) =>
        `- ${item.factId}: ${item.statement.slice(0, 160)} [refs: ${item.evidenceRefIds.join(", ") || "none"}]`,
    ),
    allowed.length === 0 ? "- (no allowedForDraft items)" : null,
  ]
    .filter(Boolean)
    .join("\n");
}

const CONTENT_DRAFT_SHAPE =
  'shape: {"title":"","body":"","channel":"threads","agenda":null,"sourceReferences":[],"contentPlan":{"assignmentId":"","factsToUse":[],"evidenceRefs":["<supplied-evidence-id>"],"targetChannels":["threads","shortform"],"primaryAngle":"","keyMessage":"","hook":"","outline":[],"ctaStrategy":"","targetAudience":"","proposition":{"contract":"content-proposition-v1","primaryAudience":"","audienceProblem":"","audienceTension":"","whyNow":null,"contentPromise":"","readerGain":"","specificTakeaways":[],"proofRequirements":[],"contentGapUsed":"","engagementMechanism":"save_worthy_checklist","desiredAudienceAction":"save","angle":"","keyMessage":"","commercialIntent":"informational","propositionStrength":"usable","limitations":[]}},"assignmentId":null}';

const PROPOSITION_RULES = [
  "ContentProposition (content-proposition-v1) is REQUIRED inside contentPlan.proposition.",
  "Do NOT merely summarize ACRB. Decide what useful content should actually be made.",
  "Angle = editorial lens. ContentProposition = concrete value delivered through that lens.",
  "Forbidden as core value: '관측됨', '참고하면 좋다', '도움이 될 수 있다', '유용한 정보를 제공한다', '관련 정보를 정리한다'.",
  "primaryAudience: specific supported segment from ACRB audience.primary (not generic Korean travelers).",
  "audienceProblem: one concrete decision problem (not '여행 준비가 어렵다').",
  "audienceTension: decision-relevant tradeoff from anxieties/decisionTriggers.",
  "whyNow: only from real seasonality/promotion/decision-window signals; null if none. Never invent urgency (좌석 마감 etc.).",
  "contentPromise: what the content helps the reader understand/do (concrete).",
  "readerGain: what remains after reading (checklist/criteria/questions) — not abstract '도움이 된다'.",
  "specificTakeaways: 2–5 when evidence allows; practical checks/rules/questions. Do NOT invent operational facts.",
  "proofRequirements: declare what must be evidenced before claiming specifics (flight/inclusions/price/boarding).",
  "contentGapUsed: which ACRB content gap this piece exploits (plain language).",
  "engagementMechanism: why someone would save/comment/share (checklist, decision aid, etc.) — not just 'add CTA'.",
  "desiredAudienceAction: save|compare|verify|comment|ask|click|consult|shortlist.",
  "propositionStrength: strong|usable|weak|insufficient. If research cannot support useful takeaways without invention → insufficient/weak. Do NOT polish a fake strong plan.",
  "outline: derive from proposition (not generic Context/Facts/CTA template).",
  "hook: connect audience tension + content promise; no unsupported urgency.",
  "ctaStrategy: derive from desiredAudienceAction.",
  "Preserve epistemic status: verified_fact vs observed_signal vs inference/hypothesis — never promote soft research to hard fact.",
].join("\n");

function formatAcrbStrategyBrief(
  acrb: NonNullable<ContentDraftRequest["audienceContentResearchBrief"]>,
): string {
  const recommended =
    acrb.contentAngles.find((a) => a.angleId === acrb.recommendedAngleId) ?? acrb.contentAngles[0] ?? null;
  return [
    "ACRB_STRATEGY_BRIEF (consume these fields explicitly for ContentProposition):",
    `topicIdentity: ${JSON.stringify(acrb.topicIdentity ?? null)}`,
    `researchVerdict=${acrb.researchVerdict}; researchStatus=${acrb.researchStatus}; sourceCoverage.externalWebSearch=${acrb.sourceCoverage.externalWebSearch}`,
    `audience.primary: ${acrb.audience.primary.map((x) => x.text).slice(0, 3).join(" | ")}`,
    `motivations: ${acrb.audience.motivations.map((x) => x.text).slice(0, 3).join(" | ")}`,
    `anxieties: ${acrb.audience.anxieties.map((x) => x.text).slice(0, 4).join(" | ")}`,
    `objections: ${acrb.audience.objections.map((x) => x.text).slice(0, 3).join(" | ")}`,
    `decisionTriggers: ${acrb.audience.decisionTriggers.map((x) => x.text).slice(0, 3).join(" | ")}`,
    `searchIntent: ${acrb.searchIntent.primaryIntent}; questions=${acrb.searchIntent.questions
      .slice(0, 5)
      .map((q) => q.text)
      .join(" | ")}`,
    `contentGaps: ${acrb.marketSignals.contentGaps.map((x) => x.text).slice(0, 4).join(" | ")}`,
    `saturatedAngles: ${acrb.marketSignals.saturatedAngles.map((x) => x.text).slice(0, 2).join(" | ")}`,
    `recommendedAngle: ${recommended?.angle ?? "none"} | tension=${recommended?.audienceTension ?? ""} | evidenceStrength=${recommended?.evidenceStrength ?? ""}`,
    `limitations: ${acrb.limitations.slice(0, 6).join(" | ")}`,
    `findingTypes: ${acrb.researchFindings
      .slice(0, 6)
      .map((f) => `${f.type}:${f.text.slice(0, 60)}`)
      .join(" || ")}`,
  ].join("\n");
}

const GROUNDING_RULES = [
  "Grounding rules:",
  "- contentPlan.evidenceRefs is REQUIRED when factsToUse has factual claims.",
  "- If factsToUse contains factual claims, evidenceRefs MUST be a non-empty array of supplied evidence IDs (or full objects copied from contentAssignment.evidenceRefs for those IDs).",
  "- Use ONLY IDs listed in AVAILABLE_EVIDENCE_REFS. Never invent evidence IDs.",
  "- If a factual claim cannot be grounded in supplied evidence, remove/rewrite that claim rather than fabricate evidence.",
  "- Do not open-ended discover evidence beyond EVIDENCE_PACK / AVAILABLE_EVIDENCE_REFS.",
  "- Structural completeness (destinations/sections/outputs) is enforced by Completeness Validator — cover every requiredDestination in title/body/contentPlan.",
].join("\n");

export function buildContentDraftPrompt(payload: ContentDraftRequest): string {
  const supplied = collectSuppliedEvidenceRefs(payload);
  const acrb = payload.audienceContentResearchBrief;
  const identity =
    payload.agendaTopicIdentity ??
    acrb?.topicIdentity ??
    null;
  const recommendedAngle = acrb
    ? acrb.contentAngles.find((a) => a.angleId === acrb.recommendedAngleId) ?? acrb.contentAngles[0]
    : null;
  const rejectedAngles = (acrb?.identityDiagnostics ?? [])
    .filter((d) => d.stage.includes("synthesis") || d.stage.includes("skeleton"))
    .map((d) => d.rejectedText)
    .filter(Boolean)
    .slice(0, 5);
  return [
    "JSON only. ContentAssignment/ContentDraftRequest를 근거로 contentPlan (with ContentProposition) + Threads 초안. 없는 혜택/일정 만들지 마. 게시하지 마. Cron 만들지 마. Do not re-select the manager agenda.",
    PROPOSITION_RULES,
    identity
      ? [
          "AgendaTopicIdentity is AUTHORITATIVE for destination / product type / travel mode / principal subject.",
          `Identity summary: ${JSON.stringify({
            origin: identity.originEntities,
            destination: identity.destinationEntities,
            productTypes: identity.productTypes,
            travelModes: identity.travelModes,
            seasonality: identity.campaignSeasonality,
            topicEntities: identity.topicEntities,
          })}`,
          "You may refine the angle and audience framing, but MUST NOT silently change destination, travel product type, travel mode, or principal commercial subject without evidence.",
          "Do NOT reuse contaminated/rejected ACRB angles (especially cross-product cruise/package drift).",
          rejectedAngles.length
            ? `Rejected contaminated angle texts (do not reuse): ${rejectedAngles.join(" || ")}`
            : null,
        ]
          .filter(Boolean)
          .join(" ")
      : null,
    acrb ? formatAcrbStrategyBrief(acrb) : null,
    acrb
      ? [
          "AudienceContentResearchBrief (RA-1) is already done — build ContentProposition, then confirm angle/keyMessage/formats/tone/targetChannels.",
          "Do NOT repeat broad research. Do NOT invent facts. inference/hypothesis must not become hard factual copy.",
          "Persist contentPlan.targetChannels using ACRB.channelFit + searchIntent + commercialIntent + format suitability.",
          "Baseline usually includes threads+shortform. Add naver_blog for deep planning/search questions, naver_band for community/family discussion, kakao_channel for consultation/offer when fit supports it.",
          "Do NOT select every channel by default.",
          `Recommended angle seed: ${recommendedAngle?.angle ?? acrb.recommendedAngleId ?? "none"} / verdict=${acrb.researchVerdict}`,
          `channelFit: ${JSON.stringify(recommendedAngle?.channelFit ?? null)}`,
        ].join(" ")
      : null,
    formatDeliverableRequirementsSection(payload.deliverableRequirements),
    formatEvidencePackSection(payload.evidencePack),
    formatAvailableEvidenceSection(supplied),
    GROUNDING_RULES,
    JSON.stringify(payload),
    CONTENT_DRAFT_SHAPE,
  ]
    .filter(Boolean)
    .join("\n");
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
    formatDeliverableRequirementsSection(payload.deliverableRequirements),
    formatEvidencePackSection(payload.evidencePack),
    formatAvailableEvidenceSection(supplied),
    GROUNDING_RULES,
    JSON.stringify(payload),
    CONTENT_DRAFT_SHAPE,
  ]
    .filter(Boolean)
    .join("\n");
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
    formatDeliverableRequirementsSection(payload.deliverableRequirements),
    formatEvidencePackSection(payload.evidencePack),
    formatAvailableEvidenceSection(supplied),
    GROUNDING_RULES,
    JSON.stringify(payload),
    CONTENT_DRAFT_SHAPE,
  ]
    .filter(Boolean)
    .join("\n");
}

/**
 * One bounded schema-shape repair. Structurally invalid contentPlan field types.
 */
export function buildContentDraftSchemaRepairPrompt(
  payload: ContentDraftRequest,
  schemaFailureClass: ContentStrategistSchemaFailureClass,
  zodPath?: string | null,
): string {
  const supplied = collectSuppliedEvidenceRefs(payload);
  return [
    "JSON only. Your previous Content Strategist response failed ContentPlan schema validation.",
    `Failure class: ${schemaFailureClass}.`,
    zodPath ? `Zod path: ${zodPath}.` : null,
    "contentPlan.proposition MUST be an object (content-proposition-v1) or null — never a prose string.",
    "contentPlan.proposition.proofRequirements MUST be an array of objects {claimArea,requiredProof,severity} — never bare strings.",
    "contentPlan.recommendedFormats MUST be an array of objects {format,score,rationale} using ONLY threads_text|instagram_carousel|blog_article|short_video_concept.",
    "Do NOT put checklist/quick_tips/app_notification into recommendedFormats (those are not ContentPlan formats).",
    "contentPlan.evidenceRefs MUST be an array of supplied evidence ID strings or full evidence objects — never bare unrelated strings mixed incorrectly.",
    "Return the COMPLETE JSON object again. No markdown fences. No prose before or after.",
    formatDeliverableRequirementsSection(payload.deliverableRequirements),
    formatEvidencePackSection(payload.evidencePack),
    formatAvailableEvidenceSection(supplied),
    PROPOSITION_RULES,
    GROUNDING_RULES,
    JSON.stringify(payload),
    CONTENT_DRAFT_SHAPE,
  ]
    .filter(Boolean)
    .join("\n");
}

export function buildContentDraftTopicIdentityRepairPrompt(
  payload: ContentDraftRequest,
  reasons: string[],
): string {
  const supplied = collectSuppliedEvidenceRefs(payload);
  const identity =
    payload.agendaTopicIdentity ?? payload.audienceContentResearchBrief?.topicIdentity ?? null;
  return [
    "JSON only. Your previous Content Strategist response violated AgendaTopicIdentity and/or ContentProposition contract.",
    `Violations: ${reasons.slice(0, 10).join(" | ")}`,
    identity
      ? `Authoritative identity: ${JSON.stringify({
          origin: identity.originEntities,
          destination: identity.destinationEntities,
          productTypes: identity.productTypes,
          travelModes: identity.travelModes,
          seasonality: identity.campaignSeasonality,
        })}`
      : null,
    PROPOSITION_RULES,
    "Return the COMPLETE JSON object again. Keep grounded facts.",
    "Rewrite primaryAngle / keyMessage / title / contentPlan.proposition so they do NOT change destination/product type/travel mode, and so proposition fields are specific (promise, readerGain, takeaways, engagement).",
    "If research cannot support useful takeaways without inventing facts, set propositionStrength=insufficient and list limitations — do NOT invent 3 fake tips.",
    "No markdown fences. No prose before or after.",
    formatDeliverableRequirementsSection(payload.deliverableRequirements),
    formatEvidencePackSection(payload.evidencePack),
    formatAvailableEvidenceSection(supplied),
    GROUNDING_RULES,
    JSON.stringify(payload),
    CONTENT_DRAFT_SHAPE,
  ]
    .filter(Boolean)
    .join("\n");
}

function resolvePayloadTopicIdentity(payload: ContentDraftRequest) {
  return payload.agendaTopicIdentity ?? payload.audienceContentResearchBrief?.topicIdentity ?? null;
}

function assertOrNullIdentity(
  output: ContentStrategistOutput,
  payload: ContentDraftRequest,
): ReturnType<typeof validateContentStrategistAgainstTopicIdentity> {
  const identity = resolvePayloadTopicIdentity(payload);
  if (!identity) return { ok: true };
  return validateContentStrategistAgainstTopicIdentity({
    output,
    identity,
    agendaId: payload.selectedAgenda?.id ?? payload.audienceContentResearchBrief?.selectedAgendaId ?? null,
    candidateId: payload.audienceContentResearchBrief?.provenance.agendaCandidateId ?? null,
  });
}

function assertProposition(
  output: ContentStrategistOutput,
  payload: ContentDraftRequest,
): { ok: true } | { ok: false; reasons: string[]; error: ContentStrategistPropositionError } {
  const identity = resolvePayloadTopicIdentity(payload);
  const prop = output.contentPlan?.proposition ?? null;
  // Scaffold-only / no ACRB paths may omit proposition — require when ACRB present.
  if (!payload.audienceContentResearchBrief && !prop) {
    return { ok: true };
  }
  const result = validateContentProposition(prop, { identity });
  if (result.ok) {
    // Persist effective strength downgrade if validator softened it.
    if (prop && result.effectiveStrength !== prop.propositionStrength && output.contentPlan) {
      output.contentPlan.proposition = {
        ...prop,
        propositionStrength: result.effectiveStrength,
        limitations: [
          ...prop.limitations,
          `strength_downgraded_to_${result.effectiveStrength}`,
        ].slice(0, 12),
      };
    }
    return { ok: true };
  }
  const reasons = result.issues.map((i) => `${i.field}:${i.code}:${i.message}`);
  return {
    ok: false,
    reasons,
    error: new ContentStrategistPropositionError(
      reasons.join("; "),
      result.issues,
      result.effectiveStrength,
    ),
  };
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
 * Supports all-string and mixed string/object arrays. Unknown IDs fail closed.
 * Does not invent refs when field is absent/empty.
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
  const hasStringIds = refs.some((item) => typeof item === "string");
  const hasObjects = refs.some((item) => isRecord(item));

  if (hasStringIds) {
    if (supplied.length === 0) {
      throw new ContentPlanContractError({
        incidentClass: "malformed_model_output",
        validationIssue: "invalid_evidence_shape",
        source: "provider_output",
        message: "Provider returned evidence ID strings but no supplied evidence context is available",
      });
    }
    const resolved: AssignmentEvidenceRef[] = [];
    const seen = new Set<string>();
    for (const item of refs) {
      if (typeof item === "string") {
        const hit = byId.get(String(item));
        if (!hit) {
          throw new ContentPlanContractError({
            incidentClass: "malformed_model_output",
            validationIssue: "invalid_evidence_shape",
            source: "provider_output",
            message: `Fabricated or unknown evidence ID not in supplied set: ${String(item)}`,
          });
        }
        if (seen.has(hit.evidenceId)) continue;
        seen.add(hit.evidenceId);
        resolved.push(hit);
        continue;
      }
      if (isRecord(item)) {
        const evidenceId = String(item.evidenceId ?? "");
        if (evidenceId && !allowedIds.has(evidenceId)) {
          throw new ContentPlanContractError({
            incidentClass: "malformed_model_output",
            validationIssue: "invalid_evidence_shape",
            source: "provider_output",
            message: `Fabricated or unknown evidence ID not in supplied set: ${evidenceId}`,
          });
        }
        if (!evidenceId || seen.has(evidenceId)) continue;
        const fromSupplied = byId.get(evidenceId);
        if (fromSupplied) {
          seen.add(evidenceId);
          resolved.push(fromSupplied);
        } else {
          // Object without matching supplied id already rejected above when id present.
          seen.add(evidenceId);
          resolved.push(item as unknown as AssignmentEvidenceRef);
        }
      }
    }
    return { ...contentPlan, evidenceRefs: resolved };
  }

  if (hasObjects && supplied.length > 0 && refs.every((item) => isRecord(item))) {
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

function schemaFailureClassOf(
  detailed: Extract<ParseContentStrategistDetailedResult, { ok: false; kind: "semantic" }>,
): ContentStrategistSchemaFailureClass | null {
  const issue =
    detailed.validationIssue ??
    (detailed.error instanceof ContentPlanContractError
      ? detailed.error.validationIssue
      : null) ??
    "";
  if (issue === "wrong_primitive_type") return "wrong_primitive_type";
  if (issue === "schema_malformed") return "schema_malformed";
  return null;
}

function schemaFailureZodPathOf(
  detailed: Extract<ParseContentStrategistDetailedResult, { ok: false; kind: "semantic" }>,
): string | null {
  if (detailed.error instanceof ContentPlanContractError) {
    return detailed.error.zodPath ?? null;
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
 * - wrong_primitive_type/schema_malformed → schema repair
 * - topic identity violation on otherwise-valid JSON → identity repair
 * Never chain format+grounding+schema. Max invocations = CONTENT_STRATEGIST_MAX_MODEL_INVOCATIONS (2).
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

  const finishOk = async (
    output: ContentStrategistOutput,
    base: {
      attemptCount: number;
      firstAttemptFailureClass: string | null;
      finalParseMode: ContentStrategistParseDiagnostics["finalParseMode"];
      stdoutLength: number;
      formatRetryUsed: boolean;
      groundingRetryUsed: boolean;
      groundingFailureClass?: ContentStrategistGroundingFailureClass | null;
      schemaRetryUsed?: boolean;
      schemaFailureClass?: ContentStrategistSchemaFailureClass | null;
    },
    allowStrategyRepair: boolean,
  ): Promise<{
    output: ContentStrategistOutput;
    diagnostics: ContentStrategistParseDiagnostics;
  }> => {
    const identityCheck = assertOrNullIdentity(output, input.payload);
    const propositionCheck = assertProposition(output, input.payload);

    if (identityCheck.ok && propositionCheck.ok) {
      return {
        output,
        diagnostics: buildDiagnostics({
          ...base,
          contentPlan: output.contentPlan,
          suppliedEvidenceRefCount: suppliedCount,
        }),
      };
    }

    const repairReasons = [
      ...(!identityCheck.ok ? identityCheck.reasons : []),
      ...(!propositionCheck.ok ? propositionCheck.reasons : []),
    ];

    if (!allowStrategyRepair) {
      if (!identityCheck.ok) {
        throw new ContentStrategistTopicIdentityError(
          identityCheck.reasons.join("; "),
          identityCheck.diagnostics,
        );
      }
      if (!propositionCheck.ok) {
        throw propositionCheck.error;
      }
      throw new Error("content strategist strategy validation failed");
    }

    const rawRepair = await input.invoke(
      buildContentDraftTopicIdentityRepairPrompt(input.payload, repairReasons),
    );
    const repaired = parseContentStrategistOutputDetailed(rawRepair, parseOpts);
    if (!repaired.ok) {
      if (!identityCheck.ok) {
        throw new ContentStrategistTopicIdentityError(
          `strategy_repair_failed:${repairReasons.join("; ")}`,
          identityCheck.diagnostics,
        );
      }
      throw new ContentStrategistPropositionError(
        `strategy_repair_failed:${repairReasons.join("; ")}`,
        propositionCheck.ok ? [] : propositionCheck.error.issues,
        propositionCheck.ok ? "weak" : propositionCheck.error.effectiveStrength,
      );
    }

    const secondIdentity = assertOrNullIdentity(repaired.output, input.payload);
    if (!secondIdentity.ok) {
      throw new ContentStrategistTopicIdentityError(
        secondIdentity.reasons.join("; "),
        secondIdentity.diagnostics,
      );
    }
    const secondProposition = assertProposition(repaired.output, input.payload);
    if (!secondProposition.ok) {
      throw secondProposition.error;
    }

    return {
      output: repaired.output,
      diagnostics: buildDiagnostics({
        attemptCount: base.attemptCount + 1,
        firstAttemptFailureClass:
          base.firstAttemptFailureClass ??
          (!identityCheck.ok ? "topic_identity_violation" : "content_proposition_violation"),
        finalParseMode: "format_retry",
        stdoutLength: repaired.stdoutLength,
        formatRetryUsed: base.formatRetryUsed,
        groundingRetryUsed: base.groundingRetryUsed,
        contentPlan: repaired.output.contentPlan,
        suppliedEvidenceRefCount: suppliedCount,
      }),
    };
  };

  const raw1 = await input.invoke(buildContentDraftPrompt(input.payload));
  const first = parseContentStrategistOutputDetailed(raw1, parseOpts);

  if (first.ok) {
    return finishOk(
      first.output,
      {
        attemptCount: 1,
        firstAttemptFailureClass: null,
        finalParseMode: first.extractMode,
        stdoutLength: first.stdoutLength,
        formatRetryUsed: false,
        groundingRetryUsed: false,
      },
      true,
    );
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
    if (groundingClass) {
      const raw2 = await input.invoke(
        buildContentDraftGroundingRepairPrompt(input.payload, groundingClass),
      );
      const second = parseContentStrategistOutputDetailed(raw2, parseOpts);

      if (second.ok) {
        return finishOk(
          second.output,
          {
            attemptCount: 2,
            firstAttemptFailureClass: groundingClass,
            groundingFailureClass: groundingClass,
            finalParseMode: "grounding_retry",
            stdoutLength: second.stdoutLength,
            formatRetryUsed: false,
            groundingRetryUsed: true,
            schemaRetryUsed: false,
          },
          false,
        );
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
            schemaRetryUsed: false,
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
            schemaRetryUsed: false,
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

    const schemaClass = schemaFailureClassOf(first);
    if (!schemaClass) {
      throw first.error instanceof ContentPlanContractError
        ? first.error
        : new Error(semanticErrorMessage(first.error));
    }

    const zodPath = schemaFailureZodPathOf(first);
    const rawSchema = await input.invoke(
      buildContentDraftSchemaRepairPrompt(input.payload, schemaClass, zodPath),
    );
    const schemaSecond = parseContentStrategistOutputDetailed(rawSchema, parseOpts);

    if (schemaSecond.ok) {
      return finishOk(
        schemaSecond.output,
        {
          attemptCount: 2,
          firstAttemptFailureClass: schemaClass,
          schemaFailureClass: schemaClass,
          finalParseMode: "schema_retry",
          stdoutLength: schemaSecond.stdoutLength,
          formatRetryUsed: false,
          groundingRetryUsed: false,
          schemaRetryUsed: true,
        },
        false,
      );
    }

    if (schemaSecond.kind === "runtime") {
      throw new ContentStrategistRuntimeError({
        failureClass: schemaSecond.failureClass,
        message: schemaSecond.message,
        diagnostics: buildDiagnostics({
          attemptCount: 2,
          firstAttemptFailureClass: schemaClass,
          schemaFailureClass: schemaClass,
          finalParseMode: null,
          stdoutLength: schemaSecond.stdoutLength,
          formatRetryUsed: false,
          groundingRetryUsed: false,
          schemaRetryUsed: true,
          suppliedEvidenceRefCount: suppliedCount,
        }),
      });
    }

    if (schemaSecond.kind === "format") {
      throw new ContentStrategistFormatError({
        failureClass: schemaSecond.failureClass,
        message: schemaSecond.message,
        diagnostics: buildDiagnostics({
          attemptCount: 2,
          firstAttemptFailureClass: schemaClass,
          schemaFailureClass: schemaClass,
          finalParseMode: null,
          stdoutLength: schemaSecond.stdoutLength,
          formatRetryUsed: false,
          groundingRetryUsed: false,
          schemaRetryUsed: true,
          suppliedEvidenceRefCount: suppliedCount,
        }),
      });
    }

    const schemaErr =
      schemaSecond.error instanceof ContentPlanContractError
        ? schemaSecond.error
        : new Error(semanticErrorMessage(schemaSecond.error));
    schemaErr.message = `${semanticErrorMessage(schemaErr)};content_strategist_schema_retry_used=1;first=${schemaClass}`;
    throw schemaErr;
  }

  // first.kind === "format" — exactly one bounded format-repair retry.
  const raw2 = await input.invoke(
    buildContentDraftFormatRepairPrompt(input.payload, first.failureClass),
  );
  const second = parseContentStrategistOutputDetailed(raw2, parseOpts);

  if (second.ok) {
    return finishOk(
      second.output,
      {
        attemptCount: 2,
        firstAttemptFailureClass: first.failureClass,
        finalParseMode: "format_retry",
        stdoutLength: second.stdoutLength,
        formatRetryUsed: true,
        groundingRetryUsed: false,
      },
      false,
    );
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

/** Attempt 1 + at most one JSON format repair. Never more — GA must not stall a run. */
export const GOVERNANCE_AUDITOR_MAX_MODEL_INVOCATIONS = 2;

export const GOVERNANCE_AUDITOR_PARSE_FAILED = "governance-auditor returned no ALLOW/REVIEW/BLOCK";

export function isGovernanceParseFailure(error: unknown): boolean {
  return error instanceof Error && error.message.includes(GOVERNANCE_AUDITOR_PARSE_FAILED);
}

function buildGovernanceFormatRepairPrompt(
  payload: GovernanceReviewRequest | import("@/lib/marketing/content/governance/types").StructuredGovernanceReviewRequest,
  previousRaw: string,
): string {
  return [
    buildGovernanceReviewPrompt(payload),
    "",
    "FORMAT REPAIR: your previous response could not be parsed as a governance decision.",
    "Return ONE JSON object and nothing else — no prose, no markdown fence, no explanation.",
    '"decision" MUST be exactly one of "ALLOW", "REVIEW", or "BLOCK".',
    `previous unparsable response (truncated): ${previousRaw.trim().slice(0, 400)}`,
  ].join("\n");
}

export type GovernanceReviewWithRetryResult = {
  result: GovernanceReviewResult;
  attempts: number;
  usedFormatRetry: boolean;
};

/**
 * Governance Auditor invoke with a single JSON format repair.
 * Previously a one-shot: an unparsable response demoted the candidate to
 * `governance_unavailable` even though the model would answer correctly on retry.
 */
export async function requestGovernanceReviewWithFormatRetry(input: {
  payload:
    | GovernanceReviewRequest
    | import("@/lib/marketing/content/governance/types").StructuredGovernanceReviewRequest;
  invoke: (prompt: string) => Promise<string>;
  onFormatRetry?: (info: { message: string }) => void;
}): Promise<GovernanceReviewWithRetryResult> {
  const firstRaw = await input.invoke(buildGovernanceReviewPrompt(input.payload));
  try {
    return { result: parseGovernanceAuditorOutput(firstRaw), attempts: 1, usedFormatRetry: false };
  } catch (error) {
    if (!isGovernanceParseFailure(error)) throw error;
    input.onFormatRetry?.({ message: error instanceof Error ? error.message : String(error) });

    const repairRaw = await input.invoke(
      buildGovernanceFormatRepairPrompt(input.payload, firstRaw),
    );
    return {
      result: parseGovernanceAuditorOutput(repairRaw),
      attempts: GOVERNANCE_AUDITOR_MAX_MODEL_INVOCATIONS,
      usedFormatRetry: true,
    };
  }
}

/**
 * Cron specialist prompts are JSON-only oneshot — no Hermes tool invocation.
 * Documented for migration safety audits (STEP 2-5.4B).
 */
export const MARKETING_CRON_SPECIALIST_USES_HERMES_TOOLS = false;
