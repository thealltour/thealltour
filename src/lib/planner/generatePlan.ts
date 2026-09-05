import "server-only";

import { generateObject } from "ai";
import { withGoogleModelFallback } from "@/lib/admin/ai/importAiModel";
import { isAiQuotaError, formatQuotaExceededMessage } from "@/lib/admin/ai/importAiErrors";
import {
  assertGeneratedPlanMatchesDraft,
  PlannerPlanInvariantError,
  plannerPlanSchema,
  type PlannerPlan,
} from "@/lib/planner/planSchemas";
import { buildPlannerPlanUserPrompt, PLANNER_PLAN_SYSTEM_PROMPT } from "@/lib/planner/prompts";
import type { PlannerDraftInput } from "@/types/planner";

const PLANNER_GENERATE_TIMEOUT_MS = 90_000;

export class PlannerGenerateError extends Error {
  readonly code: "missing_key" | "timeout" | "invalid_plan" | "provider" | "unknown";

  constructor(code: PlannerGenerateError["code"], message: string) {
    super(message);
    this.name = "PlannerGenerateError";
    this.code = code;
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

export async function generatePlannerPlan(draft: PlannerDraftInput): Promise<PlannerPlan> {
  const prompt = buildPlannerPlanUserPrompt(draft);

  try {
    const { object } = await withTimeout(
      withGoogleModelFallback("plannerGeneratePlan", async (model) =>
        generateObject({
          model,
          schema: plannerPlanSchema,
          system: PLANNER_PLAN_SYSTEM_PROMPT,
          prompt,
          maxRetries: 0,
        }),
      ),
      PLANNER_GENERATE_TIMEOUT_MS,
    );

    const parsed = plannerPlanSchema.parse(object);
    assertGeneratedPlanMatchesDraft(parsed, draft);
    return parsed;
  } catch (error) {
    if (error instanceof PlannerGenerateError) throw error;
    if (error instanceof PlannerPlanInvariantError) {
      throw new PlannerGenerateError("invalid_plan", error.message);
    }
    if (isAiQuotaError(error)) {
      throw new PlannerGenerateError("provider", formatQuotaExceededMessage(error));
    }
    const message = error instanceof Error ? error.message : "unknown provider error";
    if (/API key|키가 없/i.test(message)) {
      throw new PlannerGenerateError("missing_key", "AI provider is not configured");
    }
    throw new PlannerGenerateError("provider", "AI generation failed");
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
