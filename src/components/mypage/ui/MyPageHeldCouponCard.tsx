"use client";

import Link from "next/link";
import { cn } from "@/lib/cn";
import { buttonVariants } from "@/components/ui/Button";
import { MyPageCard } from "@/components/mypage/ui/MyPageCard";
import { MyPageNavIcon } from "@/components/mypage/ui/MyPageNavIcon";
import { buildGolfProductsHref } from "@/lib/products/golfChannel";
import { trackMembershipBenefitCtaClick } from "@/lib/analytics/trackAuthEvents";

type MyPageHeldCouponCardProps = {
  names: string[];
  /** ISO date — 데이터 있을 때만 표시 */
  earliestExpiresAt?: string | null;
  hasWelcomePack?: boolean;
  className?: string;
  elevated?: boolean;
};

function formatExpiresKo(iso: string): string | null {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return null;
  return date.toLocaleDateString("ko-KR", {
    year: "numeric",
    month: "long",
    day: "numeric",
  });
}

export function MyPageHeldCouponCard({
  names,
  earliestExpiresAt,
  hasWelcomePack = false,
  className,
  elevated = true,
}: MyPageHeldCouponCardProps) {
  const golfHref = buildGolfProductsHref();
  const expiresLabel = earliestExpiresAt ? formatExpiresKo(earliestExpiresAt) : null;

  return (
    <MyPageCard
      className={cn(
        elevated && "border-[var(--border-strong)] shadow-[var(--shadow-soft-strong)]",
        className,
      )}
    >
      <div className="flex items-start justify-between gap-3">
        <p className="type-caption text-[var(--text-muted)]">보유 쿠폰팩</p>
        <span className="inline-flex size-8 items-center justify-center rounded-lg bg-[var(--primary-soft)] text-[var(--primary)]">
          <MyPageNavIcon iconKey="points-request" />
        </span>
      </div>
      {names.length === 0 ? (
        <p className="mt-2 text-xl font-semibold text-[var(--text-primary)]">없음</p>
      ) : (
        <ul className="mt-2 space-y-1">
          {names.map((name) => (
            <li key={name} className="font-price-strong text-xl text-[var(--text-primary)]">
              {name.includes("5만원") || name.includes("웰컴")
                ? "골프여행 웰컴 쿠폰팩"
                : name}
            </li>
          ))}
        </ul>
      )}
      {hasWelcomePack || names.some((n) => n.includes("5만원") || n.includes("웰컴")) ? (
        <p className="mt-1.5 text-sm font-medium text-[var(--text-secondary)]">
          1인당 5만원 할인 · 골프투어 예약 시 적용
        </p>
      ) : null}
      {expiresLabel ? (
        <p className="mt-1 text-xs text-[var(--text-muted)]">유효기간: {expiresLabel}까지</p>
      ) : null}
      <p className="mt-2 text-xs text-[var(--text-secondary)]">
        골프투어 예약 시 차감 · 일반 패키지는 포인트(P) 사용
      </p>
      {names.length > 0 ? (
        <Link
          href={golfHref}
          onClick={() =>
            trackMembershipBenefitCtaClick({
              label: "골프여행 상품 보기",
              href: golfHref,
              section: "held_coupon_card",
            })
          }
          className={cn(
            buttonVariants({ variant: "primary", size: "sm" }),
            "mt-4 inline-flex min-h-11",
          )}
        >
          골프여행 상품 보기
        </Link>
      ) : null}
    </MyPageCard>
  );
}
