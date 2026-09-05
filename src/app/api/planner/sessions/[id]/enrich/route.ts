import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { z } from "zod";
import { ENABLE_FREE_TRAVEL_PLANNER } from "@/config/featureFlags";
import { getMemberSessionFromCookies } from "@/lib/memberSession";
import { assertPlannerSessionOwnership } from "@/lib/planner/ownership";
import { plannerAnonymousKeySchema } from "@/lib/planner/schemas";
import { getPlannerSessionById } from "@/lib/planner/repository";
import { enrichPlannerSession } from "@/lib/planner/enrichPlannerSession";

export const dynamic = "force-dynamic";
export const maxDuration = 120;

type RouteContext = { params: Promise<{ id: string }> };

const enrichBodySchema = z
  .object({
    anonymousKey: plannerAnonymousKeySchema.optional(),
  })
  .strict();

/**
 * POST /api/planner/sessions/[id]/enrich
 * Places + Weather + Routes reality layer. Never blocks core AI plan availability.
 */
export async function POST(request: Request, context: RouteContext) {
  if (!ENABLE_FREE_TRAVEL_PLANNER) {
    return NextResponse.json({ message: "Planner is disabled." }, { status: 404 });
  }

  const { id } = await context.params;
  if (!id?.trim()) {
    return NextResponse.json({ message: "Invalid session id." }, { status: 400 });
  }

  let json: unknown = {};
  try {
    const text = await request.text();
    if (text.trim()) json = JSON.parse(text);
  } catch {
    return NextResponse.json({ message: "Invalid JSON body." }, { status: 400 });
  }

  const parsed = enrichBodySchema.safeParse(json);
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
      { message: "보강할 수 없는 플랜 상태입니다.", code: "invalid_status" },
      { status: 409 },
    );
  }

  if (!session!.plan) {
    return NextResponse.json(
      { message: "보강할 일정이 없습니다.", code: "missing_plan" },
      { status: 409 },
    );
  }

  try {
    const enrichment = await enrichPlannerSession({
      sessionId: session!.id,
      plan: session!.plan,
    });

    return NextResponse.json({ enrichment });
  } catch {
    return NextResponse.json(
      {
        enrichment: {
          planFingerprint: "",
          places: [],
          routes: [],
          weather: { availability: "unavailable", days: [] },
          partialFailure: true,
          message: "일부 장소 정보를 확인하지 못했습니다.",
        },
      },
      { status: 200 },
    );
  }
}
