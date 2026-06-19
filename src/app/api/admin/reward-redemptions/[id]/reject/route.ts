import { NextResponse } from "next/server";
import { requireAdminSession } from "@/lib/apiAuth";
import {
  mapRedemptionServiceError,
  rejectRewardRedemption,
} from "@/server/services/rewards/redemptions";

/** @deprecated /api/admin/rewards/redemptions/[id]/reject 사용 */
export async function POST(
  request: Request,
  context: { params: Promise<{ id: string }> },
) {
  const auth = await requireAdminSession();
  if (!auth.ok) return auth.res;

  const { id } = await context.params;
  const body = (await request.json().catch(() => ({}))) as {
    admin_memo?: string;
    admin_note?: string;
    reason?: string;
  };
  const adminMemo = body.admin_memo?.trim() ?? body.admin_note?.trim() ?? null;

  try {
    await rejectRewardRedemption({
      redemptionId: id,
      adminMemo,
      reason: body.reason?.trim() ?? adminMemo,
    });
    return NextResponse.json({ message: "거절되었습니다. 포인트가 복구되었습니다." });
  } catch (error) {
    const mapped = mapRedemptionServiceError(error);
    return NextResponse.json({ message: mapped.message }, { status: mapped.status });
  }
}
