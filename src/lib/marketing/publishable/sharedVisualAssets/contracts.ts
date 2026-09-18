/**
 * Shared Visual Assets Manifest v1 — visualId → uploaded file mapping.
 * Operator-controlled; no vision/quality gate.
 */

export const SHARED_VISUAL_ASSETS_CONTRACT = "shared-visual-assets-v1" as const;

export type SharedVisualAssetStatus = "uploaded";

export type SharedVisualAsset = {
  visualId: string;
  expectedFilename: string;
  storedFilename: string;
  /** Package-relative posix path (e.g. media/shared-visuals/social_visual_01.png). */
  storedPath: string;
  mimeType: string;
  byteSize: number;
  width?: number;
  height?: number;
  uploadedAt: string;
  status: SharedVisualAssetStatus;
};

export type SharedVisualAssetsManifest = {
  contract: typeof SHARED_VISUAL_ASSETS_CONTRACT;
  sourceAssetId: string;
  sourceAssetVersion: number;
  sourceSharedVisualPlanFingerprint: string;
  /** Fingerprint of ManualAstraHandoff generation-relevant fields. */
  sourceManualAstraHandoffFingerprint: string;
  updatedAt: string;
  assets: SharedVisualAsset[];
};

export type SharedVisualUploadStatus = {
  required: number;
  uploaded: number;
  complete: boolean;
  missingVisualIds: string[];
  stale: boolean;
};
