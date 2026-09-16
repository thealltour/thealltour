/**
 * Real marketing_agenda_transformer invoke builder.
 * Uses roleKey routing — NOT Content Strategist / MM / Story Editor identity.
 */

import {
  createCronRuntimeRequest,
  type RuntimeExecutor,
} from "@/ai-runtime/integration";
import {
  MARKETING_CRON_JOB_ID,
  MARKETING_DEPARTMENT_ID,
} from "@/lib/marketing/cron/marketingPlanSpecialists";
import { MARKETING_AGENDA_TRANSFORMER_ROLE_KEY } from "@/lib/marketing/agendaQualityV2/transformer/prompt";
import type { AgendaTransformInvoke } from "@/lib/marketing/agendaQualityV2/transformer/transform";
import { resolveModelRoute } from "@/ai-runtime/router/role-routes";

export type CreateMarketingAgendaTransformerInvokeOptions = {
  executor: RuntimeExecutor;
  correlationId?: string;
  completionTimeoutMs?: number;
  now?: () => Date;
};

export type MarketingAgendaTransformerInvokeMeta = {
  roleKey: typeof MARKETING_AGENDA_TRANSFORMER_ROLE_KEY;
  routeSource: string;
  modelIds: readonly string[];
};

export function getMarketingAgendaTransformerRouteMeta(): MarketingAgendaTransformerInvokeMeta {
  const resolved = resolveModelRoute({
    role: MARKETING_AGENDA_TRANSFORMER_ROLE_KEY,
    workload: "reasoning",
  });
  return {
    roleKey: MARKETING_AGENDA_TRANSFORMER_ROLE_KEY,
    routeSource: resolved.routeSource,
    modelIds: resolved.modelIds,
  };
}

/**
 * Build an AgendaTransformInvoke that calls AI Runtime with roleKey=marketing_agenda_transformer.
 * System+user are concatenated into a single user message (cron pattern) with system prefix.
 */
export function createMarketingAgendaTransformerInvoke(
  options: CreateMarketingAgendaTransformerInvokeOptions,
): AgendaTransformInvoke {
  const executor = options.executor;
  const now = options.now ?? (() => new Date());
  const timeoutMs = options.completionTimeoutMs;
  const routeMeta = getMarketingAgendaTransformerRouteMeta();

  return async (params) => {
    if (params.roleKey !== MARKETING_AGENDA_TRANSFORMER_ROLE_KEY) {
      throw new Error(`unexpected roleKey: ${params.roleKey}`);
    }
  const started = Date.now();
  void started;
  const content = `${params.system}\n\n---\n\n${params.user}`;
    const request = createCronRuntimeRequest(
      {
        agentId: "content-strategist",
        workload: "reasoning",
        priority: "background",
        messages: [{ role: "user", content }],
        correlationId: options.correlationId,
        cronJobId: MARKETING_CRON_JOB_ID,
        departmentId: MARKETING_DEPARTMENT_ID,
        roleKey: MARKETING_AGENDA_TRANSFORMER_ROLE_KEY,
        routing: { requiresStructuredOutput: true },
      },
      { now },
    );
    const result = await executor.executeAndWait(request, { timeoutMs, now });
    if (result.status !== "completed" || !result.response?.content) {
      const code = result.error?.code ?? result.status;
      throw new Error(`marketing_agenda_transformer runtime failed: ${code}`);
    }
    return {
      text: result.response.content,
      modelId: result.response.modelId ?? routeMeta.modelIds[0] ?? null,
      routeSource: routeMeta.routeSource,
      provider: result.response.providerId ?? null,
    };
  };
}

/** Test/deps override: wrap a plain text invoker with role metadata. */
export function createInjectableAgendaTransformerInvoke(
  invokeText: (system: string, user: string) => Promise<string> | string,
  meta?: { modelId?: string; provider?: string; routeSource?: string },
): AgendaTransformInvoke {
  return async (params) => {
    const text = await Promise.resolve(invokeText(params.system, params.user));
    return {
      text,
      modelId: meta?.modelId ?? "test-model",
      routeSource: meta?.routeSource ?? "role_override",
      provider: meta?.provider ?? "test",
    };
  };
}
