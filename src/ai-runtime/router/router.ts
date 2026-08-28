import type { RuntimeRequest } from "@/ai-runtime/domain/request";
import { RuntimeError } from "@/ai-runtime/domain/error";
import type { RuntimeResponse, RuntimeRouteAttempt } from "@/ai-runtime/domain/response";
import type { ProviderExecutionContext } from "@/ai-runtime/adapters/types";
import { getProviderAdapter } from "@/ai-runtime/adapters/resolver";
import type { AiRuntimeRegistry } from "@/ai-runtime/registry/registry";
import type { QuotaBroker } from "@/ai-runtime/quota/broker-types";
import type { UsageLedgerAggregation } from "@/ai-runtime/quota/usage-ledger";
import type { TokenEstimator } from "@/ai-runtime/tokens/types";
import { buildRoutingCandidates, uniqueCandidatesByModel } from "@/ai-runtime/router/candidate-builder";
import {
  attemptCandidateExecution,
  isFallbackableProviderError,
  shouldSkipProviderOnError,
} from "@/ai-runtime/router/execute-routed";
import { WORKLOAD_FALLBACK_ORDER } from "@/ai-runtime/router/policies";
import { getDefaultRoutingLedger, type RoutingLedger } from "@/ai-runtime/router/routing-ledger";
import type { RuntimeRoutingDecision } from "@/ai-runtime/router/types";
import { isSpikeGatewayAgentId } from "@/ai-runtime/gateway/alias-registry";
import { SPIKE_FORCE_FALLBACK_DETAIL } from "@/ai-runtime/integration/constants";

export type RuntimeRouterDependencies = {
  registry: AiRuntimeRegistry;
  tokenEstimator: TokenEstimator;
  quotaBroker: QuotaBroker;
  usageLedger: UsageLedgerAggregation;
  routingLedger?: RoutingLedger;
  now?: () => Date;
  getAdapter?: (providerId: string) => ReturnType<typeof getProviderAdapter>;
  /** Best-effort shared telemetry — route_completed / route_failed only. */
  observability?: import("@/ai-runtime/observability/persistence").RuntimeObservabilityRecorder;
};

export interface RuntimeRouter {
  route(request: RuntimeRequest, context: ProviderExecutionContext): Promise<RuntimeResponse>;
}

export class FallbackRuntimeRouter implements RuntimeRouter {
  private readonly deps: RuntimeRouterDependencies & { routingLedger: RoutingLedger };

  constructor(deps: RuntimeRouterDependencies) {
    this.deps = {
      ...deps,
      routingLedger: deps.routingLedger ?? getDefaultRoutingLedger(),
    };
  }

  private now(): Date {
    return this.deps.now?.() ?? new Date();
  }

  async route(request: RuntimeRequest, context: ProviderExecutionContext): Promise<RuntimeResponse> {
    const correlationId = request.metadata?.correlationId;
    const candidates = uniqueCandidatesByModel(
      buildRoutingCandidates({
        request,
        registry: this.deps.registry,
        ledger: this.deps.usageLedger,
        now: () => this.now(),
      }),
    );

    const decision: RuntimeRoutingDecision = {
      requestId: request.id,
      workload: request.workload,
      priority: request.priority,
      candidates: candidates.map((candidate) => ({
        providerId: candidate.model.providerId,
        modelId: candidate.model.id,
        score: candidate.score,
        quotaHealth: candidate.quotaHealth,
      })),
      fallbackUsed: false,
      attemptCount: 0,
    };

    if (candidates.length === 0) {
      this.recordLedger(request, decision, "failed", "MODEL_UNAVAILABLE", 0, false);
      throw new RuntimeError("MODEL_UNAVAILABLE", "No eligible models for workload", false);
    }

    const attempts: RuntimeRouteAttempt[] = [];
    const triedModels = new Set<string>();
    const skippedProviders = new Set<string>();
    let shortestRetryAfter: number | undefined;
    let spikeForceFallbackPending =
      isSpikeGatewayAgentId(request.agentId) && request.metadata?.spikeForceFallback === true;

    const getAdapter = this.deps.getAdapter ?? getProviderAdapter;
    const fallbackPolicies = WORKLOAD_FALLBACK_ORDER[request.workload];

    for (const candidate of candidates) {
      if (triedModels.has(candidate.model.id)) continue;
      if (skippedProviders.has(candidate.model.providerId)) continue;
      if (attempts.length >= candidates.length) break;

      triedModels.add(candidate.model.id);
      const attemptStartedAt = this.now().toISOString();
      decision.attemptCount += 1;

      // Spike-only: fail first candidate before adapter/credentials/inference.
      if (spikeForceFallbackPending) {
        spikeForceFallbackPending = false;
        attempts.push({
          providerId: candidate.model.providerId,
          modelId: candidate.model.id,
          startedAt: attemptStartedAt,
          result: "provider_error",
          detail: SPIKE_FORCE_FALLBACK_DETAIL,
        });
        continue;
      }

      let adapter;
      try {
        adapter = getAdapter(candidate.model.providerId);
      } catch (error) {
        attempts.push({
          providerId: candidate.model.providerId,
          modelId: candidate.model.id,
          startedAt: attemptStartedAt,
          result: "provider_error",
          detail: error instanceof RuntimeError ? error.code : "adapter_unavailable",
        });
        continue;
      }

      const result = await attemptCandidateExecution({
        request,
        model: candidate.model,
        adapter,
        context,
        estimator: this.deps.tokenEstimator,
        quotaBroker: this.deps.quotaBroker,
        ledger: this.deps.usageLedger,
        correlationId,
        startedAt: attemptStartedAt,
        observability: this.deps.observability,
      });

      if (result.kind === "success") {
        decision.selectedProviderId = candidate.model.providerId;
        decision.selectedModelId = candidate.model.id;
        decision.fallbackUsed = attempts.length > 0;

        attempts.push({
          providerId: candidate.model.providerId,
          modelId: candidate.model.id,
          startedAt: attemptStartedAt,
          result: "success",
        });

        const response: RuntimeResponse = {
          ...result.response,
          routing: {
            attempts,
            fallbackUsed: decision.fallbackUsed,
          },
        };

        this.recordLedger(
          request,
          decision,
          "success",
          undefined,
          attempts.length,
          decision.fallbackUsed,
        );
        this.deps.observability?.routeCompleted({
          requestId: request.id,
          correlationId: request.metadata?.correlationId,
          agentId: request.agentId,
          source: request.source,
          workload: request.workload,
          priority: request.priority,
          providerId: decision.selectedProviderId,
          modelId: decision.selectedModelId,
          status: "success",
          attemptCount: attempts.length,
          fallbackUsed: decision.fallbackUsed,
          metadata: {
            cronJobId: request.metadata?.cronJobId,
            departmentId: request.metadata?.departmentId,
          },
        });
        return response;
      }

      if (result.kind === "quota_rejected") {
        if (result.retryAfterMs != null) {
          shortestRetryAfter =
            shortestRetryAfter == null
              ? result.retryAfterMs
              : Math.min(shortestRetryAfter, result.retryAfterMs);
        }
        attempts.push({
          providerId: candidate.model.providerId,
          modelId: candidate.model.id,
          startedAt: attemptStartedAt,
          result: result.result,
          detail: result.detail,
        });
        continue;
      }

      if (result.kind === "context_rejected" || result.kind === "invalid_rejected") {
        attempts.push({
          providerId: candidate.model.providerId,
          modelId: candidate.model.id,
          startedAt: attemptStartedAt,
          result: result.result,
          detail: result.detail,
        });
        continue;
      }

      if (result.kind === "provider_error") {
        attempts.push(result.attempt);

        if (shouldSkipProviderOnError(result.error.code)) {
          skippedProviders.add(candidate.model.providerId);
          continue;
        }

        if (!isFallbackableProviderError(result.error.code)) {
          this.recordLedger(request, decision, "failed", result.error.code, attempts.length, attempts.length > 1);
          throw result.error;
        }

        if (result.error.retryAfterMs != null) {
          shortestRetryAfter =
            shortestRetryAfter == null
              ? result.error.retryAfterMs
              : Math.min(shortestRetryAfter, result.error.retryAfterMs);
        }
        continue;
      }
    }

    const onlyContextFailures =
      attempts.length > 0 &&
      attempts.every((attempt) => attempt.detail === "context_exceeded");

    if (onlyContextFailures) {
      this.recordLedger(request, decision, "failed", "CONTEXT_TOO_LARGE", attempts.length, false);
      throw new RuntimeError("CONTEXT_TOO_LARGE", "All candidates exceed context window", false);
    }

    if (fallbackPolicies.includes("queue")) {
      this.recordLedger(request, decision, "failed", "QUOTA_EXHAUSTED", attempts.length, attempts.length > 1);
      throw new RuntimeError(
        "QUOTA_EXHAUSTED",
        "All routing candidates unavailable — queue deferred to scheduler",
        true,
        shortestRetryAfter ?? 60_000,
      );
    }

    this.recordLedger(request, decision, "failed", "QUOTA_EXHAUSTED", attempts.length, attempts.length > 1);
    throw new RuntimeError(
      "QUOTA_EXHAUSTED",
      "All routing candidates unavailable",
      true,
      shortestRetryAfter,
    );
  }

  private recordLedger(
    request: RuntimeRequest,
    decision: RuntimeRoutingDecision,
    finalStatus: "success" | "failed",
    finalErrorCode: string | undefined,
    attemptCount: number,
    fallbackUsed: boolean,
  ): void {
    this.deps.routingLedger.record({
      id: `${request.id}:${this.now().getTime()}`,
      timestamp: this.now().toISOString(),
      requestId: request.id,
      correlationId: request.metadata?.correlationId,
      workload: request.workload,
      priority: request.priority,
      candidateCount: decision.candidates.length,
      attemptCount,
      selectedProviderId: decision.selectedProviderId,
      selectedModelId: decision.selectedModelId,
      fallbackUsed,
      finalStatus,
      finalErrorCode,
    });

    if (finalStatus === "failed") {
      this.deps.observability?.routeFailed({
        requestId: request.id,
        correlationId: request.metadata?.correlationId,
        agentId: request.agentId,
        source: request.source,
        workload: request.workload,
        priority: request.priority,
        providerId: decision.selectedProviderId,
        modelId: decision.selectedModelId,
        status: "failed",
        errorCode: finalErrorCode,
        attemptCount,
        fallbackUsed,
        metadata: {
          cronJobId: request.metadata?.cronJobId,
          departmentId: request.metadata?.departmentId,
        },
      });
    }
  }
}

export function createFallbackRuntimeRouter(deps: RuntimeRouterDependencies): FallbackRuntimeRouter {
  return new FallbackRuntimeRouter(deps);
}
