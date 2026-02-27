import * as React from "react";
import { cn } from "@/lib/cn";

type BadgeVariant = "default" | "outline" | "gold" | "blue";

export type BadgeProps = React.HTMLAttributes<HTMLSpanElement> & {
  variant?: BadgeVariant;
};

export function Badge({ variant = "default", className, ...props }: BadgeProps) {
  let variantClass: string;

  switch (variant) {
    case "outline":
      variantClass =
        "border border-[color:var(--border)] bg-transparent text-content-secondary";
      break;
    case "gold":
      variantClass =
        "border border-[color:var(--theall-premium-gold)] bg-[color:color-mix(in_oklab,var(--theall-premium-gold)_10%,white)] text-[color:var(--theall-primary-navy)]";
      break;
    case "blue":
      variantClass =
        "border border-primary/40 bg-primary/5 text-primary";
      break;
    case "default":
    default:
      variantClass =
        "border border-[color:var(--border)] bg-[color:var(--card-muted)] text-content-secondary";
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

