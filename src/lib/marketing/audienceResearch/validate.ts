import { createHash } from "node:crypto";

import type { AssignmentEvidenceRef } from "@/lib/marketing/content/types";

import {
  ACRB_CHANNEL_FIT_TARGETS,
  ACRB_CONTRACT_VERSION,
  ACRB_RESEARCH_STATUSES,
  ACRB_VERDICTS,
  AUDIENCE_CONTENT_RESEARCH_BRIEF_CONTRACT,
  RESEARCH_FINDING_TYPES,
  SEARCH_INTENT_CATEGORIES,
  type AcrbChannelFit,
  type AcrbContentAngle,
  type AcrbResearchFinding,
  type AcrbTypedInsight,
  type AudienceContentResearchBrief,
  type AudienceContentResearchBriefRef,
  type ResearchFindingType,
  type SearchIntentCategory,
} from "@/lib/marketing/audienceResearch/contracts";
import {
  EVIDENCE_BACKED_STORY_BRIEF_CONTRACT,
  RESEARCH_EXECUTION_STATUSES,
  RESEARCH_QUESTION_FINDING_STATUSES,
  STORY_EVIDENCE_RELATIONSHIPS,
  STORY_EVIDENCE_SUPPORT_STATUSES,
  STORY_RESEARCH_CONTRACT_VERSION,
  type EvidenceBackedStoryBrief,
  type ResearchExecutionStatus,
  type ResearchQuestionFinding,
  type StoryEvidenceAssessmentItem,
  type StoryEvidenceRelationship,
  type StoryEvidenceSupportStatus,
} from "@/lib/marketing/storyPoint/contracts";

export function clamp01(value: number): number {
  if (!Number.isFinite(value)) return 0;
  return Math.max(0, Math.min(1, value));
}

export function isFindingType(value: unknown): value is ResearchFindingType {
  return typeof value === "string" && (RESEARCH_FINDING_TYPES as readonly string[]).includes(value);
}

export function isSearchIntentCategory(value: unknown): value is SearchIntentCategory {
  return (
    typeof value === "string" && (SEARCH_INTENT_CATEGORIES as readonly string[]).includes(value)
  );
}

function asString(value: unknown, fallback = ""): string {
  return typeof value === "string" ? value.trim() : fallback;
}

function asStringArray(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value.map((item) => asString(item)).filter(Boolean);
}

function normalizeTypedInsight(raw: unknown): AcrbTypedInsight | null {
  if (!raw || typeof raw !== "object") return null;
  const row = raw as Record<string, unknown>;
  const text = asString(row.text);
  if (!text) return null;
  const type = isFindingType(row.type) ? row.type : "hypothesis";
  return {
    text,
    type,
    confidence: clamp01(typeof row.confidence === "number" ? row.confidence : 0.4),
    evidenceRefs: asStringArray(row.evidenceRefs),
  };
}

function normalizeTypedInsightList(raw: unknown): AcrbTypedInsight[] {
  if (!Array.isArray(raw)) return [];
  return raw.map(normalizeTypedInsight).filter((item): item is AcrbTypedInsight => item != null);
}

function emptyChannelFit(): AcrbChannelFit {
  return {
    threads: 0,
    naver_blog: 0,
    naver_band: 0,
    kakao_channel: 0,
    shortform: 0,
    cardnews: 0,
  };
}

function normalizeChannelFit(raw: unknown): AcrbChannelFit {
  const base = emptyChannelFit();
  if (!raw || typeof raw !== "object") return base;
  const row = raw as Record<string, unknown>;
  for (const key of ACRB_CHANNEL_FIT_TARGETS) {
    const value = row[key];
    base[key] = clamp01(typeof value === "number" ? value : 0);
  }
  return base;
}

function normalizeFinding(raw: unknown, index: number): AcrbResearchFinding | null {
  if (!raw || typeof raw !== "object") return null;
  const row = raw as Record<string, unknown>;
  const text = asString(row.text ?? row.finding);
  if (!text) return null;
  const type = isFindingType(row.type) ? row.type : "hypothesis";
  return {
    findingId: asString(row.findingId) || `finding_${index + 1}`,
    text,
    type,
    confidence: clamp01(typeof row.confidence === "number" ? row.confidence : 0.4),
    evidenceRefs: asStringArray(row.evidenceRefs),
    sourceClass:
      typeof row.sourceClass === "string"
        ? (row.sourceClass as AcrbResearchFinding["sourceClass"])
        : null,
    provenanceNote: asString(row.provenanceNote) || null,
  };
}

function normalizeAngle(raw: unknown, index: number): AcrbContentAngle | null {
  if (!raw || typeof raw !== "object") return null;
  const row = raw as Record<string, unknown>;
  const angle = asString(row.angle);
  const hook = asString(row.hook);
  if (!angle || !hook) return null;
  return {
    angleId: asString(row.angleId) || `angle_${index + 1}`,
    angle,
    hook,
    audienceTension: asString(row.audienceTension),
    interestScore: clamp01(typeof row.interestScore === "number" ? row.interestScore : 0.5),
    noveltyScore: clamp01(typeof row.noveltyScore === "number" ? row.noveltyScore : 0.5),
    evidenceStrength: clamp01(typeof row.evidenceStrength === "number" ? row.evidenceStrength : 0.4),
    channelFit: normalizeChannelFit(row.channelFit),
    rationale: asString(row.rationale),
    supportingFindingRefs: asStringArray(row.supportingFindingRefs),
    limitations: asStringArray(row.limitations),
  };
}

export function buildEvidenceFingerprint(evidenceRefs: AssignmentEvidenceRef[]): string {
  const parts = evidenceRefs
    .map((ref) =>
      [
        ref.evidenceId,
        ref.url ?? "",
        ref.reference ?? "",
        (ref.excerpt ?? "").slice(0, 120),
        ref.observedAt ?? "",
      ].join("|"),
    )
    .sort();
  return createHash("sha256").update(parts.join("\n")).digest("hex").slice(0, 24);
}

export function buildAcrbLogicalIdentity(input: {
  selectedAgendaId: string;
  assignmentId: string;
  evidenceFingerprint: string;
  preselectionResearchBriefId: string | null;
  contractVersion?: number;
  /** ED-2: StoryPoint-aware cache key segment. */
  storyPointHash?: string | null;
  /** ED-2 research contract version (e.g. story-research-v1). */
  researchContractVersion?: string | null;
}): string {
  const seed = [
    input.selectedAgendaId,
    input.assignmentId,
    input.evidenceFingerprint,
    input.preselectionResearchBriefId ?? "",
    String(input.contractVersion ?? ACRB_CONTRACT_VERSION),
    input.storyPointHash ?? "",
    input.researchContractVersion ?? "",
  ].join("::");
  return createHash("sha256").update(seed).digest("hex").slice(0, 32);
}

export function buildAcrbId(logicalIdentity: string): string {
  return `acrb_${logicalIdentity.slice(0, 24)}`;
}

export function sha256AudienceContentResearchBrief(
  brief: AudienceContentResearchBrief,
): string {
  return createHash("sha256")
    .update(JSON.stringify(brief))
    .digest("hex");
}

export function toAudienceContentResearchBriefRef(
  brief: AudienceContentResearchBrief,
): AudienceContentResearchBriefRef {
  const recommended = brief.contentAngles.find((a) => a.angleId === brief.recommendedAngleId);
  return {
    contract: AUDIENCE_CONTENT_RESEARCH_BRIEF_CONTRACT,
    researchBriefId: brief.id,
    sha256: sha256AudienceContentResearchBrief(brief),
    researchVerdict: brief.researchVerdict,
    researchStatus: brief.researchStatus,
    recommendedAngleId: brief.recommendedAngleId,
    recommendedAngle: recommended?.angle ?? null,
  };
}

function isStorySupportVerdict(value: unknown): value is StoryEvidenceSupportStatus {
  return (
    typeof value === "string" &&
    (STORY_EVIDENCE_SUPPORT_STATUSES as readonly string[]).includes(value)
  );
}

function isResearchExecutionStatus(value: unknown): value is ResearchExecutionStatus {
  return (
    typeof value === "string" &&
    (RESEARCH_EXECUTION_STATUSES as readonly string[]).includes(value)
  );
}

function isResearchQuestionFindingStatus(
  value: unknown,
): value is ResearchQuestionFinding["status"] {
  return (
    typeof value === "string" &&
    (RESEARCH_QUESTION_FINDING_STATUSES as readonly string[]).includes(value)
  );
}

function isEvidenceRelationship(value: unknown): value is StoryEvidenceRelationship {
  return (
    typeof value === "string" &&
    (STORY_EVIDENCE_RELATIONSHIPS as readonly string[]).includes(value)
  );
}

function normalizeResearchQuestionFinding(raw: unknown): ResearchQuestionFinding | null {
  if (!raw || typeof raw !== "object") return null;
  const row = raw as Record<string, unknown>;
  const question = asString(row.question);
  if (!question) return null;
  return {
    question,
    status: isResearchQuestionFindingStatus(row.status) ? row.status : "unresolved",
    finding: asString(row.finding),
    evidenceRefs: asStringArray(row.evidenceRefs),
    sourceClasses: asStringArray(row.sourceClasses),
    confidence: clamp01(typeof row.confidence === "number" ? row.confidence : 0),
    limitations: asStringArray(row.limitations),
  };
}

function normalizeEvidenceAssessmentItem(raw: unknown): StoryEvidenceAssessmentItem | null {
  if (!raw || typeof raw !== "object") return null;
  const row = raw as Record<string, unknown>;
  const evidenceId = asString(row.evidenceId);
  if (!evidenceId) return null;
  const epistemic =
    row.epistemicType === "verified_fact" ||
    row.epistemicType === "observed_signal" ||
    row.epistemicType === "inference" ||
    row.epistemicType === "hypothesis"
      ? row.epistemicType
      : "hypothesis";
  return {
    evidenceId,
    relationship: isEvidenceRelationship(row.relationship) ? row.relationship : "unresolved",
    relevanceToStoryPoint: clamp01(
      typeof row.relevanceToStoryPoint === "number" ? row.relevanceToStoryPoint : 0,
    ),
    epistemicType: epistemic,
    sourceClass: asString(row.sourceClass) || null,
    note: asString(row.note) || null,
  };
}

function normalizeStoryPointRef(
  raw: unknown,
): AudienceContentResearchBrief["storyPointRef"] {
  if (!raw || typeof raw !== "object") return null;
  const row = raw as Record<string, unknown>;
  const storyPointId = asString(row.storyPointId);
  const storyPointHash = asString(row.storyPointHash);
  if (!storyPointId || !storyPointHash) return null;
  return {
    storyPointId,
    storyPointHash,
    researchContractVersion:
      asString(row.researchContractVersion) || STORY_RESEARCH_CONTRACT_VERSION,
  };
}

function normalizeEvidenceBackedStoryBrief(raw: unknown): EvidenceBackedStoryBrief | null {
  if (!raw || typeof raw !== "object") return null;
  const row = raw as Record<string, unknown>;
  if (row.contract !== EVIDENCE_BACKED_STORY_BRIEF_CONTRACT) return null;
  const storyPointId = asString(row.storyPointId);
  const storyPointHash = asString(row.storyPointHash);
  if (!storyPointId || !storyPointHash) return null;

  const findings = Array.isArray(row.researchQuestionFindings)
    ? row.researchQuestionFindings
        .map(normalizeResearchQuestionFinding)
        .filter((item): item is ResearchQuestionFinding => item != null)
    : [];
  const assessments = Array.isArray(row.evidenceAssessment)
    ? row.evidenceAssessment
        .map(normalizeEvidenceAssessmentItem)
        .filter((item): item is StoryEvidenceAssessmentItem => item != null)
    : [];
  const obsRaw =
    row.observability && typeof row.observability === "object"
      ? (row.observability as Record<string, unknown>)
      : {};

  return {
    contract: EVIDENCE_BACKED_STORY_BRIEF_CONTRACT,
    researchContractVersion: STORY_RESEARCH_CONTRACT_VERSION,
    storyPointId,
    storyPointHash,
    agendaLogicalIdentity: asString(row.agendaLogicalIdentity),
    researchExecutionStatus: isResearchExecutionStatus(row.researchExecutionStatus)
      ? row.researchExecutionStatus
      : "partial",
    storySupportVerdict: isStorySupportVerdict(row.storySupportVerdict)
      ? row.storySupportVerdict
      : "INSUFFICIENT_EVIDENCE",
    supportedClaimBoundary: asString(row.supportedClaimBoundary) || null,
    researchQuestionFindings: findings,
    evidenceAssessment: assessments,
    contradictedClaims: asStringArray(row.contradictedClaims),
    unresolvedQuestions: asStringArray(row.unresolvedQuestions),
    usableFactIds: asStringArray(row.usableFactIds),
    refutationNotes: asString(row.refutationNotes) || null,
    limitations: asStringArray(row.limitations),
    alternateFallbackUsed: Boolean(row.alternateFallbackUsed),
    researchSupportedFraming: asStringArray(row.researchSupportedFraming),
    observability: {
      plannedQuestionCount:
        typeof obsRaw.plannedQuestionCount === "number" ? obsRaw.plannedQuestionCount : findings.length,
      answeredQuestionCount:
        typeof obsRaw.answeredQuestionCount === "number"
          ? obsRaw.answeredQuestionCount
          : findings.filter((f) => f.status === "answered").length,
      unresolvedQuestionCount:
        typeof obsRaw.unresolvedQuestionCount === "number"
          ? obsRaw.unresolvedQuestionCount
          : findings.filter((f) => f.status === "unresolved").length,
      contradictingEvidenceCount:
        typeof obsRaw.contradictingEvidenceCount === "number"
          ? obsRaw.contradictingEvidenceCount
          : assessments.filter((a) => a.relationship === "contradicts").length,
      externalQueriesAttempted:
        typeof obsRaw.externalQueriesAttempted === "number" ? obsRaw.externalQueriesAttempted : 0,
      externalQueriesSuccessful:
        typeof obsRaw.externalQueriesSuccessful === "number" ? obsRaw.externalQueriesSuccessful : 0,
      sourceClasses: asStringArray(obsRaw.sourceClasses),
    },
  };
}

function normalizeStoryResearchOverlay(row: Record<string, unknown>): Pick<
  AudienceContentResearchBrief,
  | "storyPointRef"
  | "storyPointHash"
  | "storySupportVerdict"
  | "supportedClaimBoundary"
  | "researchQuestionFindings"
  | "contradictedClaims"
  | "unresolvedQuestions"
  | "evidenceBackedStoryBrief"
  | "researchExecutionStatus"
  | "alternateUsed"
> {
  const storyPointRef = normalizeStoryPointRef(row.storyPointRef);
  const evidenceBrief = normalizeEvidenceBackedStoryBrief(row.evidenceBackedStoryBrief);
  const findings = Array.isArray(row.researchQuestionFindings)
    ? row.researchQuestionFindings
        .map(normalizeResearchQuestionFinding)
        .filter((item): item is ResearchQuestionFinding => item != null)
    : evidenceBrief?.researchQuestionFindings;

  const storyPointHash =
    asString(row.storyPointHash) ||
    storyPointRef?.storyPointHash ||
    evidenceBrief?.storyPointHash ||
    null;

  const storySupportVerdict = isStorySupportVerdict(row.storySupportVerdict)
    ? row.storySupportVerdict
    : evidenceBrief?.storySupportVerdict ?? null;

  const researchExecutionStatus = isResearchExecutionStatus(row.researchExecutionStatus)
    ? row.researchExecutionStatus
    : evidenceBrief?.researchExecutionStatus ?? null;

  const alternateUsed =
    typeof row.alternateUsed === "boolean"
      ? row.alternateUsed
      : evidenceBrief
        ? Boolean(evidenceBrief.alternateFallbackUsed)
        : null;

  return {
    storyPointRef:
      storyPointRef ??
      (evidenceBrief
        ? {
            storyPointId: evidenceBrief.storyPointId,
            storyPointHash: evidenceBrief.storyPointHash,
            researchContractVersion: evidenceBrief.researchContractVersion,
          }
        : null),
    storyPointHash,
    storySupportVerdict,
    supportedClaimBoundary:
      asString(row.supportedClaimBoundary) ||
      evidenceBrief?.supportedClaimBoundary ||
      null,
    researchQuestionFindings: findings ?? undefined,
    contradictedClaims: Array.isArray(row.contradictedClaims)
      ? asStringArray(row.contradictedClaims)
      : evidenceBrief?.contradictedClaims,
    unresolvedQuestions: Array.isArray(row.unresolvedQuestions)
      ? asStringArray(row.unresolvedQuestions)
      : evidenceBrief?.unresolvedQuestions,
    evidenceBackedStoryBrief: evidenceBrief,
    researchExecutionStatus,
    alternateUsed,
  };
}

export function parseAudienceContentResearchBrief(
  raw: unknown,
): AudienceContentResearchBrief | null {
  if (!raw || typeof raw !== "object") return null;
  const row = raw as Record<string, unknown>;
  if (row.contract !== AUDIENCE_CONTENT_RESEARCH_BRIEF_CONTRACT) return null;
  if (typeof row.id !== "string" || !row.id.trim()) return null;
  if (typeof row.logicalIdentity !== "string" || !row.logicalIdentity.trim()) return null;

  const researchStatus = (ACRB_RESEARCH_STATUSES as readonly string[]).includes(
    String(row.researchStatus),
  )
    ? (row.researchStatus as AudienceContentResearchBrief["researchStatus"])
    : "partial";
  const researchVerdict = (ACRB_VERDICTS as readonly string[]).includes(String(row.researchVerdict))
    ? (row.researchVerdict as AudienceContentResearchBrief["researchVerdict"])
    : "PROCEED_WITH_CAUTION";

  const audienceRaw =
    row.audience && typeof row.audience === "object"
      ? (row.audience as Record<string, unknown>)
      : {};
  const searchRaw =
    row.searchIntent && typeof row.searchIntent === "object"
      ? (row.searchIntent as Record<string, unknown>)
      : {};
  const marketRaw =
    row.marketSignals && typeof row.marketSignals === "object"
      ? (row.marketSignals as Record<string, unknown>)
      : {};
  const coverageRaw =
    row.sourceCoverage && typeof row.sourceCoverage === "object"
      ? (row.sourceCoverage as Record<string, unknown>)
      : {};
  const provenanceRaw =
    row.provenance && typeof row.provenance === "object"
      ? (row.provenance as Record<string, unknown>)
      : {};

  const findings = Array.isArray(row.researchFindings)
    ? row.researchFindings
        .map((item, i) => normalizeFinding(item, i))
        .filter((item): item is AcrbResearchFinding => item != null)
    : [];
  const angles = Array.isArray(row.contentAngles)
    ? row.contentAngles
        .map((item, i) => normalizeAngle(item, i))
        .filter((item): item is AcrbContentAngle => item != null)
    : [];

  const primaryIntent = isSearchIntentCategory(searchRaw.primaryIntent)
    ? searchRaw.primaryIntent
    : "informational";
  const secondaryIntents = Array.isArray(searchRaw.secondaryIntents)
    ? searchRaw.secondaryIntents.filter(isSearchIntentCategory)
    : [];

  return {
    contract: AUDIENCE_CONTENT_RESEARCH_BRIEF_CONTRACT,
    version: ACRB_CONTRACT_VERSION,
    id: row.id.trim(),
    logicalIdentity: row.logicalIdentity.trim(),
    generatedAt: asString(row.generatedAt) || new Date().toISOString(),
    selectedAgendaId: asString(row.selectedAgendaId),
    assignmentId: asString(row.assignmentId),
    researchStatus,
    sourceCoverage: {
      assignmentEvidence: Boolean(coverageRaw.assignmentEvidence),
      metaEditorial: Boolean(coverageRaw.metaEditorial),
      internalResearchSignals: Boolean(coverageRaw.internalResearchSignals),
      semanticRetrieval: Boolean(coverageRaw.semanticRetrieval),
      historicalContent: Boolean(coverageRaw.historicalContent),
      externalWebSearch: Boolean(coverageRaw.externalWebSearch),
      notes: asStringArray(coverageRaw.notes),
    },
    audience: {
      primary: normalizeTypedInsightList(audienceRaw.primary),
      secondary: normalizeTypedInsightList(audienceRaw.secondary),
      motivations: normalizeTypedInsightList(audienceRaw.motivations),
      anxieties: normalizeTypedInsightList(audienceRaw.anxieties),
      objections: normalizeTypedInsightList(audienceRaw.objections),
      decisionTriggers: normalizeTypedInsightList(audienceRaw.decisionTriggers),
    },
    searchIntent: {
      primaryIntent,
      secondaryIntents,
      queries: normalizeTypedInsightList(searchRaw.queries),
      questions: normalizeTypedInsightList(searchRaw.questions),
    },
    marketSignals: {
      observedPatterns: normalizeTypedInsightList(marketRaw.observedPatterns),
      competitorHooks: normalizeTypedInsightList(marketRaw.competitorHooks),
      saturatedAngles: normalizeTypedInsightList(marketRaw.saturatedAngles),
      contentGaps: normalizeTypedInsightList(marketRaw.contentGaps),
    },
    researchFindings: findings,
    contentAngles: angles,
    recommendedAngleId: asString(row.recommendedAngleId) || null,
    recommendedAngleReason: asString(row.recommendedAngleReason) || null,
    researchVerdict,
    verdictReasons: asStringArray(row.verdictReasons) as AudienceContentResearchBrief["verdictReasons"],
    limitations: asStringArray(row.limitations),
    provenance: {
      preselectionResearchBriefId: asString(provenanceRaw.preselectionResearchBriefId) || null,
      agendaCandidateId: asString(provenanceRaw.agendaCandidateId) || null,
      evidenceFingerprint: asString(provenanceRaw.evidenceFingerprint),
      synthesisMode:
        provenanceRaw.synthesisMode === "llm" ||
        provenanceRaw.synthesisMode === "deterministic_fallback" ||
        provenanceRaw.synthesisMode === "reused"
          ? provenanceRaw.synthesisMode
          : "deterministic_fallback",
      documentCount:
        typeof provenanceRaw.documentCount === "number" ? provenanceRaw.documentCount : 0,
      queryCount: typeof provenanceRaw.queryCount === "number" ? provenanceRaw.queryCount : 0,
      semanticUsed: Boolean(provenanceRaw.semanticUsed),
      historicalMatchCount:
        typeof provenanceRaw.historicalMatchCount === "number"
          ? provenanceRaw.historicalMatchCount
          : 0,
      externalResearchUsed: Boolean(provenanceRaw.externalResearchUsed),
      searchProvider:
        typeof provenanceRaw.searchProvider === "string"
          ? provenanceRaw.searchProvider
          : provenanceRaw.searchProvider === null
            ? null
            : undefined,
      externalResultCount:
        typeof provenanceRaw.externalResultCount === "number"
          ? provenanceRaw.externalResultCount
          : undefined,
      fetchedDocumentCount:
        typeof provenanceRaw.fetchedDocumentCount === "number"
          ? provenanceRaw.fetchedDocumentCount
          : undefined,
      totalFetchedBytes:
        typeof provenanceRaw.totalFetchedBytes === "number"
          ? provenanceRaw.totalFetchedBytes
          : undefined,
      externalResearchRuntimeMs:
        typeof provenanceRaw.externalResearchRuntimeMs === "number"
          ? provenanceRaw.externalResearchRuntimeMs
          : undefined,
      officialSourceCount:
        typeof provenanceRaw.officialSourceCount === "number"
          ? provenanceRaw.officialSourceCount
          : undefined,
      socialCommunitySourceCount:
        typeof provenanceRaw.socialCommunitySourceCount === "number"
          ? provenanceRaw.socialCommunitySourceCount
          : undefined,
      plannedQueryCount:
        typeof provenanceRaw.plannedQueryCount === "number"
          ? provenanceRaw.plannedQueryCount
          : undefined,
      attemptedQueryCount:
        typeof provenanceRaw.attemptedQueryCount === "number"
          ? provenanceRaw.attemptedQueryCount
          : undefined,
      successfulQueryCount:
        typeof provenanceRaw.successfulQueryCount === "number"
          ? provenanceRaw.successfulQueryCount
          : undefined,
      failedQueryCount:
        typeof provenanceRaw.failedQueryCount === "number"
          ? provenanceRaw.failedQueryCount
          : undefined,
      retryCount:
        typeof provenanceRaw.retryCount === "number" ? provenanceRaw.retryCount : undefined,
      usableResultCount:
        typeof provenanceRaw.usableResultCount === "number"
          ? provenanceRaw.usableResultCount
          : undefined,
      searchRequestCount:
        typeof provenanceRaw.searchRequestCount === "number"
          ? provenanceRaw.searchRequestCount
          : undefined,
      externalSearchStatus:
        typeof provenanceRaw.externalSearchStatus === "string"
          ? (provenanceRaw.externalSearchStatus as AudienceContentResearchBrief["provenance"]["externalSearchStatus"])
          : undefined,
      providerCredentialPresent:
        typeof provenanceRaw.providerCredentialPresent === "boolean"
          ? provenanceRaw.providerCredentialPresent
          : undefined,
    },
    topicIdentity:
      row.topicIdentity && typeof row.topicIdentity === "object"
        ? (row.topicIdentity as AudienceContentResearchBrief["topicIdentity"])
        : null,
    identityDiagnostics: Array.isArray(row.identityDiagnostics)
      ? (row.identityDiagnostics as AudienceContentResearchBrief["identityDiagnostics"])
      : [],
    ...normalizeStoryResearchOverlay(row),
  };
}

export function assertAudienceContentResearchBrief(
  raw: unknown,
): AudienceContentResearchBrief {
  const parsed = parseAudienceContentResearchBrief(raw);
  if (!parsed) {
    throw new Error("invalid_audience_content_research_brief");
  }
  return parsed;
}
