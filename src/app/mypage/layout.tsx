import { cookies, headers } from "next/headers";
import { redirect } from "next/navigation";
import SiteHeader from "@/components/site-chrome/SiteHeader";
import { getMemberSessionFromCookies } from "@/lib/memberSession";
import { sanitizeNextPath } from "@/lib/auth/redirect";

export default async function MypageRouteLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const cookieStore = await cookies();
  const session = getMemberSessionFromCookies(cookieStore);
  if (!session) {
    const headerStore = await headers();
    const fromHeader = headerStore.get("x-pathname");
    const next = sanitizeNextPath(
      fromHeader && fromHeader.startsWith("/mypage") ? fromHeader : "/mypage",
      "/mypage",
    );
    redirect(`/login?next=${encodeURIComponent(next)}`);
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-[var(--surface-muted)] to-[var(--bg)] text-[var(--text-primary)]">
      <SiteHeader />
      {children}
    </div>
  );
}
