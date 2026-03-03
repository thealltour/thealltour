import * as React from "react";
import { cn } from "@/lib/cn";

type BadgeVariant =
  | "neutral"
  | "primary"
  | "premium"
  | "outline"
  | "success"
  | "warning"
  | "danger"
  | "default"
  | "blue"
  | "gold";

export type BadgeProps = React.HTMLAttributes<HTMLSpanElement> & {
  variant?: BadgeVariant;
};

/** neutral: surface-muted/text-muted. primary: primary-soft/primary. premium: secondary/white. */
export function Badge({ variant = "neutral", className, ...props }: BadgeProps) {
  let variantClass: string;

  switch (variant) {
    case "primary":
      variantClass =
        "border border-[var(--border)] bg-[var(--primary-soft)] text-[var(--primary)]";
      break;
    case "premium":
      variantClass =
        "border border-transparent bg-[var(--secondary)] text-white";
      break;
    case "outline":
      variantClass =
        "border border-[var(--border-strong)] bg-transparent text-[var(--foreground)]";
      break;
    case "success":
      variantClass =
        "border border-[var(--success)]/40 bg-[var(--success-bg)] text-[var(--success)]";
      break;
    case "warning":
      variantClass =
        "border border-[var(--warning)]/40 bg-[var(--warning-bg)] text-[var(--warning)]";
      break;
    case "danger":
      variantClass =
        "border border-[var(--danger)]/40 bg-[var(--danger-bg)] text-[var(--danger)]";
      break;
    case "neutral":
    case "default":
      variantClass =
        "border border-[var(--divider)] bg-[var(--surface-muted)] text-[var(--text-muted)]";
      break;
    case "blue":
      variantClass =
        "border border-[var(--border)] bg-[var(--primary-soft)] text-[var(--primary)]";
      break;
    case "gold":
      variantClass =
        "border border-transparent bg-[var(--secondary)] text-white";
      break;
    default:
      variantClass =
        "border border-[var(--divider)] bg-[var(--surface-muted)] text-[var(--text-muted)]";
      break;
  }

  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full px-3 py-1 type-caption font-semibold",
        variantClass,
        className,
      )}
      {...props}
    />
  );
}
