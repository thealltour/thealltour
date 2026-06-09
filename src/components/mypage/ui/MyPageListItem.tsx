import Link from "next/link";
import { cn } from "@/lib/cn";

type MyPageListItemProps = {
  children: React.ReactNode;
  className?: string;
  href?: string;
  unread?: boolean;
};

const itemClass = (unread?: boolean, className?: string) =>
  cn(
    "flex min-h-[44px] flex-wrap items-center justify-between gap-2 rounded-xl border px-3 py-2.5 transition-colors",
    unread
      ? "border-[var(--primary)]/30 bg-[var(--primary-soft)]/40"
      : "border-[var(--border)] bg-[var(--surface)] hover:bg-[var(--surface-muted)]/60",
    className,
  );

export function MyPageListItem({ children, className, href, unread }: MyPageListItemProps) {
  if (href) {
    return (
      <li>
        <Link href={href} className={cn(itemClass(unread, className), "block")}>
          {children}
        </Link>
      </li>
    );
  }

  return <li className={itemClass(unread, className)}>{children}</li>;
}

export function MyPageList({ children, className }: { children: React.ReactNode; className?: string }) {
  return <ul className={cn("space-y-2", className)}>{children}</ul>;
}
