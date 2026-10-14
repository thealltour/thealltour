import "server-only";

import { createGoogleGenerativeAI } from "@ai-sdk/google";
import {
  createOpenAI,
  type OpenAILanguageModelChatOptions,
  type OpenAILanguageModelResponsesOptions,
} from "@ai-sdk/openai";
import type { SharedV4ProviderOptions } from "@ai-sdk/provider";
import type { LanguageModel } from "ai";
import { getGoogleGenerativeAiKey } from "@/lib/admin/ai/importAiModel";
import {
  DEFAULT_PLANNER_GOOGLE_PRIMARY_MODEL,
  DEFAULT_PLANNER_GOOGLE_SEMANTIC_FALLBACK_MODEL,
  getPlannerModelIdForSemanticAttempt,
} from "@/lib/planner/modelConfig";

/**
 * Planner-only AI provider resolution. Independent of admin import provider selection
 * (IMPORT_AI_PROVIDER / key-presence precedence) and of the global OPENAI_API_KEY.
 */

export const PLANNER_AI_PROVIDERS = ["openai", "google"] as const;
export type PlannerAiProvider = (typeof PLANNER_AI_PROVIDERS)[number];

/** Missing PLANNER_AI_PROVIDER never falls back to Google implicitly. */
export const DEFAULT_PLANNER_AI_PROVIDER: PlannerAiProvider = "openai";

export type PlannerOpenAiReasoningEffort = NonNullable<
  OpenAILanguageModelChatOptions["reasoningEffort"]
>;

export const PLANNER_OPENAI_REASONING_EFFORTS = [
  "none",
  "minimal",
  "low",
  "medium",
  "high",
  "xhigh",
] as const satisfies readonly PlannerOpenAiReasoningEffort[];

export const DEFAULT_PLANNER_OPENAI_REASONING_EFFORT: PlannerOpenAiReasoningEffort = "medium";

export type PlannerModelConfigErrorCode = "missing_key" | "invalid_config";

/** Explicit config failure — message names env vars only, never values. */
export class PlannerModelConfigError extends Error {
  readonly code: PlannerModelConfigErrorCode;

  constructor(code: PlannerModelConfigErrorCode, message: string) {
    super(message);
    this.name = "PlannerModelConfigError";
    this.code = code;
  }
}

export type PlannerLanguageModelTarget = {
  provider: PlannerAiProvider;
  modelId: string;
  model: LanguageModel;
  providerOptions: SharedV4ProviderOptions | undefined;
  reasoningEffort: PlannerOpenAiReasoningEffort | null;
};

export function resolvePlannerAiProvider(): PlannerAiProvider {
  const raw = process.env.PLANNER_AI_PROVIDER?.trim().toLowerCase();
  if (!raw) return DEFAULT_PLANNER_AI_PROVIDER;
  if ((PLANNER_AI_PROVIDERS as readonly string[]).includes(raw)) {
    return raw as PlannerAiProvider;
  }
  throw new PlannerModelConfigError(
    "invalid_config",
    "PLANNER_AI_PROVIDER must be one of: openai, google",
  );
}

export function resolvePlannerAiProviderSafe(): PlannerAiProvider | null {
  try {
    return resolvePlannerAiProvider();
  } catch {
    return null;
  }
}

export function getPlannerOpenAiApiKey(): string | null {
  return process.env.PLANNER_OPENAI_API_KEY?.trim() || null;
}

export function resolvePlannerOpenAiReasoningEffort(): PlannerOpenAiReasoningEffort {
  const raw = process.env.PLANNER_OPENAI_REASONING_EFFORT?.trim().toLowerCase();
  const match = PLANNER_OPENAI_REASONING_EFFORTS.find((effort) => effort === raw);
  return match ?? DEFAULT_PLANNER_OPENAI_REASONING_EFFORT;
}

function isGoogleModelId(modelId: string): boolean {
  return modelId.startsWith("gemini-") || modelId.startsWith("gemma-");
}

/** Model ID actually requested for a semantic attempt (edit uses attempt 1). */
export function resolvePlannerModelIdForAttempt(
  provider: PlannerAiProvider | null,
  attempt: number,
): string {
  const configured = getPlannerModelIdForSemanticAttempt(attempt);
  if (provider === "google" && !isGoogleModelId(configured)) {
    return attempt <= 1
      ? DEFAULT_PLANNER_GOOGLE_PRIMARY_MODEL
      : DEFAULT_PLANNER_GOOGLE_SEMANTIC_FALLBACK_MODEL;
  }
  return configured;
}

function buildOpenAiProviderOptions(
  reasoningEffort: PlannerOpenAiReasoningEffort,
): SharedV4ProviderOptions {
  const openai = {
    reasoningEffort,
    // SDK allowlist only recognizes o1/o3/o4-mini/gpt-5* as reasoning models; without this,
    // reasoning.effort is dropped for other IDs (e.g. gpt-6.1-sol).
    forceReasoning: true,
    // SDK defaults reasoningSummary to "detailed" when an effort is set; Planner never reads it.
    reasoningSummary: null,
    // OpenAI strict mode rejects plannerPlanSchema (optional destination.country, string length
    // keywords) with 400; output is still validated by plannerPlanSchema.parse + invariants.
    strictJsonSchema: false,
  } satisfies OpenAILanguageModelResponsesOptions;
  return { openai };
}

export function resolvePlannerLanguageModel(attempt: number): PlannerLanguageModelTarget {
  const provider = resolvePlannerAiProvider();
  const modelId = resolvePlannerModelIdForAttempt(provider, attempt);

  if (provider === "openai") {
    const apiKey = getPlannerOpenAiApiKey();
    if (!apiKey) {
      throw new PlannerModelConfigError(
        "missing_key",
        "PLANNER_OPENAI_API_KEY is required when PLANNER_AI_PROVIDER=openai",
      );
    }
    const reasoningEffort = resolvePlannerOpenAiReasoningEffort();
    return {
      provider,
      modelId,
      model: createOpenAI({ apiKey })(modelId),
      providerOptions: buildOpenAiProviderOptions(reasoningEffort),
      reasoningEffort,
    };
  }

  const apiKey = getGoogleGenerativeAiKey();
  if (!apiKey) {
    throw new PlannerModelConfigError(
      "missing_key",
      "GOOGLE_GENERATIVE_AI_API_KEY (or GEMINI_API_KEY / GOOGLE_API_KEY) is required when PLANNER_AI_PROVIDER=google",
    );
  }
  return {
    provider,
    modelId,
    model: createGoogleGenerativeAI({ apiKey })(modelId),
    providerOptions: undefined,
    reasoningEffort: null,
  };
}
