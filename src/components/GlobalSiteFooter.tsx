"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

export default function GlobalSiteFooter() {
  const pathname = usePathname();

  if (pathname.startsWith("/admin") || pathname.startsWith("/theall_manager_only")) {
    return null;
  }

  return (
    <footer className="border-t border-slate-200 bg-[#f8fafc]">
      <div className="mx-auto grid w-full max-w-6xl gap-6 px-6 py-7 text-sm leading-7 text-slate-700 md:grid-cols-[1fr_auto] md:px-10">
        <div>
          <p className="text-base font-bold text-[#0f172a]">(주)더올투어</p>
          <p>대표: 김지호</p>
          <p>주소: 경기도 고양시 덕양구 용현로 27, 407호(행신동, 행신프라자)</p>
          <p>사업자등록번호: 645-88-03583</p>
          <p>통신판매업신고번호: 미정</p>
        </div>

        <div className="flex flex-col items-start gap-2 text-xs md:items-end">
          <a
            href="tel:02-0000-0000"
            className="inline-flex rounded-full border border-slate-300 bg-white px-3 py-1.5 font-medium text-slate-700 transition hover:bg-slate-50"
          >
            대표번호 02-0000-0000
          </a>
          <a
            href="mailto:help@thealltour.com"
            className="inline-flex rounded-full border border-slate-300 bg-white px-3 py-1.5 font-medium text-slate-700 transition hover:bg-slate-50"
          >
            help@thealltour.com
          </a>
          <div className="mt-1 flex items-center gap-2">
            <a
              href="https://pf.kakao.com"
              target="_blank"
              rel="noreferrer"
              className="inline-flex rounded-full border border-[#facc15] bg-[#fef9c3] px-3 py-1.5 font-medium text-[#854d0e] transition hover:bg-[#fde68a]"
            >
              카카오채널
            </a>
            <a
              href="https://www.instagram.com/thealltour"
              target="_blank"
              rel="noreferrer"
              className="inline-flex rounded-full border border-[#c4b5fd] bg-[#f5f3ff] px-3 py-1.5 font-medium text-[#5b21b6] transition hover:bg-[#ede9fe]"
            >
              인스타그램
            </a>
          </div>
        </div>
      </div>
      <div className="border-t border-slate-200 py-3 text-center text-xs text-slate-500">
        © {new Date().getFullYear()} 더올투어. All rights reserved
        <Link
          href="/theall_manager_only"
          aria-label="관리자 전용 페이지"
          className="cursor-default no-underline hover:no-underline focus:no-underline"
        >
          .
        </Link>
      </div>
    </footer>
  );
}
