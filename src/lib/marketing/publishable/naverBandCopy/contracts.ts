/**
 * Naver Band Copy Specialist — community-native compression from Narrative Plan.
 */

export const NAVER_BAND_COPY_CONTRACT = "naver-band-copy-v1" as const;
export const NAVER_BAND_COPY_WRITER_HERMES_PROFILE = "naver-band-copy-writer" as const;

export const NAVER_BAND_COPY_ENDING_INTENTS = [
  "observation",
  "soft_question",
  "community_share",
  "none",
] as const;

export type NaverBandCopyEndingIntent = (typeof NAVER_BAND_COPY_ENDING_INTENTS)[number];

export const NAVER_BAND_COPY_OPENING_INTENTS = [
  "hook",
  "reframe",
  "shared_context",
] as const;

export type NaverBandCopyOpeningIntent = (typeof NAVER_BAND_COPY_OPENING_INTENTS)[number];

export type NaverBandCopyProvenance = {
  sourceAssetId: string;
  sourceVersion: number;
  modelProfile: string;
  generatedAt: string;
  sourceNarrativeFingerprint: string;
};

export type NaverBandCopyArtifact = {
  contract: typeof NAVER_BAND_COPY_CONTRACT;
  assetId: string;
  assetVersion: number;
  title: string | null;
  body: string;
  selectedNarrativeBeats: string[];
  openingIntent: NaverBandCopyOpeningIntent;
  keyPoints: string[];
  endingIntent: NaverBandCopyEndingIntent;
  /** Soft community engagement metadata — not a forced CTA string. */
  engagementIntent: string | null;
  evidenceRefs: string[];
  sourceNarrativeFingerprint: string;
  provenance: NaverBandCopyProvenance;
};

/** Preferred length band for specialist prompts (validate hard max remains 2200). */
export const NAVER_BAND_COPY_PREFERRED_MIN_CHARS = 250;
export const NAVER_BAND_COPY_PREFERRED_MAX_CHARS = 700;
/** Specialist soft ceiling — essays fail closed before generic validate. */
export const NAVER_BAND_COPY_SPECIALIST_MAX_CHARS = 900;
