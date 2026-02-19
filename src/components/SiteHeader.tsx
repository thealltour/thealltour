import Image from "next/image";
import Link from "next/link";
import { cookies } from "next/headers";
import HeaderProductSearch from "@/components/HeaderProductSearch";
import MemberLogoutButton from "@/components/MemberLogoutButton";
import MobileFloatingMenu from "@/components/MobileFloatingMenu";
import { getMemberSessionFromCookies } from "@/lib/memberSession";

type SiteHeaderProps = {
  activeTab?: "about" | "quote" | "reviews" | "blog" | "support" | "products" | "signup";
  searchQuery?: string;
};

function getMenuClass(isActive: boolean) {
  return isActive
    ? "shrink-0 whitespace-nowrap rounded-full border border-[var(--line)] bg-[#eff6ff] px-3 py-1.5 text-[var(--brand-strong)] shadow-sm"
    : "shrink-0 whitespace-nowrap rounded-full px-3 py-1.5 text-[#0f172a] transition hover:bg-[#eff6ff] hover:text-[var(--brand-strong)]";
}

function getSubMenuClass(isActive: boolean) {
  return isActive
    ? "shrink-0 whitespace-nowrap rounded-full border border-[var(--line)] bg-[#eff6ff] px-3.5 py-1.5 text-[15px] font-bold text-[var(--brand-strong)] shadow-sm"
    : "shrink-0 whitespace-nowrap rounded-full px-3.5 py-1.5 text-[15px] font-bold text-[#0f172a] transition hover:bg-[#eff6ff] hover:text-[var(--brand-strong)]";
}

export default async function SiteHeader({ activeTab, searchQuery }: SiteHeaderProps) {
  const cookieStore = await cookies();
  const session = getMemberSessionFromCookies(cookieStore);

  return (
    <header className="sticky top-0 z-40 border-b border-slate-200 bg-white/90 backdrop-blur">
      <div className="mx-auto hidden w-full max-w-6xl flex-col px-6 py-3 lg:flex md:px-10">
        <div className="flex items-center gap-4 pb-2.5">
          <Link href="/" className="flex shrink-0 items-center">
            <Image
              src="/thealltour-logo.png"
              alt="더올투어 로고"
              width={140}
              height={90}
              className="h-auto w-[120px]"
              priority
            />
          </Link>
          <nav className="min-w-0 flex-1 items-center justify-start gap-2 text-[18px] font-bold tracking-tight text-[#0f172a] lg:flex">
            <Link className={getMenuClass(activeTab === "about")} href="/about">
              회사소개
            </Link>
            <Link className={getMenuClass(activeTab === "quote")} href="/quote">
              견적문의
            </Link>
            <Link className={getMenuClass(activeTab === "reviews")} href="/reviews">
              여행후기
            </Link>
            <Link className={getMenuClass(activeTab === "blog")} href="/blog">
              블로그
            </Link>
            <Link className={getMenuClass(activeTab === "support")} href="/support">
              고객센터
            </Link>
          </nav>

          <div className="flex shrink-0 items-center gap-2 text-sm font-medium text-slate-500">
            {session ? (
              <>
                <span className="text-slate-500">{session.name}님</span>
                <span className="text-slate-300">|</span>
                <MemberLogoutButton />
              </>
            ) : (
              <>
                <Link className="transition hover:text-slate-600" href="/login">
                  로그인
                </Link>
                <span className="text-slate-300">|</span>
                <Link
                  className={activeTab === "signup" ? "text-[#1d4ed8]" : "transition hover:text-slate-600"}
                  href="/signup"
                >
                  회원가입
                </Link>
              </>
            )}
          </div>
        </div>

        <div className="flex items-center justify-center gap-3 border-t border-slate-100 pt-2">
          <div className="flex items-center gap-1.5">
            <Link className={getSubMenuClass(activeTab === "products")} href="/products">
              패키지상품
            </Link>
            <HeaderProductSearch mode="desktop" searchQuery={searchQuery} />
          </div>
          <Link
            href="/quote"
            className="rounded-full bg-[#1d4ed8] px-4 py-2 text-xs font-semibold text-white transition hover:bg-[#1e40af]"
          >
            빠른 상담
          </Link>
        </div>
      </div>

      <div className="mx-auto flex w-full max-w-6xl flex-col gap-2 px-6 py-4 lg:hidden md:px-10">
        <div className="flex items-center justify-between">
          <Link href="/" className="flex items-center">
            <Image
              src="/thealltour-logo.png"
              alt="더올투어 로고"
              width={140}
              height={90}
              className="h-auto w-[110px] md:w-[130px]"
              priority
            />
          </Link>
          <div className="flex shrink-0 items-center gap-1.5 text-xs font-medium text-slate-500 md:text-sm">
            {session ? (
              <>
                <span className="text-slate-500">{session.name}님</span>
                <span className="text-slate-300">|</span>
                <MemberLogoutButton />
              </>
            ) : (
              <>
                <Link className="transition hover:text-slate-600" href="/login">
                  로그인
                </Link>
                <span className="text-slate-300">|</span>
                <Link
                  className={activeTab === "signup" ? "text-[#1d4ed8]" : "transition hover:text-slate-600"}
                  href="/signup"
                >
                  회원가입
                </Link>
              </>
            )}
          </div>
        </div>
        <HeaderProductSearch mode="mobile" searchQuery={searchQuery} />
      </div>
      <MobileFloatingMenu activeTab={activeTab} />
    </header>
  );
}
