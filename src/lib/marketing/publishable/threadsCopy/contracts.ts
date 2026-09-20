/**
 * Threads Copy Specialist — channel-native compression + wording from Narrative Plan.
 */

export const THREADS_COPY_CONTRACT = "threads-copy-v1" as const;
export const THREADS_COPY_WRITER_HERMES_PROFILE = "threads-copy-writer" as const;

export const THREADS_COPY_ENDING_INTENTS = [
  "observation",
  "soft_question",
  "thought",
  "none",
] as const;

export type ThreadsCopyEndingIntent = (typeof THREADS_COPY_ENDING_INTENTS)[number];

export type ThreadsCopyProvenance = {
  sourceAssetId: string;
  sourceVersion: number;
  modelProfile: string;
  generatedAt: string;
  sourceNarrativeFingerprint: string;
};

export type ThreadsCopyArtifact = {
  contract: typeof THREADS_COPY_CONTRACT;
  assetId: string;
  assetVersion: number;
  /** User-facing Threads body (title is always null downstream). */
  body: string;
  selectedNarrativeBeats: string[];
  endingIntent: ThreadsCopyEndingIntent;
  evidenceRefs: string[];
  sourceNarrativeFingerprint: string;
  /** Optional visual planning metadata — not editorial authority. */
  mediaPlan?: unknown | null;
  provenance: ThreadsCopyProvenance;
};

/** Preferred length band for specialist prompts (hard max remains 500). */
export const THREADS_COPY_PREFERRED_MIN_CHARS = 180;
export const THREADS_COPY_PREFERRED_MAX_CHARS = 420;
