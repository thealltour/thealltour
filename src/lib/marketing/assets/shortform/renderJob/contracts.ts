/**
 * SV-6 — Durable Shortform VideoRenderJob contracts.
 * Job = orchestration state, not the rendered file / Remotion / Mini-PC worker.
 */

export const SHORTFORM_VIDEO_RENDER_JOB_CONTRACT = "shortform-video-render-job-v1" as const;

export const SHORTFORM_VIDEO_RENDER_PROFILE_V1 = "shortform_vertical_v1" as const;

export const SHORTFORM_VIDEO_RENDER_JOB_STATUSES = [
  "QUEUED",
  "RUNNING",
  "READY",
  "FAILED",
  "CANCELLED",
] as const;
export type ShortformVideoRenderJobStatus = (typeof SHORTFORM_VIDEO_RENDER_JOB_STATUSES)[number];

export const DEFAULT_SHORTFORM_VIDEO_RENDER_MAX_ATTEMPTS = 3;
export const DEFAULT_SHORTFORM_VIDEO_RENDER_LEASE_MS = 30 * 60 * 1000;
export const MAX_SHORTFORM_VIDEO_RENDER_ERROR_SUMMARY_LENGTH = 400;
export const MAX_SHORTFORM_VIDEO_RENDER_ERROR_CODE_LENGTH = 64;

export type ShortformVideoRenderScenePickSnapshot = {
  sceneId: string;
  sourceId: string;
  origin: string | null;
  rightsKind: string;
  factualMatch: string | null;
  mediaType: string | null;
};

export type ShortformVideoRenderInputSnapshot = {
  briefContract: string;
  briefSha256: string;
  briefRelativePath: string;
  resolutionContract: string | null;
  resolutionSha256: string | null;
  resolutionRelativePath: string | null;
  selectionHash: string;
  scenePicks: ShortformVideoRenderScenePickSnapshot[];
  renderProfile: typeof SHORTFORM_VIDEO_RENDER_PROFILE_V1;
};

export type ShortformVideoRenderJob = {
  contract: typeof SHORTFORM_VIDEO_RENDER_JOB_CONTRACT;
  id: string;
  jobId: string;
  logicalRunKey: string;
  candidateId: string;
  productionRequestId: string | null;
  businessDateKst: string;
  status: ShortformVideoRenderJobStatus;
  shortVideoBriefArtifactPath: string;
  sourceResolutionArtifactPath: string | null;
  renderProfile: typeof SHORTFORM_VIDEO_RENDER_PROFILE_V1;
  inputSnapshot: ShortformVideoRenderInputSnapshot;
  attemptCount: number;
  maxAttempts: number;
  claimedBy: string | null;
  claimedAt: string | null;
  leaseExpiresAt: string | null;
  claimToken: string | null;
  nextAttemptAt: string | null;
  outputArtifactPath: string | null;
  errorCode: string | null;
  errorSummary: string | null;
  createdAt: string;
  updatedAt: string;
  completedAt: string | null;
};

export type EnqueueShortformVideoRenderJobResult = {
  job: ShortformVideoRenderJob;
  created: boolean;
};

export type FinalizeShortformVideoRenderJobResult =
  | { ok: true; job: ShortformVideoRenderJob }
  | {
      ok: false;
      reason: "not_found" | "ownership_lost" | "not_running" | "terminal" | "invalid_transition";
      job: ShortformVideoRenderJob | null;
    };
