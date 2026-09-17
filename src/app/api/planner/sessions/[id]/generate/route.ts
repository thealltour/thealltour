import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { ENABLE_FREE_TRAVEL_PLANNER } from "@/config/featureFlags";
import { getMemberSessionFromCookies } from "@/lib/memberSession";
import { assertPlannerSessionOwnership } from "@/lib/planner/ownership";
import { plannerAnonymousKeySchema, plannerDraftInputSchema } from "@/lib/planner/schemas";
import {
  getPlannerSessionById,
  saveGeneratedPlannerPlan,
} from "@/lib/planner/repository";
import {
  generatePlannerPlan,
  getPlannerFailureCategory,
  getPlannerGenerateSafeLogFields,
  getPlannerItemDensityStats,
  PlannerGenerateError,
  toClientGenerationErrorMessage,
  type PlannerGenerateDiagnosticEvent,
  type PlannerGenerateStage,
} from "@/lib/planner/generatePlan";
import type { PlannerGenerationFailureCategory } from "@/types/planner";
import { z } from "zod";

export const dynamic = "force-dynamic";
export const maxDuration = 120;

type RouteContext = { params: Promise<{ id: string }> };

const generateBodySchema = z
  .object({
    anonymousKey: plannerAnonymousKeySchema,
  })
  .strict();

function toPublicPlanPayload(session: {
  id: string;
  status: string;
  sourceProductId: string | null;
  input: unknown;
  plan: unknown;
  updatedAt: string;
}) {
  return {
    id: session.id,
    status: session.status,
    sourceProductId: session.sourceProductId,
    input: session.input,
    plan: session.plan,
    updatedAt: session.updatedAt,
  };
}

function logGenerateFailure(params: {
  sessionId: string;
  failureCategory: PlannerGenerationFailureCategory;
  durationMs: number;
  errorCode?: string | null;
  errorName?: string | null;
  stage?: PlannerGenerateStage | null;
  attempt?: number | null;
  maxAttempts?: number | null;
  modelId?: string | null;
  provider?: string | null;
  schemaIssuePaths?: Array<{ path: string; code: string }> | null;
  invariantCode?: string | null;
  qualityIssue?: {
    code?: string;
    day?: number;
    actual?: number;
    expectedMinimum?: number;
    pace?: string;
    dayRole?: string;
  } | null;
  sdkFailureType?: string | null;
  causeName?: string | null;
  causeChain?: string[] | null;
  finishReason?: string | null;
  usage?: { inputTokens?: number; outputTokens?: number; totalTokens?: number } | null;
}) {
  console.error("[planner/generate]", {
    sessionId: params.sessionId,
    failureCategory: params.failureCategory,
    errorCode: params.errorCode ?? null,
    errorName: params.errorName ?? null,
    sdkFailureType: params.sdkFailureType ?? null,
    causeName: params.causeName ?? null,
    causeChain: params.causeChain ?? null,
    stage: params.stage ?? null,
    attempt: params.attempt ?? null,
    maxAttempts: params.maxAttempts ?? null,
    provider: params.provider ?? null,
    modelId: params.modelId ?? null,
    schemaIssuePaths: params.schemaIssuePaths ?? null,
    invariantCode: params.invariantCode ?? null,
    qualityIssue: params.qualityIssue
      ? {
          code: params.qualityIssue.code ?? null,
          day: params.qualityIssue.day ?? null,
          actual: params.qualityIssue.actual ?? null,
          expectedMinimum: params.qualityIssue.expectedMinimum ?? null,
          pace: params.qualityIssue.pace ?? null,
          dayRole: params.qualityIssue.dayRole ?? null,
        }
      : null,
    finishReason: params.finishReason ?? null,
    usage: params.usage ?? null,
    durationMs: params.durationMs,
    ok: false,
  });
}

/**
 * POST /api/planner/sessions/[id]/generate
 * Generates plan_json from DB input_json. Ownership required.
 */
export async function POST(request: Request, context: RouteContext) {
  if (!ENABLE_FREE_TRAVEL_PLANNER) {
    return NextResponse.json({ message: "Planner is disabled." }, { status: 404 });
  }

  const { id } = await context.params;
  if (!id?.trim()) {
    return NextResponse.json({ message: "Invalid session id." }, { status: 400 });
  }

  let json: unknown;
  try {
    json = await request.json();
  } catch {
    return NextResponse.json({ message: "Invalid JSON body." }, { status: 400 });
  }

  const parsed = generateBodySchema.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json(
      { message: parsed.error.issues[0]?.message ?? "Invalid request." },
      { status: 400 },
    );
  }

  const cookieStore = await cookies();
  const memberSession = getMemberSessionFromCookies(cookieStore);
  const session = await getPlannerSessionById(id.trim());

  const ownership = assertPlannerSessionOwnership({
    session,
    anonymousKey: parsed.data.anonymousKey,
    cookieMemberId: memberSession?.memberId ?? null,
  });
  if (!ownership.ok) {
    return NextResponse.json({ message: ownership.message }, { status: ownership.status });
  }

  // Idempotent: already generated/saved → return existing without AI call
  if ((session!.status === "generated" || session!.status === "saved") && session!.plan) {
    return NextResponse.json({
      session: toPublicPlanPayload(session!),
      reused: true,
    });
  }

  const draftParsed = plannerDraftInputSchema.safeParse(session!.input);
  if (!draftParsed.success) {
    logGenerateFailure({
      sessionId: session!.id,
      failureCategory: "input_invalid",
      stage: "schema_validation",
      errorCode: "input_invalid",
      errorName: "DraftValidationError",
      durationMs: 0,
    });
    return NextResponse.json(
      {
        message: "여행 조건이 아직 완료되지 않았습니다.",
        code: "incomplete_draft",
        failureCategory: "input_invalid" satisfies PlannerGenerationFailureCategory,
      },
      { status: 400 },
    );
  }

  const startedAt = Date.now();
  try {
    const { plan, meta } = await generatePlannerPlan(draftParsed.data, {
      onDiagnostic: (event: PlannerGenerateDiagnosticEvent) => {
        if (event.type !== "semantic_retry") return;
        console.warn("[planner/generate/retry]", {
          sessionId: session!.id,
          failureCategory: event.failureCategory,
          errorCode: event.errorCode,
          stage: event.stage,
          attempt: event.attempt,
          nextAttempt: event.nextAttempt,
          maxAttempts: event.maxAttempts,
          provider: event.provider ?? null,
          modelId: event.modelId ?? null,
          selectedModelId: event.selectedModelId ?? null,
          nextModelId: event.nextModelId ?? null,
          schemaIssuePaths: event.schemaIssuePaths ?? null,
          invariantCode: event.invariantCode ?? null,
          qualityIssue: event.qualityIssue
            ? {
                code: event.qualityIssue.code,
                day: event.qualityIssue.day,
                actual: event.qualityIssue.actual,
                expectedMinimum: event.qualityIssue.expectedMinimum,
                pace: event.qualityIssue.pace,
                dayRole: event.qualityIssue.dayRole,
              }
            : null,
          errorName: event.errorName ?? null,
          sdkFailureType: event.sdkFailureType ?? null,
          causeName: event.causeName ?? null,
          causeChain: event.causeChain ?? null,
          finishReason: event.finishReason ?? null,
          usage: event.usage ?? null,
        });
      },
    });

    let saved;
    try {
      saved = await saveGeneratedPlannerPlan({ id: session!.id, plan });
    } catch (persistError) {
      logGenerateFailure({
        sessionId: session!.id,
        failureCategory: "persist_failed",
        stage: "persistence",
        errorCode: "persist_failed",
        errorName: persistError instanceof Error ? persistError.name : "PersistError",
        attempt: meta.semanticAttempts,
        maxAttempts: meta.semanticAttempts,
        provider: meta.provider,
        modelId: meta.modelId,
        durationMs: Date.now() - startedAt,
      });
      return NextResponse.json(
        {
          message: toClientGenerationErrorMessage(
            new PlannerGenerateError("unknown", "persist failed", "persist_failed", {
              stage: "persistence",
            }),
          ),
          code: "generation_failed",
          failureCategory: "persist_failed" satisfies PlannerGenerationFailureCategory,
        },
        { status: 502 },
      );
    }

    if (!saved.plan) {
      logGenerateFailure({
        sessionId: session!.id,
        failureCategory: "result_navigation_failed",
        stage: "result_validation",
        errorCode: "result_navigation_failed",
        errorName: "MissingPlanError",
        attempt: meta.semanticAttempts,
        maxAttempts: meta.semanticAttempts,
        provider: meta.provider,
        modelId: meta.modelId,
        durationMs: Date.now() - startedAt,
      });
      return NextResponse.json(
        {
          message: toClientGenerationErrorMessage(null),
          code: "generation_failed",
          failureCategory: "result_navigation_failed" satisfies PlannerGenerationFailureCategory,
        },
        { status: 502 },
      );
    }

    const densityStats = getPlannerItemDensityStats(plan);
    console.info("[planner/generate]", {
      sessionId: session!.id,
      durationMs: Date.now() - startedAt,
      dayCount: plan.days.length,
      totalItemCount: densityStats.totalItemCount,
      minDayItemCount: densityStats.minItemsPerDay,
      maxDayItemCount: densityStats.maxItemsPerDay,
      avgItemsPerDay: densityStats.averageItemsPerDay,
      dateMode: draftParsed.data.dates.mode,
      semanticAttempts: meta.semanticAttempts,
      provider: meta.provider,
      modelId: meta.modelId,
      ok: true,
    });
    return NextResponse.json({
      session: toPublicPlanPayload(saved),
      reused: false,
    });
  } catch (err) {
    const failureCategory = getPlannerFailureCategory(err);
    const safe = getPlannerGenerateSafeLogFields(err);
    logGenerateFailure({
      sessionId: session!.id,
      failureCategory,
      durationMs: Date.now() - startedAt,
      errorCode: safe.errorCode,
      errorName: safe.errorName,
      stage: safe.stage,
      attempt: safe.attempt,
      maxAttempts: safe.maxAttempts,
      modelId: safe.modelId,
      provider: safe.provider,
      schemaIssuePaths: safe.schemaIssuePaths,
      invariantCode: safe.invariantCode,
      qualityIssue: safe.qualityIssue,
      sdkFailureType: safe.sdkFailureType,
      causeName: safe.causeName,
      causeChain: safe.causeChain,
      finishReason: safe.finishReason,
      usage: safe.usage,
    });
    return NextResponse.json(
      {
        message: toClientGenerationErrorMessage(err),
        code: "generation_failed",
        failureCategory,
      },
      { status: 502 },
    );
  }
}
