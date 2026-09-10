import "server-only";

import { MarketingSourceCatalogError } from "@/lib/marketing/assets/sourceCatalog/errors";
import type { MarketingMediaSourceCatalogRepository } from "@/lib/marketing/assets/sourceCatalog/repository";
import type {
  ListMarketingMediaSourcesFilter,
  MarketingMediaSourceRecord,
  MarketingMediaSourceUsageRecord,
  RecordMarketingMediaSourcePickInput,
  RegisterExternalMarketingMediaSourceInput,
  RegisterMarketingMediaSourceInput,
  UpdateMarketingMediaSourceInput,
} from "@/lib/marketing/assets/sourceCatalog/types";
import {
  MARKETING_MEDIA_SOURCE_CATALOG_CONTRACT,
  type MarketingMediaOrientation,
  type MarketingMediaRightsKind,
  type MarketingMediaSourceStatus,
  type MarketingMediaType,
} from "@/lib/marketing/assets/sourceCatalog/types";
import {
  assertBusinessId,
  assertOptionalBusinessId,
  assertProviderAssetId,
  assertProviderIdentifier,
  assertSha256Hex,
  isMarketingMediaOrientation,
  isMarketingMediaRightsKind,
  isMarketingMediaSourceStatus,
  isMarketingMediaType,
  isMarketingMediaSourceKind,
  isShortformAssetDisposition,
  isShortformStorageClass,
  validateRegisterExternalMarketingMediaSourceInput,
  validateRegisterMarketingMediaSourceInput,
  validateUpdateMarketingMediaSourceInput,
  type NormalizedRegisterMarketingMediaSource,
} from "@/lib/marketing/assets/sourceCatalog/validation";

export const MARKETING_MEDIA_SOURCES_TABLE = "marketing_media_sources";
export const MARKETING_MEDIA_SOURCE_USAGES_TABLE = "marketing_media_source_usages";

type DbError = { message: string; code?: string } | null;

type ThenableQuery<T> = PromiseLike<{ data: T; error: DbError }>;

type FilterBuilder = {
  eq: (column: string, value: unknown) => FilterBuilder;
  order: (column: string, options?: { ascending?: boolean }) => FilterBuilder;
  limit: (count: number) => ThenableQuery<unknown>;
  maybeSingle: () => ThenableQuery<unknown>;
  select: (columns?: string) => FilterBuilder;
};

type DbClient = {
  from: (table: string) => {
    insert: (values: Record<string, unknown> | Record<string, unknown>[]) => {
      select: (columns?: string) => {
        single: () => ThenableQuery<unknown>;
        maybeSingle: () => ThenableQuery<unknown>;
      };
    };
    update: (values: Record<string, unknown>) => {
      eq: (column: string, value: unknown) => {
        select: (columns?: string) => {
          single: () => ThenableQuery<unknown>;
        };
      };
    };
    select: (columns?: string) => FilterBuilder;
  };
};

function asRecord(value: unknown): Record<string, unknown> {
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    throw new MarketingSourceCatalogError("catalog row is malformed");
  }
  return value as Record<string, unknown>;
}

function asNullableString(value: unknown): string | null {
  if (value == null) return null;
  return String(value);
}

function mapSourceRow(value: unknown): MarketingMediaSourceRecord {
  const row = asRecord(value);
  const sourceKind = row.source_kind;
  const storageClass = row.storage_class;
  const disposition = row.disposition;
  if (!isMarketingMediaSourceKind(sourceKind)) {
    throw new MarketingSourceCatalogError("source_kind is invalid");
  }
  if (!isShortformStorageClass(storageClass)) {
    throw new MarketingSourceCatalogError("storage_class is invalid");
  }
  if (!isShortformAssetDisposition(disposition)) {
    throw new MarketingSourceCatalogError("disposition is invalid");
  }
  const mediaTypeRaw = row.media_type ?? "unknown";
  if (!isMarketingMediaType(mediaTypeRaw)) {
    throw new MarketingSourceCatalogError("media_type is invalid");
  }
  const rightsKindRaw = row.rights_kind ?? "unknown";
  if (!isMarketingMediaRightsKind(rightsKindRaw)) {
    throw new MarketingSourceCatalogError("rights_kind is invalid");
  }
  const statusRaw = row.status ?? "active";
  if (!isMarketingMediaSourceStatus(statusRaw)) {
    throw new MarketingSourceCatalogError("status is invalid");
  }
  const orientationRaw = row.orientation;
  let orientation: MarketingMediaOrientation | null = null;
  if (orientationRaw != null) {
    if (!isMarketingMediaOrientation(orientationRaw)) {
      throw new MarketingSourceCatalogError("orientation is invalid");
    }
    orientation = orientationRaw;
  }
  const metadata =
    row.metadata && typeof row.metadata === "object" && !Array.isArray(row.metadata)
      ? (row.metadata as Record<string, unknown>)
      : {};

  return {
    id: String(row.id ?? ""),
    contractVersion: MARKETING_MEDIA_SOURCE_CATALOG_CONTRACT,
    sourceKind,
    storageClass,
    disposition,
    provider: asNullableString(row.provider),
    providerAssetId: asNullableString(row.provider_asset_id),
    sourcePageUrl: asNullableString(row.source_page_url),
    remoteAssetUrl: asNullableString(row.remote_asset_url),
    remoteAssetUrlExpiresAt: asNullableString(row.remote_asset_url_expires_at),
    managedRelativePath: asNullableString(row.managed_relative_path),
    mediaType: mediaTypeRaw as MarketingMediaType,
    mimeType: asNullableString(row.mime_type),
    width: row.width == null ? null : Number(row.width),
    height: row.height == null ? null : Number(row.height),
    durationMs: row.duration_ms == null ? null : Number(row.duration_ms),
    orientation,
    sha256: asNullableString(row.sha256),
    creatorName: asNullableString(row.creator_name),
    rightsKind: rightsKindRaw as MarketingMediaRightsKind,
    licenseName: asNullableString(row.license_name),
    licenseUrl: asNullableString(row.license_url),
    attributionText: asNullableString(row.attribution_text),
    rightsNote: asNullableString(row.rights_note),
    metadata,
    isPinned: Boolean(row.is_pinned),
    status: statusRaw as MarketingMediaSourceStatus,
    createdAt: String(row.created_at ?? ""),
    updatedAt: String(row.updated_at ?? ""),
  };
}

function mapUsageRow(value: unknown): MarketingMediaSourceUsageRecord {
  const row = asRecord(value);
  return {
    id: String(row.id ?? ""),
    sourceId: String(row.source_id ?? ""),
    candidateId: String(row.candidate_id ?? ""),
    productionRequestId: asNullableString(row.production_request_id),
    sceneKey: asNullableString(row.scene_key),
    relation: "picked",
    createdAt: String(row.created_at ?? ""),
  };
}

function toDbInsert(validated: NormalizedRegisterMarketingMediaSource): Record<string, unknown> {
  return {
    contract_version: validated.contractVersion,
    source_kind: validated.sourceKind,
    storage_class: validated.storageClass,
    disposition: validated.disposition,
    provider: validated.provider,
    provider_asset_id: validated.providerAssetId,
    source_page_url: validated.sourcePageUrl,
    remote_asset_url: validated.remoteAssetUrl,
    remote_asset_url_expires_at: validated.remoteAssetUrlExpiresAt,
    managed_relative_path: validated.managedRelativePath,
    media_type: validated.mediaType,
    mime_type: validated.mimeType,
    width: validated.width,
    height: validated.height,
    duration_ms: validated.durationMs,
    orientation: validated.orientation,
    sha256: validated.sha256,
    creator_name: validated.creatorName,
    rights_kind: validated.rightsKind,
    license_name: validated.licenseName,
    license_url: validated.licenseUrl,
    attribution_text: validated.attributionText,
    rights_note: validated.rightsNote,
    metadata: validated.metadata,
    is_pinned: validated.isPinned,
    status: validated.status,
  };
}

function isUniqueViolation(error: DbError): boolean {
  if (!error) return false;
  return error.code === "23505" || /duplicate key|unique constraint/i.test(error.message);
}

export class SupabaseMarketingMediaSourceCatalogRepository
  implements MarketingMediaSourceCatalogRepository
{
  private readonly client: DbClient;

  constructor(input: { client: DbClient }) {
    this.client = input.client;
  }

  async registerSource(input: RegisterMarketingMediaSourceInput): Promise<MarketingMediaSourceRecord> {
    const validated = validateRegisterMarketingMediaSourceInput(input);
    if (validated.provider && validated.providerAssetId) {
      const existing = await this.findByProviderIdentity({
        provider: validated.provider,
        providerAssetId: validated.providerAssetId,
      });
      if (existing) return existing;
    }
    return this.#insertSource(validated);
  }

  async registerExternalSource(
    input: RegisterExternalMarketingMediaSourceInput,
  ): Promise<MarketingMediaSourceRecord> {
    const validated = validateRegisterExternalMarketingMediaSourceInput(input);
    const existing = await this.findByProviderIdentity({
      provider: validated.provider!,
      providerAssetId: validated.providerAssetId!,
    });
    if (existing) return existing;
    try {
      return await this.#insertSource(validated);
    } catch (error) {
      if (
        error instanceof MarketingSourceCatalogError &&
        error.code === "duplicate_provider_identity"
      ) {
        const raced = await this.findByProviderIdentity({
          provider: validated.provider!,
          providerAssetId: validated.providerAssetId!,
        });
        if (raced) return raced;
      }
      throw error;
    }
  }

  async getById(id: string): Promise<MarketingMediaSourceRecord | null> {
    const safeId = assertBusinessId(id, "id");
    const { data, error } = await this.client
      .from(MARKETING_MEDIA_SOURCES_TABLE)
      .select("*")
      .eq("id", safeId)
      .maybeSingle();
    if (error) {
      throw new MarketingSourceCatalogError(`getById failed: ${error.message}`);
    }
    if (!data) return null;
    return mapSourceRow(data);
  }

  async findByProviderIdentity(params: {
    provider: string;
    providerAssetId: string;
  }): Promise<MarketingMediaSourceRecord | null> {
    const provider = assertProviderIdentifier(params.provider);
    const providerAssetId = assertProviderAssetId(params.providerAssetId);
    const { data, error } = await this.client
      .from(MARKETING_MEDIA_SOURCES_TABLE)
      .select("*")
      .eq("provider", provider)
      .eq("provider_asset_id", providerAssetId)
      .maybeSingle();
    if (error) {
      throw new MarketingSourceCatalogError(`findByProviderIdentity failed: ${error.message}`);
    }
    if (!data) return null;
    return mapSourceRow(data);
  }

  async findBySha256(sha256: string): Promise<MarketingMediaSourceRecord[]> {
    const digest = assertSha256Hex(sha256);
    const { data, error } = await this.client
      .from(MARKETING_MEDIA_SOURCES_TABLE)
      .select("*")
      .eq("sha256", digest)
      .order("created_at", { ascending: false })
      .limit(100);
    if (error) {
      throw new MarketingSourceCatalogError(`findBySha256 failed: ${error.message}`);
    }
    const rows = Array.isArray(data) ? data : [];
    return rows.map(mapSourceRow);
  }

  async list(filter: ListMarketingMediaSourcesFilter = {}): Promise<MarketingMediaSourceRecord[]> {
    const limit = filter.limit ?? 100;
    if (!Number.isInteger(limit) || limit < 1 || limit > 500) {
      throw new MarketingSourceCatalogError("limit must be an integer 1..500");
    }
    let query = this.client.from(MARKETING_MEDIA_SOURCES_TABLE).select("*");
    if (filter.sourceKind) query = query.eq("source_kind", filter.sourceKind);
    if (filter.storageClass) query = query.eq("storage_class", filter.storageClass);
    if (filter.status) query = query.eq("status", filter.status);
    if (filter.provider) query = query.eq("provider", filter.provider);
    if (filter.isPinned != null) query = query.eq("is_pinned", filter.isPinned);
    const { data, error } = await query.order("created_at", { ascending: false }).limit(limit);
    if (error) {
      throw new MarketingSourceCatalogError(`list failed: ${error.message}`);
    }
    const rows = Array.isArray(data) ? data : [];
    return rows.map(mapSourceRow);
  }

  async updateSource(input: UpdateMarketingMediaSourceInput): Promise<MarketingMediaSourceRecord> {
    const patch = validateUpdateMarketingMediaSourceInput(input);
    const payload: Record<string, unknown> = {
      updated_at: new Date().toISOString(),
    };
    if ("sourcePageUrl" in patch) payload.source_page_url = patch.sourcePageUrl;
    if ("remoteAssetUrl" in patch) payload.remote_asset_url = patch.remoteAssetUrl;
    if ("remoteAssetUrlExpiresAt" in patch) {
      payload.remote_asset_url_expires_at = patch.remoteAssetUrlExpiresAt;
    }
    if ("managedRelativePath" in patch) {
      payload.managed_relative_path = patch.managedRelativePath;
    }
    if (patch.mediaType !== undefined) payload.media_type = patch.mediaType;
    if ("mimeType" in patch) payload.mime_type = patch.mimeType;
    if ("width" in patch) payload.width = patch.width;
    if ("height" in patch) payload.height = patch.height;
    if ("durationMs" in patch) payload.duration_ms = patch.durationMs;
    if ("orientation" in patch) payload.orientation = patch.orientation;
    if ("sha256" in patch) payload.sha256 = patch.sha256;
    if ("creatorName" in patch) payload.creator_name = patch.creatorName;
    if (patch.rightsKind !== undefined) payload.rights_kind = patch.rightsKind;
    if ("licenseName" in patch) payload.license_name = patch.licenseName;
    if ("licenseUrl" in patch) payload.license_url = patch.licenseUrl;
    if ("attributionText" in patch) payload.attribution_text = patch.attributionText;
    if ("rightsNote" in patch) payload.rights_note = patch.rightsNote;
    if (patch.metadata !== undefined) payload.metadata = patch.metadata;
    if (patch.isPinned !== undefined) payload.is_pinned = patch.isPinned;
    if (patch.disposition !== undefined) payload.disposition = patch.disposition;
    if (patch.storageClass !== undefined) payload.storage_class = patch.storageClass;
    if (patch.status !== undefined) payload.status = patch.status;
    if (patch.isPinned === true) payload.disposition = "pin";

    const { data, error } = await this.client
      .from(MARKETING_MEDIA_SOURCES_TABLE)
      .update(payload)
      .eq("id", patch.id)
      .select("*")
      .single();
    if (error) {
      throw new MarketingSourceCatalogError(`updateSource failed: ${error.message}`, "not_found");
    }
    return mapSourceRow(data);
  }

  async recordPick(
    input: RecordMarketingMediaSourcePickInput,
  ): Promise<MarketingMediaSourceUsageRecord> {
    const sourceId = assertBusinessId(input.sourceId, "sourceId");
    const candidateId = assertBusinessId(input.candidateId, "candidateId");
    const productionRequestId = assertOptionalBusinessId(
      input.productionRequestId ?? null,
      "productionRequestId",
    );
    const sceneKey = assertOptionalBusinessId(input.sceneKey ?? null, "sceneKey");

    const source = await this.getById(sourceId);
    if (!source) {
      throw new MarketingSourceCatalogError("source not found", "not_found");
    }

    const { data, error } = await this.client
      .from(MARKETING_MEDIA_SOURCE_USAGES_TABLE)
      .insert({
        source_id: sourceId,
        candidate_id: candidateId,
        production_request_id: productionRequestId,
        scene_key: sceneKey,
        relation: "picked",
      })
      .select("*")
      .single();

    if (error) {
      if (isUniqueViolation(error)) {
        throw new MarketingSourceCatalogError(
          "duplicate pick for source/candidate/scene",
          "duplicate_pick",
        );
      }
      throw new MarketingSourceCatalogError(`recordPick failed: ${error.message}`);
    }
    return mapUsageRow(data);
  }

  async listUsagesForCandidate(candidateId: string): Promise<MarketingMediaSourceUsageRecord[]> {
    const id = assertBusinessId(candidateId, "candidateId");
    const { data, error } = await this.client
      .from(MARKETING_MEDIA_SOURCE_USAGES_TABLE)
      .select("*")
      .eq("candidate_id", id)
      .order("created_at", { ascending: false })
      .limit(500);
    if (error) {
      throw new MarketingSourceCatalogError(`listUsagesForCandidate failed: ${error.message}`);
    }
    return (Array.isArray(data) ? data : []).map(mapUsageRow);
  }

  async listUsagesForSource(sourceId: string): Promise<MarketingMediaSourceUsageRecord[]> {
    const id = assertBusinessId(sourceId, "sourceId");
    const { data, error } = await this.client
      .from(MARKETING_MEDIA_SOURCE_USAGES_TABLE)
      .select("*")
      .eq("source_id", id)
      .order("created_at", { ascending: false })
      .limit(500);
    if (error) {
      throw new MarketingSourceCatalogError(`listUsagesForSource failed: ${error.message}`);
    }
    return (Array.isArray(data) ? data : []).map(mapUsageRow);
  }

  async #insertSource(
    validated: NormalizedRegisterMarketingMediaSource,
  ): Promise<MarketingMediaSourceRecord> {
    const { data, error } = await this.client
      .from(MARKETING_MEDIA_SOURCES_TABLE)
      .insert(toDbInsert(validated))
      .select("*")
      .single();
    if (error) {
      if (isUniqueViolation(error)) {
        throw new MarketingSourceCatalogError(
          "duplicate provider identity",
          "duplicate_provider_identity",
        );
      }
      throw new MarketingSourceCatalogError(`registerSource failed: ${error.message}`);
    }
    return mapSourceRow(data);
  }
}
