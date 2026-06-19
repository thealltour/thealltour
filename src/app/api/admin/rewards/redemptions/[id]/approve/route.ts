import { NextResponse } from "next/server";
import { requireAdminSession } from "@/lib/apiAuth";
import {
  approveRewardRedemption,
  mapRedemptionServiceError,
} from "@/server/services/rewards/redemptions";

export async function POST(
  request: Request,
  context: { params: Promise<{ id: string }> },
) {
  const auth = await requireAdminSession();
  if (!auth.ok) return auth.res;

  const { id } = await context.params;
  let body: { admin_memo?: string };
  try {
    body = (await request.json()) as { admin_memo?: string };
  } catch {
    body = {};
  }

  try {
    await approveRewardRedemption({ redemptionId: id, adminMemo: body.admin_memo ?? null });
    return NextResponse.json({ message: "승인되었습니다." });
  } catch (error) {
    const mapped = mapRedemptionServiceError(error);
    return NextResponse.json({ message: mapped.message }, { status: mapped.status });
  }
}
