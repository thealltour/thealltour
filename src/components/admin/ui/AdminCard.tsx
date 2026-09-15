"use client";

import type { ReactNode } from "react";
import { cn } from "@/lib/cn";

type AdminCardVariant = "default" | "muted" | "glass";

type AdminCardProps = {
  children: ReactNode;
  className?: string;
  variant?: AdminCardVariant;
};

/**
 * Admin surface card — radius/border/shadow tokens match public `Card` default.
 * `muted` / `glass` remain admin-only density variants.
 */
export default function AdminCard({
  children,
  className,
  variant = "default",
}: AdminCardProps) {
  const base =
    "rounded-[var(--radius-lg)] border border-[var(--border)] transition-colors duration-150";

  const byVariant: Record<AdminCardVariant, string> = {
    default: "bg-[var(--surface)] shadow-[var(--shadow-soft)]",
    muted: "bg-[var(--surface-muted)] shadow-none",
    glass:
      "bg-[var(--glass-surface)] border-[var(--glass-border)] shadow-[var(--shadow-soft)] backdrop-blur-md",
  };

  return (
    <div className={cn(base, byVariant[variant], className)}>
      {children}
    </div>
  );
}
