import * as React from "react";
import { cn } from "@/lib/cn";

type CardVariant = "default" | "elevated" | "hero" | "interactive";

export type CardProps = React.HTMLAttributes<HTMLDivElement> & {
  variant?: CardVariant;
};

/** bg=--surface, border=--border, shadow=--shadow-soft, radius --radius-lg (16px). interactive: hover 시 shadow-soft-strong + border-strong */
export function Card({ variant = "default", className, ...props }: CardProps) {
  let variantClass: string;

  switch (variant) {
    case "elevated":
      variantClass =
        "rounded-[var(--radius-lg)] border border-[var(--border)] bg-[var(--surface-elevated)] shadow-[var(--shadow-soft-strong)]";
      break;
    case "hero":
      variantClass =
        "rounded-[var(--radius-xl)] bg-[var(--surface-inverse)] text-[var(--text-on-inverse)] " +
        "shadow-[var(--shadow-soft-strong)] ring-1 ring-[var(--site-border)]";
      break;
    case "interactive":
      variantClass =
        "rounded-[var(--radius-lg)] border border-[var(--border)] bg-[var(--surface)] shadow-[var(--shadow-soft)] " +
        "transition hover:border-[var(--border-strong)] hover:shadow-[var(--shadow-soft-strong)]";
      break;
    case "default":
    default:
      variantClass =
        "rounded-[var(--radius-lg)] border border-[var(--border)] bg-[var(--surface)] shadow-[var(--shadow-soft)]";
      break;
  }

  return <div className={cn(variantClass, className)} {...props} />;
}
