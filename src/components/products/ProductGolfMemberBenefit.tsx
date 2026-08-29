"use client";

import { Gift } from "lucide-react";
import { usePathname } from "next/navigation";
import { useAuthModal } from "@/components/auth/AuthModalProvider";
import { buttonVariants } from "@/components/ui/Button";
import { cn } from "@/lib/cn";
import { DISCOUNT_RATES } from "@/lib/payments/calculatePaxDiscount";
import { trackMembershipBenefitCtaClick } from "@/lib/analytics/trackAuthEvents";

export type ProductGolfMemberBenefitProps = {
  memberLoggedIn: boolean;
  /** 로그인 회원 예약 패널 preview (보유 티어 기반 계산) */
  paxDiscountPreview?: { label: string; amount: number } | null;
  className?: string;
};

/**
 * Golf 상품 Detail — Sync/Membership 혜택 continuity.
 * Hero 가격을 쿠폰 적용가로 바꾸지 않고 별도 안내만 제공.
 */
export function ProductGolfMemberBenefit({
  memberLoggedIn,
  paxDiscountPreview,
  className,
}: ProductGolfMemberBenefitProps) {
  const pathname = usePathname();
  const { openAuth } = useAuthModal();
  const welcomeWon = DISCOUNT_RATES.WELCOME;

  if (memberLoggedIn && paxDiscountPreview && paxDiscountPreview.amount > 0) {
    return (
      <aside
        className={cn(
          "rounded-2xl border border-[var(--success)]/30 bg-[var(--success-bg)] px-4 py-3.5",
          className,
        )}
        aria-label="골프 회원 혜택"
      >
        <p className="text-xs font-semibold text-[var(--success)]">골프여행 회원 혜택</p>
        <p className="mt-1 text-sm font-bold text-[var(--text-primary)]">{paxDiscountPreview.label}</p>
        <p className="mt-1 text-xs leading-snug text-[var(--text-secondary)]">
          예상 상품가와 별도로, 보유 쿠폰팩은 예약·결제 단계에서 적용됩니다.
        </p>
      </aside>
    );
  }

  if (memberLoggedIn) {
    return (
      <aside
        className={cn(
          "rounded-2xl border border-[var(--border)] bg-[var(--surface-muted)]/60 px-4 py-3.5",
          className,
        )}
        aria-label="골프 회원 혜택"
      >
        <p className="text-xs font-semibold text-[var(--text-primary)]">골프여행 쿠폰팩</p>
        <p className="mt-1 text-xs leading-snug text-[var(--text-secondary)]">
          보유 중인 골프 쿠폰팩이 있으면 예약 단계에서 1인당 할인이 적용됩니다. 마이페이지에서 쿠폰팩을
          확인할 수 있어요.
        </p>
      </aside>
    );
  }

  return (
    <aside
      className={cn(
        "rounded-2xl border border-[var(--border)] bg-[var(--surface-muted)]/70 px-4 py-3.5",
        className,
      )}
      aria-label="카카오 신규회원 골프 혜택"
    >
      <div className="flex items-start gap-2.5">
        <Gift className="mt-0.5 h-4 w-4 shrink-0 text-[var(--primary)]" aria-hidden />
        <div className="min-w-0 flex-1">
          <p className="text-xs font-semibold text-[var(--text-primary)]">카카오 신규회원 혜택</p>
          <p className="mt-1 text-sm font-bold text-[var(--text-primary)]">
            골프여행 1인당 {Math.round(welcomeWon / 10_000)}만원 할인
          </p>
          <p className="mt-1 text-xs leading-snug text-[var(--text-secondary)]">
            카카오 신규가입 시 골프여행 웰컴 쿠폰팩이 자동 지급돼요. 비회원도 바로 예약할 수 있습니다.
          </p>
          <button
            type="button"
            onClick={() => {
              trackMembershipBenefitCtaClick({
                label: "혜택 받고 가입",
                href: pathname || "/products",
                section: "product_detail_golf",
              });
              openAuth({ mode: "signup", next: pathname });
            }}
            className={cn(
              buttonVariants({ variant: "outline", size: "sm" }),
              "mt-3 inline-flex min-h-11",
            )}
          >
            혜택 받고 가입
          </button>
          <button
            type="button"
            onClick={() => openAuth({ mode: "login", next: pathname })}
            className="mt-2 block text-left text-[0.6875rem] font-medium text-[var(--text-muted)] underline-offset-2 hover:underline"
          >
            이미 회원이신가요? 로그인
          </button>
        </div>
      </div>
    </aside>
  );
}
