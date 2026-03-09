"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";
import { PageContainer } from "@/components/layout/PageContainer";

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

const footerPillClass =
  "footer-pill focus-visible:outline-none";
const footerPillCtaClass = "footer-pill footer-pill-cta focus-visible:outline-none";

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
    <footer className="border-t border-[var(--divider)] bg-[var(--surface-muted)]">
      <PageContainer size="wide" className="grid gap-6 py-7 type-small leading-7 text-[var(--text-muted)] md:grid-cols-[1fr_auto]">
        <div>
          <p className="type-body font-bold text-[var(--foreground)]">{companyName}</p>
          <p className="text-[var(--text-subtle)]">대표: {ceoName}</p>
          <p className="text-[var(--text-subtle)]">주소: {address}</p>
          <p className="text-[var(--text-subtle)]">사업자등록번호: {businessRegNo}</p>
          <p className="text-[var(--text-subtle)]">관광사업등록번호: {tourismRegNo}</p>
          <p className="text-[var(--text-subtle)]">통신판매업신고번호: {mailOrderRegNo}</p>
        </div>

        <div className="flex flex-col items-start gap-2 type-caption md:items-end">
          <a href={`tel:${mainPhone}`} className={footerPillClass}>
            대표번호 {mainPhone}
          </a>
          <a href={`mailto:${mainEmail}`} className={footerPillClass}>
            {mainEmail}
          </a>
          <div className="mt-1 flex items-center gap-2">
            <a
              href={kakaoChannelUrl ?? "https://pf.kakao.com"}
              target="_blank"
              rel="noreferrer"
              className={footerPillCtaClass}
            >
              카카오채널
            </a>
            <a
              href={instagramUrl ?? "https://www.instagram.com/thealltour"}
              target="_blank"
              rel="noreferrer"
              className={footerPillClass}
            >
              인스타그램
            </a>
          </div>
          <div className="mt-1 flex items-center gap-2">
            <Link href="/terms" className={footerPillClass}>
              이용약관
            </Link>
            <Link href="/privacy" className={footerPillClass}>
              개인정보처리방침
            </Link>
          </div>
        </div>
      </PageContainer>
      <PageContainer size="wide" className="border-t border-[var(--divider)] py-3 text-center type-caption text-[var(--text-subtle)]">
        © {new Date().getFullYear()} 더올투어. All rights reserved
        <Link
          href="/theall_manager_only"
          aria-label="관리자 전용 페이지"
          className="cursor-default no-underline hover:no-underline focus:no-underline"
        >
          .
        </Link>
      </PageContainer>
    </footer>
  );
}
