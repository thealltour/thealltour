import Link from "next/link";
import { ChevronRight } from "lucide-react";
import { cn } from "@/lib/cn";

type MyPageListItemProps = {
  children: React.ReactNode;
  className?: string;
  href?: string;
  unread?: boolean;
  chevron?: boolean;
  leading?: React.ReactNode;
};

const itemClass = (unread?: boolean, className?: string, interactive?: boolean) =>
  cn(
    "flex min-h-[44px] flex-wrap items-center justify-between gap-2 rounded-xl border px-3 py-2.5 transition-colors",
    unread
      ? "border-[var(--primary)]/30 bg-[var(--primary-soft)]/40"
      : "border-[var(--border)] bg-[var(--surface)]",
    interactive && "hover:border-[var(--border-strong)] hover:bg-[var(--surface-muted)]/60",
    className,
  );

export function MyPageListItem({
  children,
  className,
  href,
  unread,
  chevron,
  leading,
}: MyPageListItemProps) {
  const content = (
    <>
      <div className="flex min-w-0 flex-1 items-center gap-3">
        {leading ? <span className="shrink-0">{leading}</span> : null}
        <div className="min-w-0 flex-1">{children}</div>
      </div>
      {chevron ? <ChevronRight className="size-4 shrink-0 text-[var(--text-muted)]" aria-hidden /> : null}
    </>
  );

  if (href) {
    return (
      <li>
        <Link href={href} className={cn(itemClass(unread, className, true), "block")}>
          {content}
        </Link>
      </li>
    );
  }

  return <li className={itemClass(unread, className)}>{content}</li>;
}

export function MyPageList({ children, className }: { children: React.ReactNode; className?: string }) {
  return <ul className={cn("space-y-2", className)}>{children}</ul>;
}
