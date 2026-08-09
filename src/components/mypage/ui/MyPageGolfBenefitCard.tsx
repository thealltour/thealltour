import Link from "next/link";
import { cn } from "@/lib/cn";
import { buttonVariants } from "@/components/ui/Button";
import { MyPageCard } from "@/components/mypage/ui/MyPageCard";
import { MyPageNavIcon } from "@/components/mypage/ui/MyPageNavIcon";
import { buildGolfProductsHref } from "@/lib/products/golfChannel";
import type { MemberGolfDiscountCopy } from "@/lib/mypage/memberGolfDiscountCopy";

type MyPageGolfBenefitCardProps = {
  copy: MemberGolfDiscountCopy;
  className?: string;
  elevated?: boolean;
};

export function MyPageGolfBenefitCard({
  copy,
  className,
  elevated = true,
}: MyPageGolfBenefitCardProps) {
  const allGolfHref = buildGolfProductsHref();

  return (
    <MyPageCard
      className={cn(
        elevated && "border-[var(--border-strong)] shadow-[var(--shadow-soft-strong)]",
        className,
      )}
    >
      <div className="flex items-start justify-between gap-3">
        <p className="type-caption text-[var(--text-muted)]">{copy.badgeLabel}</p>
        <span className="inline-flex size-8 items-center justify-center rounded-lg bg-[var(--primary-soft)] text-[var(--primary)]">
          <MyPageNavIcon iconKey="points" />
        </span>
      </div>
      <p className="font-price-strong mt-2 text-3xl text-[var(--text-primary)]">{copy.headline}</p>
      <p className="mt-1 text-xs text-[var(--text-secondary)]">{copy.subline}</p>
      <div className="mt-4 flex flex-wrap gap-2">
        <Link
          href={allGolfHref}
          className={cn(buttonVariants({ variant: "primary", size: "sm" }), "inline-flex")}
        >
          골프여행 전체보기
        </Link>
        <Link
          href="/#home-golf-tours"
          className={cn(buttonVariants({ variant: "outline", size: "sm" }), "inline-flex")}
        >
          추천 골프투어
        </Link>
      </div>
    </MyPageCard>
  );
}
