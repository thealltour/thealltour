import type { PerformanceMetricsAdapter } from "@/lib/marketing/performance/adapters/types";
import {
  createMetricsAdapterRegistry,
  createStubMetricsAdapter,
  resolveMetricsAdapter,
} from "@/lib/marketing/performance/adapters/createMetricsAdapter";
import { listPlatformReadMetricsCapabilities } from "@/lib/marketing/performance/capabilityMatrix";
import {
  buildManualPerformanceReference,
  evaluateManualPublicationEligibility,
} from "@/lib/marketing/performance/eligibility";
import {
  buildCollectionId,
  buildLogicalObservationKey,
} from "@/lib/marketing/performance/idempotency";
import {
  deriveNormalizedPerformanceFeatures,
  deriveSampleQuality,
} from "@/lib/marketing/performance/normalizeFeatures";
import type { ContentPerformanceRepository } from "@/lib/marketing/performance/repository/contracts";
import { metricsFromCollection } from "@/lib/marketing/performance/repository/inMemoryContentPerformanceRepository";
import type {
  ContentPerformanceSnapshot,
  ManualPerformanceReference,
  PerformanceCollectionRequest,
  PerformanceCollectionResult,
} from "@/lib/marketing/performance/types";
import type { CompletedMarketingCandidate } from "@/lib/marketing/cron/daily/types";
import type { HumanMarketingReview } from "@/lib/marketing/review/types";
import { resolvePlatformChannel } from "@/lib/marketing/performance/capabilityMatrix";
import { logPerformanceCollectionEvent } from "@/lib/marketing/performance/observability";

export type ManualPublicationCollectionDeps = {
  repository: ContentPerformanceRepository;
  adapters?: PerformanceMetricsAdapter[];
  now?: () => Date;
};

function deriveContentOrigin(review: HumanMarketingReview): "ai_unchanged" | "human_edited" {
  return review.humanEditedAfterGovernance ? "human_edited" : "ai_unchanged";
}

function mapDataAvailability(status: PerformanceCollectionResult["status"]): ContentPerformanceSnapshot["dataAvailability"] {
  if (status === "success") return "available";
  if (status === "partial") return "partial";
  return "unavailable";
}

function hasMetricValues(metrics: PerformanceCollectionResult["metrics"]): boolean {
  return Object.values(metrics).some((value) => value != null && Number.isFinite(value));
}

export class ManualPublicationPerformanceCollectionService {
  private readonly adapters: PerformanceMetricsAdapter[];

  constructor(private readonly deps: ManualPublicationCollectionDeps) {
    this.adapters =
      deps.adapters ??
      createMetricsAdapterRegistry(
        listPlatformReadMetricsCapabilities().map((cap) => createStubMetricsAdapter(cap.platform)),
      );
  }

  private now(): Date {
    return this.deps.now?.() ?? new Date();
  }

  buildReferenceFromReview(
    review: HumanMarketingReview,
    createdAt?: string,
  ): ManualPerformanceReference | null {
    if (!review.manualPublication) return null;
    return buildManualPerformanceReference({
      candidateId: review.candidateId,
      reviewId: review.reviewId,
      manualPublication: review.manualPublication,
      humanEditedAfterGovernance: review.humanEditedAfterGovernance,
      createdAt: createdAt ?? this.now().toISOString(),
    });
  }

  async collectPerformanceForManualPublication(input: {
    review: HumanMarketingReview;
    candidate: CompletedMarketingCandidate;
    correlationId?: string | null;
  }): Promise<{
    reference: ManualPerformanceReference | null;
    eligibility: ReturnType<typeof evaluateManualPublicationEligibility>;
    request?: PerformanceCollectionRequest;
    result?: PerformanceCollectionResult;
    snapshot?: ContentPerformanceSnapshot;
    idempotentReuse?: boolean;
  }> {
    const eligibility = evaluateManualPublicationEligibility(input.review.manualPublication);
    const reference = this.buildReferenceFromReview(input.review);
    if (!reference || eligibility.status !== "eligible") {
      logPerformanceCollectionEvent({
        candidateId: input.review.candidateId,
        reviewId: input.review.reviewId,
        platform: eligibility.platform ?? input.review.manualPublication?.platform ?? "unknown",
        collectionStatus: eligibility.status === "unsupported_provider" ? "unsupported" : "insufficient_reference",
        failureReason: eligibility.reason,
        contentOrigin: deriveContentOrigin(input.review),
      });
      return { reference, eligibility };
    }

    const collectionId = buildCollectionId();
    const requestedAt = this.now().toISOString();
    const request: PerformanceCollectionRequest = {
      contract: "performance-collection-request-v1",
      collectionId,
      candidateId: reference.candidateId,
      reviewId: reference.reviewId,
      platform: reference.platform,
      externalPostId: reference.externalPostId,
      externalUrl: reference.externalUrl,
      publishedAt: reference.publishedAt,
      requestedAt,
      correlationId: input.correlationId ?? null,
    };

    const logicalObservationKey = buildLogicalObservationKey({
      candidateId: reference.candidateId,
      reviewId: reference.reviewId,
      platform: reference.platform,
      externalPostId: reference.externalPostId,
      externalUrl: reference.externalUrl,
      observedAt: requestedAt,
    });

    const existing = await this.deps.repository.findByLogicalObservationKey(logicalObservationKey);
    if (existing) {
      logPerformanceCollectionEvent({
        candidateId: reference.candidateId,
        reviewId: reference.reviewId,
        platform: reference.platform,
        collectionStatus: existing.collectionStatus,
        snapshotId: existing.snapshotId,
        contentOrigin: existing.contentOrigin,
        idempotentReuse: true,
      });
      return {
        reference,
        eligibility,
        request,
        result: {
          contract: "performance-collection-result-v1",
          collectionId,
          status: existing.collectionStatus,
          observedAt: existing.observedAt,
          metrics: existing.metrics,
        },
        snapshot: existing,
        idempotentReuse: true,
      };
    }

    const adapter = resolveMetricsAdapter(this.adapters, request);
    const result: PerformanceCollectionResult = adapter
      ? await adapter.collect(request)
      : {
          contract: "performance-collection-result-v1",
          collectionId,
          status: "unsupported",
          observedAt: requestedAt,
          metrics: {},
          reason: "no_metrics_adapter",
        };

    const channel = resolvePlatformChannel(reference.platform) ?? reference.platform;
    const normalizedMetrics =
      hasMetricValues(result.metrics)
        ? deriveNormalizedPerformanceFeatures(result.metrics, result.observedAt, reference.publishedAt)
        : null;
    const sampleQuality = deriveSampleQuality(result.status, normalizedMetrics?.ageHoursAtObservation ?? null);

    const snapshot = await this.deps.repository.save({
      snapshot: {
        collectionId,
        logicalObservationKey,
        candidateId: reference.candidateId,
        humanReviewId: reference.reviewId,
        platform: reference.platform,
        channel,
        externalPostId: reference.externalPostId,
        externalUrl: reference.externalUrl,
        publishedAt: reference.publishedAt,
        publicationSource: "manual",
        contentOrigin: deriveContentOrigin(input.review),
        collectionStatus: result.status,
        observedAt: result.observedAt,
        dataAvailability: mapDataAvailability(result.status),
        topic: input.candidate.selectedAgenda.title,
        destinations: input.candidate.selectedAgenda.destinations ?? [],
        format: input.candidate.contentPlan?.recommendedFormats?.[0]?.format ?? input.candidate.draft.channel,
        commercialIntent:
          input.candidate.selectedAgenda.commercialIntent ??
          input.candidate.contentAssignment.commercialIntent ??
          null,
        productLinked: (input.candidate.contentAssignment.matchedProductIds ?? []).length > 0,
        sampleQuality,
        reason: result.reason ?? null,
      },
      metrics: hasMetricValues(result.metrics) ? metricsFromCollection(result.metrics) : [],
    });

    logPerformanceCollectionEvent({
      collectionId,
      candidateId: snapshot.candidateId,
      reviewId: snapshot.humanReviewId,
      platform: snapshot.platform,
      adapter: adapter?.platform ?? null,
      collectionStatus: snapshot.collectionStatus,
      snapshotId: snapshot.snapshotId,
      metricNamesAvailable: Object.keys(snapshot.metrics).filter((k) => snapshot.metrics[k as keyof typeof snapshot.metrics] != null),
      collectedAt: snapshot.observedAt,
      correlationId: input.correlationId ?? null,
      failureReason: result.reason ?? null,
      contentOrigin: snapshot.contentOrigin,
    });

    return { reference, eligibility, request, result, snapshot };
  }
}

export async function createManualPublicationPerformanceCollectionService(
  deps: Partial<ManualPublicationCollectionDeps> = {},
): Promise<ManualPublicationPerformanceCollectionService> {
  const { createContentPerformanceRepository } = await import(
    "@/lib/marketing/performance/repository/createContentPerformanceRepository"
  );
  const repository = deps.repository ?? (await createContentPerformanceRepository());
  return new ManualPublicationPerformanceCollectionService({ ...deps, repository });
}
