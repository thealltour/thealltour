import type { SupabaseClient } from "@supabase/supabase-js";

type MemberPointsRow = {
  point_balance?: number | null;
  points?: number | null;
};

export function getMemberPointBalance(member: MemberPointsRow | null | undefined): number {
  return Number(member?.point_balance ?? member?.points ?? 0);
}

export function buildMemberPointUpdatePayload(
  member: MemberPointsRow | null | undefined,
  nextBalance: number,
): { point_balance?: number; points?: number } {
  if (member && member.point_balance !== undefined && member.point_balance !== null) {
    return { point_balance: nextBalance };
  }
  return { points: nextBalance };
}

export async function fetchMemberPoints(
  client: SupabaseClient,
  userId: string,
): Promise<{ balance: number; row: MemberPointsRow | null }> {
  const { data } = await client.from("members").select("point_balance, points").eq("id", userId).maybeSingle();
  const row = data as MemberPointsRow | null;
  return { balance: getMemberPointBalance(row), row };
}

export const REWARD_REDEMPTION_REF_TYPE = "REWARD_REDEMPTION" as const;
