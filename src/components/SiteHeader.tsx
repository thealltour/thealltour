import Image from "next/image";
import Link from "next/link";
import { cookies } from "next/headers";
import HeaderProductSearch from "@/components/HeaderProductSearch";
import MemberLogoutButton from "@/components/MemberLogoutButton";
import MobileFloatingMenu from "@/components/MobileFloatingMenu";
import { getMemberSessionFromCookies } from "@/lib/memberSession";
import { supabase } from "@/lib/supabase";

type SiteHeaderProps = {
  activeTab?: "about" | "quote" | "reviews" | "blog" | "support" | "products" | "signup";
  searchQuery?: string;
  golfPresetActive?: boolean;
};

function getMenuClass(isActive: boolean) {
  return isActive
    ? "shrink-0 whitespace-nowrap rounded-full border border-[var(--line)] bg-[#eff6ff] px-3 py-1.5 text-[var(--brand-strong)] shadow-sm"
    : "shrink-0 whitespace-nowrap rounded-full px-3 py-1.5 text-[#0f172a] transition hover:bg-[#eff6ff] hover:text-[var(--brand-strong)]";
}

function getSubMenuClass(isActive: boolean) {
  return `shrink-0 whitespace-nowrap rounded-full border border-[#93c5fd] px-3.5 py-1.5 text-[15px] font-bold transition ${
    isActive
      ? "bg-[#bfdbfe] text-[#1e3a8a] ring-1 ring-[#60a5fa]"
      : "bg-[#dbeafe] text-[#1e3a8a] hover:bg-[#bfdbfe]"
  }`;
}

function getGolfSubMenuClass(isActive: boolean) {
  return `shrink-0 whitespace-nowrap rounded-full border border-[#86efac] px-3.5 py-1.5 text-[15px] font-bold transition ${
    isActive
      ? "bg-[#bbf7d0] text-[#166534] ring-1 ring-[#4ade80]"
      : "bg-[#dcfce7] text-[#166534] hover:bg-[#bbf7d0]"
  }`;
}

export default async function SiteHeader({ activeTab, searchQuery, golfPresetActive = false }: SiteHeaderProps) {
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
    <header className="sticky top-0 z-40 border-b border-slate-200 bg-white/90 backdrop-blur">
      <div className="mx-auto hidden w-full max-w-6xl flex-col px-6 py-3 lg:flex md:px-10">
        <div className="flex items-center gap-4 pb-2.5">
          <Link href="/" className="flex shrink-0 items-center">
            <Image
              src="/thealltour-logo.png"
              alt="더올투어 로고"
              width={140}
              height={90}
              sizes="120px"
              className="h-auto w-[120px]"
            />
          </Link>
          <nav className="min-w-0 flex-1 items-center justify-center gap-2 text-[18px] font-bold tracking-tight text-[#0f172a] lg:flex">
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
              여행가이드
            </Link>
            <Link className={getMenuClass(activeTab === "support")} href="/support">
              고객센터
            </Link>
          </nav>

          <div className="flex shrink-0 items-center gap-3 text-sm font-medium text-slate-500">
            {session ? (
              <>
                <span className="text-slate-500">{session.name}님</span>
              {memberPoints !== null ? (
                <span className="inline-flex items-center gap-1 rounded-full bg-[#eff6ff] px-2 py-1 text-[11px] font-semibold text-[#1d4ed8]">
                  포인트
                  <span className="tabular-nums text-xs">
                    {memberPoints.toLocaleString("ko-KR")}P
                  </span>
                </span>
              ) : null}
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

        <div className="flex items-center justify-center gap-2.5 border-t border-slate-100 pt-2">
          <Link className={getSubMenuClass(activeTab === "products")} href="/products">
            패키지상품
          </Link>
          <Link className={getGolfSubMenuClass(golfPresetActive)} href="/products?tourType=golf-park">
            골프/파크골프
          </Link>
          <HeaderProductSearch mode="desktop" searchQuery={searchQuery} />
          <Link
            href="/quote"
            className="shrink-0 whitespace-nowrap rounded-full bg-[#1d4ed8] px-3.5 py-1.5 text-[15px] font-bold text-white transition hover:bg-[#1e40af]"
          >
            빠른 상담
          </Link>
        </div>
      </div>

      <div className="mx-auto flex w-full max-w-6xl flex-col gap-2.5 px-5 py-4 lg:hidden md:px-8">
        <div className="grid grid-cols-[auto_1fr_auto] items-center gap-2.5">
          <Link href="/" className="flex items-center">
            <Image
              src="/thealltour-logo.png"
              alt="더올투어 로고"
              width={140}
              height={90}
              sizes="(max-width: 768px) 110px, 130px"
              className="h-auto w-[105px] md:w-[120px]"
            />
          </Link>
          <div className="flex min-w-0 items-center justify-center gap-1.5">
            <Link
              href="/products"
              className={`shrink-0 whitespace-nowrap rounded-full border border-[#93c5fd] px-2.5 py-1.5 text-[11px] font-bold transition md:px-3 md:text-xs ${
                activeTab === "products"
                  ? "bg-[#bfdbfe] text-[#1e3a8a] ring-1 ring-[#60a5fa]"
                  : "bg-[#dbeafe] text-[#1e3a8a] hover:bg-[#bfdbfe]"
              }`}
            >
              패키지상품
            </Link>
            <Link
              href="/products?tourType=golf-park"
              className={`shrink-0 whitespace-nowrap rounded-full border border-[#86efac] px-2.5 py-1.5 text-[11px] font-bold transition md:px-3 md:text-xs ${
                golfPresetActive
                  ? "bg-[#bbf7d0] text-[#166534] ring-1 ring-[#4ade80]"
                  : "bg-[#dcfce7] text-[#166534] hover:bg-[#bbf7d0]"
              }`}
            >
              골프/파크골프
            </Link>
          </div>
          <div className="flex shrink-0 flex-col items-end gap-1.5 text-xs font-semibold leading-tight text-slate-600 md:text-sm">
            {session ? (
              <>
                <span className="text-slate-500">{session.name}님</span>
                <MemberLogoutButton />
              </>
            ) : (
              <>
                <Link
                  className="inline-flex min-h-7 items-center rounded px-2 transition hover:bg-slate-100 hover:text-slate-700"
                  href="/login"
                >
                  로그인
                </Link>
                <Link
                  className={
                    activeTab === "signup"
                      ? "inline-flex min-h-7 items-center rounded px-2 text-[#1d4ed8]"
                      : "inline-flex min-h-7 items-center rounded px-2 transition hover:bg-slate-100 hover:text-slate-700"
                  }
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
