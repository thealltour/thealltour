import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { ENABLE_FREE_TRAVEL_PLANNER } from "@/config/featureFlags";
import { getMemberSessionFromCookies } from "@/lib/memberSession";
import { assertPlannerSessionOwnership } from "@/lib/planner/ownership";
import { plannerDraftInputSchema, plannerEditBodySchema } from "@/lib/planner/schemas";
import { getPlannerSessionById } from "@/lib/planner/repository";
import { persistEditedPlannerPlan } from "@/lib/planner/planVersionRepository";
import {
  generateEditedPlannerPlan,
  getPlannerGenerateSafeLogFields,
  getPlannerItemDensityStats,
  toClientEditErrorMessage,
  type PlannerGenerateDiagnosticEvent,
} from "@/lib/planner/generatePlan";
import { formatKstBusinessDate } from "@/lib/planner/quota/kst";
import { resolvePlannerQuotaSubject } from "@/lib/planner/quota/resolveSubject";
import {
  consumePlannerAiEditQuota,
  releasePlannerAiEditQuota,
  reservePlannerAiEditQuota,
} from "@/lib/planner/quota/repository";
import { aiEditQuotaBlockedResponse } from "@/lib/planner/quota/http";
import type { PlannerQuotaSubject } from "@/lib/planner/quota/types";
import { persistAnalyticsEventAdmin } from "@/lib/analytics/persistAnalyticsEventAdmin";
import { ANALYTICS_EVENTS, ANALYTICS_SOURCES } from "@/lib/analytics/events";

export const dynamic = "force-dynamic";
export const maxDuration = 300;

type RouteContext = { params: Promise<{ id: string }> };

/**
 * POST /api/planner/sessions/[id]/edit
 * Regenerates plan_json from DB input_json + current plan + instruction.
 * Never accepts planJson / memberId / status from the client.
 *
 * Member: AI Edit daily quota (3/KST day) + per-session in-progress lock.
 * Guest: no new quota policy; session lock only (prevents concurrent LLM).
 * Manual Edit is a separate route and never touches these quotas.
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

  const parsed = plannerEditBodySchema.safeParse(json);
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
    anonymousKey: parsed.data.anonymousKey ?? null,
    cookieMemberId: memberSession?.memberId ?? null,
  });
  if (!ownership.ok) {
    return NextResponse.json({ message: ownership.message }, { status: ownership.status });
  }

  if (session!.status !== "generated" && session!.status !== "saved") {
    return NextResponse.json(
      { message: "수정할 수 없는 플랜 상태입니다.", code: "invalid_status" },
      { status: 409 },
    );
  }

  if (!session!.plan) {
    return NextResponse.json(
      { message: "수정할 일정이 없습니다.", code: "missing_plan" },
      { status: 409 },
    );
  }

  const draftParsed = plannerDraftInputSchema.safeParse(session!.input);
  if (!draftParsed.success) {
    return NextResponse.json(
      { message: "여행 조건이 올바르지 않습니다.", code: "incomplete_draft" },
      { status: 400 },
    );
  }

  const cookieMemberId = memberSession?.memberId?.trim() || "";
  let quotaSubject: PlannerQuotaSubject;
  if (cookieMemberId) {
    // Member AI Edit quota is keyed by memberId only (cross-device shared).
    quotaSubject = {
      subjectType: "member",
      subjectId: cookieMemberId,
      windowType: "kst_day",
      windowKey: formatKstBusinessDate(new Date()),
    };
  } else {
    const anonymousKey = parsed.data.anonymousKey?.trim() || "";
    if (!anonymousKey) {
      return NextResponse.json({ message: "Invalid request." }, { status: 400 });
    }
    try {
      // Guest: session lock only — resolveSubject yields lifetime window (no new guest quota).
      quotaSubject = resolvePlannerQuotaSubject({
        cookieMemberId: null,
        anonymousKey,
      });
    } catch {
      return NextResponse.json({ message: "Invalid request." }, { status: 400 });
    }
  }

  const isMemberQuota = quotaSubject.subjectType === "member";
  let aiEditReserved = false;

  try {
    const reserveResult = await reservePlannerAiEditQuota({
      subject: quotaSubject,
      sessionId: session!.id,
      enforceLimit: isMemberQuota,
    });
    if (reserveResult !== "reserved") {
      const blocked = aiEditQuotaBlockedResponse({ result: reserveResult });
      const eventName =
        reserveResult === "already_reserved"
          ? ANALYTICS_EVENTS.planner_ai_edit_in_progress_blocked
          : ANALYTICS_EVENTS.planner_ai_edit_quota_blocked;
      await persistAnalyticsEventAdmin({
        eventName,
        source: ANALYTICS_SOURCES.planner,
        pagePath: `/planner/${session!.id}`,
        productId: session!.sourceProductId,
        metadata: {
          sessionId: session!.id,
          destination: session!.plan.destination.name.slice(0, 120),
          subjectType: isMemberQuota ? "member" : "anonymous",
          reason:
            reserveResult === "already_reserved" ? "already_in_progress" : "daily_exceeded",
        },
      }).catch(() => undefined);
      return blocked;
    }
    aiEditReserved = true;
  } catch {
    return NextResponse.json(
      { message: toClientEditErrorMessage(null), code: "edit_failed" },
      { status: 502 },
    );
  }

  const instruction = parsed.data.instruction;
  const instructionLength = instruction.length;
  const startedAt = Date.now();
  const previousPlan = session!.plan;
  const status = session!.status;

  const outcome: {
    success: Extract<PlannerGenerateDiagnosticEvent, { type: "attempt_success" }> | null;
  } = { success: null };

  try {
    const nextPlan = await generateEditedPlannerPlan(
      {
        draft: draftParsed.data,
        currentPlan: previousPlan,
        instruction,
      },
      {
        onDiagnostic: (event) => {
          if (event.type === "attempt_success") outcome.success = event;
        },
      },
    );

    const { versionNumber } = await persistEditedPlannerPlan({
      sessionId: session!.id,
      previousPlan,
      nextPlan,
      editInstruction: instruction,
      status,
    });

    if (isMemberQuota) {
      await consumePlannerAiEditQuota({ sessionId: session!.id });
    } else {
      // Guest: lock only — do not create a lasting quota ledger.
      await releasePlannerAiEditQuota({ sessionId: session!.id });
    }
    aiEditReserved = false;

    const densityStats = getPlannerItemDensityStats(nextPlan);
    const refreshed = await getPlannerSessionById(session!.id);
    const durationMs = Date.now() - startedAt;
    console.info("[planner] edit ok", {
      sessionId: session!.id,
      durationMs,
      instructionLength,
      versionNumber,
      status,
      totalItemCount: densityStats.totalItemCount,
      minDayItemCount: densityStats.minItemsPerDay,
      maxDayItemCount: densityStats.maxItemsPerDay,
      avgItemsPerDay: densityStats.averageItemsPerDay,
      provider: outcome.success?.provider ?? null,
      modelId: outcome.success?.modelId ?? null,
      finishReason: outcome.success?.finishReason ?? null,
      usage: outcome.success?.usage ?? null,
    });

    return NextResponse.json({
      session: {
        id: refreshed?.id ?? session!.id,
        status: refreshed?.status ?? status,
        sourceProductId: refreshed?.sourceProductId ?? session!.sourceProductId,
        plan: refreshed?.plan ?? nextPlan,
        isSaved: (refreshed?.status ?? status) === "saved",
        updatedAt: refreshed?.updatedAt ?? new Date().toISOString(),
      },
      versionNumber,
    });
  } catch (error) {
    if (aiEditReserved) {
      await releasePlannerAiEditQuota({ sessionId: session!.id });
      aiEditReserved = false;
    }
    const durationMs = Date.now() - startedAt;
    const safe = getPlannerGenerateSafeLogFields(error);
    console.info("[planner] edit failed", {
      sessionId: session!.id,
      durationMs,
      instructionLength,
      category: error instanceof Error ? error.name : "unknown",
      errorCode: safe.errorCode,
      stage: safe.stage,
      provider: safe.provider,
      modelId: safe.modelId,
      providerStatusCode: safe.providerStatusCode,
      sdkFailureType: safe.sdkFailureType,
    });
    return NextResponse.json(
      { message: toClientEditErrorMessage(error), code: "edit_failed" },
      { status: 502 },
    );
  } finally {
    if (aiEditReserved) {
      await releasePlannerAiEditQuota({ sessionId: session!.id });
    }
  }
}
