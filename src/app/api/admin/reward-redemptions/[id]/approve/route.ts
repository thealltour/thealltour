import { NextResponse } from "next/server";
import { requireAdminSession } from "@/lib/apiAuth";
import {
  approveRewardRedemption,
  mapRedemptionServiceError,
  rejectRewardRedemption,
} from "@/server/services/rewards/redemptions";

/** @deprecated /api/admin/rewards/redemptions/[id]/approve 사용 */
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
    action?: string;
  };
  const adminMemo = body.admin_memo?.trim() ?? body.admin_note?.trim() ?? null;

  try {
    if (body.action === "reject") {
      await rejectRewardRedemption({ redemptionId: id, adminMemo, reason: adminMemo });
      return NextResponse.json({ message: "거절되었습니다. 포인트가 복구되었습니다." });
    }
    await approveRewardRedemption({ redemptionId: id, adminMemo });
    return NextResponse.json({ message: "승인되었습니다." });
  } catch (error) {
    const mapped = mapRedemptionServiceError(error);
    return NextResponse.json({ message: mapped.message }, { status: mapped.status });
  }
}
