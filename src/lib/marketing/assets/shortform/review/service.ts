/**
 * SV-5 — Human Source Review / Explicit Pick service (server-only domain).
 * Resolve ≠ Pick ≠ Ingest. No binary download.
 */

import { readCandidateAssetPackageFile } from "@/lib/marketing/assets/candidateAssetPackageService";
import { MarketingAssetPathError } from "@/lib/marketing/assets/errors";
import { createMarketingMediaSourceCatalogRepository } from "@/lib/marketing/assets/sourceCatalog/createSourceCatalogRepository";
import { MarketingSourceCatalogError } from "@/lib/marketing/assets/sourceCatalog/errors";
import type { MarketingMediaSourceCatalogRepository } from "@/lib/marketing/assets/sourceCatalog/repository";
import type {
  MarketingMediaSourceUsageRecord,
  MarketingMediaType,
} from "@/lib/marketing/assets/sourceCatalog/types";
import type { MarketingMediaSourceKind } from "@/lib/marketing/assets/shortform/storagePolicy";
import { SHORT_VIDEO_BRIEF_RELATIVE_PATH } from "@/lib/marketing/assets/shortVideoBrief/paths";
import { parseShortVideoBrief } from "@/lib/marketing/assets/shortVideoBrief/validate";
import type { ShortVideoBrief } from "@/lib/marketing/assets/shortVideoBrief/contracts";
import { createShortformResolverProviders } from "@/lib/marketing/assets/shortform/resolver/createProviders";
import {
  SHORTFORM_SOURCE_RESOLUTION_CONTRACT,
  type ShortformSourceResolutionPlan,
} from "@/lib/marketing/assets/shortform/resolver/contracts";
import { persistShortformSourceResolution } from "@/lib/marketing/assets/shortform/resolver/persist";
import { SHORTFORM_SOURCE_RESOLUTION_RELATIVE_PATH } from "@/lib/marketing/assets/shortform/resolver/paths";
import { resolveShortVideoSources } from "@/lib/marketing/assets/shortform/resolver/resolveBrief";
import { rebuildShortformBriefsFromDraft } from "@/lib/marketing/assets/shortform/rebuildShortformBriefsFromDraft";
import {
  toResolveDto,
  type ShortformSourcesResolveDto,
} from "@/lib/marketing/assets/shortform/review/dto";
import {
  isShortformCandidateSelectionSigningConfigured,
  verifyShortformCandidateSelectionToken,
  type ShortformCandidateSelectionPayload,
} from "@/lib/marketing/assets/shortform/review/selectionToken";
import { createHumanMarketingReviewRepository } from "@/lib/marketing/review/repository/createHumanMarketingReviewRepository";

export class ShortformSourceReviewError extends Error {
  readonly code: string;
  readonly httpStatus: number;

  constructor(message: string, code: string, httpStatus: number) {
    super(message);
    this.name = "ShortformSourceReviewError";
    this.code = code;
    this.httpStatus = httpStatus;
  }
}

function isCatalogSchemaMissing(error: unknown): boolean {
  if (!(error instanceof Error)) return false;
  const msg = error.message.toLowerCase();
  return (
    msg.includes("does not exist") ||
    msg.includes("42p01") ||
    (msg.includes("relation") && msg.includes("marketing_media_source")) ||
    msg.includes("catalog_unavailable")
  );
}

function wrapCatalogError(error: unknown): never {
  if (isCatalogSchemaMissing(error)) {
    throw new ShortformSourceReviewError(
      "미디어 소스 카탈로그가 아직 준비되지 않았습니다.",
      "CATALOG_UNAVAILABLE",
      503,
    );
  }
  if (error instanceof MarketingSourceCatalogError) {
    if (error.code === "not_found") {
      throw new ShortformSourceReviewError("소스를 찾을 수 없습니다.", "SOURCE_NOT_FOUND", 404);
    }
    if (error.code === "duplicate_pick") {
      throw new ShortformSourceReviewError("이미 선택된 소스입니다.", "DUPLICATE_PICK", 409);
    }
    throw new ShortformSourceReviewError(error.message, error.code.toUpperCase(), 400);
  }
  throw error;
}

async function loadShortVideoBriefOrThrow(candidateId: string): Promise<{
  brief: ShortVideoBrief;
}> {
  let result: Awaited<ReturnType<typeof readCandidateAssetPackageFile>>;
  try {
    result = await readCandidateAssetPackageFile({
      candidateId,
      relativePath: SHORT_VIDEO_BRIEF_RELATIVE_PATH,
    });
  } catch (error) {
    if (error instanceof MarketingAssetPathError) {
      const msg = error.message.toLowerCase();
      if (msg.includes("package not found") || msg.includes("artifact not found")) {
        throw new ShortformSourceReviewError(
          "ShortVideoBrief가 필요합니다. 먼저 short-video-brief 산출물을 준비하세요.",
          "SHORT_VIDEO_BRIEF_REQUIRED",
          409,
        );
      }
    }
    throw error;
  }
  if (!result.ok) {
    throw new ShortformSourceReviewError("후보를 찾을 수 없습니다.", "CANDIDATE_NOT_FOUND", 404);
  }
  let parsedJson: unknown;
  try {
    parsedJson = JSON.parse(result.file.bytes.toString("utf8"));
  } catch {
    throw new ShortformSourceReviewError(
      "ShortVideoBrief JSON이 올바르지 않습니다.",
      "SHORT_VIDEO_BRIEF_INVALID",
      409,
    );
  }
  try {
    return { brief: parseShortVideoBrief(parsedJson) };
  } catch (error) {
    throw new ShortformSourceReviewError(
      error instanceof Error ? error.message : "ShortVideoBrief가 유효하지 않습니다.",
      "SHORT_VIDEO_BRIEF_INVALID",
      409,
    );
  }
}

function mapExternalSourceKind(
  payload: ShortformCandidateSelectionPayload,
): MarketingMediaSourceKind {
  if (payload.provider === "pexels" || payload.origin === "pexels") return "pexels";
  if (payload.provider === "pixabay" || payload.origin === "pixabay") return "pixabay";
  return "unknown";
}

function mapMediaType(payload: ShortformCandidateSelectionPayload): MarketingMediaType {
  if (payload.mediaType === "video") return "video";
  if (payload.mediaType === "image") return "image";
  return "other";
}

export type ResolveShortformSourcesForReviewInput = {
  candidateId: string;
  catalog?: MarketingMediaSourceCatalogRepository;
  env?: NodeJS.ProcessEnv | Record<string, string | undefined>;
  /** Injected for tests — skips HDD brief read when provided. */
  brief?: ShortVideoBrief;
  /**
   * When false (default), reuse durable package resolution if present.
   * When true, re-run providers (Admin “다시 검색”).
   */
  forceRefresh?: boolean;
  /** Package root override for tests. */
  packageRoot?: string | null;
};

function tryParsePersistedSourceResolution(raw: unknown): ShortformSourceResolutionPlan | null {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return null;
  const record = raw as Record<string, unknown>;
  if (record.contract !== SHORTFORM_SOURCE_RESOLUTION_CONTRACT) return null;
  if (typeof record.candidateId !== "string" || !record.candidateId.trim()) return null;
  if (typeof record.businessDateKst !== "string" || !record.businessDateKst.trim()) return null;
  if (!Array.isArray(record.scenes)) return null;
  if (typeof record.createdAt !== "string" || !record.createdAt.trim()) return null;
  return raw as ShortformSourceResolutionPlan;
}

async function loadPersistedSourceResolution(
  candidateId: string,
): Promise<ShortformSourceResolutionPlan | null> {
  try {
    const result = await readCandidateAssetPackageFile({
      candidateId,
      relativePath: SHORTFORM_SOURCE_RESOLUTION_RELATIVE_PATH,
    });
    if (!result.ok) return null;
    return tryParsePersistedSourceResolution(JSON.parse(result.file.bytes.toString("utf8")));
  } catch {
    return null;
  }
}

export async function resolveShortformSourcesForReview(
  input: ResolveShortformSourcesForReviewInput,
): Promise<ShortformSourcesResolveDto> {
  if (!isShortformCandidateSelectionSigningConfigured(input.env ?? process.env)) {
    throw new ShortformSourceReviewError(
      "후보 선택 서명 시크릿이 구성되지 않았습니다.",
      "SELECTION_SECRET_MISSING",
      503,
    );
  }

  if (input.forceRefresh && !input.brief) {
    try {
      const reviewRepo = await createHumanMarketingReviewRepository({});
      const review = await reviewRepo.findByCandidateId(input.candidateId);
      if (review?.currentDraft?.body?.trim()) {
        await rebuildShortformBriefsFromDraft({
          candidateId: input.candidateId,
          draft: review.currentDraft,
          invalidateUnpickedResolution: true,
        });
      }
    } catch {
      /* best-effort; fall through to existing brief on disk */
    }
  }

  const brief = input.brief ?? (await loadShortVideoBriefOrThrow(input.candidateId)).brief;
  if (brief.candidateId !== input.candidateId) {
    throw new ShortformSourceReviewError(
      "Brief candidateId가 일치하지 않습니다.",
      "SHORT_VIDEO_BRIEF_MISMATCH",
      409,
    );
  }

  const catalog =
    input.catalog ?? (await createMarketingMediaSourceCatalogRepository({ env: input.env }));

  let catalogAvailable = true;
  let usages: MarketingMediaSourceUsageRecord[] = [];
  try {
    usages = await catalog.listUsagesForCandidate(input.candidateId);
  } catch (error) {
    if (isCatalogSchemaMissing(error)) {
      catalogAvailable = false;
      usages = [];
    } else {
      wrapCatalogError(error);
    }
  }

  const sourceLookup = new Map<string, { provider: string | null; providerAssetId: string | null }>();
  for (const usage of usages) {
    try {
      const source = await catalog.getById(usage.sourceId);
      if (source) {
        sourceLookup.set(source.id, {
          provider: source.provider,
          providerAssetId: source.providerAssetId,
        });
      }
    } catch {
      /* ignore lookup gaps for display */
    }
  }

  if (!input.forceRefresh) {
    const persisted = await loadPersistedSourceResolution(input.candidateId);
    if (persisted && persisted.candidateId === input.candidateId) {
      return toResolveDto({
        plan: persisted,
        brief,
        usages,
        sourceLookup,
        catalogAvailable,
      });
    }
  }

  const providers = createShortformResolverProviders({
    catalog,
    env: input.env,
  });

  const plan = await resolveShortVideoSources({
    brief,
    providers,
  });

  // Best-effort durable persist so Admin reload can reuse without live providers.
  try {
    let packageRoot = input.packageRoot?.trim() || null;
    if (!packageRoot) {
      const briefFile = await readCandidateAssetPackageFile({
        candidateId: input.candidateId,
        relativePath: SHORT_VIDEO_BRIEF_RELATIVE_PATH,
      });
      if (briefFile.ok) {
        // absolutePath ends with context/short-video-brief.json → package root is two levels up.
        packageRoot = briefFile.file.absolutePath.replace(/[/\\][^/\\]+[/\\][^/\\]+$/, "");
      }
    }
    if (packageRoot) {
      persistShortformSourceResolution({
        packageRoot,
        plan,
        createdAt: new Date().toISOString(),
        overwrite: Boolean(input.forceRefresh),
      });
    }
  } catch {
    /* review still succeeds without durable write */
  }

  return toResolveDto({
    plan,
    brief,
    usages,
    sourceLookup,
    catalogAvailable,
  });
}

export type PickShortformSourceForReviewInput = {
  candidateId: string;
  sceneId: string;
  selectionToken: string;
  catalog?: MarketingMediaSourceCatalogRepository;
  env?: NodeJS.ProcessEnv | Record<string, string | undefined>;
  /** Injected for tests — skips production job repository. */
  jobRepository?: import("@/lib/marketing/assets/shortform/renderJob/repository").ShortformVideoRenderJobRepository;
  /** When false, skip CG-3 auto-enqueue (tests that only assert PICK). Default true. */
  autoEnqueueRender?: boolean;
};

export type PickShortformSourceForReviewResult = {
  usageId: string;
  sourceId: string;
  sceneId: string;
  candidateId: string;
  managedRelativePath: null;
  storageClass: string;
  provider: string | null;
  providerAssetId: string | null;
  replaced: boolean;
  renderEnqueue?: {
    enqueued: boolean;
    created: boolean;
    status: string | null;
    jobId: string | null;
    reason: string;
  };
};

export async function pickShortformSourceForReview(
  input: PickShortformSourceForReviewInput,
): Promise<PickShortformSourceForReviewResult> {
  if (!isShortformCandidateSelectionSigningConfigured(input.env ?? process.env)) {
    throw new ShortformSourceReviewError(
      "후보 선택 서명 시크릿이 구성되지 않았습니다.",
      "SELECTION_SECRET_MISSING",
      503,
    );
  }

  const payload = verifyShortformCandidateSelectionToken(input.selectionToken);
  if (!payload) {
    throw new ShortformSourceReviewError(
      "선택 토큰이 유효하지 않거나 만료되었습니다.",
      "INVALID_SELECTION_TOKEN",
      400,
    );
  }

  if (payload.candidateId !== input.candidateId || payload.sceneId !== input.sceneId) {
    throw new ShortformSourceReviewError(
      "선택 토큰이 장면/후보와 일치하지 않습니다.",
      "SELECTION_TOKEN_MISMATCH",
      400,
    );
  }

  if (payload.rightsKind === "unknown") {
    throw new ShortformSourceReviewError(
      "사용권이 확인되지 않은 후보는 선택할 수 없습니다.",
      "UNKNOWN_RIGHTS_BLOCKED",
      400,
    );
  }

  if (payload.origin === "generated_video_plan") {
    throw new ShortformSourceReviewError(
      "AI 생성 계획은 아직 선택할 수 없습니다.",
      "GENERATED_PLAN_NOT_PICKABLE",
      400,
    );
  }

  const catalog =
    input.catalog ?? (await createMarketingMediaSourceCatalogRepository({ env: input.env }));

  let previousUsages;
  try {
    previousUsages = (await catalog.listUsagesForCandidate(input.candidateId)).filter(
      (u) => (u.sceneKey ?? null) === input.sceneId,
    );
  } catch (error) {
    wrapCatalogError(error);
  }

  let sourceId: string;
  let storageClass: string;
  let provider: string | null;
  let providerAssetId: string | null;

  try {
    if (payload.origin === "internal_catalog") {
      if (!payload.catalogSourceId) {
        throw new ShortformSourceReviewError(
          "내부 카탈로그 소스 ID가 없습니다.",
          "INTERNAL_SOURCE_REQUIRED",
          400,
        );
      }
      const existing = await catalog.getById(payload.catalogSourceId);
      if (!existing) {
        throw new ShortformSourceReviewError("소스를 찾을 수 없습니다.", "SOURCE_NOT_FOUND", 404);
      }
      // Persist pick-time factualMatch/origin for CG-3 render-ready evaluation.
      await catalog.updateSource({
        id: existing.id,
        metadata: {
          ...existing.metadata,
          pickOrigin: payload.origin,
          factualMatch: payload.factualMatch,
          candidateKey: payload.candidateKey,
          score: payload.score,
          previewUrl: payload.previewUrl,
        },
      });
      sourceId = existing.id;
      storageClass = existing.storageClass;
      provider = existing.provider;
      providerAssetId = existing.providerAssetId;
    } else {
      if (!payload.provider || !payload.providerAssetId) {
        throw new ShortformSourceReviewError(
          "외부 소스 identity가 불완전합니다.",
          "EXTERNAL_IDENTITY_REQUIRED",
          400,
        );
      }
      const registered = await catalog.registerExternalSource({
        sourceKind: mapExternalSourceKind(payload),
        provider: payload.provider,
        providerAssetId: payload.providerAssetId,
        storageClass: "external_ref",
        disposition: "pick_only",
        sourcePageUrl: payload.sourcePageUrl,
        remoteAssetUrl: payload.remoteAssetUrl,
        managedRelativePath: null,
        mediaType: mapMediaType(payload),
        width: payload.width,
        height: payload.height,
        durationMs: payload.durationMs,
        orientation: payload.orientation as never,
        creatorName: payload.creatorName,
        rightsKind: payload.rightsKind,
        licenseName: payload.licenseName,
        licenseUrl: payload.licenseUrl,
        attributionText: payload.attributionText,
        metadata: {
          pickOrigin: payload.origin,
          candidateKey: payload.candidateKey,
          factualMatch: payload.factualMatch,
          score: payload.score,
          previewUrl: payload.previewUrl,
        },
      });
      if (registered.managedRelativePath != null) {
        throw new ShortformSourceReviewError(
          "외부 PICK은 managed path를 만들 수 없습니다.",
          "INGEST_FORBIDDEN",
          500,
        );
      }
      if (registered.storageClass !== "external_ref") {
        throw new ShortformSourceReviewError(
          "외부 PICK storageClass가 올바르지 않습니다.",
          "INGEST_FORBIDDEN",
          500,
        );
      }
      sourceId = registered.id;
      storageClass = registered.storageClass;
      provider = registered.provider;
      providerAssetId = registered.providerAssetId;
    }

    const usage = await catalog.setScenePick({
      sourceId,
      candidateId: input.candidateId,
      sceneKey: input.sceneId,
    });

    const pickResult: PickShortformSourceForReviewResult = {
      usageId: usage.id,
      sourceId: usage.sourceId,
      sceneId: input.sceneId,
      candidateId: input.candidateId,
      managedRelativePath: null,
      storageClass,
      provider,
      providerAssetId,
      replaced:
        previousUsages.length > 0 &&
        !(previousUsages.length === 1 && previousUsages[0]!.sourceId === sourceId),
    };

    if (input.autoEnqueueRender === false) {
      return pickResult;
    }

    try {
      const { maybeEnqueueShortformRenderAfterPick } = await import(
        "@/lib/marketing/assets/shortform/renderReady"
      );
      const enqueueResult = await maybeEnqueueShortformRenderAfterPick({
        candidateId: input.candidateId,
        catalog,
        jobRepository: input.jobRepository,
        env: input.env,
      });
      pickResult.renderEnqueue = {
        enqueued: enqueueResult.enqueued,
        created: enqueueResult.created,
        status: enqueueResult.job?.status ?? null,
        jobId: enqueueResult.job?.jobId ?? null,
        reason: enqueueResult.skippedReason ?? enqueueResult.evaluation.reason,
      };
    } catch (error) {
      pickResult.renderEnqueue = {
        enqueued: false,
        created: false,
        status: null,
        jobId: null,
        reason: error instanceof Error ? error.message.slice(0, 200) : "enqueue_failed",
      };
    }

    return pickResult;
  } catch (error) {
    if (error instanceof ShortformSourceReviewError) throw error;
    wrapCatalogError(error);
  }
}

/** Exported for API error mapping */
export function shortformSourceReviewErrorResponse(error: unknown): Response {
  if (error instanceof ShortformSourceReviewError) {
    return Response.json(
      { message: error.message, code: error.code },
      { status: error.httpStatus, headers: { "Cache-Control": "no-store" } },
    );
  }
  console.error("[shortform-source-review]", error);
  return Response.json(
    { message: "내부 오류가 발생했습니다.", code: "INTERNAL_ERROR" },
    { status: 500, headers: { "Cache-Control": "no-store" } },
  );
}
