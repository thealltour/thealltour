import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { ENABLE_FREE_TRAVEL_PLANNER } from "@/config/featureFlags";
import { getMemberSessionFromCookies } from "@/lib/memberSession";
import { plannerAnonymousKeySchema } from "@/lib/planner/schemas";
import { claimPlannerSessionForMember } from "@/lib/planner/repository";
import { z } from "zod";

export const dynamic = "force-dynamic";

type RouteContext = { params: Promise<{ id: string }> };

const saveBodySchema = z
  .object({
    anonymousKey: plannerAnonymousKeySchema,
  })
  .strict();

/**
 * POST /api/planner/sessions/[id]/save
 * Claims anonymous generated plan for the logged-in member, or marks already-owned generated as saved.
 * memberId / status / planJson are never accepted from the client.
 */
export async function POST(request: Request, context: RouteContext) {
  if (!ENABLE_FREE_TRAVEL_PLANNER) {
    return NextResponse.json({ message: "Planner is disabled." }, { status: 404 });
  }

  const { id } = await context.params;
  if (!id?.trim()) {
    return NextResponse.json({ message: "Invalid session id." }, { status: 400 });
  }

  const cookieStore = await cookies();
  const memberSession = getMemberSessionFromCookies(cookieStore);
  if (!memberSession?.memberId) {
    return NextResponse.json({ message: "로그인이 필요합니다.", code: "unauthorized" }, { status: 401 });
  }

  let json: unknown;
  try {
    json = await request.json();
  } catch {
    return NextResponse.json({ message: "Invalid JSON body." }, { status: 400 });
  }

  const parsed = saveBodySchema.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json(
      { message: parsed.error.issues[0]?.message ?? "Invalid request." },
      { status: 400 },
    );
  }

  const result = await claimPlannerSessionForMember({
    id: id.trim(),
    memberId: memberSession.memberId,
    anonymousKey: parsed.data.anonymousKey,
  });

  if (!result.ok) {
    if (result.reason === "not_found") {
      return NextResponse.json({ message: "Planner session not found." }, { status: 404 });
    }
    if (result.reason === "invalid_status") {
      return NextResponse.json(
        { message: "저장할 수 없는 플랜 상태입니다.", code: "invalid_status" },
        { status: 409 },
      );
    }
    if (result.reason === "forbidden") {
      return NextResponse.json({ message: "플랜을 저장할 수 없습니다." }, { status: 403 });
    }
    return NextResponse.json({ message: "플랜을 저장하지 못했습니다." }, { status: 409 });
  }

  const session = result.session;
  return NextResponse.json({
    session: {
      id: session.id,
      status: session.status,
      sourceProductId: session.sourceProductId,
      plan: session.plan,
      isSaved: session.status === "saved",
      updatedAt: session.updatedAt,
    },
    claimed: result.claimed,
  });
}
