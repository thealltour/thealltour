import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { ENABLE_FREE_TRAVEL_PLANNER } from "@/config/featureFlags";
import { getMemberSessionFromCookies } from "@/lib/memberSession";
import { listSavedPlannerSessionsForMember } from "@/lib/planner/repository";
import { SAVED_PLANNER_LIST_DEFAULT_LIMIT } from "@/lib/planner/savedPlanDto";

export const dynamic = "force-dynamic";

/**
 * GET /api/planner/saved
 * Returns the current member's saved plans. memberId is never accepted from the client.
 */
export async function GET() {
  if (!ENABLE_FREE_TRAVEL_PLANNER) {
    return NextResponse.json({ message: "Planner is disabled." }, { status: 404 });
  }

  const cookieStore = await cookies();
  const memberSession = getMemberSessionFromCookies(cookieStore);
  if (!memberSession?.memberId) {
    return NextResponse.json({ message: "로그인이 필요합니다.", code: "unauthorized" }, { status: 401 });
  }

  try {
    const plans = await listSavedPlannerSessionsForMember({
      memberId: memberSession.memberId,
      limit: SAVED_PLANNER_LIST_DEFAULT_LIMIT,
    });

    return NextResponse.json({
      plans,
      count: plans.length,
    });
  } catch {
    return NextResponse.json(
      { message: "저장한 플랜을 불러오지 못했습니다." },
      { status: 500 },
    );
  }
}
