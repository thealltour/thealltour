"use client";

import type { ReactNode } from "react";

type AdminBadgeVariant = "success" | "warning" | "danger";

type AdminBadgeProps = {
  children: ReactNode;
  variant?: AdminBadgeVariant;
  className?: string;
};

function cx(...values: Array<string | false | null | undefined>) {
  return values.filter(Boolean).join(" ");
}

export default function AdminBadge({
  children,
  variant = "success",
  className,
}: AdminBadgeProps) {
  const base =
    "inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-[11px] font-medium";

  const byVariant: Record<AdminBadgeVariant, string> = {
    success:
      "bg-[color-mix(in_oklab,var(--success)12%,transparent)] text-[var(--success)]",
    warning:
      "bg-[color-mix(in_oklab,var(--warning)14%,transparent)] text-[var(--warning)]",
    danger:
      "bg-[color-mix(in_oklab,var(--danger)14%,transparent)] text-[var(--danger)]",
  };

  return (
    <span className={cx(base, byVariant[variant], className)}>
      <span
        className={cx(
          "h-1.5 w-1.5 rounded-full",
          variant === "success" && "bg-[var(--success)]",
          variant === "warning" && "bg-[var(--warning)]",
          variant === "danger" && "bg-[var(--danger)]",
        )}
      />
      {children}
    </span>
  );
}

