/**
 * SV-4 — Shortform Source Resolver contracts (resolve ≠ pick ≠ ingest).
 */

import type { MarketingMediaRightsKind } from "@/lib/marketing/assets/sourceCatalog/types";

export const SHORTFORM_SOURCE_RESOLUTION_CONTRACT = "shortform-source-resolution-v1" as const;

export const SHORTFORM_SOURCE_CANDIDATE_ORIGINS = [
  "internal_catalog",
  "pexels",
  "pixabay",
  "photo_motion",
  "generated_video_plan",
] as const;
export type ShortformSourceCandidateOrigin = (typeof SHORTFORM_SOURCE_CANDIDATE_ORIGINS)[number];

export const SHORTFORM_SOURCE_CANDIDATE_MEDIA_TYPES = [
  "video",
  "image",
  "generated_video_plan",
] as const;
export type ShortformSourceCandidateMediaType =
  (typeof SHORTFORM_SOURCE_CANDIDATE_MEDIA_TYPES)[number];

export const SHORTFORM_FACTUAL_MATCH_LEVELS = [
  "confirmed",
  "probable",
  "generic",
  "unknown",
] as const;
export type ShortformFactualMatch = (typeof SHORTFORM_FACTUAL_MATCH_LEVELS)[number];

export const SHORTFORM_SCENE_RESOLUTION_STATUSES = [
  "resolved",
  "review_required",
  "unresolved",
  "generation_fallback_available",
] as const;
export type ShortformSceneResolutionStatus = (typeof SHORTFORM_SCENE_RESOLUTION_STATUSES)[number];

export const SHORTFORM_PROVIDER_ATTEMPT_STATUSES = [
  "success",
  "empty",
  "unavailable",
  "error",
  "disabled",
  "skipped",
] as const;
export type ShortformProviderAttemptStatus = (typeof SHORTFORM_PROVIDER_ATTEMPT_STATUSES)[number];

export type ShortformSourceScoreBreakdown = {
  relevance: number;
  mediaFit: number;
  orientationFit: number;
  durationFit: number;
  provenance: number;
  reuseBonus: number;
};

export type ShortformSourceCandidate = {
  candidateKey: string;
  origin: ShortformSourceCandidateOrigin;
  catalogSourceId: string | null;
  provider: string | null;
  providerAssetId: string | null;
  mediaType: ShortformSourceCandidateMediaType;
  sourcePageUrl: string | null;
  remoteAssetUrl: string | null;
  remoteAssetUrlExpiresAt: string | null;
  previewUrl: string | null;
  width: number | null;
  height: number | null;
  durationMs: number | null;
  orientation: "landscape" | "portrait" | "square" | "unknown" | null;
  creatorName: string | null;
  rightsKind: MarketingMediaRightsKind;
  licenseName: string | null;
  licenseUrl: string | null;
  attributionText: string | null;
  sha256: string | null;
  score: number;
  scoreBreakdown: ShortformSourceScoreBreakdown;
  factualMatch: ShortformFactualMatch;
  autoPickEligible: boolean;
  reviewRequired: boolean;
  rejectionReasons: string[];
  generationIntent?: {
    subject: string;
    durationMs: number;
    provider: "fal";
  };
};

export type ShortformProviderAttempt = {
  providerId: string;
  status: ShortformProviderAttemptStatus;
  candidateCount: number;
  message: string | null;
};

export type ShortformSceneSourceResolution = {
  sceneId: string;
  status: ShortformSceneResolutionStatus;
  recommendedCandidate: ShortformSourceCandidate | null;
  candidates: ShortformSourceCandidate[];
  attemptedSources: ShortformProviderAttempt[];
  reason: string;
};

export type ShortformSourceResolutionPlan = {
  contract: typeof SHORTFORM_SOURCE_RESOLUTION_CONTRACT;
  candidateId: string;
  businessDateKst: string;
  scenes: ShortformSceneSourceResolution[];
  createdAt: string;
};
