import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { ENABLE_FREE_TRAVEL_PLANNER } from "@/config/featureFlags";
import { getMemberSessionFromCookies } from "@/lib/memberSession";
import { assertPlannerSessionOwnership } from "@/lib/planner/ownership";
import { getPlannerSessionById } from "@/lib/planner/repository";
import {
  persistEditedPlannerPlan,
  PlannerPlanVersionConflictError,
} from "@/lib/planner/planVersionRepository";
import { applyPlannerManualCommand } from "@/lib/planner/manualEdit/applyPlannerManualCommand";
import { plannerManualEditBodySchema } from "@/lib/planner/manualEdit/schemas";
import {
  manualEditInstructionLabel,
  PlannerManualEditError,
  type PlannerManualCommand,
} from "@/lib/planner/manualEdit/types";
import { plannerPlanSchema } from "@/lib/planner/planSchemas";

export const dynamic = "force-dynamic";

type RouteContext = { params: Promise<{ id: string }> };

function statusForManualError(code: PlannerManualEditError["code"]): number {
  switch (code) {
    case "INVALID_DAY":
    case "INVALID_ITEM":
      return 404;
    case "LAST_DAY_ITEM_CANNOT_BE_DELETED":
    case "DAY_ITEMS_FULL":
    case "INVALID_ORDER":
      return 409;
    case "EMPTY_PATCH":
    case "VALIDATION":
    default:
      return 400;
  }
}

/**
 * POST /api/planner/sessions/[id]/manual-edit
 * Applies a single plan mutation without AI / quota.
 * Never accepts plan_json wholesale from the client.
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

  const parsed = plannerManualEditBodySchema.safeParse(json);
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

  const previousPlanParsed = plannerPlanSchema.safeParse(session!.plan);
  if (!previousPlanParsed.success) {
    return NextResponse.json(
      { message: "저장된 일정 형식이 올바르지 않습니다.", code: "invalid_plan" },
      { status: 500 },
    );
  }

  const command = parsed.data as PlannerManualCommand;
  let nextPlan;
  try {
    nextPlan = applyPlannerManualCommand(previousPlanParsed.data, command);
  } catch (error) {
    if (error instanceof PlannerManualEditError) {
      return NextResponse.json(
        { code: error.code, message: error.message },
        { status: statusForManualError(error.code) },
      );
    }
    throw error;
  }

  const status = session!.status;
  try {
    const { versionNumber, updatedAt } = await persistEditedPlannerPlan({
      sessionId: session!.id,
      previousPlan: previousPlanParsed.data,
      nextPlan,
      editInstruction: manualEditInstructionLabel(command.operation),
      status,
      expectedUpdatedAt: command.expectedUpdatedAt,
    });

    return NextResponse.json({
      session: {
        id: session!.id,
        status,
        sourceProductId: session!.sourceProductId,
        plan: nextPlan,
        isSaved: status === "saved",
        updatedAt,
      },
      versionNumber,
      operation: command.operation,
    });
  } catch (error) {
    if (error instanceof PlannerPlanVersionConflictError) {
      return NextResponse.json(
        {
          code: "PLAN_VERSION_CONFLICT",
          message: "다른 곳에서 일정이 변경되었습니다. 최신 내용을 다시 불러와 주세요.",
        },
        { status: 409 },
      );
    }
    console.error("[planner/manual-edit]", error);
    return NextResponse.json(
      { message: "일정을 수정하지 못했습니다. 잠시 후 다시 시도해 주세요.", code: "manual_edit_failed" },
      { status: 502 },
    );
  }
}
