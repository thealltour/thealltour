"use client";

import type { ReactNode } from "react";
import { cn } from "@/lib/cn";

export type AdminBadgeVariant =
  | "success"
  | "warning"
  | "danger"
  | "muted"
  | "neutral";

type AdminBadgeProps = {
  children: ReactNode;
  variant?: AdminBadgeVariant;
  className?: string;
  /** Show status dot (default true for success/warning/danger). */
  showDot?: boolean;
};

const byVariant: Record<AdminBadgeVariant, string> = {
  success:
    "border border-[var(--success)]/40 bg-[var(--success-bg)] text-[var(--success)]",
  warning:
    "border border-[var(--warning)]/40 bg-[var(--warning-bg)] text-[var(--warning)]",
  danger:
    "border border-[var(--danger)]/40 bg-[var(--danger-bg)] text-[var(--danger)]",
  muted:
    "border border-[var(--divider)] bg-[var(--surface-muted)] text-[var(--text-muted)]",
  neutral:
    "border border-[var(--divider)] bg-[var(--surface-muted)] text-[var(--text-muted)]",
};

const dotByVariant: Partial<Record<AdminBadgeVariant, string>> = {
  success: "bg-[var(--success)]",
  warning: "bg-[var(--warning)]",
  danger: "bg-[var(--danger)]",
};

/**
 * Compact status badge for admin — same semantic tokens as public `Badge`.
 */
export default function AdminBadge({
  children,
  variant = "success",
  className,
  showDot,
}: AdminBadgeProps) {
  const withDot =
    showDot ?? (variant === "success" || variant === "warning" || variant === "danger");
  const dotClass = dotByVariant[variant];

  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded-[var(--radius-pill)] px-2.5 py-0.5 text-[11px] font-medium",
        byVariant[variant],
        className,
      )}
    >
      {withDot && dotClass ? (
        <span className={cn("h-1.5 w-1.5 shrink-0 rounded-full", dotClass)} />
      ) : null}
      {children}
    </span>
  );
}
