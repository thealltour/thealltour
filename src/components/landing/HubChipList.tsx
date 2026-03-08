import Link from "next/link";
import type { ProductTaxonomy } from "@/types/productTaxonomy";
import { cn } from "@/lib/cn";

export type HubChipListProps = {
  items: ProductTaxonomy[];
  getHref: (item: ProductTaxonomy) => string;
  getLabel?: (item: ProductTaxonomy) => string;
  className?: string;
};

/**
 * 허브 페이지 상단 칩 목록. 지역/테마 이름을 한 줄로 노출.
 */
export function HubChipList({
  items,
  getHref,
  getLabel = (i) => i.card_title?.trim() || i.name,
  className,
}: HubChipListProps) {
  if (items.length === 0) return null;

  return (
    <div
      className={cn(
        "flex gap-2 overflow-x-auto pb-1 [scrollbar-width:thin]",
        "min-h-[44px] items-center",
        className,
      )}
      role="list"
    >
      {items.map((item) => (
        <Link
          key={item.id}
          href={getHref(item)}
          role="listitem"
          className={cn(
            "shrink-0 rounded-full border border-[var(--border-strong)] bg-[var(--surface)] px-4 py-2",
            "type-small font-medium text-[var(--foreground)]",
            "transition hover:border-[var(--primary)] hover:bg-[var(--primary-soft)] hover:text-[var(--primary)]",
            "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--focus-ring)] focus-visible:ring-offset-1",
          )}
        >
          {getLabel(item)}
        </Link>
      ))}
    </div>
  );
}
