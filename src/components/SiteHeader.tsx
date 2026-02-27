import Image from "next/image";
import Link from "next/link";
import { cookies } from "next/headers";
import { Check, X } from "lucide-react";
import HeaderProductSearch from "@/components/HeaderProductSearch";
import MemberLogoutButton from "@/components/MemberLogoutButton";
import MobileFloatingMenu from "@/components/MobileFloatingMenu";
import HeaderQuickConsultCtas from "@/components/HeaderQuickConsultCtas";
import HeaderMobileShell from "@/components/HeaderMobileShell";
import { getMemberSessionFromCookies } from "@/lib/memberSession";
import { supabase } from "@/lib/supabase";

type SiteHeaderProps = {
  activeTab?: "about" | "quote" | "reviews" | "blog" | "support" | "products" | "signup";
  searchQuery?: string;
  golfPresetActive?: boolean;
  quickConsultHref?: string;
  kakaoConsultHref?: string;
};

function getMenuClass(isActive: boolean) {
  const base = "shrink-0 whitespace-nowrap type-nav transition-colors duration-150";
  return isActive ? `${base} type-nav-active text-white` : `${base} text-white/70 hover:text-white`;
}

function getSubMenuClass(isActive: boolean) {
  const base =
    "shrink-0 whitespace-nowrap rounded-full border px-4 py-2 type-caption md:type-small transition-colors duration-150";
  return isActive
    ? `${base} bg-[rgba(30,58,138,0.18)] border-[rgba(30,58,138,0.35)] text-white`
    : `${base} bg-white/5 border-white/10 text-white/80 hover:bg-white/8 hover:border-white/15`;
}

function getGolfSubMenuClass(isActive: boolean) {
  const base =
    "shrink-0 whitespace-nowrap rounded-full border px-4 py-2 type-caption md:type-small transition-colors duration-150";
  return isActive
    ? `${base} bg-[rgba(34,197,94,0.18)] border-[rgba(34,197,94,0.45)] text-white`
    : `${base} bg-white/5 border-white/10 text-white/80 hover:bg-white/8 hover:border-white/15`;
}

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
    <header className="sticky top-0 z-40 border-b border-[rgba(184,150,46,0.32)] bg-[rgba(27,36,49,0.92)] backdrop-blur-md">
      <div className="mx-auto hidden w-full max-w-6xl flex-col px-6 py-4 lg:flex md:px-10">
        <div className="flex items-center gap-6 pb-2.5">
          <Link
            href="/"
            className="flex shrink-0 items-center gap-2.5 rounded-2xl border border-white/10 bg-white/[0.05] px-3.5 py-2 transition-colors duration-150 hover:bg-white/10"
            aria-label="더올투어 홈"
          >
            <Image
              src="/thealltour-logo.png"
              alt=""
              width={64}
              height={64}
              sizes="64px"
              className="h-10 w-10 object-contain md:h-11 md:w-11"
            />
            <div className="flex flex-col justify-center leading-tight">
              <span className="heading-display-hero text-[15px] font-bold tracking-tight text-white md:text-[17px]">
                더올투어
              </span>
              <span className="mt-0.5 type-caption font-medium tracking-wide text-white/60">
                Golf & Premium Travel
              </span>
            </div>
          </Link>
          <nav className="min-w-0 flex-1 items-center justify-center gap-8 tracking-tight lg:flex">
            <Link className={getMenuClass(activeTab === "about")} href="/about">
              <span className="relative inline-flex flex-col items-center">
                <span>회사소개</span>
                {activeTab === "about" ? (
                  <span className="mt-1 h-[2px] w-6 rounded-full bg-[rgba(184,150,46,0.55)] shadow-[0_0_8px_rgba(184,150,46,0.45)]" />
                ) : null}
              </span>
            </Link>
            <Link className={getMenuClass(activeTab === "quote")} href="/quote">
              <span className="relative inline-flex flex-col items-center">
                <span>견적문의</span>
                {activeTab === "quote" ? (
                  <span className="mt-1 h-[2px] w-6 rounded-full bg-[rgba(184,150,46,0.55)] shadow-[0_0_8px_rgba(184,150,46,0.45)]" />
                ) : null}
              </span>
            </Link>
            <Link className={getMenuClass(activeTab === "reviews")} href="/reviews">
              <span className="relative inline-flex flex-col items-center">
                <span>여행후기</span>
                {activeTab === "reviews" ? (
                  <span className="mt-1 h-[2px] w-6 rounded-full bg-[rgba(184,150,46,0.55)] shadow-[0_0_8px_rgba(184,150,46,0.45)]" />
                ) : null}
              </span>
            </Link>
            <Link className={getMenuClass(activeTab === "blog")} href="/blog">
              <span className="relative inline-flex flex-col items-center">
                <span>여행가이드</span>
                {activeTab === "blog" ? (
                  <span className="mt-1 h-[2px] w-6 rounded-full bg-[rgba(184,150,46,0.55)] shadow-[0_0_8px_rgba(184,150,46,0.45)]" />
                ) : null}
              </span>
            </Link>
            <Link className={getMenuClass(activeTab === "support")} href="/support">
              <span className="relative inline-flex flex-col items-center">
                <span>고객센터</span>
                {activeTab === "support" ? (
                  <span className="mt-1 h-[2px] w-6 rounded-full bg-[rgba(184,150,46,0.55)] shadow-[0_0_8px_rgba(184,150,46,0.45)]" />
                ) : null}
              </span>
            </Link>
          </nav>

          <div className="flex shrink-0 items-center gap-3 type-small font-medium text-content-secondary">
            {session ? (
              <>
                <span className="text-content-secondary">{session.name}님</span>
              {memberPoints !== null ? (
                <span className="inline-flex items-center gap-1 rounded-full bg-[#eff6ff] px-2 py-1 type-caption font-semibold text-[#1E3A8A]">
                  포인트
                  <span className="tabular-nums type-caption">
                    {memberPoints.toLocaleString("ko-KR")}P
                  </span>
                </span>
              ) : null}
                <span className="text-slate-300">|</span>
                <MemberLogoutButton />
              </>
            ) : (
              <>
                <Link className="type-small transition hover:text-content-primary" href="/login">
                  로그인
                </Link>
                <span className="text-slate-300">|</span>
                <Link
                  className={activeTab === "signup" ? "text-[#1E3A8A]" : "type-small transition hover:text-content-primary"}
                  href="/signup"
                >
                  회원가입
                </Link>
              </>
            )}
          </div>
        </div>

        <div className="flex items-center gap-3 border-t border-white/10 pt-3">
          <div className="flex shrink-0 items-center gap-2">
            <Link className={getSubMenuClass(activeTab === "products")} href="/products">
              <span className="flex items-center gap-1.5">
                {activeTab === "products" ? (
                  <Check className="h-3.5 w-3.5" aria-hidden="true" />
                ) : null}
                <span>패키지상품</span>
                {activeTab === "products" ? (
                  <X className="h-3 w-3 text-white/70" aria-hidden="true" />
                ) : null}
              </span>
            </Link>
            <Link className={getGolfSubMenuClass(golfPresetActive)} href="/products?tourType=golf-park">
              <span className="flex items-center gap-1.5">
                {golfPresetActive ? (
                  <Check className="h-3.5 w-3.5" aria-hidden="true" />
                ) : null}
                <span>골프/파크골프</span>
                {golfPresetActive ? (
                  <X className="h-3 w-3 text-white/70" aria-hidden="true" />
                ) : null}
              </span>
            </Link>
          </div>

          <div className="flex flex-1 justify-center px-2">
            <HeaderProductSearch mode="desktop" searchQuery={searchQuery} />
          </div>

          <HeaderQuickConsultCtas
            quickConsultHref={quickConsultHref}
            kakaoConsultHref={kakaoConsultHref}
          />
        </div>
      </div>

      {/* 모바일 전용 헤더 (클라이언트 컴포넌트) */}
      <HeaderMobileShell activeTab={activeTab} searchQuery={searchQuery} />
      <MobileFloatingMenu activeTab={activeTab} isLoggedIn={!!session} />
    </header>
  );
}
