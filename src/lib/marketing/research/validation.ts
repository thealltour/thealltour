import { z } from "zod";

import {
  AGENDA_CANDIDATE_STATUSES,
  AUTHORITY_LEVELS,
  CLAIM_SOURCES,
  COMMERCIAL_RELEVANCE_LEVELS,
  CREDIBILITY_LEVELS,
  RESEARCH_BRIEF_STATUSES,
  RESEARCH_EVIDENCE_TYPES,
  RESEARCH_SIGNAL_STATUSES,
  RESEARCH_SIGNAL_TYPES,
  RESEARCH_SOURCE_TYPES,
} from "@/lib/marketing/research/types/enums";

const scoreSchema = z.number().min(0).max(1);

export const freshnessMetadataSchema = z.object({
  publishedAt: z.string().datetime().nullable().optional(),
  observedAt: z.string().datetime(),
  expiresAt: z.string().datetime().nullable().optional(),
  halfLifeHours: z.number().nullable().optional(),
  freshnessScore: scoreSchema.nullable().optional(),
});

export const travelRelevanceAssessmentSchema = z.object({
  score: scoreSchema,
  reasons: z.array(z.string()),
  destinationRelevance: scoreSchema.nullable().optional(),
  travelerImpact: scoreSchema.nullable().optional(),
  bookingImpact: scoreSchema.nullable().optional(),
  marketRelevance: scoreSchema.nullable().optional(),
});

export const researchEvidenceSchema = z.object({
  id: z.string().min(1),
  sourceId: z.string().uuid(),
  url: z.string().url().nullable().optional(),
  title: z.string().nullable().optional(),
  excerpt: z.string().nullable().optional(),
  reference: z.string().nullable().optional(),
  publishedAt: z.string().datetime().nullable().optional(),
  observedAt: z.string().datetime(),
  evidenceType: z.enum(RESEARCH_EVIDENCE_TYPES),
});

export const researchSourceSchema = z.object({
  id: z.string().uuid(),
  sourceType: z.enum(RESEARCH_SOURCE_TYPES),
  name: z.string().min(1),
  canonicalUrl: z.string().url().nullable().optional(),
  provider: z.string().nullable().optional(),
  authorityLevel: z.enum(AUTHORITY_LEVELS).nullable().optional(),
  defaultCredibility: scoreSchema.nullable().optional(),
  locale: z.string().nullable().optional(),
  country: z.string().nullable().optional(),
  language: z.string().nullable().optional(),
  isOfficial: z.boolean(),
  isEnabled: z.boolean(),
  metadata: z.record(z.string(), z.unknown()).nullable().optional(),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
});

export const researchSignalSchema = z.object({
  id: z.string().uuid(),
  sourceId: z.string().uuid(),
  sourceType: z.enum(RESEARCH_SOURCE_TYPES),
  signalType: z.enum(RESEARCH_SIGNAL_TYPES),
  title: z.string().min(1),
  summary: z.string().min(1),
  claim: z.string().nullable().optional(),
  claimSource: z.enum(CLAIM_SOURCES).nullable().optional(),
  evidence: z.array(researchEvidenceSchema).min(1),
  canonicalUrl: z.string().url().nullable().optional(),
  externalId: z.string().nullable().optional(),
  publishedAt: z.string().datetime().nullable().optional(),
  observedAt: z.string().datetime(),
  expiresAt: z.string().datetime().nullable().optional(),
  geography: z.array(z.string()),
  destinations: z.array(z.string()),
  topics: z.array(z.string()),
  entities: z.array(z.string()),
  language: z.string().min(2),
  rawFingerprint: z.string().min(16),
  normalizedFingerprint: z.string().min(16).nullable().optional(),
  status: z.enum(RESEARCH_SIGNAL_STATUSES),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
});

export const commercialRelevanceSchema = z.object({
  level: z.enum(COMMERCIAL_RELEVANCE_LEVELS),
  matchedProductIds: z.array(z.string()),
  confidence: scoreSchema.nullable().optional(),
});

export const credibilityAssessmentSchema = z.object({
  score: scoreSchema,
  level: z.enum(CREDIBILITY_LEVELS),
  reasons: z.array(z.string()),
});

/** ResearchBrief must not carry content-draft fields. */
export const researchBriefSchema = z
  .object({
    id: z.string().uuid(),
    title: z.string().min(1),
    summary: z.string().min(1),
    signalIds: z.array(z.string().uuid()).min(1),
    primarySignalId: z.string().uuid().nullable().optional(),
    claims: z.array(z.string()).min(1),
    evidence: z.array(researchEvidenceSchema).min(1),
    topics: z.array(z.string()),
    destinations: z.array(z.string()),
    entities: z.array(z.string()),
    freshness: freshnessMetadataSchema,
    credibility: credibilityAssessmentSchema,
    travelRelevance: travelRelevanceAssessmentSchema,
    publicInterest: scoreSchema,
    commercialRelevance: commercialRelevanceSchema.nullable().optional(),
    risks: z.array(z.string()),
    openQuestions: z.array(z.string()),
    generatedAt: z.string().datetime(),
    validUntil: z.string().datetime().nullable().optional(),
    status: z.enum(RESEARCH_BRIEF_STATUSES),
  })
  .strict();

/** AgendaCandidate must not imply MM final selection. */
export const agendaCandidateSchema = z
  .object({
    id: z.string().uuid(),
    researchBriefId: z.string().uuid(),
    title: z.string().min(1),
    rationale: z.string().min(1),
    freshnessScore: scoreSchema,
    publicInterestScore: scoreSchema,
    travelRelevanceScore: scoreSchema,
    credibilityScore: scoreSchema,
    commercialLinkageScore: scoreSchema.nullable().optional(),
    historicalDuplicationScore: scoreSchema.nullable().optional(),
    seasonalityScore: scoreSchema.nullable().optional(),
    compositeResearchScore: scoreSchema,
    riskFlags: z.array(z.string()),
    supportingEvidenceIds: z.array(z.string()),
    status: z.enum(AGENDA_CANDIDATE_STATUSES),
    createdAt: z.string().datetime(),
    updatedAt: z.string().datetime(),
  })
  .strict()
  .refine(
    (value) =>
      !("selectedForToday" in value) &&
      !("finalPriority" in value) &&
      !("publishDecision" in value),
    { message: "AgendaCandidate must not include Marketing Manager decision fields" },
  );
