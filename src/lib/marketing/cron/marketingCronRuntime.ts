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
  requestContentStrategistDraftWithFormatRetry,
  requestGovernanceReviewWithFormatRetry,
  isContentStrategistFormatError,
  isContentStrategistRuntimeError,
} from "@/lib/marketing/cron/marketingPlanSpecialists";
import {
  assertChannelEditorHermesProfile,
  ensureChannelEditorHermesOneshotReady,
  type ChannelComposerPromptParts,
} from "@/lib/marketing/publishable/channelEditorIdentity";
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

export type HermesProfileInvoker = (
  profile: string,
  prompt: string,
) => string | Promise<string>;

/**
 * RA-1C — wire Audience & Content Research LLM synthesis to the same Hermes/Runtime
 * gateway used by Marketing Cron. Reuses content-strategist profile as structured-JSON
 * transport; the ACRB prompt itself forbids final channel copy. No new Bot process.
 */
export function createAudienceResearchInvoke(
  options: MarketingPlanPipelineDispatchOptions,
): ((prompt: string) => Promise<string>) | null {
  if (options.useRuntime) {
    if (!options.executor) return null;
    const executor = options.executor;
    const now = options.now ?? (() => new Date());
    const timeoutMs = options.completionTimeoutMs;
    return async (prompt: string) => {
      const request = createCronRuntimeRequest(
        {
          agentId: "content-strategist",
          workload: "content_draft",
          priority: "background",
          messages: [{ role: "user", content: prompt }],
          correlationId: options.correlationId,
          cronJobId: MARKETING_CRON_JOB_ID,
          departmentId: MARKETING_DEPARTMENT_ID,
          roleKey: "research_synthesis",
          routing: { requiresStructuredOutput: true },
        },
        { now },
      );
      const result = await executor.executeAndWait(request, { timeoutMs, now });
      return assertRuntimeContent(result);
    };
  }

  const invokeHermes = options.invokeHermesProfile;
  if (!invokeHermes) return null;
  return async (prompt: string) => Promise.resolve(invokeHermes("content-strategist", prompt));
}

/** ED-1 — Story Miner LLM invoke (reuses content-strategist transport; no web search). */
export function createStoryMinerInvoke(
  options: MarketingPlanPipelineDispatchOptions,
): ((prompt: string) => Promise<string>) | null {
  if (options.useRuntime) {
    if (!options.executor) return null;
    const executor = options.executor;
    const now = options.now ?? (() => new Date());
    const timeoutMs = options.completionTimeoutMs;
    return async (prompt: string) => {
      const request = createCronRuntimeRequest(
        {
          agentId: "content-strategist",
          workload: "content_draft",
          priority: "background",
          messages: [{ role: "user", content: prompt }],
          correlationId: options.correlationId,
          cronJobId: MARKETING_CRON_JOB_ID,
          departmentId: MARKETING_DEPARTMENT_ID,
          roleKey: "story_point_miner",
          routing: { requiresStructuredOutput: true },
        },
        { now },
      );
      const result = await executor.executeAndWait(request, { timeoutMs, now });
      return assertRuntimeContent(result);
    };
  }

  const invokeHermes = options.invokeHermesProfile;
  if (!invokeHermes) return null;
  return async (prompt: string) => Promise.resolve(invokeHermes("content-strategist", prompt));
}

/**
 * Canonical Asset Source Writer — structured JSON Korean source asset.
 * Reuses content-strategist Hermes/Runtime transport (no new Hermes bot). Role is
 * enforced by prompt contract (asset-source-writer), not Content Strategist.
 */
export const ASSET_SOURCE_WRITER_MODEL_PROFILE = "content-strategist" as const;

export function createAssetSourceWriterInvoke(
  options: MarketingPlanPipelineDispatchOptions,
): ((prompt: string) => Promise<string>) | null {
  if (options.useRuntime) {
    if (!options.executor) return null;
    const executor = options.executor;
    const now = options.now ?? (() => new Date());
    const timeoutMs = options.completionTimeoutMs;
    return async (prompt: string) => {
      const request = createCronRuntimeRequest(
        {
          agentId: ASSET_SOURCE_WRITER_MODEL_PROFILE,
          workload: "content_draft",
          priority: "background",
          messages: [{ role: "user", content: prompt }],
          correlationId: options.correlationId,
          cronJobId: MARKETING_CRON_JOB_ID,
          departmentId: MARKETING_DEPARTMENT_ID,
          roleKey: "asset_source_writer",
          routing: { requiresStructuredOutput: true },
        },
        { now },
      );
      const result = await executor.executeAndWait(request, { timeoutMs, now });
      return assertRuntimeContent(result);
    };
  }

  const invokeHermes = options.invokeHermesProfile;
  if (!invokeHermes) return null;
  return async (prompt: string) =>
    Promise.resolve(invokeHermes(ASSET_SOURCE_WRITER_MODEL_PROFILE, prompt));
}

/**
 * MQ-4 — production PublishableLlmInvoke for channel-native composers.
 * Runtime: Channel Editor identity as system message + roleKey=channel_editor.
 * Hermes oneshot: channel-editor-* profile (never content-strategist).
 */
export const PUBLISHABLE_COMPOSER_RUNTIME_AGENT_ID = "content-strategist" as const;

export function createPublishableComposerInvoke(
  options: MarketingPlanPipelineDispatchOptions,
): ((prompt: ChannelComposerPromptParts | string) => Promise<string>) | null {
  if (options.useRuntime) {
    if (!options.executor) return null;
    const executor = options.executor;
    const now = options.now ?? (() => new Date());
    const timeoutMs = options.completionTimeoutMs;
    return async (prompt) => {
      const parts =
        typeof prompt === "string"
          ? { channel: "threads" as const, system: "", user: prompt, text: prompt }
          : prompt;
      if (!parts.system || !/You are a Channel (Adapter|Editor)/.test(parts.system)) {
        throw new Error("channel_editor_identity_missing_from_runtime_prompt");
      }
      const messages = [
        { role: "system" as const, content: parts.system },
        { role: "user" as const, content: parts.user || parts.text },
      ];
      const request = createCronRuntimeRequest(
        {
          // Gateway agent id remains CS transport alias; identity is Channel Editor system prompt.
          agentId: PUBLISHABLE_COMPOSER_RUNTIME_AGENT_ID,
          workload: "content_draft",
          priority: "background",
          messages,
          correlationId: options.correlationId,
          cronJobId: MARKETING_CRON_JOB_ID,
          departmentId: MARKETING_DEPARTMENT_ID,
          roleKey: "channel_editor",
          routing: { requiresStructuredOutput: true },
        },
        { now },
      );
      const result = await executor.executeAndWait(request, { timeoutMs, now });
      return assertRuntimeContent(result);
    };
  }

  const invokeHermes = options.invokeHermesProfile;
  if (!invokeHermes) return null;
  return async (prompt) => {
    const channel = typeof prompt === "string" ? null : prompt.channel;
    if (!channel) {
      throw new Error("channel_editor_oneshot_requires_channel");
    }
    const { profile } = ensureChannelEditorHermesOneshotReady(channel);
    assertChannelEditorHermesProfile(profile);
    const text = typeof prompt === "string" ? prompt : prompt.text;
    return Promise.resolve(invokeHermes(profile, text));
  };
}

export type MarketingPlanPipelineDispatchOptions = {
  useRuntime: boolean;
  correlationId: string;
  executor?: Pick<RuntimeExecutor, "executeAndWait">;
  invokeHermesProfile?: HermesProfileInvoker;
  completionTimeoutMs?: number;
  now?: () => Date;
  /** Observability hook — fires when Governance Auditor needed a JSON format repair. */
  onGovernanceFormatRetry?: (info: { message: string }) => void;
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
                  roleKey: "content_strategist",
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
          if (isContentStrategistFormatError(error) || isContentStrategistRuntimeError(error)) {
            throw new Error(error.toPipelineMessage());
          }
          throw error;
        }
      },
      requestGovernance: async (envelope: HandoffEnvelope<StructuredGovernanceReviewRequest>) => {
        const { result } = await requestGovernanceReviewWithFormatRetry({
          payload: envelope.payload,
          invoke: async (prompt) => {
            const request = createCronRuntimeRequest(
              {
                agentId: "governance-auditor",
                workload: "governance",
                priority: "high",
                messages: [{ role: "user", content: prompt }],
                correlationId: options.correlationId,
                parentRequestId: lastRequestId,
                cronJobId: MARKETING_CRON_JOB_ID,
                departmentId: MARKETING_DEPARTMENT_ID,
                roleKey: "governance_auditor",
                routing: { requiresStructuredOutput: true },
              },
              { now },
            );
            lastRequestId = request.id;
            return assertRuntimeGovernance(await executor.executeAndWait(request, { timeoutMs, now }));
          },
          onFormatRetry: options.onGovernanceFormatRetry,
        });
        return result;
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
          invoke: (prompt) => Promise.resolve(invokeHermes("content-strategist", prompt)),
        });
        return output;
      } catch (error) {
        if (isContentStrategistFormatError(error) || isContentStrategistRuntimeError(error)) {
          throw new Error(error.toPipelineMessage());
        }
        throw error;
      }
    },
    requestGovernance: async (envelope: HandoffEnvelope<StructuredGovernanceReviewRequest>) => {
      const { result } = await requestGovernanceReviewWithFormatRetry({
        payload: envelope.payload,
        invoke: (prompt) => Promise.resolve(invokeHermes("governance-auditor", prompt)),
        onFormatRetry: options.onGovernanceFormatRetry,
      });
      return result;
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
            roleKey: "marketing_manager",
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
      return Promise.resolve(invokeHermes("marketing-manager", prompt));
    },
  };
}
