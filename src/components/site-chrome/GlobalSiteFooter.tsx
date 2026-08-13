"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";
import { BookOpen, Instagram, Mail, MessageCircle, Phone, UsersRound } from "lucide-react";
import { PageContainer } from "@/components/layout/PageContainer";
import { buttonVariants } from "@/components/ui/Button";
import { cn } from "@/lib/cn";

type SiteSettingsClient = {
  kakao_channel_url?: string;
  instagram_url?: string;
  naver_band_url?: string;
  naver_blog_url?: string;
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

function isPlaceholderRegNo(value: string | undefined): boolean {
  const v = (value ?? "").trim();
  return !v || v === "미정";
}

function isPlaceholderPhone(value: string | undefined): boolean {
  const v = (value ?? "").trim();
  return !v || v === "02-0000-0000";
}

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

  /** 카카오싱크는 랜딩 레이아웃 안 축소 푸터를 쓰므로 루트 전폭 푸터는 숨김 */
  if (pathname.startsWith("/golf/kakao-sync")) {
    return null;
  }

  const isGolfAdLanding = pathname.startsWith("/golf/ads");

  const companyName = settings?.company_name ?? "(주)더올투어";
  const ceoName = settings?.ceo_name ?? "김지호";
  const address = settings?.address ?? "경기도 고양시 덕양구 용현로 27, 407호(행신동, 행신프라자)";
  const businessRegNo = settings?.business_reg_no ?? "645-88-03583";
  const tourismRegNo = settings?.tourism_reg_no?.trim() ?? "";
  const mailOrderRegNo = settings?.mail_order_reg_no?.trim() ?? "";
  const mainPhone = settings?.main_phone?.trim() ?? "";
  const showTourismReg = !isPlaceholderRegNo(tourismRegNo);
  const showMailOrderReg = !isPlaceholderRegNo(mailOrderRegNo);
  const showMainPhone = !isPlaceholderPhone(mainPhone);
  const mainEmail = settings?.main_email ?? "thealltour@gmail.com";
  const kakaoChannelUrl = settings?.kakao_channel_url ?? "https://pf.kakao.com";
  const instagramUrl = settings?.instagram_url ?? "https://www.instagram.com/thealltour";
  const naverBandUrl = (settings?.naver_band_url ?? "").trim();
  const naverBlogUrl = (settings?.naver_blog_url ?? "").trim();

  /** 상담·채널: 카카오, 인스타, (선택)밴드·블로그 — 그리드에서 동일 셀 크기 */
  const channelCount =
    1 + 1 + (naverBandUrl ? 1 : 0) + (naverBlogUrl ? 1 : 0);
  const channelGridClass = cn(
    "grid w-full items-stretch gap-2",
    channelCount === 2 && "grid-cols-2",
    channelCount === 3 && "grid-cols-3",
    channelCount >= 4 && "grid-cols-2 sm:grid-cols-4",
  );
  /** 그리드 행 높이에 맞춤. 글자는 카카오와 동일하게 `type-btn`(globals) 기준 */
  const channelBtnEqual =
    "flex min-h-[44px] h-full w-full min-w-0 shrink-0 items-center justify-center gap-1.5 px-1.5 py-1 text-center";

  return (
    <footer
      className={cn(
        "border-t border-[var(--divider)] bg-[var(--surface-muted)] text-[var(--foreground)]",
        isGolfAdLanding && "pb-[calc(3.25rem+env(safe-area-inset-bottom,0px))]",
      )}
    >
      <PageContainer
        size="wide"
        className={cn(isGolfAdLanding && "hardcoded-landing-x w-full px-4")}
      >
        {/* 본문: 브랜드·회사정보 | 연락·액션 */}
        <div className="border-b border-[var(--divider)] py-5 sm:py-7 md:py-8">
          <div className="grid gap-4 sm:gap-9 md:grid-cols-[minmax(0,1.15fr)_minmax(0,1fr)] md:items-start md:gap-10 lg:gap-14">
            <div className="min-w-0">
              <p className="type-caption font-semibold uppercase tracking-[0.14em] text-[var(--footer-text-muted)]">
                THE ALL TOUR
              </p>
              <p className="font-card-title mt-1 text-xl font-bold tracking-tight text-[var(--foreground)] sm:text-2xl">
                {companyName}
              </p>
              <p className="mt-1.5 max-w-md text-sm leading-snug text-[var(--footer-text-muted)] sm:mt-2">
                맞춤형 해외·국내 골프·패키지 여행을 전문 상담으로 설계합니다.
              </p>
              <ul className="mt-3 space-y-0.5 text-[13px] leading-snug text-[var(--footer-text-muted)] sm:mt-4 sm:space-y-1 sm:text-sm sm:leading-snug">
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
                {showTourismReg ? (
                  <li>
                    <span className="font-semibold text-[var(--foreground)]">관광사업등록번호</span>{" "}
                    <span>{tourismRegNo}</span>
                  </li>
                ) : null}
                {showMailOrderReg ? (
                  <li>
                    <span className="font-semibold text-[var(--foreground)]">통신판매업신고번호</span>{" "}
                    <span>{mailOrderRegNo}</span>
                  </li>
                ) : null}
              </ul>
            </div>

            <div className="flex min-w-0 flex-col gap-3 sm:gap-3.5">
              {/* 상담·채널: 카카오 + 네이버·인스타 등 */}
              <div>
                <p className="mb-1.5 type-caption font-medium text-[var(--footer-text)]">
                  상담 · 채널
                </p>
                <div className={cn(channelGridClass)}>
                  <a
                    href={kakaoChannelUrl ?? "https://pf.kakao.com"}
                    target="_blank"
                    rel="noreferrer"
                    className={cn(
                      buttonVariants({
                        // 광고 랜딩(isGolfAdLanding)에서는 하단 고정 간편가입 CTA(카카오 옐로우)와
                        // 시각적으로 경쟁하지 않도록 outline 스타일로 전환. 일반 페이지는 기존 유지.
                        variant: isGolfAdLanding ? "outline" : "kakao",
                        size: "md",
                        className: cn(
                          channelBtnEqual,
                          "!min-h-[44px] h-full !px-1.5 py-1 [&_svg]:h-3.5 [&_svg]:w-3.5 sm:[&_svg]:h-4 sm:[&_svg]:w-4",
                        ),
                      }),
                      focusRing,
                    )}
                  >
                    <MessageCircle className="shrink-0" aria-hidden />
                    <span className="min-w-0 break-words [overflow-wrap:anywhere]">카카오 채널</span>
                  </a>
                  <a
                    href={instagramUrl ?? "https://www.instagram.com/thealltour"}
                    target="_blank"
                    rel="noreferrer"
                    className={cn(
                      "footer-pill-instagram footer-pill-channel-equal inline-flex",
                      channelBtnEqual,
                      focusRing,
                    )}
                  >
                    <Instagram className="h-3.5 w-3.5 shrink-0 sm:h-4 sm:w-4" aria-hidden />
                    <span className="min-w-0 break-words [overflow-wrap:anywhere]">인스타그램</span>
                  </a>
                  {naverBandUrl ? (
                    <a
                      href={naverBandUrl}
                      target="_blank"
                      rel="noreferrer"
                      className={cn(
                        "footer-pill-naver footer-pill-channel-equal inline-flex",
                        channelBtnEqual,
                        focusRing,
                      )}
                    >
                      <UsersRound className="h-3.5 w-3.5 shrink-0 sm:h-4 sm:w-4" aria-hidden />
                      <span className="min-w-0 break-words [overflow-wrap:anywhere]">네이버 밴드</span>
                    </a>
                  ) : null}
                  {naverBlogUrl ? (
                    <a
                      href={naverBlogUrl}
                      target="_blank"
                      rel="noreferrer"
                      className={cn(
                        "footer-pill-naver footer-pill-channel-equal inline-flex",
                        channelBtnEqual,
                        focusRing,
                      )}
                    >
                      <BookOpen className="h-3.5 w-3.5 shrink-0 sm:h-4 sm:w-4" aria-hidden />
                      <span className="min-w-0 break-words [overflow-wrap:anywhere]">네이버 블로그</span>
                    </a>
                  ) : null}
                </div>
              </div>

              {/* 2순위: 전화 · 이메일 */}
              <div>
                <p className="mb-1 type-caption font-medium text-[var(--footer-text)] sm:mb-1.5">
                  연락처
                </p>
                <div className="flex flex-wrap gap-1.5 sm:gap-2">
                  {showMainPhone ? (
                    <a
                      href={`tel:${mainPhone}`}
                      className={cn("footer-pill-secondary", focusRing)}
                    >
                      <Phone className="h-3.5 w-3.5 shrink-0 opacity-90" aria-hidden />
                      <span className="tabular-nums">대표 {mainPhone}</span>
                    </a>
                  ) : null}
                  <a
                    href={`mailto:${mainEmail}`}
                    className={cn("footer-pill-secondary", focusRing)}
                  >
                    <Mail className="h-3.5 w-3.5 shrink-0 opacity-90" aria-hidden />
                    <span className="max-w-[200px] truncate sm:max-w-none">{mainEmail}</span>
                  </a>
                </div>
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
          <p className="text-center type-caption leading-snug text-[var(--footer-text-muted)] sm:text-right">
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
