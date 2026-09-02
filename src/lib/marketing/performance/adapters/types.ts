import type {
  PerformanceCollectionRequest,
  PerformanceCollectionResult,
} from "@/lib/marketing/performance/types";

/**
 * Read-only metrics adapter — no publish/comment/DM/like/follow/mutate methods.
 */
export type PerformanceMetricsAdapter = {
  readonly kind: "performance_metrics_adapter";
  readonly platform: string;
  canHandle(request: PerformanceCollectionRequest): boolean;
  collect(request: PerformanceCollectionRequest): Promise<PerformanceCollectionResult>;
};

export function assertReadOnlyMetricsAdapter(adapter: PerformanceMetricsAdapter): void {
  if (adapter.kind !== "performance_metrics_adapter") {
    throw new Error("Invalid PerformanceMetricsAdapter kind");
  }
  const record = adapter as PerformanceMetricsAdapter & Record<string, unknown>;
  for (const forbidden of [
    "publish",
    "delete",
    "comment",
    "message",
    "like",
    "follow",
    "unfollow",
    "mutateAccount",
    "send",
    "post",
  ]) {
    if (typeof record[forbidden] === "function") {
      throw new Error(`PerformanceMetricsAdapter must not expose ${forbidden}`);
    }
  }
}
