import { createEnvCredentialResolver } from "@/ai-runtime/adapters/env-credential-resolver";
import type { CredentialEnvSource } from "@/ai-runtime/adapters/credential-resolver";
import type { ProviderExecutionContext } from "@/ai-runtime/adapters/types";
import { createDefaultAiRuntimeRegistry } from "@/ai-runtime/registry/registry";
import { createInMemoryUsageLedger } from "@/ai-runtime/quota/usage-ledger";
import { createInMemoryQuotaBroker } from "@/ai-runtime/quota/quota-broker";
import { createHeuristicTokenEstimator } from "@/ai-runtime/tokens";
import { createFallbackRuntimeRouter } from "@/ai-runtime/router";
import { createRuntimeScheduler } from "@/ai-runtime/scheduler";
import { createRuntimeExecutor, type SchedulerRuntimeExecutor } from "@/ai-runtime/integration/runtime-executor";
import type { UsageLedgerAggregation } from "@/ai-runtime/quota";
import type { QuotaBroker } from "@/ai-runtime/quota/broker-types";
import type { RuntimeScheduler } from "@/ai-runtime/scheduler";

export type CreateRuntimeExecutorStackOptions = {
  env?: CredentialEnvSource;
  now?: () => Date;
};

export type RuntimeExecutorStackObservability = {
  scheduler: RuntimeScheduler;
  ledger: UsageLedgerAggregation;
  quotaBroker: QuotaBroker;
};

let lastRuntimeExecutorStackObservability: RuntimeExecutorStackObservability | null = null;

/** Read-only peek for ops/cron telemetry — not for production routing decisions. */
export function peekRuntimeExecutorStackObservability(): RuntimeExecutorStackObservability | null {
  return lastRuntimeExecutorStackObservability;
}

export function resetRuntimeExecutorStackObservabilityForTests(): void {
  lastRuntimeExecutorStackObservability = null;
}

/**
 * Wires Registry → Router → Scheduler → RuntimeExecutor for integration callers.
 * Cron/scripts should use RuntimeExecutor only — not import this stack directly when avoidable.
 */
export function createRuntimeExecutorStack(
  options: CreateRuntimeExecutorStackOptions = {},
): SchedulerRuntimeExecutor {
  const now = options.now ?? (() => new Date());
  const ledger = createInMemoryUsageLedger({ now });
  const quotaBroker = createInMemoryQuotaBroker({ ledger, now });
  const registry = createDefaultAiRuntimeRegistry();
  const tokenEstimator = createHeuristicTokenEstimator();
  const router = createFallbackRuntimeRouter({
    registry,
    tokenEstimator,
    quotaBroker,
    usageLedger: ledger,
    now,
  });
  const context: ProviderExecutionContext = {
    credentialResolver: createEnvCredentialResolver({ env: options.env }),
  };
  const scheduler = createRuntimeScheduler({
    router,
    context,
    now,
  });
  lastRuntimeExecutorStackObservability = { scheduler, ledger, quotaBroker };
  return createRuntimeExecutor({ scheduler });
}
