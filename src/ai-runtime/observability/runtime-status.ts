import { WORKLOAD_CLASSES, type WorkloadClass } from "@/ai-runtime/domain/workload";
import type { ModelDefinition } from "@/ai-runtime/domain/model";
import type { ProviderDefinition } from "@/ai-runtime/domain/provider";
import { createDefaultProviderAdapters } from "@/ai-runtime/adapters/resolver";
import { CREDENTIAL_REF_ENV_CANDIDATES } from "@/ai-runtime/adapters/credential-resolver";
import type { CredentialEnvSource } from "@/ai-runtime/adapters/credential-resolver";
import { createDefaultAiRuntimeRegistry } from "@/ai-runtime/registry/registry";
import {
  buildModelQuotaState,
  buildProviderQuotaState,
  getDefaultUsageLedger,
  type UsageLedgerAggregation,
} from "@/ai-runtime/quota";
import type { QuotaBroker, QuotaReservationSnapshot } from "@/ai-runtime/quota/broker-types";
import { getDefaultQuotaBroker } from "@/ai-runtime/quota/quota-broker";
import {
  formatWorkloadPolicyOrder,
  getDefaultRoutingLedger,
  PROVIDER_DISPLAY_LABELS,
} from "@/ai-runtime/router";
import type { RoutingLedger } from "@/ai-runtime/router/routing-ledger";
import type { RuntimeScheduler } from "@/ai-runtime/scheduler";
import type { RuntimeQuotaState } from "@/ai-runtime/quota/types";
import { getRuntimeEnvBag } from "@/lib/runtimeEnvStore";
import type {
  AdapterReadiness,
  RuntimeModelStatusDto,
  RuntimeProviderStatusDto,
  RuntimeQuotaSnapshotDto,
  RuntimeReservationSnapshotDto,
  RuntimeRoutingPolicyDto,
  RuntimeRoutingStatusDto,
  RuntimeSchedulerStatusDto,
  RuntimeStatusDto,
} from "@/ai-runtime/observability/types";

export type BuildRuntimeStatusOptions = {
  env?: CredentialEnvSource;
  now?: () => Date;
  ledger?: UsageLedgerAggregation;
  quotaBroker?: QuotaBroker;
  routingLedger?: RoutingLedger;
  scheduler?: RuntimeScheduler;
  /** Injected shared telemetry (tests / preloaded). */
  shared?: import("@/ai-runtime/observability/persistence").SharedRuntimeTelemetryDto;
};

function toReservationSnapshot(snapshot: QuotaReservationSnapshot): RuntimeReservationSnapshotDto {
  return { ...snapshot };
}

function toQuotaSnapshot(state: RuntimeQuotaState): RuntimeQuotaSnapshotDto {
  return {
    health: state.health,
    minuteRequests: state.minute.requests,
    minuteTokens: state.minute.tokensKnown ? state.minute.tokens : undefined,
    minuteTokensKnown: state.minute.tokensKnown,
    dayRequests: state.day.requests,
    dayTokens: state.day.tokensKnown ? state.day.tokens : undefined,
    dayTokensKnown: state.day.tokensKnown,
    configured: state.configured
      ? {
          rpm: state.configured.rpm,
          tpm: state.configured.tpm,
          rpd: state.configured.rpd,
          tpd: state.configured.tpd,
        }
      : undefined,
    observed: state.observed
      ? {
          limitRequests: state.observed.limitRequests,
          remainingRequests: state.observed.remainingRequests,
          limitTokens: state.observed.limitTokens,
          remainingTokens: state.observed.remainingTokens,
          resetRequestsAt: state.observed.resetRequestsAt,
          resetTokensAt: state.observed.resetTokensAt,
        }
      : undefined,
    retryAfterMs: state.retryAfterMs,
    blockedUntil: state.blockedUntil,
  };
}

/**
 * Request-time credential presence from the provided env bag only.
 * Callers (Admin status route) must pass getRuntimeEnvBag() after ensureRuntimeEnv().
 */
export function evaluateCredentialConfigured(
  credentialRef: string | undefined,
  env: CredentialEnvSource,
): boolean {
  if (!credentialRef?.trim()) return false;
  const candidates = CREDENTIAL_REF_ENV_CANDIDATES[credentialRef];
  if (!candidates?.length) return false;
  return candidates.some((name) => {
    try {
      const fromBag = env[name];
      return typeof fromBag === "string" && Boolean(fromBag.trim());
    } catch {
      // Next process.env proxies can throw on some keys
      return false;
    }
  });
}

function isCredentialConfigured(
  credentialRef: string | undefined,
  env: CredentialEnvSource,
): boolean {
  return evaluateCredentialConfigured(credentialRef, env);
}

function adapterReadinessForProvider(
  providerId: string,
  adapterIds: ReadonlySet<string>,
): AdapterReadiness {
  return adapterIds.has(providerId) ? "ready" : "unavailable";
}

function toModelStatus(
  model: ModelDefinition,
  providerEnabled: boolean,
  ledger: UsageLedgerAggregation,
  now: () => Date,
  quotaBroker: QuotaBroker,
): RuntimeModelStatusDto {
  const routingEnabled = model.routing.enabled;
  const eligible = providerEnabled && routingEnabled;
  const quotaState = buildModelQuotaState(model.providerId, model.id, { ledger, now });
  const reservation = quotaBroker.getReservationSnapshot({
    providerId: model.providerId,
    modelId: model.id,
  });
  return {
    id: model.id,
    displayName: model.displayName,
    modelSlug: model.modelId,
    routingEnabled,
    eligible,
    workloads: [...model.routing.workloadClasses],
    providerManaged: model.metadata?.routingMode === "provider-managed",
    freeTierEligible: model.economics.freeTierEligible === true,
    quota: toQuotaSnapshot(quotaState),
    reservation: toReservationSnapshot(reservation),
  };
}

function toProviderStatus(
  provider: ProviderDefinition,
  models: ModelDefinition[],
  adapterIds: ReadonlySet<string>,
  env: CredentialEnvSource,
  ledger: UsageLedgerAggregation,
  now: () => Date,
  quotaBroker: QuotaBroker,
): RuntimeProviderStatusDto {
  const providerModels = models.filter((model) => model.providerId === provider.id);
  const disabledReason =
    !provider.enabled && provider.metadata?.statusReason
      ? provider.metadata.statusReason
      : !provider.enabled
        ? "Provider disabled in registry"
        : undefined;

  const quotaState = buildProviderQuotaState(provider.id, { ledger, now });
  const reservation = quotaBroker.getReservationSnapshot({ providerId: provider.id });

  return {
    id: provider.id,
    displayName: provider.displayName,
    kind: provider.kind,
    enabled: provider.enabled,
    adapterReadiness: adapterReadinessForProvider(provider.id, adapterIds),
    credentialConfigured: isCredentialConfigured(provider.credentialRef, env),
    disabledReason,
    registeredModelCount: providerModels.length,
    models: providerModels.map((model) =>
      toModelStatus(model, provider.enabled, ledger, now, quotaBroker),
    ),
    quota: toQuotaSnapshot(quotaState),
    reservation: toReservationSnapshot(reservation),
  };
}

/**
 * Builds a read-only runtime status snapshot for admin UI.
 * Uses Registry + Adapter resolver + env presence only — no live API calls.
 */
export function buildRuntimeStatus(options: BuildRuntimeStatusOptions = {}): RuntimeStatusDto {
  const env = options.env ?? getRuntimeEnvBag();
  const now = options.now ?? (() => new Date());
  const ledger = options.ledger ?? getDefaultUsageLedger();
  const quotaBroker = options.quotaBroker ?? getDefaultQuotaBroker(ledger);
  const registry = createDefaultAiRuntimeRegistry();
  const adapterIds = new Set(createDefaultProviderAdapters().keys());

  const providers = registry.listProviders();
  const models = registry.listModels();

  const providerStatuses = providers.map((provider) =>
    toProviderStatus(provider, models, adapterIds, env, ledger, now, quotaBroker),
  );

  const reservationSummary = quotaBroker.getReservationSnapshot();
  const routingLedger = options.routingLedger ?? getDefaultRoutingLedger();
  const routingSnapshot = routingLedger.snapshot(now());

  const routing: RuntimeRoutingStatusDto = {
    lastHourRequests: routingSnapshot.lastHourRequests,
    fallbackCount: routingSnapshot.fallbackCount,
    fallbackRate: routingSnapshot.fallbackRate,
    providerSelections: Object.fromEntries(
      Object.entries(routingSnapshot.providerSelections).map(([providerId, count]) => [
        PROVIDER_DISPLAY_LABELS[providerId] ?? providerId,
        count,
      ]),
    ),
    recent: routingSnapshot.recent,
  };

  const routingPolicies: RuntimeRoutingPolicyDto[] = WORKLOAD_CLASSES.map((workload) => ({
    workload,
    orderLabels: formatWorkloadPolicyOrder(workload),
  }));

  const schedulerSnapshot = options.scheduler?.snapshot(now());
  const scheduler: RuntimeSchedulerStatusDto | undefined = schedulerSnapshot
    ? {
        queued: schedulerSnapshot.queued,
        runnable: schedulerSnapshot.runnable,
        deferred: schedulerSnapshot.deferred,
        running: schedulerSnapshot.running,
        completedLastHour: schedulerSnapshot.completedLastHour,
        failedLastHour: schedulerSnapshot.failedLastHour,
        cancelled: schedulerSnapshot.cancelled,
        recent: schedulerSnapshot.recent.map((job) => ({
          jobId: job.jobId,
          agentId: job.agentId,
          source: job.source,
          workload: job.workload,
          priority: job.priority,
          status: job.status,
          attempts: job.attempts,
          queuedAt: job.queuedAt,
          availableAt: job.availableAt,
          startedAt: job.startedAt,
          completedAt: job.completedAt,
          lastErrorCode: job.lastErrorCode,
          deferReason: job.deferReason,
          correlationId: job.correlationId,
          cronJobId: job.cronJobId,
        })),
      }
    : undefined;

  const summary = {
    enabledProviders: providerStatuses.filter((provider) => provider.enabled).length,
    disabledProviders: providerStatuses.filter((provider) => !provider.enabled).length,
    registeredModels: models.length,
    adaptersReady: providerStatuses.filter((provider) => provider.adapterReadiness === "ready")
      .length,
    activeReservations: reservationSummary.activeReservations,
  };

  return {
    generatedAt: now().toISOString(),
    summary,
    routing,
    routingPolicies,
    scheduler,
    providers: providerStatuses,
    shared: options.shared,
  };
}

/**
 * Merges process-local live state with shared PostgreSQL telemetry.
 * DB unreadability → shared.available=false; never throws.
 */
export async function buildRuntimeStatusWithShared(
  options: BuildRuntimeStatusOptions & {
    repository?: import("@/ai-runtime/observability/persistence").RuntimeObservabilityRepository | null;
  } = {},
): Promise<RuntimeStatusDto> {
  const now = options.now ?? (() => new Date());
  let shared = options.shared;

  if (!shared) {
    try {
      const { resolveRuntimeObservabilityRepository } = await import(
        "@/ai-runtime/observability/persistence/repository"
      );
      const repo =
        options.repository === undefined
          ? await resolveRuntimeObservabilityRepository({ env: options.env as Record<string, string | undefined> | undefined })
          : options.repository;
      if (repo) {
        shared = await repo.loadSharedTelemetry(now());
      } else {
        shared = {
          available: false,
          lastHour: { requests: 0, completed: 0, failed: 0, fallbacks: 0, providerCalls: 0 },
          providerUsage: [],
          recentJobs: [],
          recentRoutes: [],
        };
      }
    } catch {
      shared = {
        available: false,
        lastHour: { requests: 0, completed: 0, failed: 0, fallbacks: 0, providerCalls: 0 },
        providerUsage: [],
        recentJobs: [],
        recentRoutes: [],
      };
    }
  }

  // Explicit field forward — never drop `env` via partial spreads / defaults.
  return buildRuntimeStatus({
    env: options.env,
    now: options.now,
    ledger: options.ledger,
    quotaBroker: options.quotaBroker,
    routingLedger: options.routingLedger,
    scheduler: options.scheduler,
    shared,
  });
}

/** Workloads with at least one eligible enabled model (for display helpers). */
export function listWorkloadsWithEligibleModels(
  status: RuntimeStatusDto,
): WorkloadClass[] {
  const eligible = new Set<WorkloadClass>();
  for (const provider of status.providers) {
    if (!provider.enabled) continue;
    for (const model of provider.models) {
      if (!model.eligible) continue;
      for (const workload of model.workloads) {
        eligible.add(workload);
      }
    }
  }
  return WORKLOAD_CLASSES.filter((workload) => eligible.has(workload));
}
