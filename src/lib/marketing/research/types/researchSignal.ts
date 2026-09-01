import type {
  ResearchEvidenceType,
  ResearchSourceType,
} from "@/lib/marketing/research/types/enums";

/** Traceable evidence attached to a signal claim. */
export type ResearchEvidence = {
  id: string;
  sourceId: string;
  url?: string | null;
  title?: string | null;
  excerpt?: string | null;
  reference?: string | null;
  publishedAt?: string | null;
  observedAt: string;
  evidenceType: ResearchEvidenceType;
};

export type CreateResearchEvidenceInput = Omit<ResearchEvidence, "id"> & {
  id?: string;
};

/** Freshness metadata — not simple publishedAt sort. */
export type FreshnessMetadata = {
  publishedAt?: string | null;
  observedAt: string;
  expiresAt?: string | null;
  halfLifeHours?: number | null;
  freshnessScore?: number | null;
};

export type CredibilityAssessment = {
  score: number;
  level: "high" | "medium" | "low" | "unknown";
  reasons: string[];
};

export type TravelRelevanceAssessment = {
  score: number;
  reasons: string[];
  destinationRelevance?: number | null;
  travelerImpact?: number | null;
  bookingImpact?: number | null;
  marketRelevance?: number | null;
};

export type CommercialRelevance = {
  level: "none" | "low" | "medium" | "high" | "unknown";
  matchedProductIds: string[];
  confidence?: number | null;
  reasons?: string[];
};

export type ResearchSignal = {
  id: string;
  sourceId: string;
  sourceType: ResearchSourceType;

  signalType: import("@/lib/marketing/research/types/enums").ResearchSignalType;
  title: string;
  summary: string;

  claim?: string | null;
  claimSource?: import("@/lib/marketing/research/types/enums").ClaimSource | null;
  evidence: ResearchEvidence[];

  canonicalUrl?: string | null;
  externalId?: string | null;

  publishedAt?: string | null;
  observedAt: string;
  expiresAt?: string | null;

  geography: string[];
  destinations: string[];
  topics: string[];
  entities: string[];

  freshness?: FreshnessMetadata | null;
  credibility?: CredibilityAssessment | null;
  travelRelevance?: TravelRelevanceAssessment | null;
  publicInterestScore?: number | null;

  commercialRelevance?: CommercialRelevance | null;
  seasonality?: string | null;

  language: string;
  rawFingerprint: string;
  normalizedFingerprint?: string | null;

  duplicateOfSignalId?: string | null;
  corroborationCount?: number;

  status: import("@/lib/marketing/research/types/enums").ResearchSignalStatus;

  metadata?: Record<string, unknown> | null;
  createdAt: string;
  updatedAt: string;
};

export type RawResearchSignalInput = Omit<
  ResearchSignal,
  | "id"
  | "rawFingerprint"
  | "normalizedFingerprint"
  | "freshness"
  | "credibility"
  | "travelRelevance"
  | "publicInterestScore"
  | "commercialRelevance"
  | "duplicateOfSignalId"
  | "corroborationCount"
  | "status"
  | "createdAt"
  | "updatedAt"
> & {
  id?: string;
  status?: ResearchSignal["status"];
};
