import { z } from "zod";

import {
  agendaCandidateSchema,
  commercialRelevanceSchema,
  credibilityAssessmentSchema,
  corroborationAssessmentSchema,
  freshnessMetadataSchema,
  researchBriefSchema,
  researchEvidenceSchema,
  researchScoreComponentsSchema,
  researchSignalSchema,
  researchSourceSchema,
  travelRelevanceAssessmentSchema,
} from "@/lib/marketing/research/validation";
import type { AgendaCandidate, ResearchBrief } from "@/lib/marketing/research/types/researchBrief";
import type { ResearchSource } from "@/lib/marketing/research/types/researchSource";
import type {
  ResearchEvidence,
  ResearchSignal,
} from "@/lib/marketing/research/types/researchSignal";
import { ResearchValidationError } from "@/lib/marketing/research/repository/errors";

function asString(value: unknown, fallback = ""): string {
  return typeof value === "string" ? value : fallback;
}

function asStringOrNull(value: unknown): string | null {
  return typeof value === "string" ? value : value == null ? null : String(value);
}

function asNumberOrNull(value: unknown): number | null {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string" && value.trim()) {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : null;
  }
  return null;
}

function asBool(value: unknown, fallback = false): boolean {
  return typeof value === "boolean" ? value : fallback;
}

/** Postgres timestamptz → ISO Z for Zod `.datetime()` validation. */
function normalizeIsoDatetime(value: unknown): string {
  if (typeof value !== "string" || !value.trim()) return "";
  const ms = Date.parse(value);
  if (Number.isNaN(ms)) return asString(value);
  return new Date(ms).toISOString();
}

function asStringArray(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value.filter((item): item is string => typeof item === "string");
}

function asJsonObject(value: unknown): Record<string, unknown> | null {
  if (typeof value !== "object" || value == null || Array.isArray(value)) return null;
  return value as Record<string, unknown>;
}

function assertNoSecrets(row: Record<string, unknown>): void {
  const serialized = JSON.stringify(row).toLowerCase();
  for (const token of ["access_token", "refresh_token", "client_secret", "password", "api_key"]) {
    if (serialized.includes(token)) {
      throw new ResearchValidationError(`forbidden credential-like field: ${token}`);
    }
  }
}

function parseJsonField<T>(value: unknown, schema: z.ZodType<T>, label: string): T {
  if (value == null) {
    throw new ResearchValidationError(`missing ${label}`);
  }
  const parsed = schema.safeParse(value);
  if (!parsed.success) {
    throw new ResearchValidationError(`invalid ${label}: ${parsed.error.message}`);
  }
  return parsed.data;
}

export function mapResearchSourceRow(row: Record<string, unknown>): ResearchSource {
  assertNoSecrets(row);
  return researchSourceSchema.parse({
    id: asString(row.id),
    sourceType: asString(row.source_type),
    name: asString(row.name),
    canonicalUrl: asStringOrNull(row.canonical_url),
    provider: asStringOrNull(row.provider),
    authorityLevel: asStringOrNull(row.authority_level),
    defaultCredibility: asNumberOrNull(row.default_credibility),
    locale: asStringOrNull(row.locale),
    country: asStringOrNull(row.country),
    language: asStringOrNull(row.language),
    isOfficial: asBool(row.is_official),
    isEnabled: asBool(row.is_enabled, true),
    metadata: asJsonObject(row.metadata),
    createdAt: normalizeIsoDatetime(row.created_at),
    updatedAt: normalizeIsoDatetime(row.updated_at),
  });
}

export function toResearchSourceRow(source: ResearchSource): Record<string, unknown> {
  return {
    id: source.id,
    source_type: source.sourceType,
    name: source.name,
    canonical_url: source.canonicalUrl ?? null,
    provider: source.provider ?? null,
    authority_level: source.authorityLevel ?? null,
    default_credibility: source.defaultCredibility ?? null,
    locale: source.locale ?? null,
    country: source.country ?? null,
    language: source.language ?? null,
    is_official: source.isOfficial,
    is_enabled: source.isEnabled,
    metadata: source.metadata ?? null,
    created_at: source.createdAt,
    updated_at: source.updatedAt,
  };
}

export function mapResearchEvidenceRow(row: Record<string, unknown>): ResearchEvidence {
  assertNoSecrets(row);
  return researchEvidenceSchema.parse({
    id: asString(row.id),
    sourceId: asString(row.source_id),
    url: asStringOrNull(row.url),
    title: asStringOrNull(row.title),
    excerpt: asStringOrNull(row.excerpt),
    reference: asStringOrNull(row.reference),
    publishedAt: row.published_at ? normalizeIsoDatetime(row.published_at) : null,
    observedAt: normalizeIsoDatetime(row.observed_at),
    evidenceType: asString(row.evidence_type),
  });
}

function normalizeFreshnessJson(value: unknown): unknown {
  if (typeof value !== "object" || value == null || Array.isArray(value)) return value;
  const row = value as Record<string, unknown>;
  return {
    ...row,
    publishedAt: row.publishedAt ? normalizeIsoDatetime(row.publishedAt) : row.publishedAt ?? null,
    observedAt: row.observedAt ? normalizeIsoDatetime(row.observedAt) : row.observedAt,
    expiresAt: row.expiresAt ? normalizeIsoDatetime(row.expiresAt) : row.expiresAt ?? null,
  };
}

export function mapResearchSignalRow(
  row: Record<string, unknown>,
  evidenceRows: ResearchEvidence[],
): ResearchSignal {
  assertNoSecrets(row);
  const base = researchSignalSchema.parse({
    id: asString(row.id),
    sourceId: asString(row.source_id),
    sourceType: asString(row.source_type),
    signalType: asString(row.signal_type),
    title: asString(row.title),
    summary: asString(row.summary),
    claim: asStringOrNull(row.claim),
    claimSource: asStringOrNull(row.claim_source),
    evidence: evidenceRows,
    canonicalUrl: asStringOrNull(row.canonical_url),
    externalId: asStringOrNull(row.external_id),
    publishedAt: row.published_at ? normalizeIsoDatetime(row.published_at) : null,
    observedAt: normalizeIsoDatetime(row.observed_at),
    expiresAt: row.expires_at ? normalizeIsoDatetime(row.expires_at) : null,
    geography: asStringArray(row.geography),
    destinations: asStringArray(row.destinations),
    topics: asStringArray(row.topics),
    entities: asStringArray(row.entities),
    language: asString(row.language, "en"),
    rawFingerprint: asString(row.raw_fingerprint),
    normalizedFingerprint: asStringOrNull(row.normalized_fingerprint),
    status: asString(row.status),
    createdAt: normalizeIsoDatetime(row.created_at),
    updatedAt: normalizeIsoDatetime(row.updated_at),
  });

  return {
    ...base,
    freshness: row.freshness
      ? parseJsonField(normalizeFreshnessJson(row.freshness), freshnessMetadataSchema, "freshness")
      : null,
    credibility: row.credibility
      ? parseJsonField(row.credibility, credibilityAssessmentSchema, "credibility")
      : null,
    travelRelevance: row.travel_relevance
      ? parseJsonField(row.travel_relevance, travelRelevanceAssessmentSchema, "travel_relevance")
      : null,
    publicInterestScore: asNumberOrNull(row.public_interest_score),
    commercialRelevance: row.commercial_relevance
      ? parseJsonField(row.commercial_relevance, commercialRelevanceSchema, "commercial_relevance")
      : null,
    duplicateOfSignalId: asStringOrNull(row.duplicate_of_signal_id),
    corroborationCount: asNumberOrNull(row.corroboration_count) ?? 0,
    seasonality: asStringOrNull(row.seasonality),
    metadata: asJsonObject(row.metadata),
  };
}

export function toResearchSignalRow(signal: ResearchSignal): Record<string, unknown> {
  return {
    id: signal.id,
    source_id: signal.sourceId,
    source_type: signal.sourceType,
    signal_type: signal.signalType,
    title: signal.title,
    summary: signal.summary,
    claim: signal.claim ?? null,
    claim_source: signal.claimSource ?? null,
    canonical_url: signal.canonicalUrl ?? null,
    external_id: signal.externalId ?? null,
    published_at: signal.publishedAt ?? null,
    observed_at: signal.observedAt,
    expires_at: signal.expiresAt ?? null,
    geography: signal.geography,
    destinations: signal.destinations,
    topics: signal.topics,
    entities: signal.entities,
    language: signal.language,
    raw_fingerprint: signal.rawFingerprint,
    normalized_fingerprint: signal.normalizedFingerprint ?? null,
    duplicate_of_signal_id: signal.duplicateOfSignalId ?? null,
    corroboration_count: signal.corroborationCount ?? 0,
    freshness: signal.freshness ?? null,
    credibility: signal.credibility ?? null,
    travel_relevance: signal.travelRelevance ?? null,
    public_interest_score: signal.publicInterestScore ?? null,
    commercial_relevance: signal.commercialRelevance ?? null,
    seasonality: signal.seasonality ?? null,
    status: signal.status,
    metadata: signal.metadata ?? null,
    created_at: signal.createdAt,
    updated_at: signal.updatedAt,
  };
}

export function toResearchEvidenceRow(
  evidence: ResearchEvidence,
  signalId: string,
): Record<string, unknown> {
  return {
    id: evidence.id,
    signal_id: signalId,
    source_id: evidence.sourceId,
    url: evidence.url ?? null,
    title: evidence.title ?? null,
    excerpt: evidence.excerpt ?? null,
    reference: evidence.reference ?? null,
    published_at: evidence.publishedAt ?? null,
    observed_at: evidence.observedAt,
    evidence_type: evidence.evidenceType,
  };
}

export function mapResearchBriefRow(
  row: Record<string, unknown>,
  signalIds: string[],
  evidence: ResearchEvidence[],
): ResearchBrief {
  assertNoSecrets(row);
  const claimsRaw = row.claims;
  const claims = Array.isArray(claimsRaw)
    ? claimsRaw.filter((item): item is string => typeof item === "string")
    : [];
  const risks = Array.isArray(row.risks)
    ? row.risks.filter((item): item is string => typeof item === "string")
    : [];
  const openQuestions = Array.isArray(row.open_questions)
    ? row.open_questions.filter((item): item is string => typeof item === "string")
    : [];

  return researchBriefSchema.parse({
    id: asString(row.id),
    title: asString(row.title),
    summary: asString(row.summary),
    signalIds,
    primarySignalId: asStringOrNull(row.primary_signal_id),
    clusterId: asStringOrNull(row.cluster_id),
    claims,
    evidence,
    topics: asStringArray(row.topics),
    destinations: asStringArray(row.destinations),
    entities: asStringArray(row.entities),
    freshness: parseJsonField(
      normalizeFreshnessJson(row.freshness),
      freshnessMetadataSchema,
      "brief.freshness",
    ),
    credibility: parseJsonField(row.credibility, credibilityAssessmentSchema, "brief.credibility"),
    travelRelevance: parseJsonField(
      row.travel_relevance,
      travelRelevanceAssessmentSchema,
      "brief.travel_relevance",
    ),
    publicInterest: asNumberOrNull(row.public_interest) ?? 0,
    commercialRelevance: row.commercial_relevance
      ? parseJsonField(row.commercial_relevance, commercialRelevanceSchema, "brief.commercial_relevance")
      : null,
    corroboration: row.corroboration
      ? parseJsonField(row.corroboration, corroborationAssessmentSchema, "brief.corroboration")
      : null,
    risks,
    openQuestions,
    generatedAt: normalizeIsoDatetime(row.generated_at),
    validUntil: row.valid_until ? normalizeIsoDatetime(row.valid_until) : null,
    status: asString(row.status),
  }) as ResearchBrief;
}

export function toResearchBriefRow(brief: ResearchBrief): Record<string, unknown> {
  return {
    id: brief.id,
    title: brief.title,
    summary: brief.summary,
    primary_signal_id: brief.primarySignalId ?? null,
    cluster_id: brief.clusterId ?? null,
    claims: brief.claims,
    topics: brief.topics,
    destinations: brief.destinations,
    entities: brief.entities,
    freshness: brief.freshness,
    credibility: brief.credibility,
    travel_relevance: brief.travelRelevance,
    public_interest: brief.publicInterest,
    commercial_relevance: brief.commercialRelevance ?? null,
    corroboration: brief.corroboration ?? null,
    risks: brief.risks,
    open_questions: brief.openQuestions,
    generated_at: brief.generatedAt,
    valid_until: brief.validUntil ?? null,
    status: brief.status,
    updated_at: new Date().toISOString(),
  };
}

export function mapAgendaCandidateRow(row: Record<string, unknown>): AgendaCandidate {
  assertNoSecrets(row);
  const supportingEvidenceIds = Array.isArray(row.supporting_evidence_ids)
    ? row.supporting_evidence_ids.filter((item): item is string => typeof item === "string")
    : [];
  const riskFlags = Array.isArray(row.risk_flags)
    ? row.risk_flags.filter((item): item is string => typeof item === "string")
    : [];

  return agendaCandidateSchema.parse({
    id: asString(row.id),
    researchBriefId: asString(row.research_brief_id),
    title: asString(row.title),
    rationale: asString(row.rationale),
    freshnessScore: asNumberOrNull(row.freshness_score) ?? 0,
    publicInterestScore: asNumberOrNull(row.public_interest_score) ?? 0,
    travelRelevanceScore: asNumberOrNull(row.travel_relevance_score) ?? 0,
    credibilityScore: asNumberOrNull(row.credibility_score) ?? 0,
    commercialLinkageScore: asNumberOrNull(row.commercial_linkage_score),
    historicalDuplicationScore: asNumberOrNull(row.historical_duplication_score),
    seasonalityScore: asNumberOrNull(row.seasonality_score),
    corroborationScore: asNumberOrNull(row.corroboration_score),
    compositeResearchScore: asNumberOrNull(row.composite_research_score) ?? 0,
    researchScoreComponents: row.research_score_components
      ? parseJsonField(
          row.research_score_components,
          researchScoreComponentsSchema,
          "candidate.research_score_components",
        )
      : null,
    scoreReasons: Array.isArray(row.score_reasons)
      ? row.score_reasons.filter((item): item is string => typeof item === "string")
      : undefined,
    riskFlags,
    supportingEvidenceIds,
    status: asString(row.status),
    createdAt: normalizeIsoDatetime(row.created_at),
    updatedAt: normalizeIsoDatetime(row.updated_at),
  });
}

export function toAgendaCandidateRow(candidate: AgendaCandidate): Record<string, unknown> {
  return {
    id: candidate.id,
    research_brief_id: candidate.researchBriefId,
    title: candidate.title,
    rationale: candidate.rationale,
    freshness_score: candidate.freshnessScore,
    public_interest_score: candidate.publicInterestScore,
    travel_relevance_score: candidate.travelRelevanceScore,
    credibility_score: candidate.credibilityScore,
    commercial_linkage_score: candidate.commercialLinkageScore ?? null,
    historical_duplication_score: candidate.historicalDuplicationScore ?? null,
    seasonality_score: candidate.seasonalityScore ?? null,
    corroboration_score: candidate.corroborationScore ?? null,
    composite_research_score: candidate.compositeResearchScore,
    research_score_components: candidate.researchScoreComponents ?? null,
    score_reasons: candidate.scoreReasons ?? [],
    risk_flags: candidate.riskFlags,
    supporting_evidence_ids: candidate.supportingEvidenceIds,
    status: candidate.status,
    created_at: candidate.createdAt,
    updated_at: candidate.updatedAt,
  };
}
