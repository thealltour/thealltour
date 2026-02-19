import Image from "next/image";
import Link from "next/link";
import { cookies } from "next/headers";
import MemberLogoutButton from "@/components/MemberLogoutButton";
import { getMemberSessionFromCookies } from "@/lib/memberSession";

type SiteHeaderProps = {
  activeTab?: "about" | "quote" | "reviews" | "blog" | "support" | "products" | "signup";
};

function getMenuClass(isActive: boolean) {
  return isActive
    ? "rounded-full bg-[#e0ecff] px-3 py-1 text-[#1d4ed8]"
    : "rounded-full px-3 py-1 transition hover:bg-[#f1f5f9] hover:text-[#1d4ed8]";
}

export default async function SiteHeader({ activeTab }: SiteHeaderProps) {
  const cookieStore = await cookies();
  const session = getMemberSessionFromCookies(cookieStore);

  return (
    <header className="sticky top-0 z-40 border-b border-slate-200 bg-white/90 backdrop-blur">
      <div className="mx-auto flex w-full max-w-6xl items-center justify-between px-6 py-4 md:px-10">
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

        <nav className="hidden items-center gap-2 text-base font-semibold text-slate-700 lg:flex">
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
          <Link className={getMenuClass(activeTab === "products")} href="/products">
            패키지상품
          </Link>
        </nav>

        <div className="flex items-center gap-2 text-xs font-medium text-slate-500 md:text-sm">
          <Link
            href="/quote"
            className="hidden rounded-full bg-[#1d4ed8] px-4 py-2 text-xs font-semibold text-white transition hover:bg-[#1e40af] md:inline-flex"
          >
            빠른 상담 신청
          </Link>
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
    </header>
  );
}
