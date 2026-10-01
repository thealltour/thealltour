"use client";

import { useProductDepartureSiblings } from "@/components/products/ProductDepartureSiblingsContext";
import { cn } from "@/lib/cn";
import type { ProductDepartureSibling } from "@/lib/products/departureSiblings";

export type ProductDepartureCitySwitcherVariant = "flight" | "rail";

function formatSiblingMeta(sibling: ProductDepartureSibling): string {
  const parts: string[] = [];
  if (sibling.duration) parts.push(sibling.duration);
  if (sibling.fromPrice != null) parts.push(`${sibling.fromPrice.toLocaleString("ko-KR")}원~`);
  return parts.join(" · ");
}

/**
 * 같은 상품의 출발지별 형제 상품 전환 칩.
 * 항공 섹션과 예약 영역에 함께 놓이며, 둘 다 현재 상품을 선택 상태로 보여주므로 항상 같은 값을 가리킨다.
 * 형제가 없으면 렌더하지 않는다.
 */
export function ProductDepartureCitySwitcher({
  variant,
  className,
}: {
  variant: ProductDepartureCitySwitcherVariant;
  className?: string;
}) {
  const { siblings, pendingSiblingId, switchTo } = useProductDepartureSiblings();
  if (siblings.length < 2) return null;

  const compact = variant === "rail";
  const isSwitching = pendingSiblingId != null;

  return (
    <div
      role="radiogroup"
      aria-label="출발지"
      aria-busy={isSwitching || undefined}
      className={cn(compact ? "grid grid-cols-2 gap-2" : "flex flex-wrap gap-2", className)}
      data-testid={`departure-city-switcher-${variant}`}
    >
      {siblings.map((sibling) => {
        const active = sibling.isCurrent;
        const pending = pendingSiblingId === sibling.id;
        const meta = pending ? "불러오는 중" : formatSiblingMeta(sibling);
        return (
          <button
            key={sibling.id}
            type="button"
            role="radio"
            aria-checked={active}
            disabled={isSwitching && !active}
            onClick={() => switchTo(sibling.id)}
            className={cn(
              "flex min-h-[44px] items-center gap-2.5 rounded-xl border-2 text-left transition",
              compact ? "px-2.5 py-2" : "px-3 py-2",
              active
                ? "border-[var(--accent)] bg-[var(--accent-soft)] text-[#0f172a] ring-1 ring-[var(--accent)]"
                : "border-slate-300 bg-white text-slate-800 hover:border-slate-400 hover:bg-slate-50",
              isSwitching && !active && !pending && "opacity-60",
            )}
          >
            <span
              className={cn(
                "flex h-4 w-4 shrink-0 items-center justify-center rounded-full border-2",
                active || pending ? "border-[var(--accent)] bg-[var(--accent)]" : "border-slate-300 bg-white",
              )}
              aria-hidden
            >
              {active || pending ? <span className="h-1.5 w-1.5 rounded-full bg-white" /> : null}
            </span>
            <span className="min-w-0">
              <span className="block text-sm font-bold">{sibling.departureCity}출발</span>
              {meta ? (
                <span className={cn("block truncate text-xs", active ? "text-slate-700" : "text-slate-500")}>
                  {meta}
                </span>
              ) : null}
            </span>
          </button>
        );
      })}
    </div>
  );
}
