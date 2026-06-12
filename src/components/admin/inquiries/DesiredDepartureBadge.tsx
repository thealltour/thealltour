import { CalendarIcon } from "@/icons/system/CalendarIcon";
import { resolveDesiredDeparture } from "@/lib/inquiry/desiredDeparture";
import type { Inquiry } from "@/types/inquiry";

type DesiredDepartureBadgeProps = {
  inquiry: Pick<Inquiry, "content" | "quote_snapshot">;
  className?: string;
};

export function DesiredDepartureBadge({ inquiry, className }: DesiredDepartureBadgeProps) {
  const resolved = resolveDesiredDeparture(inquiry);
  if (!resolved) return null;

  const isFlexible = resolved.snapshot?.flexible === true;
  const isLegacy = resolved.legacyText === true;

  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-semibold ${
        isFlexible
          ? "bg-[var(--surface-muted)] text-[var(--text-secondary)]"
          : isLegacy
            ? "bg-slate-100 text-slate-700 dark:bg-slate-800/80 dark:text-slate-200"
            : "bg-[var(--primary-soft)] text-[var(--primary)]"
      } ${className ?? ""}`}
    >
      <CalendarIcon size={14} className="shrink-0" aria-hidden />
      <span>출발 희망일: {resolved.label}</span>
    </span>
  );
}
