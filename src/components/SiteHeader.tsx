import { cookies } from "next/headers";
import SiteHeaderUI from "@/components/SiteHeaderUI";
import { getMemberSessionFromCookies } from "@/lib/memberSession";
import { supabase } from "@/lib/supabase";

type SiteHeaderProps = {
  activeTab?: "about" | "quote" | "reviews" | "blog" | "support" | "products" | "signup";
  searchQuery?: string;
  golfPresetActive?: boolean;
  quickConsultHref?: string;
  kakaoConsultHref?: string;
};

export default async function SiteHeader({
  activeTab,
  searchQuery,
  golfPresetActive = false,
  quickConsultHref,
  kakaoConsultHref,
}: SiteHeaderProps) {
  const cookieStore = await cookies();
  const session = getMemberSessionFromCookies(cookieStore);
  let memberPoints: number | null = null;

  if (session) {
    const { data } = await supabase
      .from("members")
      .select("points")
      .eq("id", session.memberId)
      .maybeSingle();
    if (data && typeof data.points === "number") {
      memberPoints = data.points;
    }
  }

  return (
    <SiteHeaderUI
      activeTab={activeTab}
      searchQuery={searchQuery}
      golfPresetActive={golfPresetActive}
      quickConsultHref={quickConsultHref}
      kakaoConsultHref={kakaoConsultHref}
      session={session ? { name: session.name } : null}
      memberPoints={memberPoints}
    />
  );
}
