import Link from "next/link";
import { Icon } from "@/components/ui/Icon";
import { cn } from "@/lib/cn";
import {
  HOME_HERO_ALL_PRODUCTS_ACTION,
  HOME_HERO_QUICK_ACTIONS,
} from "@/lib/homeHeroQuickActions";

/**
 * 모바일 홈 히어로 검색창 하단 — 테마 바로가기 (카드 없이 아이콘+라벨).
 */
export function HomeQuickKeywords() {
  return (
    <nav
      className="w-full min-w-0 max-w-full md:hidden"
      aria-label="테마·상품군 빠른 탐색 (보조)"
    >
      <ul className="grid w-full grid-cols-4 items-stretch">
        {HOME_HERO_QUICK_ACTIONS.map((item) => {
          const isGolf = item.id === "golf";
          return (
            <li key={item.id} className="flex min-w-0">
              <Link
                href={item.href}
                className="group flex min-h-10 w-full flex-col items-center justify-center gap-0.5 px-0.5 py-0.5 text-center focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--focus-ring)] focus-visible:ring-offset-2 focus-visible:ring-offset-white"
                aria-label={item.ariaLabel ?? item.label}
              >
                <Icon
                  name={item.iconName}
                  size={24}
                  className={
                    isGolf
                      ? "text-[var(--hero-accent)]"
                      : "text-[var(--hero-text-secondary)] group-hover:text-[var(--hero-text-primary)]"
                  }
                />
                <span
                  className={cn(
                    "line-clamp-1 w-full text-xs font-medium leading-tight tracking-tight",
                    isGolf
                      ? "text-[var(--hero-accent)]"
                      : "text-[var(--hero-text-secondary)] group-hover:text-[var(--hero-text-primary)]",
                  )}
                >
                  {item.label}
                </span>
              </Link>
            </li>
          );
        })}
      </ul>
      <div className="flex justify-end">
        <Link
          href={HOME_HERO_ALL_PRODUCTS_ACTION.href}
          className="inline-flex items-center py-0.5 text-xs font-medium tracking-tight text-[var(--hero-text-secondary)] transition-colors duration-150 hover:text-[var(--hero-text-primary)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--focus-ring)] focus-visible:ring-offset-2 focus-visible:ring-offset-white"
          aria-label={HOME_HERO_ALL_PRODUCTS_ACTION.ariaLabel}
        >
          {HOME_HERO_ALL_PRODUCTS_ACTION.label}
          <span aria-hidden> →</span>
        </Link>
      </div>
    </nav>
  );
}
