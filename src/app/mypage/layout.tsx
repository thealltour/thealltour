import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import SiteHeader from "@/components/site-chrome/SiteHeader";
import { getMemberSessionFromCookies } from "@/lib/memberSession";

export default async function MypageRouteLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const cookieStore = await cookies();
  const session = getMemberSessionFromCookies(cookieStore);
  if (!session) redirect("/login");

  return (
    <div className="min-h-screen bg-gradient-to-b from-[var(--surface-muted)] to-[var(--bg)] text-[var(--text-primary)]">
      <SiteHeader />
      {children}
    </div>
  );
}
