"use client";

import type { ReactNode } from "react";

type AdminCardVariant = "default" | "muted" | "glass";

type AdminCardProps = {
  children: ReactNode;
  className?: string;
  variant?: AdminCardVariant;
};

function cx(...values: Array<string | false | null | undefined>) {
  return values.filter(Boolean).join(" ");
}

export default function AdminCard({
  children,
  className,
  variant = "default",
}: AdminCardProps) {
  const base = "rounded-xl border transition-colors duration-150";

  const byVariant: Record<AdminCardVariant, string> = {
    default: "bg-[var(--surface)] border-[var(--border)]",
    muted: "bg-[var(--surface-muted)] border-[var(--border)]",
    glass:
      "bg-[var(--glass-surface)] border-[var(--glass-border)] backdrop-blur-md",
  };

  return (
    <div className={cx(base, byVariant[variant], className)}>
      {children}
    </div>
  );
}

