import "server-only";

import { generateObject } from "ai";
import { ZodError } from "zod";
import { withGoogleModelFallback } from "@/lib/admin/ai/importAiModel";
import { isAiQuotaError, formatQuotaExceededMessage } from "@/lib/admin/ai/importAiErrors";
import {
  assertEditedPlanMatchesContext,
  assertGeneratedPlanMatchesDraft,
  PlannerPlanInvariantError,
  plannerPlanSchema,
  type PlannerPlan,
} from "@/lib/planner/planSchemas";
import {
  buildPlannerEditUserPrompt,
  buildPlannerPlanUserPrompt,
  PLANNER_EDIT_SYSTEM_PROMPT,
  PLANNER_PLAN_SYSTEM_PROMPT,
} from "@/lib/planner/prompts";
import type { PlannerDraftInput, PlannerGenerationFailureCategory } from "@/types/planner";

const PLANNER_GENERATE_TIMEOUT_MS = 90_000;

export class PlannerGenerateError extends Error {
  readonly code:
    | "missing_key"
    | "timeout"
    | "invalid_plan"
    | "schema_invalid"
    | "invariant_failed"
    | "provider"
    | "unknown";
  readonly failureCategory: PlannerGenerationFailureCategory;

  constructor(
    code: PlannerGenerateError["code"],
    message: string,
    failureCategory?: PlannerGenerationFailureCategory,
  ) {
    super(message);
    this.name = "PlannerGenerateError";
    this.code = code;
    this.failureCategory =
      failureCategory ??
      (code === "schema_invalid"
        ? "schema_invalid"
        : code === "invariant_failed" || code === "invalid_plan"
          ? "invariant_failed"
          : code === "missing_key" || code === "timeout" || code === "provider"
            ? "provider_failed"
            : "provider_failed");
  }
}

function withTimeout<T>(promise: Promise<T>, ms: number): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const timer = setTimeout(() => {
      reject(new PlannerGenerateError("timeout", "AI generation timed out"));
    }, ms);
    promise.then(
      (value) => {
        clearTimeout(timer);
        resolve(value);
      },
      (err) => {
        clearTimeout(timer);
        reject(err);
      },
    );
  });
}

function mapProviderError(error: unknown): never {
  if (error instanceof PlannerGenerateError) throw error;
  if (error instanceof PlannerPlanInvariantError) {
    throw new PlannerGenerateError("invariant_failed", error.message, "invariant_failed");
  }
  if (error instanceof ZodError) {
    throw new PlannerGenerateError("schema_invalid", "Plan schema validation failed", "schema_invalid");
  }
  if (isAiQuotaError(error)) {
    throw new PlannerGenerateError("provider", formatQuotaExceededMessage(error), "provider_failed");
  }
  const message = error instanceof Error ? error.message : "unknown provider error";
  if (/API key|키가 없/i.test(message)) {
    throw new PlannerGenerateError("missing_key", "AI provider is not configured", "provider_failed");
  }
  // AI SDK schema validation messages often mention schema / validation
  if (/schema|validation| Zod|parse/i.test(message)) {
    throw new PlannerGenerateError("schema_invalid", "Plan schema validation failed", "schema_invalid");
  }
  throw new PlannerGenerateError("provider", "AI generation failed", "provider_failed");
}

async function runGenerateObject(params: {
  label: string;
  system: string;
  prompt: string;
}): Promise<PlannerPlan> {
  const { object } = await withTimeout(
    withGoogleModelFallback(params.label, async (model) =>
      generateObject({
        model,
        schema: plannerPlanSchema,
        system: params.system,
        prompt: params.prompt,
        maxRetries: 0,
      }),
    ),
    PLANNER_GENERATE_TIMEOUT_MS,
  );
  try {
    return plannerPlanSchema.parse(object);
  } catch (error) {
    if (error instanceof ZodError) {
      throw new PlannerGenerateError("schema_invalid", "Plan schema validation failed", "schema_invalid");
    }
    throw error;
  }
}

export async function generatePlannerPlan(draft: PlannerDraftInput): Promise<PlannerPlan> {
  try {
    const parsed = await runGenerateObject({
      label: "plannerGeneratePlan",
      system: PLANNER_PLAN_SYSTEM_PROMPT,
      prompt: buildPlannerPlanUserPrompt(draft),
    });
    try {
      assertGeneratedPlanMatchesDraft(parsed, draft);
    } catch (error) {
      if (error instanceof PlannerPlanInvariantError) {
        throw new PlannerGenerateError("invariant_failed", error.message, "invariant_failed");
      }
      throw error;
    }
    return parsed;
  } catch (error) {
    mapProviderError(error);
  }
}

export async function generateEditedPlannerPlan(params: {
  draft: PlannerDraftInput;
  currentPlan: PlannerPlan;
  instruction: string;
}): Promise<PlannerPlan> {
  try {
    const parsed = await runGenerateObject({
      label: "plannerEditPlan",
      system: PLANNER_EDIT_SYSTEM_PROMPT,
      prompt: buildPlannerEditUserPrompt(params),
    });
    try {
      assertEditedPlanMatchesContext(parsed, params.draft, params.currentPlan);
    } catch (error) {
      if (error instanceof PlannerPlanInvariantError) {
        throw new PlannerGenerateError("invariant_failed", error.message, "invariant_failed");
      }
      throw error;
    }
    return parsed;
  } catch (error) {
    mapProviderError(error);
  }
}

export function toClientGenerationErrorMessage(error: unknown): string {
  if (error instanceof PlannerGenerateError) {
    if (error.code === "timeout") {
      return "여행 플랜 생성이 너무 오래 걸렸습니다. 잠시 후 다시 시도해 주세요.";
    }
    if (error.code === "missing_key") {
      return "여행 플랜 생성 준비가 아직 완료되지 않았습니다. 잠시 후 다시 시도해 주세요.";
    }
  }
  return "여행 플랜을 만드는 중 문제가 발생했습니다. 잠시 후 다시 시도해 주세요.";
}

export function toClientEditErrorMessage(error: unknown): string {
  if (error instanceof PlannerGenerateError) {
    if (error.code === "timeout") {
      return "일정 수정이 너무 오래 걸렸습니다. 잠시 후 다시 시도해 주세요.";
    }
    if (error.code === "missing_key") {
      return "일정 수정 준비가 아직 완료되지 않았습니다. 잠시 후 다시 시도해 주세요.";
    }
    if (error.code === "invariant_failed" || error.code === "invalid_plan") {
      return "일정을 수정하지 못했습니다. 목적지·날짜 변경은 새 플랜에서 진행해 주세요.";
    }
  }
  return "일정을 수정하지 못했습니다. 잠시 후 다시 시도해 주세요.";
}

export function getPlannerFailureCategory(error: unknown): PlannerGenerationFailureCategory {
  if (error instanceof PlannerGenerateError) return error.failureCategory;
  if (error instanceof PlannerPlanInvariantError) return "invariant_failed";
  if (error instanceof ZodError) return "schema_invalid";
  return "provider_failed";
}
