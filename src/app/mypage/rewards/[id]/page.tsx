import { redirect } from "next/navigation";

type Props = { params: Promise<{ id: string }> };

/** 이전 경로 호환: /mypage/rewards/[id] → 리워드 교환소로 이동 (해당 경품은 카탈로그에서 교환 신청 가능) */
export default async function MypageRewardsIdPage({ params }: Props) {
  await params;
  redirect("/mypage/rewards");
}
