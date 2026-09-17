import "server-only";

import { generateObject, NoObjectGeneratedError } from "ai";
import { ZodError } from "zod";
import {
  resolveImportAiProvider,
  withGoogleModelFallback,
} from "@/lib/admin/ai/importAiModel";
import { isAiQuotaError, formatQuotaExceededMessage } from "@/lib/admin/ai/importAiErrors";
import {
  assertEditedPlanMatchesContext,
  assertGeneratedPlanMatchesDraft,
  PlannerPlanInvariantError,
  plannerPlanSchema,
  type PlannerPlan,
} from "@/lib/planner/planSchemas";
import {
  assertPlannerPlanQuality,
  PlannerPlanQualityError,
  type PlannerPlanQualityIssue,
} from "@/lib/planner/planQuality";
import {
  appendPlannerSemanticRetryInstruction,
  buildPlannerEditUserPrompt,
  buildPlannerPlanUserPrompt,
  PLANNER_EDIT_SYSTEM_PROMPT,
  PLANNER_PLAN_SYSTEM_PROMPT,
} from "@/lib/planner/prompts";
import {
  getPlannerModelIdForSemanticAttempt,
  getPlannerPrimaryModelId,
  getPlannerSemanticFallbackModelId,
} from "@/lib/planner/modelConfig";
import {
  extractPlannerGenerationDiagnostic,
  type PlannerRootCauseDiagnostic,
  type PlannerSdkFailureType,
  type PlannerUsageDiagnostic,
} from "@/lib/planner/generationDiagnostics";
import type { PlannerDraftInput, PlannerGenerationFailureCategory } from "@/types/planner";

const PLANNER_GENERATE_TIMEOUT_MS = 90_000;
export const MAX_PLANNER_SEMANTIC_ATTEMPTS = 2;

export type PlannerGenerateStage =
  | "provider_call"
  | "schema_validation"
  | "invariant_validation"
  | "quality_validation"
  | "persistence"
  | "result_validation";

export type PlannerSchemaIssuePath = {
  path: string;
  code: string;
};

export type PlannerGenerateDiagnostics = {
  stage: PlannerGenerateStage;
  attempt?: number;
  maxAttempts?: number;
  modelId?: string | null;
  provider?: string | null;
  schemaIssuePaths?: PlannerSchemaIssuePath[];
  invariantCode?: string;
  qualityIssue?: PlannerPlanQualityIssue;
  errorName?: string;
  sdkFailureType?: PlannerSdkFailureType | null;
  causeName?: string | null;
  causeChain?: string[] | null;
  finishReason?: string | null;
  usage?: PlannerUsageDiagnostic | null;
  rootCause?: PlannerRootCauseDiagnostic | null;
};

export type PlannerGenerateMeta = {
  semanticAttempts: number;
  provider: string | null;
  modelId: string | null;
};

export type PlannerGenerateResult = {
  plan: PlannerPlan;
  meta: PlannerGenerateMeta;
};

export type PlannerGenerateDiagnosticEvent =
  | {
      type: "semantic_retry";
      attempt: number;
      nextAttempt: number;
      maxAttempts: number;
      failureCategory: PlannerGenerationFailureCategory;
      errorCode: PlannerGenerateError["code"];
      stage: PlannerGenerateStage;
      modelId?: string | null;
      nextModelId?: string | null;
      selectedModelId?: string | null;
      provider?: string | null;
      schemaIssuePaths?: PlannerSchemaIssuePath[];
      invariantCode?: string;
      qualityIssue?: PlannerPlanQualityIssue;
      errorName?: string;
      sdkFailureType?: PlannerSdkFailureType | null;
      causeName?: string | null;
      causeChain?: string[] | null;
      finishReason?: string | null;
      usage?: PlannerUsageDiagnostic | null;
    }
  | {
      type: "attempt_success";
      attempt: number;
      maxAttempts: number;
      modelId?: string | null;
      selectedModelId?: string | null;
      provider?: string | null;
    };

export class PlannerGenerateError extends Error {
  readonly code:
    | "missing_key"
    | "timeout"
    | "invalid_plan"
    | "schema_invalid"
    | "invariant_failed"
    | "quality_failed"
    | "provider"
    | "unknown";
  readonly failureCategory: PlannerGenerationFailureCategory;
  readonly diagnostics: PlannerGenerateDiagnostics;

  constructor(
    code: PlannerGenerateError["code"],
    message: string,
    failureCategory?: PlannerGenerationFailureCategory,
    diagnostics?: Partial<PlannerGenerateDiagnostics>,
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
          : code === "quality_failed"
            ? "quality_failed"
            : code === "missing_key" || code === "timeout" || code === "provider"
              ? "provider_failed"
              : "provider_failed");
    this.diagnostics = {
      stage: diagnostics?.stage ?? "provider_call",
      attempt: diagnostics?.attempt,
      maxAttempts: diagnostics?.maxAttempts,
      modelId: diagnostics?.modelId ?? null,
      provider: diagnostics?.provider ?? null,
      schemaIssuePaths: diagnostics?.schemaIssuePaths,
      invariantCode: diagnostics?.invariantCode,
      qualityIssue: diagnostics?.qualityIssue,
      errorName: diagnostics?.errorName ?? this.name,
      sdkFailureType: diagnostics?.sdkFailureType ?? null,
      causeName: diagnostics?.causeName ?? null,
      causeChain: diagnostics?.causeChain ?? null,
      finishReason: diagnostics?.finishReason ?? null,
      usage: diagnostics?.usage ?? null,
      rootCause: diagnostics?.rootCause ?? null,
    };
  }
}

function withTimeout<T>(promise: Promise<T>, ms: number): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const timer = setTimeout(() => {
      reject(new PlannerGenerateError("timeout", "AI generation timed out", "provider_failed", {
        stage: "provider_call",
        errorName: "TimeoutError",
      }));
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

function extractModelId(model: unknown): string | null {
  if (!model || typeof model !== "object") return null;
  const maybe = model as { modelId?: unknown };
  return typeof maybe.modelId === "string" ? maybe.modelId : null;
}

function isZodErrorLike(error: unknown): error is ZodError {
  if (error instanceof ZodError) return true;
  return (
    !!error &&
    typeof error === "object" &&
    (error as { name?: string }).name === "ZodError" &&
    Array.isArray((error as { issues?: unknown }).issues)
  );
}

function zodIssuePaths(error: ZodError): PlannerSchemaIssuePath[] {
  return error.issues.slice(0, 24).map((issue) => ({
    path: issue.path.join("."),
    code: issue.code,
  }));
}

function findZodCause(error: unknown): ZodError | null {
  const visited = new Set<unknown>();
  let current: unknown = error;
  for (let depth = 0; depth < 5; depth += 1) {
    if (current == null || visited.has(current)) return null;
    visited.add(current);
    if (isZodErrorLike(current)) return current;
    if (current && typeof current === "object" && "cause" in current) {
      current = (current as { cause?: unknown }).cause;
      continue;
    }
    return null;
  }
  return null;
}

export function isSemanticRetryableFailure(error: PlannerGenerateError): boolean {
  return (
    error.failureCategory === "schema_invalid" ||
    error.failureCategory === "invariant_failed" ||
    error.failureCategory === "quality_failed"
  );
}

function attachRootCauseDiagnostics(
  base: Partial<PlannerGenerateDiagnostics>,
  error: unknown,
): Partial<PlannerGenerateDiagnostics> {
  const rootCause = extractPlannerGenerationDiagnostic(error);
  return {
    ...base,
    errorName: base.errorName ?? rootCause.errorName ?? undefined,
    schemaIssuePaths: base.schemaIssuePaths ?? rootCause.schemaIssuePaths ?? undefined,
    sdkFailureType: base.sdkFailureType ?? rootCause.sdkFailureType,
    causeName: base.causeName ?? rootCause.causeName,
    causeChain: base.causeChain ?? rootCause.causeChain,
    finishReason: base.finishReason ?? rootCause.finishReason,
    usage: base.usage ?? rootCause.usage,
    rootCause: base.rootCause ?? rootCause,
  };
}

export function normalizePlannerGenerateError(
  error: unknown,
  extras?: Partial<PlannerGenerateDiagnostics>,
): PlannerGenerateError {
  if (error instanceof PlannerGenerateError) {
    const merged = attachRootCauseDiagnostics(
      {
        ...error.diagnostics,
        ...extras,
        errorName: extras?.errorName ?? error.diagnostics.errorName ?? error.name,
        rootCause: extras?.rootCause ?? error.diagnostics.rootCause,
      },
      error.diagnostics.rootCause ? error : error,
    );
    // Prefer existing rootCause on PlannerGenerateError; re-extract from original only if missing
    const rootCause =
      error.diagnostics.rootCause ??
      extras?.rootCause ??
      extractPlannerGenerationDiagnostic(error);
    return new PlannerGenerateError(error.code, error.message, error.failureCategory, {
      ...merged,
      rootCause,
      sdkFailureType: merged.sdkFailureType ?? rootCause.sdkFailureType,
      causeName: merged.causeName ?? rootCause.causeName,
      causeChain: merged.causeChain ?? rootCause.causeChain,
      finishReason: merged.finishReason ?? rootCause.finishReason,
      usage: merged.usage ?? rootCause.usage,
      schemaIssuePaths: merged.schemaIssuePaths ?? rootCause.schemaIssuePaths ?? undefined,
      errorName: merged.errorName ?? rootCause.errorName ?? error.name,
    });
  }

  if (error instanceof PlannerPlanInvariantError) {
    return new PlannerGenerateError(
      "invariant_failed",
      "Plan invariant validation failed",
      "invariant_failed",
      attachRootCauseDiagnostics(
        {
          stage: "invariant_validation",
          invariantCode: error.code,
          errorName: error.name,
          ...extras,
        },
        error,
      ),
    );
  }

  if (error instanceof PlannerPlanQualityError) {
    return new PlannerGenerateError(
      "quality_failed",
      "Plan quality validation failed",
      "quality_failed",
      attachRootCauseDiagnostics(
        {
          stage: "quality_validation",
          qualityIssue: error.issue,
          errorName: error.name,
          ...extras,
        },
        error,
      ),
    );
  }

  const rootCause = extractPlannerGenerationDiagnostic(error);
  const zodFromChain = findZodCause(error);
  if (rootCause.schemaIssuePaths || isZodErrorLike(error) || zodFromChain) {
    return new PlannerGenerateError(
      "schema_invalid",
      "Plan schema validation failed",
      "schema_invalid",
      attachRootCauseDiagnostics(
        {
          stage: "schema_validation",
          schemaIssuePaths:
            rootCause.schemaIssuePaths ??
            (zodFromChain ? zodIssuePaths(zodFromChain) : undefined),
          errorName: rootCause.errorName ?? (error instanceof Error ? error.name : "ZodError"),
          ...extras,
        },
        error,
      ),
    );
  }

  if (NoObjectGeneratedError.isInstance(error)) {
    return new PlannerGenerateError(
      "schema_invalid",
      "Plan schema validation failed",
      "schema_invalid",
      attachRootCauseDiagnostics(
        {
          stage: "schema_validation",
          schemaIssuePaths: rootCause.schemaIssuePaths ?? undefined,
          errorName: error.name,
          ...extras,
        },
        error,
      ),
    );
  }

  if (isAiQuotaError(error)) {
    return new PlannerGenerateError(
      "provider",
      formatQuotaExceededMessage(error),
      "provider_failed",
      attachRootCauseDiagnostics(
        {
          stage: "provider_call",
          errorName: error instanceof Error ? error.name : "QuotaError",
          sdkFailureType: "provider",
          ...extras,
        },
        error,
      ),
    );
  }

  const message = error instanceof Error ? error.message : "unknown provider error";
  const errorName = error instanceof Error ? error.name : "Error";

  if (/API key|키가 없/i.test(message)) {
    return new PlannerGenerateError(
      "missing_key",
      "AI provider is not configured",
      "provider_failed",
      attachRootCauseDiagnostics(
        { stage: "provider_call", errorName, sdkFailureType: "provider", ...extras },
        error,
      ),
    );
  }

  if (/schema|validation|\bZod\b|parse/i.test(message)) {
    return new PlannerGenerateError(
      "schema_invalid",
      "Plan schema validation failed",
      "schema_invalid",
      attachRootCauseDiagnostics(
        { stage: "schema_validation", errorName, ...extras },
        error,
      ),
    );
  }

  return new PlannerGenerateError(
    "provider",
    "AI generation failed",
    "provider_failed",
    attachRootCauseDiagnostics(
      { stage: "provider_call", errorName, sdkFailureType: "provider", ...extras },
      error,
    ),
  );
}

async function runGenerateObject(params: {
  label: string;
  system: string;
  prompt: string;
  primaryModelId: string;
  onModelId?: (modelId: string | null) => void;
}): Promise<PlannerPlan> {
  const { object } = await withTimeout(
    withGoogleModelFallback(
      params.label,
      async (model) => {
        params.onModelId?.(extractModelId(model));
        return generateObject({
          model,
          schema: plannerPlanSchema,
          system: params.system,
          prompt: params.prompt,
          maxRetries: 0,
        });
      },
      { primaryModelId: params.primaryModelId },
    ),
    PLANNER_GENERATE_TIMEOUT_MS,
  );
  try {
    return plannerPlanSchema.parse(object);
  } catch (error) {
    throw normalizePlannerGenerateError(error, { stage: "schema_validation" });
  }
}

function resolveProviderSafe(): string | null {
  try {
    return resolveImportAiProvider();
  } catch {
    return null;
  }
}

export async function generatePlannerPlan(
  draft: PlannerDraftInput,
  options?: {
    onDiagnostic?: (event: PlannerGenerateDiagnosticEvent) => void;
  },
): Promise<PlannerGenerateResult> {
  const basePrompt = buildPlannerPlanUserPrompt(draft);
  const provider = resolveProviderSafe();
  let lastModelId: string | null = null;
  let lastSelectedModelId: string | null = null;
  let lastError: PlannerGenerateError | null = null;

  for (let attempt = 1; attempt <= MAX_PLANNER_SEMANTIC_ATTEMPTS; attempt += 1) {
    const selectedModelId = getPlannerModelIdForSemanticAttempt(attempt);
    lastSelectedModelId = selectedModelId;
    const prompt =
      attempt === 1
        ? basePrompt
        : appendPlannerSemanticRetryInstruction(basePrompt, {
            densityFailed: lastError?.failureCategory === "quality_failed",
          });

    try {
      const parsed = await runGenerateObject({
        label: "plannerGeneratePlan",
        system: PLANNER_PLAN_SYSTEM_PROMPT,
        prompt,
        primaryModelId: selectedModelId,
        onModelId: (id) => {
          lastModelId = id;
        },
      });
      try {
        assertGeneratedPlanMatchesDraft(parsed, draft);
      } catch (error) {
        throw normalizePlannerGenerateError(error, {
          stage: "invariant_validation",
          attempt,
          maxAttempts: MAX_PLANNER_SEMANTIC_ATTEMPTS,
          modelId: lastModelId,
          provider,
        });
      }
      try {
        assertPlannerPlanQuality(parsed, draft);
      } catch (error) {
        throw normalizePlannerGenerateError(error, {
          stage: "quality_validation",
          attempt,
          maxAttempts: MAX_PLANNER_SEMANTIC_ATTEMPTS,
          modelId: lastModelId,
          provider,
        });
      }

      options?.onDiagnostic?.({
        type: "attempt_success",
        attempt,
        maxAttempts: MAX_PLANNER_SEMANTIC_ATTEMPTS,
        modelId: lastModelId,
        selectedModelId,
        provider,
      });

      return {
        plan: parsed,
        meta: {
          semanticAttempts: attempt,
          provider,
          modelId: lastModelId,
        },
      };
    } catch (error) {
      const normalized = normalizePlannerGenerateError(error, {
        attempt,
        maxAttempts: MAX_PLANNER_SEMANTIC_ATTEMPTS,
        modelId: lastModelId,
        provider,
      });
      lastError = normalized;

      if (isSemanticRetryableFailure(normalized) && attempt < MAX_PLANNER_SEMANTIC_ATTEMPTS) {
        const nextModelId = getPlannerModelIdForSemanticAttempt(attempt + 1);
        options?.onDiagnostic?.({
          type: "semantic_retry",
          attempt,
          nextAttempt: attempt + 1,
          maxAttempts: MAX_PLANNER_SEMANTIC_ATTEMPTS,
          failureCategory: normalized.failureCategory,
          errorCode: normalized.code,
          stage: normalized.diagnostics.stage,
          modelId: lastModelId,
          selectedModelId,
          nextModelId,
          provider,
          schemaIssuePaths: normalized.diagnostics.schemaIssuePaths,
          invariantCode: normalized.diagnostics.invariantCode,
          qualityIssue: normalized.diagnostics.qualityIssue,
          errorName: normalized.diagnostics.errorName,
          sdkFailureType: normalized.diagnostics.sdkFailureType,
          causeName: normalized.diagnostics.causeName,
          causeChain: normalized.diagnostics.causeChain,
          finishReason: normalized.diagnostics.finishReason,
          usage: normalized.diagnostics.usage,
        });
        continue;
      }

      throw normalized;
    }
  }

  throw (
    lastError ??
    new PlannerGenerateError("unknown", "AI generation failed", "provider_failed", {
      stage: "provider_call",
      attempt: MAX_PLANNER_SEMANTIC_ATTEMPTS,
      maxAttempts: MAX_PLANNER_SEMANTIC_ATTEMPTS,
      provider,
      modelId: lastModelId ?? lastSelectedModelId,
    })
  );
}

export async function generateEditedPlannerPlan(params: {
  draft: PlannerDraftInput;
  currentPlan: PlannerPlan;
  instruction: string;
}): Promise<PlannerPlan> {
  const provider = resolveProviderSafe();
  let lastModelId: string | null = null;
  try {
    const parsed = await runGenerateObject({
      label: "plannerEditPlan",
      system: PLANNER_EDIT_SYSTEM_PROMPT,
      prompt: buildPlannerEditUserPrompt(params),
      primaryModelId: getPlannerPrimaryModelId(),
      onModelId: (id) => {
        lastModelId = id;
      },
    });
    try {
      assertEditedPlanMatchesContext(parsed, params.draft, params.currentPlan);
    } catch (error) {
      throw normalizePlannerGenerateError(error, {
        stage: "invariant_validation",
        attempt: 1,
        maxAttempts: 1,
        modelId: lastModelId,
        provider,
      });
    }
    return parsed;
  } catch (error) {
    throw normalizePlannerGenerateError(error, {
      attempt: 1,
      maxAttempts: 1,
      modelId: lastModelId,
      provider,
    });
  }
}

/** Exported for tests / ops docs — re-export model resolvers. */
export {
  getPlannerPrimaryModelId,
  getPlannerSemanticFallbackModelId,
  getPlannerModelIdForSemanticAttempt,
};

export { getPlannerItemDensityStats } from "@/lib/planner/planQuality";

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
  if (error instanceof PlannerPlanQualityError) return "quality_failed";
  if (isZodErrorLike(error)) return "schema_invalid";
  return "provider_failed";
}

export function getPlannerGenerateSafeLogFields(error: unknown): {
  errorCode: string | null;
  errorName: string | null;
  stage: PlannerGenerateStage | null;
  attempt: number | null;
  maxAttempts: number | null;
  modelId: string | null;
  provider: string | null;
  schemaIssuePaths: PlannerSchemaIssuePath[] | null;
  invariantCode: string | null;
  qualityIssue: PlannerPlanQualityIssue | null;
  sdkFailureType: PlannerSdkFailureType | null;
  causeName: string | null;
  causeChain: string[] | null;
  finishReason: string | null;
  usage: PlannerUsageDiagnostic | null;
} {
  if (!(error instanceof PlannerGenerateError)) {
    const root = extractPlannerGenerationDiagnostic(error);
    return {
      errorCode: null,
      errorName: root.errorName,
      stage: null,
      attempt: null,
      maxAttempts: null,
      modelId: null,
      provider: null,
      schemaIssuePaths: root.schemaIssuePaths,
      invariantCode: null,
      qualityIssue: null,
      sdkFailureType: root.sdkFailureType,
      causeName: root.causeName,
      causeChain: root.causeChain,
      finishReason: root.finishReason,
      usage: root.usage,
    };
  }
  const d = error.diagnostics;
  return {
    errorCode: error.code,
    errorName: d.errorName ?? error.name,
    stage: d.stage,
    attempt: d.attempt ?? null,
    maxAttempts: d.maxAttempts ?? null,
    modelId: d.modelId ?? null,
    provider: d.provider ?? null,
    schemaIssuePaths: d.schemaIssuePaths ?? null,
    invariantCode: d.invariantCode ?? null,
    qualityIssue: d.qualityIssue ?? null,
    sdkFailureType: d.sdkFailureType ?? null,
    causeName: d.causeName ?? null,
    causeChain: d.causeChain ?? null,
    finishReason: d.finishReason ?? null,
    usage: d.usage ?? null,
  };
}
