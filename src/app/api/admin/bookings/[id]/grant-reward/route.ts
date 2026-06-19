import { NextResponse } from "next/server";
import { requireAdminSession } from "@/lib/apiAuth";
import { grantRewardFromBooking } from "@/lib/bookings/grantBookingReward";

export async function POST(
  request: Request,
  context: { params: Promise<{ id: string }> },
) {
  const auth = await requireAdminSession();
  if (!auth.ok) return auth.res;
  const { id } = await context.params;

  let body: { admin_memo?: string } = {};
  try {
    body = (await request.json()) as { admin_memo?: string };
  } catch {
    body = {};
  }

  try {
    const result = await grantRewardFromBooking(id, { admin_memo: body.admin_memo });
    return NextResponse.json({
      message: `${result.amount.toLocaleString()}P 리워드가 지급되었습니다.`,
      ...result,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "리워드 지급에 실패했습니다.";
    return NextResponse.json({ message }, { status: 400 });
  }
}
