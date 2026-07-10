import { cookies } from "next/headers";
import { getMemberPointsData } from "@/lib/member/meServerData";
import { getMemberSessionFromCookies } from "@/lib/memberSession";

export type MyPageMemberSummary = {
  name: string;
  points: number | null;
};

export async function getMyPageMemberSummary(): Promise<MyPageMemberSummary | null> {
  const cookieStore = await cookies();
  const session = getMemberSessionFromCookies(cookieStore);
  if (!session) return null;

  const pointsData = await getMemberPointsData(session.memberId);
  return {
    name: session.name,
    points: typeof pointsData?.balance === "number" ? pointsData.balance : null,
  };
}
