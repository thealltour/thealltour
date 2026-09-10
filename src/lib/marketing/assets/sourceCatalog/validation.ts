/**
 * SV-2 source catalog validation — fail closed; no silent coercion of invalid input.
 */

import { assertSafeRelativeArtifactPath } from "@/lib/marketing/assets/paths";
import {
  defaultDispositionForSource,
  defaultStorageClassForSource,
  MARKETING_MEDIA_SOURCE_KINDS,
  SHORTFORM_ASSET_DISPOSITIONS,
  SHORTFORM_STORAGE_CLASSES,
  type MarketingMediaSourceKind,
  type ShortformAssetDisposition,
  type ShortformStorageClass,
} from "@/lib/marketing/assets/shortform/storagePolicy";
import { MarketingSourceCatalogError } from "@/lib/marketing/assets/sourceCatalog/errors";
import {
  MARKETING_MEDIA_ORIENTATIONS,
  MARKETING_MEDIA_RIGHTS_KINDS,
  MARKETING_MEDIA_SOURCE_CATALOG_CONTRACT,
  MARKETING_MEDIA_SOURCE_STATUSES,
  MARKETING_MEDIA_TYPES,
  type MarketingMediaOrientation,
  type MarketingMediaRightsKind,
  type MarketingMediaSourceStatus,
  type MarketingMediaType,
  type RegisterExternalMarketingMediaSourceInput,
  type RegisterMarketingMediaSourceInput,
  type UpdateMarketingMediaSourceInput,
} from "@/lib/marketing/assets/sourceCatalog/types";

const SHA256_RE = /^[a-f0-9]{64}$/;
const PROVIDER_RE = /^[a-z][a-z0-9_-]{0,63}$/;
const PROVIDER_ASSET_ID_MAX = 256;
const TEXT_FIELD_MAX = 256;
const LONG_TEXT_MAX = 2000;
const MIME_MAX = 128;
const PATH_MAX = 512;
const METADATA_JSON_MAX_BYTES = 64 * 1024;
const ID_MAX = 128;

export function isMarketingMediaSourceKind(value: unknown): value is MarketingMediaSourceKind {
  return (
    typeof value === "string" &&
    (MARKETING_MEDIA_SOURCE_KINDS as readonly string[]).includes(value)
  );
}

export function isShortformStorageClass(value: unknown): value is ShortformStorageClass {
  return (
    typeof value === "string" && (SHORTFORM_STORAGE_CLASSES as readonly string[]).includes(value)
  );
}

export function isShortformAssetDisposition(value: unknown): value is ShortformAssetDisposition {
  return (
    typeof value === "string" &&
    (SHORTFORM_ASSET_DISPOSITIONS as readonly string[]).includes(value)
  );
}

export function isMarketingMediaRightsKind(value: unknown): value is MarketingMediaRightsKind {
  return (
    typeof value === "string" && (MARKETING_MEDIA_RIGHTS_KINDS as readonly string[]).includes(value)
  );
}

export function isMarketingMediaSourceStatus(value: unknown): value is MarketingMediaSourceStatus {
  return (
    typeof value === "string" &&
    (MARKETING_MEDIA_SOURCE_STATUSES as readonly string[]).includes(value)
  );
}

export function isMarketingMediaType(value: unknown): value is MarketingMediaType {
  return typeof value === "string" && (MARKETING_MEDIA_TYPES as readonly string[]).includes(value);
}

export function isMarketingMediaOrientation(value: unknown): value is MarketingMediaOrientation {
  return (
    typeof value === "string" && (MARKETING_MEDIA_ORIENTATIONS as readonly string[]).includes(value)
  );
}

function assertOptionalTrimmedString(
  value: unknown,
  label: string,
  maxLen: number,
): string | null {
  if (value == null) return null;
  if (typeof value !== "string") {
    throw new MarketingSourceCatalogError(`${label} must be a string or null`);
  }
  const trimmed = value.trim();
  if (!trimmed) return null;
  if (trimmed.length > maxLen) {
    throw new MarketingSourceCatalogError(`${label} exceeds max length ${maxLen}`);
  }
  if (/[\u0000-\u001f\u007f]/.test(trimmed)) {
    throw new MarketingSourceCatalogError(`${label} must not contain control characters`);
  }
  return trimmed;
}

export function assertProviderIdentifier(value: unknown): string {
  if (typeof value !== "string" || !PROVIDER_RE.test(value)) {
    throw new MarketingSourceCatalogError(
      "provider must match /^[a-z][a-z0-9_-]{0,63}$/",
      "invalid_provider",
    );
  }
  return value;
}

export function assertProviderAssetId(value: unknown): string {
  if (typeof value !== "string") {
    throw new MarketingSourceCatalogError("providerAssetId must be a string", "invalid_provider_asset_id");
  }
  const trimmed = value.trim();
  if (!trimmed || trimmed.length > PROVIDER_ASSET_ID_MAX) {
    throw new MarketingSourceCatalogError(
      `providerAssetId must be 1..${PROVIDER_ASSET_ID_MAX} chars`,
      "invalid_provider_asset_id",
    );
  }
  if (/[\u0000-\u001f\u007f]/.test(trimmed)) {
    throw new MarketingSourceCatalogError(
      "providerAssetId must not contain control characters",
      "invalid_provider_asset_id",
    );
  }
  return trimmed;
}

export function assertHttpOrHttpsUrl(value: unknown, label: string): string {
  if (typeof value !== "string" || !value.trim()) {
    throw new MarketingSourceCatalogError(`${label} must be a non-empty string`, "invalid_url");
  }
  let parsed: URL;
  try {
    parsed = new URL(value.trim());
  } catch {
    throw new MarketingSourceCatalogError(`${label} is not a valid URL`, "invalid_url");
  }
  if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
    throw new MarketingSourceCatalogError(
      `${label} must use http: or https: scheme`,
      "invalid_url_scheme",
    );
  }
  return parsed.toString();
}

export function assertOptionalHttpOrHttpsUrl(value: unknown, label: string): string | null {
  if (value == null) return null;
  if (typeof value === "string" && !value.trim()) return null;
  return assertHttpOrHttpsUrl(value, label);
}

export function assertSha256Hex(value: unknown): string {
  if (typeof value !== "string" || !SHA256_RE.test(value)) {
    throw new MarketingSourceCatalogError(
      "sha256 must be a 64-char lowercase hex digest",
      "invalid_sha256",
    );
  }
  return value;
}

export function assertManagedRelativePath(value: unknown): string {
  if (typeof value !== "string") {
    throw new MarketingSourceCatalogError("managedRelativePath must be a string", "invalid_path");
  }
  if (value.length > PATH_MAX) {
    throw new MarketingSourceCatalogError(
      `managedRelativePath exceeds max length ${PATH_MAX}`,
      "invalid_path",
    );
  }
  try {
    return assertSafeRelativeArtifactPath(value);
  } catch (error) {
    const message = error instanceof Error ? error.message : "invalid managedRelativePath";
    throw new MarketingSourceCatalogError(message, "invalid_path");
  }
}

export function assertOptionalPositiveInt(value: unknown, label: string): number | null {
  if (value == null) return null;
  if (typeof value !== "number" || !Number.isInteger(value) || value <= 0) {
    throw new MarketingSourceCatalogError(`${label} must be a positive integer or null`);
  }
  return value;
}

export function assertOptionalNonNegativeInt(value: unknown, label: string): number | null {
  if (value == null) return null;
  if (typeof value !== "number" || !Number.isInteger(value) || value < 0) {
    throw new MarketingSourceCatalogError(`${label} must be a non-negative integer or null`);
  }
  return value;
}

export function assertJsonObjectMetadata(value: unknown): Record<string, unknown> {
  if (value == null) return {};
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    throw new MarketingSourceCatalogError("metadata must be a JSON object");
  }
  const serialized = JSON.stringify(value);
  if (serialized.length > METADATA_JSON_MAX_BYTES) {
    throw new MarketingSourceCatalogError(
      `metadata exceeds max serialized size ${METADATA_JSON_MAX_BYTES}`,
    );
  }
  return { ...(value as Record<string, unknown>) };
}

export function assertBusinessId(value: unknown, label: string): string {
  if (typeof value !== "string" || !value.trim()) {
    throw new MarketingSourceCatalogError(`${label} must be a non-empty string`);
  }
  const trimmed = value.trim();
  if (trimmed.length > ID_MAX || /[\u0000-\u001f\u007f]/.test(trimmed) || trimmed.includes("/")) {
    throw new MarketingSourceCatalogError(`${label} is not a valid business id`);
  }
  return trimmed;
}

export function assertOptionalBusinessId(value: unknown, label: string): string | null {
  if (value == null) return null;
  if (typeof value === "string" && !value.trim()) return null;
  return assertBusinessId(value, label);
}

export function assertOptionalIsoTimestamp(value: unknown, label: string): string | null {
  if (value == null) return null;
  if (typeof value !== "string" || !value.trim()) return null;
  const ms = Date.parse(value);
  if (!Number.isFinite(ms)) {
    throw new MarketingSourceCatalogError(`${label} must be a valid ISO timestamp`);
  }
  return new Date(ms).toISOString();
}

export type NormalizedRegisterMarketingMediaSource = {
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
  contractVersion: typeof MARKETING_MEDIA_SOURCE_CATALOG_CONTRACT;
};

function normalizeCoreFields(
  input: RegisterMarketingMediaSourceInput,
): NormalizedRegisterMarketingMediaSource {
  if (!isMarketingMediaSourceKind(input.sourceKind)) {
    throw new MarketingSourceCatalogError("sourceKind is invalid");
  }

  const storageClass = input.storageClass ?? defaultStorageClassForSource(input.sourceKind);
  if (!isShortformStorageClass(storageClass)) {
    throw new MarketingSourceCatalogError("storageClass is invalid");
  }

  let disposition = input.disposition ?? defaultDispositionForSource(input.sourceKind);
  if (!isShortformAssetDisposition(disposition)) {
    throw new MarketingSourceCatalogError("disposition is invalid");
  }

  const isPinned = input.isPinned === true || disposition === "pin";
  if (isPinned) {
    disposition = "pin";
  }

  const providerRaw = input.provider ?? null;
  const providerAssetIdRaw = input.providerAssetId ?? null;
  let provider: string | null = null;
  let providerAssetId: string | null = null;
  if (providerRaw != null || providerAssetIdRaw != null) {
    if (providerRaw == null || providerAssetIdRaw == null) {
      throw new MarketingSourceCatalogError(
        "provider and providerAssetId must both be set or both null",
      );
    }
    provider = assertProviderIdentifier(providerRaw);
    providerAssetId = assertProviderAssetId(providerAssetIdRaw);
  }

  const rightsKind = input.rightsKind ?? "unknown";
  if (!isMarketingMediaRightsKind(rightsKind)) {
    throw new MarketingSourceCatalogError("rightsKind is invalid");
  }

  const status = input.status ?? "active";
  if (!isMarketingMediaSourceStatus(status)) {
    throw new MarketingSourceCatalogError("status is invalid");
  }

  const mediaType = input.mediaType ?? "unknown";
  if (!isMarketingMediaType(mediaType)) {
    throw new MarketingSourceCatalogError("mediaType is invalid");
  }

  let orientation: MarketingMediaOrientation | null = null;
  if (input.orientation != null) {
    if (!isMarketingMediaOrientation(input.orientation)) {
      throw new MarketingSourceCatalogError("orientation is invalid");
    }
    orientation = input.orientation;
  }

  const managedRelativePath =
    input.managedRelativePath == null || input.managedRelativePath === ""
      ? null
      : assertManagedRelativePath(input.managedRelativePath);

  if (storageClass === "external_ref" && managedRelativePath != null) {
    // Allowed but unusual — keep path if explicitly provided; do not require it.
  }

  return {
    sourceKind: input.sourceKind,
    storageClass,
    disposition,
    provider,
    providerAssetId,
    sourcePageUrl: assertOptionalHttpOrHttpsUrl(input.sourcePageUrl ?? null, "sourcePageUrl"),
    remoteAssetUrl: assertOptionalHttpOrHttpsUrl(input.remoteAssetUrl ?? null, "remoteAssetUrl"),
    remoteAssetUrlExpiresAt: assertOptionalIsoTimestamp(
      input.remoteAssetUrlExpiresAt ?? null,
      "remoteAssetUrlExpiresAt",
    ),
    managedRelativePath,
    mediaType,
    mimeType: assertOptionalTrimmedString(input.mimeType ?? null, "mimeType", MIME_MAX),
    width: assertOptionalPositiveInt(input.width ?? null, "width"),
    height: assertOptionalPositiveInt(input.height ?? null, "height"),
    durationMs: assertOptionalNonNegativeInt(input.durationMs ?? null, "durationMs"),
    orientation,
    sha256:
      input.sha256 == null || input.sha256 === ""
        ? null
        : assertSha256Hex(input.sha256),
    creatorName: assertOptionalTrimmedString(input.creatorName ?? null, "creatorName", TEXT_FIELD_MAX),
    rightsKind,
    licenseName: assertOptionalTrimmedString(input.licenseName ?? null, "licenseName", TEXT_FIELD_MAX),
    licenseUrl: assertOptionalHttpOrHttpsUrl(input.licenseUrl ?? null, "licenseUrl"),
    attributionText: assertOptionalTrimmedString(
      input.attributionText ?? null,
      "attributionText",
      LONG_TEXT_MAX,
    ),
    rightsNote: assertOptionalTrimmedString(input.rightsNote ?? null, "rightsNote", LONG_TEXT_MAX),
    metadata: assertJsonObjectMetadata(input.metadata),
    isPinned,
    status,
    contractVersion: MARKETING_MEDIA_SOURCE_CATALOG_CONTRACT,
  };
}

export function validateRegisterMarketingMediaSourceInput(
  input: RegisterMarketingMediaSourceInput,
): NormalizedRegisterMarketingMediaSource {
  return normalizeCoreFields(input);
}

export function validateRegisterExternalMarketingMediaSourceInput(
  input: RegisterExternalMarketingMediaSourceInput,
): NormalizedRegisterMarketingMediaSource {
  const provider = assertProviderIdentifier(input.provider);
  const providerAssetId = assertProviderAssetId(input.providerAssetId);
  return normalizeCoreFields({
    ...input,
    provider,
    providerAssetId,
    storageClass: input.storageClass ?? "external_ref",
    disposition: input.disposition ?? "pick_only",
  });
}

export function validateUpdateMarketingMediaSourceInput(
  input: UpdateMarketingMediaSourceInput,
): Omit<UpdateMarketingMediaSourceInput, "id"> & { id: string } {
  const id = assertBusinessId(input.id, "id");
  const patch: UpdateMarketingMediaSourceInput = { id };

  if ("sourcePageUrl" in input) {
    patch.sourcePageUrl = assertOptionalHttpOrHttpsUrl(input.sourcePageUrl ?? null, "sourcePageUrl");
  }
  if ("remoteAssetUrl" in input) {
    patch.remoteAssetUrl = assertOptionalHttpOrHttpsUrl(
      input.remoteAssetUrl ?? null,
      "remoteAssetUrl",
    );
  }
  if ("remoteAssetUrlExpiresAt" in input) {
    patch.remoteAssetUrlExpiresAt = assertOptionalIsoTimestamp(
      input.remoteAssetUrlExpiresAt ?? null,
      "remoteAssetUrlExpiresAt",
    );
  }
  if ("managedRelativePath" in input) {
    patch.managedRelativePath =
      input.managedRelativePath == null || input.managedRelativePath === ""
        ? null
        : assertManagedRelativePath(input.managedRelativePath);
  }
  if (input.mediaType !== undefined) {
    if (!isMarketingMediaType(input.mediaType)) {
      throw new MarketingSourceCatalogError("mediaType is invalid");
    }
    patch.mediaType = input.mediaType;
  }
  if ("mimeType" in input) {
    patch.mimeType = assertOptionalTrimmedString(input.mimeType ?? null, "mimeType", MIME_MAX);
  }
  if ("width" in input) {
    patch.width = assertOptionalPositiveInt(input.width ?? null, "width");
  }
  if ("height" in input) {
    patch.height = assertOptionalPositiveInt(input.height ?? null, "height");
  }
  if ("durationMs" in input) {
    patch.durationMs = assertOptionalNonNegativeInt(input.durationMs ?? null, "durationMs");
  }
  if ("orientation" in input) {
    if (input.orientation != null && !isMarketingMediaOrientation(input.orientation)) {
      throw new MarketingSourceCatalogError("orientation is invalid");
    }
    patch.orientation = input.orientation ?? null;
  }
  if ("sha256" in input) {
    patch.sha256 =
      input.sha256 == null || input.sha256 === "" ? null : assertSha256Hex(input.sha256);
  }
  if ("creatorName" in input) {
    patch.creatorName = assertOptionalTrimmedString(
      input.creatorName ?? null,
      "creatorName",
      TEXT_FIELD_MAX,
    );
  }
  if (input.rightsKind !== undefined) {
    if (!isMarketingMediaRightsKind(input.rightsKind)) {
      throw new MarketingSourceCatalogError("rightsKind is invalid");
    }
    patch.rightsKind = input.rightsKind;
  }
  if ("licenseName" in input) {
    patch.licenseName = assertOptionalTrimmedString(
      input.licenseName ?? null,
      "licenseName",
      TEXT_FIELD_MAX,
    );
  }
  if ("licenseUrl" in input) {
    patch.licenseUrl = assertOptionalHttpOrHttpsUrl(input.licenseUrl ?? null, "licenseUrl");
  }
  if ("attributionText" in input) {
    patch.attributionText = assertOptionalTrimmedString(
      input.attributionText ?? null,
      "attributionText",
      LONG_TEXT_MAX,
    );
  }
  if ("rightsNote" in input) {
    patch.rightsNote = assertOptionalTrimmedString(
      input.rightsNote ?? null,
      "rightsNote",
      LONG_TEXT_MAX,
    );
  }
  if (input.metadata !== undefined) {
    patch.metadata = assertJsonObjectMetadata(input.metadata);
  }
  if (input.isPinned !== undefined) {
    patch.isPinned = input.isPinned === true;
  }
  if (input.disposition !== undefined) {
    if (!isShortformAssetDisposition(input.disposition)) {
      throw new MarketingSourceCatalogError("disposition is invalid");
    }
    patch.disposition = input.disposition;
  }
  if (input.storageClass !== undefined) {
    if (!isShortformStorageClass(input.storageClass)) {
      throw new MarketingSourceCatalogError("storageClass is invalid");
    }
    patch.storageClass = input.storageClass;
  }
  if (input.status !== undefined) {
    if (!isMarketingMediaSourceStatus(input.status)) {
      throw new MarketingSourceCatalogError("status is invalid");
    }
    patch.status = input.status;
  }

  if (patch.isPinned === true) {
    patch.disposition = "pin";
  }

  return patch;
}

/** unknown rights is allowed but never implies commercial clearance. */
export function rightsKindImpliesCommercialClearance(rightsKind: MarketingMediaRightsKind): boolean {
  return rightsKind === "owned" || rightsKind === "partner_authorized";
}
