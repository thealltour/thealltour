import { NextResponse } from "next/server";
import { requireAdminSession } from "@/lib/apiAuth";
import {
  mapRedemptionServiceError,
  shipRewardRedemption,
} from "@/server/services/rewards/redemptions";

export async function POST(
  request: Request,
  context: { params: Promise<{ id: string }> },
) {
  const auth = await requireAdminSession();
  if (!auth.ok) return auth.res;

  const { id } = await context.params;
  let body: { tracking_carrier?: string; tracking_number?: string; admin_memo?: string };
  try {
    body = (await request.json()) as {
      tracking_carrier?: string;
      tracking_number?: string;
      admin_memo?: string;
    };
  } catch {
    body = {};
  }

  try {
    await shipRewardRedemption({
      redemptionId: id,
      trackingCarrier: body.tracking_carrier ?? null,
      trackingNumber: body.tracking_number ?? null,
      adminMemo: body.admin_memo ?? null,
    });
    return NextResponse.json({ message: "발송 처리되었습니다." });
  } catch (error) {
    const mapped = mapRedemptionServiceError(error);
    return NextResponse.json({ message: mapped.message }, { status: mapped.status });
  }
}
