"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";
import { Instagram, Mail, MessageCircle, Phone } from "lucide-react";
import { PageContainer } from "@/components/layout/PageContainer";
import { buttonVariants } from "@/components/ui/Button";
import { cn } from "@/lib/cn";

type SiteSettingsClient = {
  kakao_channel_url?: string;
  instagram_url?: string;
  company_name?: string;
  ceo_name?: string;
  address?: string;
  business_reg_no?: string;
  tourism_reg_no?: string;
  mail_order_reg_no?: string;
  main_phone?: string;
  main_email?: string;
};

const focusRing = "focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-[var(--focus-ring)]";

export default function GlobalSiteFooter() {
  const pathname = usePathname();
  const [settings, setSettings] = useState<SiteSettingsClient | null>(null);

  useEffect(() => {
    let isMounted = true;
    async function load() {
      try {
        const response = await fetch("/api/site-settings", { cache: "no-store" });
        const result = (await response.json()) as SiteSettingsClient | { message?: string };
        if (!response.ok || !result || typeof result !== "object" || "message" in result) {
          return;
        }
        if (isMounted) {
          setSettings(result as SiteSettingsClient);
        }
      } catch {
        // 실패 시에는 기본 URL 사용
      }
    }
    load();
    return () => {
      isMounted = false;
    };
  }, []);

  if (pathname.startsWith("/admin") || pathname.startsWith("/theall_manager_only")) {
    return null;
  }

  const companyName = settings?.company_name ?? "(주)더올투어";
  const ceoName = settings?.ceo_name ?? "김지호";
  const address = settings?.address ?? "경기도 고양시 덕양구 용현로 27, 407호(행신동, 행신프라자)";
  const businessRegNo = settings?.business_reg_no ?? "645-88-03583";
  const tourismRegNo = settings?.tourism_reg_no ?? "미정";
  const mailOrderRegNo = settings?.mail_order_reg_no ?? "미정";
  const mainPhone = settings?.main_phone ?? "02-0000-0000";
  const mainEmail = settings?.main_email ?? "thealltour@gmail.com";
  const kakaoChannelUrl = settings?.kakao_channel_url ?? "https://pf.kakao.com";
  const instagramUrl = settings?.instagram_url ?? "https://www.instagram.com/thealltour";

  return (
    <footer className="border-t border-[var(--divider)] bg-[var(--surface-muted)] text-[var(--foreground)]">
      <PageContainer size="wide">
        {/* 본문: 브랜드·회사정보 | 연락·액션 */}
        <div className="border-b border-[var(--divider)] py-5 sm:py-7 md:py-8">
          <div className="grid gap-4 sm:gap-9 md:grid-cols-[minmax(0,1.15fr)_minmax(0,1fr)] md:items-start md:gap-10 lg:gap-14">
            <div className="min-w-0">
              <p className="type-caption font-semibold uppercase tracking-[0.14em] text-[var(--text-subtle)]">
                THE ALL TOUR
              </p>
              <p className="font-card-title mt-1 text-xl font-bold tracking-tight text-[var(--foreground)] sm:text-2xl">
                {companyName}
              </p>
              <p className="mt-1.5 max-w-md text-sm leading-snug text-[var(--text-subtle)] sm:mt-2">
                맞춤형 해외·국내 골프·패키지 여행을 전문 상담으로 설계합니다.
              </p>
              <ul className="mt-3 space-y-0.5 text-[13px] leading-snug text-[var(--text-subtle)] sm:mt-4 sm:space-y-1 sm:text-sm sm:leading-snug">
                <li>
                  <span className="font-semibold text-[var(--foreground)]">대표</span>{" "}
                  <span>{ceoName}</span>
                </li>
                <li>
                  <span className="font-semibold text-[var(--foreground)]">주소</span>{" "}
                  <span className="break-words">{address}</span>
                </li>
                <li>
                  <span className="font-semibold text-[var(--foreground)]">사업자등록번호</span>{" "}
                  <span>{businessRegNo}</span>
                </li>
                <li>
                  <span className="font-semibold text-[var(--foreground)]">관광사업등록번호</span>{" "}
                  <span>{tourismRegNo}</span>
                </li>
                <li>
                  <span className="font-semibold text-[var(--foreground)]">통신판매업신고번호</span>{" "}
                  <span>{mailOrderRegNo}</span>
                </li>
              </ul>
            </div>

            <div className="flex min-w-0 flex-col gap-3 sm:gap-3.5">
              {/* 1순위: 카카오 */}
              <div>
                <p className="mb-1.5 type-caption font-medium text-[var(--text-subtle)]">
                  상담 · 채널
                </p>
                <a
                  href={kakaoChannelUrl ?? "https://pf.kakao.com"}
                  target="_blank"
                  rel="noreferrer"
                  className={cn(
                    buttonVariants({
                      variant: "kakao",
                      size: "md",
                      className: "h-11 w-full justify-center gap-2 px-4 sm:w-auto sm:min-w-[220px]",
                    }),
                    focusRing,
                  )}
                >
                  <MessageCircle className="h-4 w-4 shrink-0" aria-hidden />
                  카카오 채널
                </a>
              </div>

              {/* 2순위: 전화 · 이메일 */}
              <div>
                <p className="mb-1 type-caption font-medium text-[var(--text-subtle)] sm:mb-1.5">
                  연락처
                </p>
                <div className="flex flex-wrap gap-1.5 sm:gap-2">
                  <a
                    href={`tel:${mainPhone}`}
                    className={cn("footer-pill-secondary", focusRing)}
                  >
                    <Phone className="h-3.5 w-3.5 shrink-0 opacity-80" aria-hidden />
                    <span className="tabular-nums">대표 {mainPhone}</span>
                  </a>
                  <a
                    href={`mailto:${mainEmail}`}
                    className={cn("footer-pill-secondary", focusRing)}
                  >
                    <Mail className="h-3.5 w-3.5 shrink-0 opacity-80" aria-hidden />
                    <span className="max-w-[200px] truncate sm:max-w-none">{mainEmail}</span>
                  </a>
                </div>
              </div>

              {/* 3순위: 인스타 */}
              <div>
                <p className="mb-1 type-caption font-medium text-[var(--text-subtle)] sm:mb-1.5">
                  SNS
                </p>
                <a
                  href={instagramUrl ?? "https://www.instagram.com/thealltour"}
                  target="_blank"
                  rel="noreferrer"
                  className={cn("footer-pill-tertiary inline-flex items-center gap-1.5", focusRing)}
                >
                  <Instagram className="h-3.5 w-3.5 shrink-0 opacity-80" aria-hidden />
                  인스타그램
                </a>
              </div>
            </div>
          </div>
        </div>

        {/* 하단: 정책 + 저작권 */}
        <div className="flex flex-col gap-2 py-3 sm:flex-row sm:flex-wrap sm:items-center sm:justify-between sm:gap-x-6 sm:gap-y-2 sm:gap-3 sm:py-4 md:py-5">
          <nav
            className="flex flex-wrap gap-x-0.5 gap-y-1 sm:gap-x-2 sm:gap-y-2"
            aria-label="약관 및 정책"
          >
            <Link
              href="/terms"
              className={cn("footer-pill-tertiary", focusRing)}
            >
              이용약관
            </Link>
            <Link
              href="/privacy"
              className={cn("footer-pill-tertiary", focusRing)}
            >
              개인정보처리방침
            </Link>
          </nav>
          <p className="text-center type-caption leading-snug text-[var(--text-subtle)] sm:text-right">
            © {new Date().getFullYear()} 더올투어. All rights reserved
            <Link
              href="/theall_manager_only"
              aria-label="관리자 전용 페이지"
              className="cursor-default no-underline hover:no-underline focus:no-underline"
            >
              .
            </Link>
          </p>
        </div>
      </PageContainer>
    </footer>
  );
}
