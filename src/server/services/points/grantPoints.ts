import { supabase } from "@/lib/supabase";
import { getPointExpiresAt } from "@/config/rewardPolicy";

export type GrantPointStatus = "CONFIRMED" | "PENDING";

type GrantPointsParams = {
  userId: string;
  amount: number;
  status: GrantPointStatus;
  reason: string;
  refType?: string;
  refId?: string;
  actorAdminId?: string | null;
  expiresAt?: string | null;
};

export async function grantPointsToUser(params: GrantPointsParams) {
  const userId = params.userId.trim();
  const amount = Number(params.amount);
  if (!userId) throw new Error("userId는 필수입니다.");
  if (!Number.isFinite(amount) || amount <= 0) throw new Error("amount는 1 이상의 숫자여야 합니다.");

  const { data: memberRow, error: memberErr } = await supabase
    .from("members")
    .select("id, point_balance, point_pending")
    .eq("id", userId)
    .maybeSingle();

  if (memberErr || !memberRow) {
    throw new Error("회원을 찾을 수 없습니다.");
  }

  const currentBalance = Number((memberRow as { point_balance?: number }).point_balance ?? 0);
  const currentPending = Number((memberRow as { point_pending?: number }).point_pending ?? 0);
  const status = params.status === "PENDING" ? "PENDING" : "CONFIRMED";
  const now = new Date().toISOString();

  const { data: ledgerRow, error: ledgerErr } = await supabase
    .from("point_ledger")
    .insert({
      user_id: userId,
      type: "EARN",
      status,
      amount,
      reason: params.reason?.trim() || "관리자 지급",
      ref_type: params.refType?.trim() || null,
      ref_id: params.refId?.trim() || null,
      expires_at: params.expiresAt ?? getPointExpiresAt(),
      created_at: now,
    })
    .select("id")
    .maybeSingle();

  if (ledgerErr || !ledgerRow) {
    throw new Error("포인트 원장 기록에 실패했습니다.");
  }

  if (status === "CONFIRMED") {
    const { error: updateErr } = await supabase
      .from("members")
      .update({ point_balance: currentBalance + amount })
      .eq("id", userId);
    if (updateErr) throw new Error("포인트 반영에 실패했습니다.");
  } else {
    const { error: updateErr } = await supabase
      .from("members")
      .update({ point_pending: currentPending + amount })
      .eq("id", userId);
    if (updateErr) throw new Error("대기 포인트 반영에 실패했습니다.");
  }

  await supabase.from("notifications").insert({
    user_id: userId,
    type: "POINT_EARNED",
    title: "포인트 적립",
    body:
      status === "CONFIRMED"
        ? `${amount}P가 적립되었습니다.`
        : `${amount}P가 적립 예정입니다. (확정 후 사용 가능합니다.)`,
  });

  return {
    ledgerId: (ledgerRow as { id: string }).id,
    appliedStatus: status,
    actorAdminId: params.actorAdminId ?? null,
  };
}
