import { cn } from "@/lib/cn";
import type { CorporateItineraryStatus } from "@/lib/corporate/content";

const STATUS_CLASS: Record<CorporateItineraryStatus, string> = {
  예시: "bg-[var(--surface-muted)] text-[var(--text-secondary)]",
  "면담 후보": "bg-[var(--primary-soft)] text-[var(--primary)]",
  "협의 대상": "bg-[var(--warning-soft,var(--primary-soft))] text-[var(--text-secondary)]",
  "선택 가능": "bg-[var(--surface-muted)] text-[var(--text-muted)]",
};

export function CorporateStatusBadge({
  status,
  className,
}: {
  status: CorporateItineraryStatus;
  className?: string;
}) {
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-md px-2 py-0.5 text-xs font-semibold tracking-tight",
        STATUS_CLASS[status],
        className,
      )}
    >
      {status}
    </span>
  );
}
