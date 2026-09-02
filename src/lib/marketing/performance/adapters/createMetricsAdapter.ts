import type { PerformanceMetricsAdapter } from "@/lib/marketing/performance/adapters/types";
import type {
  PerformanceCollectionRequest,
  PerformanceCollectionResult,
} from "@/lib/marketing/performance/types";
import { getPlatformReadMetricsCapability } from "@/lib/marketing/performance/capabilityMatrix";

export function createStubMetricsAdapter(platform: string): PerformanceMetricsAdapter {
  const normalized = platform.trim().toLowerCase();
  return {
    kind: "performance_metrics_adapter",
    platform: normalized,
    canHandle(request: PerformanceCollectionRequest) {
      return request.platform.trim().toLowerCase() === normalized;
    },
    async collect(request: PerformanceCollectionRequest): Promise<PerformanceCollectionResult> {
      const capability = getPlatformReadMetricsCapability(normalized);
      const observedAt = new Date().toISOString();

      if (!capability) {
        return {
          contract: "performance-collection-result-v1",
          collectionId: request.collectionId,
          status: "unsupported",
          observedAt,
          metrics: {},
          reason: "platform_not_in_capability_matrix",
        };
      }

      if (capability.implementationState !== "supported") {
        return {
          contract: "performance-collection-result-v1",
          collectionId: request.collectionId,
          status: capability.credentialRequired ? "auth_required" : "unsupported",
          observedAt,
          metrics: {},
          reason: `our_current_read_capability_${capability.implementationState}`,
          providerMetadata: {
            metricsSupport: capability.metricsSupport,
            officialApi: capability.officialApi,
          },
        };
      }

      return {
        contract: "performance-collection-result-v1",
        collectionId: request.collectionId,
        status: "unsupported",
        observedAt,
        metrics: {},
        reason: "live_read_not_implemented",
      };
    },
  };
}

export function createMockSuccessMetricsAdapter(
  platform: string,
  metrics: PerformanceCollectionResult["metrics"],
): PerformanceMetricsAdapter {
  const normalized = platform.trim().toLowerCase();
  return {
    kind: "performance_metrics_adapter",
    platform: normalized,
    canHandle(request: PerformanceCollectionRequest) {
      return request.platform.trim().toLowerCase() === normalized;
    },
    async collect(request: PerformanceCollectionRequest): Promise<PerformanceCollectionResult> {
      return {
        contract: "performance-collection-result-v1",
        collectionId: request.collectionId,
        status: "success",
        observedAt: new Date().toISOString(),
        metrics,
      };
    },
  };
}

export function createRateLimitedMetricsAdapter(platform: string): PerformanceMetricsAdapter {
  const normalized = platform.trim().toLowerCase();
  return {
    kind: "performance_metrics_adapter",
    platform: normalized,
    canHandle(request: PerformanceCollectionRequest) {
      return request.platform.trim().toLowerCase() === normalized;
    },
    async collect(request: PerformanceCollectionRequest): Promise<PerformanceCollectionResult> {
      return {
        contract: "performance-collection-result-v1",
        collectionId: request.collectionId,
        status: "rate_limited",
        observedAt: new Date().toISOString(),
        metrics: {},
        reason: "provider_rate_limited",
      };
    },
  };
}

export function createMetricsAdapterRegistry(
  adapters: PerformanceMetricsAdapter[],
): PerformanceMetricsAdapter[] {
  return adapters;
}

export function resolveMetricsAdapter(
  adapters: PerformanceMetricsAdapter[],
  request: PerformanceCollectionRequest,
): PerformanceMetricsAdapter | null {
  return adapters.find((adapter) => adapter.canHandle(request)) ?? null;
}
