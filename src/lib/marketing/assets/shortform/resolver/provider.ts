import type { MarketingMediaRightsKind } from "@/lib/marketing/assets/sourceCatalog/types";
import type { ShortVideoSceneRequirement } from "@/lib/marketing/assets/shortVideoBrief/contracts";
import type {
  ShortformFactualMatch,
  ShortformProviderAttemptStatus,
  ShortformSourceCandidate,
  ShortformSourceCandidateMediaType,
  ShortformSourceCandidateOrigin,
  ShortformSourceScoreBreakdown,
} from "@/lib/marketing/assets/shortform/resolver/contracts";

/** Pre-score normalized hit from a provider (transient; never auto-persisted). */
export type ShortformNormalizedHit = {
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
  tags: string[];
  titleOrSubject: string | null;
  storageClassHint: string | null;
  factualMatchHint: ShortformFactualMatch | null;
};

export type ShortformProviderSearchInput = {
  scene: ShortVideoSceneRequirement;
  queries: string[];
  limit: number;
};

export type ShortformProviderSearchResult = {
  providerId: string;
  status: ShortformProviderAttemptStatus;
  hits: ShortformNormalizedHit[];
  message: string | null;
};

export type ShortformSourceProvider = {
  readonly providerId: string;
  search(input: ShortformProviderSearchInput): Promise<ShortformProviderSearchResult>;
};

export type ScoredShortformSourceCandidate = ShortformSourceCandidate & {
  scoreBreakdown: ShortformSourceScoreBreakdown;
};
