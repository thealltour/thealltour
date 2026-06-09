import Link from "next/link";
import { cn } from "@/lib/cn";
import { buttonVariants } from "@/components/ui/Button";
import { MyPageCard } from "@/components/mypage/ui/MyPageCard";

type MyPageEmptyStateProps = {
  message: string;
  description?: string;
  ctaHref?: string;
  ctaLabel?: string;
  className?: string;
  dashed?: boolean;
};

export function MyPageEmptyState({
  message,
  description,
  ctaHref,
  ctaLabel,
  className,
  dashed = true,
}: MyPageEmptyStateProps) {
  if (dashed) {
    return (
      <div
        className={cn(
          "rounded-2xl border border-dashed border-[var(--border)] bg-[var(--surface-muted)]/50 p-6 text-center",
          className,
        )}
      >
        <p className="text-sm text-[var(--text-muted)]">{message}</p>
        {description ? <p className="mt-2 text-xs text-[var(--text-secondary)]">{description}</p> : null}
        {ctaHref && ctaLabel ? (
          <Link href={ctaHref} className={cn(buttonVariants({ variant: "outline", size: "sm" }), "mt-4")}>
            {ctaLabel}
          </Link>
        ) : null}
      </div>
    );
  }

  return (
    <MyPageCard className={cn("text-center", className)}>
      <p className="text-sm font-semibold text-[var(--text-primary)]">{message}</p>
      {description ? <p className="mt-2 text-xs leading-relaxed text-[var(--text-secondary)]">{description}</p> : null}
      {ctaHref && ctaLabel ? (
        <Link href={ctaHref} className={cn(buttonVariants({ variant: "primary", size: "sm" }), "mt-4 inline-flex")}>
          {ctaLabel}
        </Link>
      ) : null}
    </MyPageCard>
  );
}
