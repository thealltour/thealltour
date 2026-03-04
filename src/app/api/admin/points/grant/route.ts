import { NextResponse } from "next/server";
import { requireAdminSession } from "@/lib/apiAuth";
import { grantPointsToUser } from "@/server/services/points/grantPoints";

type Body = {
  userId: string;
  amount: number;
  reason: string;
  refType?: string;
  refId?: string;
  expiresAt?: string;
  status?: "CONFIRMED" | "PENDING";
};

/** 관리자: 포인트 수동 지급 — ledger EARN, balance 또는 pending 반영, 알림 */
export async function POST(request: Request) {
  const auth = await requireAdminSession();
  if (!auth.ok) return auth.res;

  let body: Body;
  try {
    body = (await request.json()) as Body;
  } catch {
    return NextResponse.json({ message: "요청 형식이 올바르지 않습니다." }, { status: 400 });
  }

  const userId = body.userId?.trim();
  const amount = Number(body.amount);
  const reason = body.reason?.trim() || "관리자 지급";
  const status = body.status === "PENDING" ? "PENDING" : "CONFIRMED";

  if (!userId) {
    return NextResponse.json({ message: "userId는 필수입니다." }, { status: 400 });
  }
  if (!Number.isFinite(amount) || amount <= 0) {
    return NextResponse.json({ message: "amount는 1 이상의 숫자여야 합니다." }, { status: 400 });
  }

  try {
    const result = await grantPointsToUser({
      userId,
      amount,
      status,
      reason,
      refType: body.refType?.trim() || undefined,
      refId: body.refId?.trim() || undefined,
      expiresAt: body.expiresAt?.trim() || null,
      actorAdminId: "ADMIN",
    });

    return NextResponse.json({
      message: status === "CONFIRMED" ? `${amount}P 지급되었습니다.` : `${amount}P가 대기 상태로 기록되었습니다.`,
      ledgerId: result.ledgerId,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "포인트 지급에 실패했습니다.";
    return NextResponse.json({ message }, { status: 500 });
  }
}
