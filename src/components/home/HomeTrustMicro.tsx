import { Check } from "lucide-react";
import { cn } from "@/lib/cn";
import { getHomeTrustMicroItems } from "@/lib/homeTrustContent";

export type HomeTrustMicroProps = {
  tourismRegNo?: string;
  className?: string;
};

/**
 * Golf Tour 직후 compact trust strip — 사실 기반 3-point micro benefits.
 */
export function HomeTrustMicro({ tourismRegNo, className }: HomeTrustMicroProps) {
  const items = getHomeTrustMicroItems(tourismRegNo);

  return (
    <div
      className={cn("w-full px-4 py-1 sm:px-6 md:px-8", className)}
      aria-label="신뢰 정보"
    >
      <div className="mx-auto flex max-w-[1344px] items-stretch justify-center gap-1 rounded-xl bg-[var(--surface-muted)]/70 px-2 py-2 ring-1 ring-[var(--border)] sm:gap-2 sm:px-3 sm:py-2.5">
        {items.map((item) => (
          <div
            key={item}
            className="flex min-w-0 flex-1 items-center justify-center gap-1 px-0.5"
          >
            <Check
              className="h-3.5 w-3.5 shrink-0 text-[var(--primary)]"
              strokeWidth={2}
              aria-hidden
            />
            <span className="truncate text-center text-[11px] font-medium leading-tight text-[var(--text-secondary)] sm:text-xs">
              {item}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}
