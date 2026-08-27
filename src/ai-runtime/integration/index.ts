export type {
  RuntimeRequestFactoryInput,
  RuntimeRequestFactoryOptions,
  RuntimeSubmission,
  RuntimeExecutionResult,
  RuntimeExecutor,
  RuntimeInteractiveExecutor,
  RuntimeAwaitOptions,
  IntegrationExecutionMode,
  IntegrationPathClassification,
} from "@/ai-runtime/integration/types";

export {
  createRuntimeRequest,
  createCronRuntimeRequest,
  createHandoffRuntimeRequest,
  createDepartmentRuntimeRequest,
  createInteractiveRuntimeRequest,
} from "@/ai-runtime/integration/runtime-request-factory";

export {
  SchedulerRuntimeExecutor,
  createRuntimeExecutor,
  getDefaultRuntimeExecutor,
  initializeDefaultRuntimeExecutor,
  resetDefaultRuntimeExecutorForTests,
  type SchedulerRuntimeExecutorDeps,
} from "@/ai-runtime/integration/runtime-executor";

export {
  DEFAULT_RUNTIME_COMPLETION_TIMEOUT_MS,
  RUNTIME_COMPLETION_POLL_INTERVAL_MS,
  AI_RUNTIME_MARKETING_CRON_ENABLED_ENV,
} from "@/ai-runtime/integration/constants";

export {
  isTerminalJobStatus,
  schedulerJobToExecutionResult,
  timeoutExecutionResult,
} from "@/ai-runtime/integration/completion";

export {
  createRuntimeExecutorStack,
  type CreateRuntimeExecutorStackOptions,
} from "@/ai-runtime/integration/runtime-stack";

/**
 * Integration layer contract:
 * - Callers build Agent context / messages upstream.
 * - RuntimeRequestFactory normalizes to RuntimeRequest (no provider/model).
 * - RuntimeExecutor submits to Scheduler (no Router/Broker internals).
 * - Provider SDK imports belong in adapters only — not here.
 */
