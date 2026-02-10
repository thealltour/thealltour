import Image from "next/image";
import Link from "next/link";
import { cookies } from "next/headers";
import MemberLogoutButton from "@/components/MemberLogoutButton";
import { getMemberSessionFromCookies } from "@/lib/memberSession";

type SiteHeaderProps = {
  activeTab?: "about" | "quote" | "reviews" | "blog" | "support" | "products" | "signup";
};

function getMenuClass(isActive: boolean) {
  return isActive ? "text-[#1d4ed8]" : "transition hover:text-[#1d4ed8]";
}

export default async function SiteHeader({ activeTab }: SiteHeaderProps) {
  const cookieStore = await cookies();
  const session = getMemberSessionFromCookies(cookieStore);

  return (
    <header className="border-b border-slate-200 bg-white/95 backdrop-blur">
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

        <nav className="hidden items-center gap-10 text-lg font-semibold text-slate-700 lg:flex">
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

        <div className="flex items-center gap-3 text-xs font-medium text-slate-400 md:text-sm">
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
