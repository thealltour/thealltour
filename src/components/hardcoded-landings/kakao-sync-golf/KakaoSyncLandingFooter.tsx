import Link from "next/link";
import { PageContainer } from "@/components/layout/PageContainer";
import { cn } from "@/lib/cn";

const focusRing = "focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-[var(--focus-ring)]";

export type KakaoSyncLandingFooterSettings = {
  company_name?: string;
  ceo_name?: string;
  address?: string;
  business_reg_no?: string;
  tourism_reg_no?: string;
  mail_order_reg_no?: string;
};

function isPlaceholderRegNo(value: string | undefined): boolean {
  const v = (value ?? "").trim();
  return !v || v === "미정";
}

/** 카카오싱크 랜딩 전용 축소형 풋터 — 채널 버튼·연락처 제거, 사업자정보+약관 링크+저작권만 유지 */
export function KakaoSyncLandingFooter({ settings }: { settings: KakaoSyncLandingFooterSettings }) {
  const companyName = settings.company_name ?? "(주)더올투어";
  const ceoName = settings.ceo_name ?? "김지호";
  const address = settings.address ?? "경기도 고양시 덕양구 용현로 27, 407호(행신동, 행신프라자)";
  const businessRegNo = settings.business_reg_no ?? "645-88-03583";
  const tourismRegNo = settings.tourism_reg_no?.trim() ?? "";
  const mailOrderRegNo = settings.mail_order_reg_no?.trim() ?? "";
  const showTourismReg = !isPlaceholderRegNo(tourismRegNo);
  const showMailOrderReg = !isPlaceholderRegNo(mailOrderRegNo);

  return (
    <footer className="border-t border-[var(--divider)] bg-[var(--surface-muted)] text-[var(--foreground)]">
      <PageContainer size="wide" className="hardcoded-landing-x w-full px-4">
        <div className="flex flex-col items-center gap-2 py-4 text-center">
          <p className="type-caption leading-relaxed text-[var(--footer-text-muted)] [word-break:keep-all]">
            {companyName} · 대표 {ceoName} · 사업자등록번호 {businessRegNo}
            {showTourismReg ? ` · 관광사업등록번호 ${tourismRegNo}` : ""}
            {showMailOrderReg ? ` · 통신판매업신고번호 ${mailOrderRegNo}` : ""}
          </p>
          <p className="type-caption leading-relaxed text-[var(--footer-text-muted)] [word-break:keep-all]">
            {address}
          </p>
          <nav className="flex gap-3" aria-label="약관 및 정책">
            <Link href="/terms" className={cn("footer-pill-tertiary", focusRing)}>
              이용약관
            </Link>
            <Link href="/privacy" className={cn("footer-pill-tertiary", focusRing)}>
              개인정보처리방침
            </Link>
          </nav>
          <p className="type-caption leading-snug text-[var(--footer-text-muted)]">
            © {new Date().getFullYear()} 더올투어. All rights reserved
          </p>
        </div>
      </PageContainer>
    </footer>
  );
}
