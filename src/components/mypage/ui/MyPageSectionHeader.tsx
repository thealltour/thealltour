import Link from "next/link";
import { cn } from "@/lib/cn";

type MyPageSectionHeaderProps = {
  title: string;
  description?: string;
  actionHref?: string;
  actionLabel?: string;
  className?: string;
};

export function MyPageSectionHeader({
  title,
  description,
  actionHref,
  actionLabel,
  className,
}: MyPageSectionHeaderProps) {
  return (
    <div className={cn("flex flex-wrap items-end justify-between gap-2", className)}>
      <div>
        <h2 className="text-base font-semibold text-[var(--text-primary)]">{title}</h2>
        {description ? <p className="mt-0.5 text-sm text-[var(--text-muted)]">{description}</p> : null}
      </div>
      {actionHref && actionLabel ? (
        <Link href={actionHref} className="link-primary text-xs font-medium">
          {actionLabel}
        </Link>
      ) : null}
    </div>
  );
}
