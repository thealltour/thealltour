/**
 * Marketing asset transport (SV-8B2).
 * Local FS vs Pi authenticated HTTP — executor stays transport-agnostic.
 */

import { MEDIA_BRIEF_RELATIVE_PATH } from "@/lib/marketing/assets/video/paths";
import { SHORT_VIDEO_BRIEF_RELATIVE_PATH } from "@/lib/marketing/assets/shortVideoBrief/paths";
import { SHORTFORM_SOURCE_RESOLUTION_RELATIVE_PATH } from "@/lib/marketing/assets/shortform/resolver/paths";
import { MarketingAssetTransportError } from "@/lib/marketing/assets/transport/errors";

export const MARKETING_ASSET_TRANSPORT_MODE_ENV = "MARKETING_ASSET_TRANSPORT_MODE" as const;
export const MARKETING_ASSET_TRANSFER_TOKEN_ENV = "MARKETING_ASSET_TRANSFER_TOKEN" as const;
export const MARKETING_ASSET_TRANSFER_BASE_URL_ENV = "MARKETING_ASSET_TRANSFER_BASE_URL" as const;
export const MARKETING_ASSET_TRANSFER_BIND_HOST_ENV = "MARKETING_ASSET_TRANSFER_BIND_HOST" as const;
export const MARKETING_ASSET_TRANSFER_PORT_ENV = "MARKETING_ASSET_TRANSFER_PORT" as const;

export const MARKETING_ASSET_TRANSPORT_MODES = ["local", "http"] as const;
export type MarketingAssetTransportMode = (typeof MARKETING_ASSET_TRANSPORT_MODES)[number];

/** Fixed Candidate Package final path — never client-chosen. */
export const SHORTFORM_FINAL_TRANSFER_RELATIVE_PATH = "reel/final/shortform.mp4" as const;

/** Bounded allowlist — never client-supplied relative paths. */
export const CANDIDATE_PACKAGE_ARTIFACT_KINDS = [
  "media-brief",
  "short-video-brief",
  "shortform-source-resolution",
] as const;
export type CandidatePackageArtifactKind = (typeof CANDIDATE_PACKAGE_ARTIFACT_KINDS)[number];

const ARTIFACT_KIND_TO_RELATIVE_PATH: Record<CandidatePackageArtifactKind, string> = {
  "media-brief": MEDIA_BRIEF_RELATIVE_PATH,
  "short-video-brief": SHORT_VIDEO_BRIEF_RELATIVE_PATH,
  "shortform-source-resolution": SHORTFORM_SOURCE_RESOLUTION_RELATIVE_PATH,
};

export function isCandidatePackageArtifactKind(value: string): value is CandidatePackageArtifactKind {
  return (CANDIDATE_PACKAGE_ARTIFACT_KINDS as readonly string[]).includes(value);
}

export function resolveCandidatePackageArtifactRelativePath(
  kind: string,
): string {
  if (!isCandidatePackageArtifactKind(kind)) {
    throw new MarketingAssetTransportError(
      "unknown or disallowed artifact kind",
      "ARTIFACT_KIND_NOT_ALLOWED",
      400,
    );
  }
  return ARTIFACT_KIND_TO_RELATIVE_PATH[kind];
}

export const MARKETING_ASSET_TRANSFER_LIMITS = {
  /** Managed source download / serve ceiling. */
  managedSourceMaxBytes: 120 * 1024 * 1024,
  /** Final shortform upload ceiling (aligned with provider download budget). */
  finalUploadMaxBytes: 150 * 1024 * 1024,
  /** Candidate package JSON artifact ceiling. */
  candidateArtifactMaxBytes: 5 * 1024 * 1024,
  /** Default HTTP client timeout. */
  httpTimeoutMs: 120_000,
  defaultPort: 3101,
  defaultBindHost: "127.0.0.1",
} as const;

export type MarketingAssetTransportReadiness = {
  ready: boolean;
  reason: string;
  mode: MarketingAssetTransportMode | "invalid";
  checks: Record<string, boolean>;
};

export type MaterializeManagedSourceResult = {
  absolutePath: string;
  sourceId: string;
  sha256: string | null;
  byteSize: number;
  mediaType: string | null;
};

export type PersistShortformFinalResult = {
  relativePath: typeof SHORTFORM_FINAL_TRANSFER_RELATIVE_PATH;
  sha256: string;
  byteSize: number;
  mediaType: "video/mp4";
};

export type ReadCandidatePackageArtifactResult = {
  artifactKind: CandidatePackageArtifactKind;
  relativePath: string;
  bytes: Buffer;
  sha256: string;
  byteSize: number;
  mediaType: string;
};

export type MarketingAssetTransport = {
  readonly mode: MarketingAssetTransportMode;
  probeReadiness(): MarketingAssetTransportReadiness | Promise<MarketingAssetTransportReadiness>;
  materializeManagedSource(input: {
    sourceId: string;
    destinationAbsolutePath: string;
    signal?: AbortSignal;
  }): Promise<MaterializeManagedSourceResult>;
  readCandidatePackageArtifact(input: {
    candidateId: string;
    businessDateKst: string;
    artifactKind: CandidatePackageArtifactKind;
    signal?: AbortSignal;
  }): Promise<ReadCandidatePackageArtifactResult>;
  persistShortformFinal(input: {
    candidateId: string;
    businessDateKst: string;
    workspaceFinalAbsolutePath: string;
    signal?: AbortSignal;
  }): Promise<PersistShortformFinalResult>;
};

export function parseMarketingAssetTransportMode(
  env: NodeJS.ProcessEnv | Record<string, string | undefined> = process.env,
): MarketingAssetTransportMode {
  const raw = env[MARKETING_ASSET_TRANSPORT_MODE_ENV]?.trim().toLowerCase();
  if (!raw || raw === "local") return "local";
  if (raw === "http") return "http";
  throw new Error(`invalid ${MARKETING_ASSET_TRANSPORT_MODE_ENV}: ${raw}`);
}
