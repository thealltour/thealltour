import { randomUUID } from "node:crypto";

import { AI_RUNTIME_MARKETING_CRON_ENABLED_ENV } from "@/ai-runtime/integration/constants";
import {
  createCronRuntimeRequest,
  type RuntimeExecutor,
} from "@/ai-runtime/integration";
import type { HandoffEnvelope } from "@/lib/marketing/bot/organization/envelope";
import type { ContentDraftRequest } from "@/lib/marketing/bot/organization/handoffs";
import type { StructuredGovernanceReviewRequest } from "@/lib/marketing/content/governance/types";
import type { DepartmentPipelineDeps } from "@/lib/marketing/bot/organization/pipeline";
import {
  MARKETING_CRON_JOB_ID,
  MARKETING_DEPARTMENT_ID,
  MARKETING_CRON_SPECIALIST_USES_HERMES_TOOLS,
  buildGovernanceReviewPrompt,
  parseGovernanceAuditorOutput,
  requestContentStrategistDraftWithFormatRetry,
  isContentStrategistFormatError,
} from "@/lib/marketing/cron/marketingPlanSpecialists";
export { MARKETING_CRON_SPECIALIST_USES_HERMES_TOOLS };

export function isAiRuntimeMarketingCronEnabled(
  env: Record<string, string | undefined> = process.env,
): boolean {
  const raw = env[AI_RUNTIME_MARKETING_CRON_ENABLED_ENV]?.trim().toLowerCase();
  return raw === "true" || raw === "1";
}

export function createMarketingCronCorrelationId(now = new Date()): string {
  return `marketing-cron:${now.toISOString()}:${randomUUID().slice(0, 8)}`;
}

export type HermesProfileInvoker = (profile: string, prompt: string) => string;

export type MarketingPlanPipelineDispatchOptions = {
  useRuntime: boolean;
  correlationId: string;
  executor?: Pick<RuntimeExecutor, "executeAndWait">;
  invokeHermesProfile?: HermesProfileInvoker;
  completionTimeoutMs?: number;
  now?: () => Date;
};

function assertRuntimeContent(result: Awaited<ReturnType<RuntimeExecutor["executeAndWait"]>>): string {
  if (result.status !== "completed" || !result.response?.content) {
    const code = result.error?.code ?? "RUNTIME_ERROR";
    throw new Error(`content-strategist runtime failed: ${code}`);
  }
  return result.response.content;
}

function assertRuntimeGovernance(result: Awaited<ReturnType<RuntimeExecutor["executeAndWait"]>>): string {
  if (result.status !== "completed" || !result.response?.content) {
    const code = result.error?.code ?? "RUNTIME_ERROR";
    throw new Error(`governance-auditor runtime failed: ${code}`);
  }
  return result.response.content;
}

/**
 * Builds pipeline draft/governance dispatchers for Marketing Cron.
 * Exactly one of Runtime or Hermes path executes per call — never both.
 */
export function createMarketingPlanPipelineDispatch(
  options: MarketingPlanPipelineDispatchOptions,
): Pick<DepartmentPipelineDeps, "requestDraft" | "requestGovernance"> {
  let lastRequestId: string | undefined;

  if (options.useRuntime) {
    if (!options.executor) {
      throw new Error("RuntimeExecutor is required when AI Runtime Marketing Cron is enabled");
    }
    const executor = options.executor;
    const now = options.now ?? (() => new Date());
    const timeoutMs = options.completionTimeoutMs;

    return {
      requestDraft: async (envelope: HandoffEnvelope<ContentDraftRequest>) => {
        try {
          const { output } = await requestContentStrategistDraftWithFormatRetry({
            payload: envelope.payload,
            invoke: async (prompt) => {
              const request = createCronRuntimeRequest(
                {
                  agentId: "content-strategist",
                  workload: "content_draft",
                  priority: "background",
                  messages: [{ role: "user", content: prompt }],
                  correlationId: options.correlationId,
                  parentRequestId: lastRequestId,
                  cronJobId: MARKETING_CRON_JOB_ID,
                  departmentId: MARKETING_DEPARTMENT_ID,
                  routing: { requiresStructuredOutput: true },
                },
                { now },
              );
              lastRequestId = request.id;
              const result = await executor.executeAndWait(request, { timeoutMs, now });
              return assertRuntimeContent(result);
            },
          });
          return output;
        } catch (error) {
          if (isContentStrategistFormatError(error)) {
            throw new Error(error.toPipelineMessage());
          }
          throw error;
        }
      },
      requestGovernance: async (envelope: HandoffEnvelope<StructuredGovernanceReviewRequest>) => {
        const request = createCronRuntimeRequest(
          {
            agentId: "governance-auditor",
            workload: "governance",
            priority: "high",
            messages: [{ role: "user", content: buildGovernanceReviewPrompt(envelope.payload) }],
            correlationId: options.correlationId,
            parentRequestId: lastRequestId,
            cronJobId: MARKETING_CRON_JOB_ID,
            departmentId: MARKETING_DEPARTMENT_ID,
            routing: { requiresStructuredOutput: true },
          },
          { now },
        );
        lastRequestId = request.id;
        const result = await executor.executeAndWait(request, { timeoutMs, now });
        return parseGovernanceAuditorOutput(assertRuntimeGovernance(result));
      },
    };
  }

  const invokeHermes = options.invokeHermesProfile;
  if (!invokeHermes) {
    throw new Error("Hermes profile invoker is required when AI Runtime Marketing Cron is disabled");
  }

  return {
    requestDraft: async (envelope: HandoffEnvelope<ContentDraftRequest>) => {
      try {
        const { output } = await requestContentStrategistDraftWithFormatRetry({
          payload: envelope.payload,
          invoke: (prompt) => invokeHermes("content-strategist", prompt),
        });
        return output;
      } catch (error) {
        if (isContentStrategistFormatError(error)) {
          throw new Error(error.toPipelineMessage());
        }
        throw error;
      }
    },
    requestGovernance: async (envelope: HandoffEnvelope<StructuredGovernanceReviewRequest>) => {
      const raw = invokeHermes("governance-auditor", buildGovernanceReviewPrompt(envelope.payload));
      return parseGovernanceAuditorOutput(raw);
    },
  };
}

function assertRuntimeManager(result: Awaited<ReturnType<RuntimeExecutor["executeAndWait"]>>): string {
  if (result.status !== "completed" || !result.response?.content) {
    const code = result.error?.code ?? "RUNTIME_ERROR";
    throw new Error(`marketing-manager runtime failed: ${code}`);
  }
  return result.response.content;
}

export type MarketingManagerAgendaDispatchOptions = MarketingPlanPipelineDispatchOptions;

/**
 * Builds Marketing Manager agenda selection dispatch for the daily pipeline.
 * Exactly one of Runtime or Hermes path executes per call — never both.
 */
export function createMarketingManagerAgendaDispatch(
  options: MarketingManagerAgendaDispatchOptions,
): {
  invokeManagerProfile: (prompt: string) => Promise<string>;
} {
  if (options.useRuntime) {
    if (!options.executor) {
      throw new Error("RuntimeExecutor is required when AI Runtime Marketing Cron is enabled");
    }
    const executor = options.executor;
    const now = options.now ?? (() => new Date());
    const timeoutMs = options.completionTimeoutMs;
    let lastRequestId: string | undefined;

    return {
      invokeManagerProfile: async (prompt: string) => {
        const request = createCronRuntimeRequest(
          {
            agentId: "marketing-manager",
            workload: "manager_decision",
            priority: "background",
            messages: [{ role: "user", content: prompt }],
            correlationId: options.correlationId,
            parentRequestId: lastRequestId,
            cronJobId: MARKETING_CRON_JOB_ID,
            departmentId: MARKETING_DEPARTMENT_ID,
            routing: { requiresStructuredOutput: true },
          },
          { now },
        );
        lastRequestId = request.id;
        const result = await executor.executeAndWait(request, { timeoutMs, now });
        return assertRuntimeManager(result);
      },
    };
  }

  const invokeHermes = options.invokeHermesProfile;
  if (!invokeHermes) {
    throw new Error("Hermes profile invoker is required when AI Runtime Marketing Cron is disabled");
  }

  return {
    invokeManagerProfile: async (prompt: string) => {
      return invokeHermes("marketing-manager", prompt);
    },
  };
}
