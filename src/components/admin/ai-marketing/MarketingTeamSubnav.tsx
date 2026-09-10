"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  AI_MARKETING_TEAM_GROUP_LABEL,
  AI_MARKETING_TEAM_NAV,
  resolveAiMarketingTeamNavId,
} from "@/lib/adminNav/aiMarketingTeam";
import { cn } from "@/lib/cn";

type Props = {
  className?: string;
};

export function MarketingTeamSubnav({ className }: Props) {
  const pathname = usePathname() ?? "";
  const activeId = resolveAiMarketingTeamNavId(pathname);

  return (
    <nav
      aria-label={AI_MARKETING_TEAM_GROUP_LABEL}
      className={cn(
        "flex flex-wrap gap-1 border-b border-[var(--border)] pb-2",
        className,
      )}
    >
      {AI_MARKETING_TEAM_NAV.map((item) => {
        const active = item.id === activeId;
        return (
          <Link
            key={item.id}
            href={item.href}
            className={cn(
              "rounded-md px-2.5 py-1.5 text-xs font-medium transition-colors sm:text-sm",
              active
                ? "bg-[var(--surface-muted)] font-semibold text-[var(--text)]"
                : "text-[var(--text-secondary)] hover:bg-[var(--surface-muted)] hover:text-[var(--text)]",
            )}
            aria-current={active ? "page" : undefined}
          >
            {item.label}
          </Link>
        );
      })}
    </nav>
  );
}
