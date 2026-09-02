"use client";

import { AlertTriangle, Info, MessageSquare } from "lucide-react";

export type AlertCardVariant = "success" | "warning" | "danger" | "info" | "neutral";

const variantConfig: Record<
  AlertCardVariant,
  { icon: typeof AlertTriangle; className: string }
> = {
  success: {
    icon: Info,
    className: "border border-[var(--divider)] bg-[var(--success-bg)] [&_.alert-icon]:text-[var(--success)]",
  },
  warning: {
    icon: AlertTriangle,
    className: "border border-[var(--divider)] bg-[var(--warning-bg)] [&_.alert-icon]:text-[var(--warning)]",
  },
  danger: {
    icon: AlertTriangle,
    className: "border border-[var(--divider)] bg-[var(--danger-bg)] [&_.alert-icon]:text-[var(--danger)]",
  },
  info: {
    icon: Info,
    className: "border border-[var(--divider)] bg-[var(--surface-muted)] [&_.alert-icon]:text-[var(--primary)]",
  },
  neutral: {
    icon: MessageSquare,
    className: "border border-[var(--divider)] bg-[var(--surface-muted)] [&_.alert-icon]:text-[var(--text-muted)]",
  },
};

type AlertCardProps = {
  variant?: AlertCardVariant;
  title?: string;
  children: React.ReactNode;
  className?: string;
};

export default function AlertCard({
  variant = "neutral",
  title,
  children,
  className = "",
}: AlertCardProps) {
  const { icon: Icon, className: variantClass } = variantConfig[variant];
  return (
    <div
      className={`rounded-xl border p-4 ${variantClass} ${className}`}
      role="region"
      aria-label={title ?? "안내"}
    >
      <div className="flex gap-3">
        <span className="alert-icon shrink-0" aria-hidden>
          <Icon className="h-5 w-5" />
        </span>
        <div className="min-w-0 flex-1">
          {title ? (
            <h3 className="mb-1.5 text-sm font-semibold text-[var(--foreground)]">{title}</h3>
          ) : null}
          <div className="min-w-0 flex-1 break-words [overflow-wrap:anywhere] text-sm leading-[1.7] text-[var(--text-muted)]">
            {children}
          </div>
        </div>
      </div>
    </div>
  );
}
