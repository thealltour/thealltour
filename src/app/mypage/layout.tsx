import { redirect } from "next/navigation";
import { cookies } from "next/headers";
import { getMemberSessionFromCookies } from "@/lib/memberSession";
import SiteHeader from "@/components/SiteHeader";
import MypageNav from "@/components/mypage/MypageNav";

export default async function MypageLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const cookieStore = await cookies();
  const session = getMemberSessionFromCookies(cookieStore);
  if (!session) {
    redirect("/login?next=/mypage");
  }

  return (
    <div className="min-h-screen bg-[var(--bg)] text-[var(--text-primary)]">
      <SiteHeader />
      <main className="mx-auto max-w-6xl px-4 py-6 md:py-8">
        <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <h1 className="text-xl font-bold text-[var(--text-primary)]">마이페이지</h1>
          <p className="text-sm text-[var(--text-secondary)]">{session.name}님</p>
        </div>
        <div className="flex flex-col gap-8 lg:flex-row lg:gap-10">
          <aside className="shrink-0 lg:w-52">
            <div className="rounded-xl border border-[var(--border)] bg-[var(--surface)] p-3">
              <MypageNav />
            </div>
          </aside>
          <div className="min-w-0 flex-1">{children}</div>
        </div>
      </main>
    </div>
  );
}
