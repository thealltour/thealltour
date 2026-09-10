/**
 * SV-2 — Global Marketing Source Catalog domain types.
 * Reuses SV-1 storage/disposition/source-kind symbols. Not a binary archive.
 */

import type {
  MarketingMediaSourceKind,
  ShortformAssetDisposition,
  ShortformStorageClass,
} from "@/lib/marketing/assets/shortform/storagePolicy";

export const MARKETING_MEDIA_SOURCE_CATALOG_CONTRACT =
  "marketing-media-source-catalog-v1" as const;

export const MARKETING_MEDIA_SOURCE_STATUSES = ["active", "unavailable", "archived"] as const;
export type MarketingMediaSourceStatus = (typeof MARKETING_MEDIA_SOURCE_STATUSES)[number];

export const MARKETING_MEDIA_RIGHTS_KINDS = [
  "owned",
  "partner_authorized",
  "provider_license",
  "generated",
  "unknown",
] as const;
export type MarketingMediaRightsKind = (typeof MARKETING_MEDIA_RIGHTS_KINDS)[number];

export const MARKETING_MEDIA_TYPES = ["video", "image", "audio", "other", "unknown"] as const;
export type MarketingMediaType = (typeof MARKETING_MEDIA_TYPES)[number];

export const MARKETING_MEDIA_ORIENTATIONS = [
  "landscape",
  "portrait",
  "square",
  "unknown",
] as const;
export type MarketingMediaOrientation = (typeof MARKETING_MEDIA_ORIENTATIONS)[number];

export const MARKETING_MEDIA_SOURCE_USAGE_RELATIONS = ["picked"] as const;
export type MarketingMediaSourceUsageRelation =
  (typeof MARKETING_MEDIA_SOURCE_USAGE_RELATIONS)[number];

export type MarketingMediaSourceRecord = {
  id: string;
  contractVersion: typeof MARKETING_MEDIA_SOURCE_CATALOG_CONTRACT;
  sourceKind: MarketingMediaSourceKind;
  storageClass: ShortformStorageClass;
  disposition: ShortformAssetDisposition;
  provider: string | null;
  providerAssetId: string | null;
  sourcePageUrl: string | null;
  remoteAssetUrl: string | null;
  remoteAssetUrlExpiresAt: string | null;
  managedRelativePath: string | null;
  mediaType: MarketingMediaType;
  mimeType: string | null;
  width: number | null;
  height: number | null;
  durationMs: number | null;
  orientation: MarketingMediaOrientation | null;
  sha256: string | null;
  creatorName: string | null;
  rightsKind: MarketingMediaRightsKind;
  licenseName: string | null;
  licenseUrl: string | null;
  attributionText: string | null;
  rightsNote: string | null;
  metadata: Record<string, unknown>;
  isPinned: boolean;
  status: MarketingMediaSourceStatus;
  createdAt: string;
  updatedAt: string;
};

export type RegisterMarketingMediaSourceInput = {
  sourceKind: MarketingMediaSourceKind;
  storageClass?: ShortformStorageClass;
  disposition?: ShortformAssetDisposition;
  provider?: string | null;
  providerAssetId?: string | null;
  sourcePageUrl?: string | null;
  remoteAssetUrl?: string | null;
  remoteAssetUrlExpiresAt?: string | null;
  managedRelativePath?: string | null;
  mediaType?: MarketingMediaType;
  mimeType?: string | null;
  width?: number | null;
  height?: number | null;
  durationMs?: number | null;
  orientation?: MarketingMediaOrientation | null;
  sha256?: string | null;
  creatorName?: string | null;
  rightsKind?: MarketingMediaRightsKind;
  licenseName?: string | null;
  licenseUrl?: string | null;
  attributionText?: string | null;
  rightsNote?: string | null;
  metadata?: Record<string, unknown>;
  isPinned?: boolean;
  status?: MarketingMediaSourceStatus;
};

/** External stock / provider identity registration (idempotent on provider+providerAssetId). */
export type RegisterExternalMarketingMediaSourceInput = RegisterMarketingMediaSourceInput & {
  provider: string;
  providerAssetId: string;
};

export type UpdateMarketingMediaSourceInput = {
  id: string;
  sourcePageUrl?: string | null;
  remoteAssetUrl?: string | null;
  remoteAssetUrlExpiresAt?: string | null;
  managedRelativePath?: string | null;
  mediaType?: MarketingMediaType;
  mimeType?: string | null;
  width?: number | null;
  height?: number | null;
  durationMs?: number | null;
  orientation?: MarketingMediaOrientation | null;
  sha256?: string | null;
  creatorName?: string | null;
  rightsKind?: MarketingMediaRightsKind;
  licenseName?: string | null;
  licenseUrl?: string | null;
  attributionText?: string | null;
  rightsNote?: string | null;
  metadata?: Record<string, unknown>;
  isPinned?: boolean;
  disposition?: ShortformAssetDisposition;
  storageClass?: ShortformStorageClass;
  status?: MarketingMediaSourceStatus;
};

export type ListMarketingMediaSourcesFilter = {
  sourceKind?: MarketingMediaSourceKind;
  storageClass?: ShortformStorageClass;
  status?: MarketingMediaSourceStatus;
  provider?: string;
  isPinned?: boolean;
  limit?: number;
};

export type MarketingMediaSourceUsageRecord = {
  id: string;
  sourceId: string;
  candidateId: string;
  productionRequestId: string | null;
  sceneKey: string | null;
  relation: MarketingMediaSourceUsageRelation;
  createdAt: string;
};

export type RecordMarketingMediaSourcePickInput = {
  sourceId: string;
  candidateId: string;
  productionRequestId?: string | null;
  sceneKey?: string | null;
};
