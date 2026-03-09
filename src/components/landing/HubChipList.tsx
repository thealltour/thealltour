import Link from "next/link";
import type { ProductTaxonomy } from "@/types/productTaxonomy";
import { cn } from "@/lib/cn";

export type HubChipGroup = {
  root: ProductTaxonomy;
  children: ProductTaxonomy[];
};

export type HubChipListProps = {
  items: ProductTaxonomy[];
  getHref: (item: ProductTaxonomy) => string;
  getLabel?: (item: ProductTaxonomy) => string;
  /** 칩 목록 위에 표시할 제목 (예: "빠른 선택") */
  title?: string;
  /** 제목 아래 부가 설명 */
  description?: string;
  /** true면 가로 스크롤 없이 flex-wrap으로 위아래 정렬 */
  wrap?: boolean;
  /** 지역별처럼 대분류(해외/국내) 밑에 중분류 칩 배치. 넣으면 items 대신 groups 사용 */
  groups?: HubChipGroup[];
  className?: string;
};

const chipBaseClass = cn(
  "shrink-0 rounded-xl border border-[var(--border)] bg-[var(--surface)] px-4 py-2.5",
  "type-small font-medium text-[var(--foreground)]",
  "shadow-[var(--shadow-soft)] transition duration-150",
  "hover:border-[var(--primary)] hover:bg-[var(--primary-soft)] hover:text-[var(--primary)] hover:shadow-[var(--shadow-soft-strong)]",
  "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--focus-ring)] focus-visible:ring-offset-1",
);

/**
 * 허브 페이지 상단 칩 목록.
 * - groups 있으면: 대분류(해외/국내) 밑에 중분류 칩을 wrap으로 표시.
 * - wrap true면: 단일 목록을 가로 스크롤 없이 위아래로 감싸기.
 */
export function HubChipList({
  items,
  getHref,
  getLabel = (i) => i.card_title?.trim() || i.name,
  title,
  description,
  wrap = false,
  groups,
  className,
}: HubChipListProps) {
  const listItems = groups
    ? groups.flatMap((g) => g.children)
    : items;
  if (listItems.length === 0 && !groups?.length) return null;

  if (groups && groups.length > 0) {
    return (
      <div className={cn("space-y-6", className)}>
        {(title || description) && (
          <div className="space-y-0.5">
            {title && (
              <h2 className="type-small font-semibold text-[var(--foreground)]">
                {title}
              </h2>
            )}
            {description && (
              <p className="type-caption text-[var(--text-muted)]">
                {description}
              </p>
            )}
          </div>
        )}
        <div className="space-y-4">
          {groups.map(({ root, children }) => (
            <section key={root.id} className="space-y-2">
              <Link
                href={getHref(root)}
                className={cn(
                  "type-small font-semibold text-[var(--primary)]",
                  "hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--focus-ring)] focus-visible:ring-offset-1 rounded",
                )}
              >
                {getLabel(root)}
              </Link>
              <div
                className="flex flex-wrap gap-2"
                role="list"
              >
                {children.map((item) => (
                  <Link
                    key={item.id}
                    href={getHref(item)}
                    role="listitem"
                    className={chipBaseClass}
                  >
                    {getLabel(item)}
                  </Link>
                ))}
              </div>
            </section>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className={cn("space-y-3", className)}>
      {(title || description) && (
        <div className="space-y-0.5">
          {title && (
            <h2 className="type-small font-semibold text-[var(--foreground)]">
              {title}
            </h2>
          )}
          {description && (
            <p className="type-caption text-[var(--text-muted)]">
              {description}
            </p>
          )}
        </div>
      )}
      <div
        className={cn(
          "flex gap-2 pb-2 pt-0.5 min-h-[48px] items-center",
          wrap
            ? "flex-wrap"
            : cn(
                "relative overflow-x-auto",
                "[scrollbar-width:thin] [scrollbar-color:var(--border)_transparent]",
                "after:pointer-events-none after:absolute after:right-0 after:top-0 after:bottom-2 after:w-8 after:shrink-0 after:bg-gradient-to-l after:from-[var(--theall-page-bg)] after:content-['']",
              ),
        )}
        role="list"
      >
        {items.map((item) => (
          <Link
            key={item.id}
            href={getHref(item)}
            role="listitem"
            className={chipBaseClass}
          >
            {getLabel(item)}
          </Link>
        ))}
      </div>
    </div>
  );
}
