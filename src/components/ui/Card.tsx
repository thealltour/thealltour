import * as React from "react";
import { cn } from "@/lib/cn";

type CardVariant = "default" | "elevated" | "hero";

export type CardProps = React.HTMLAttributes<HTMLDivElement> & {
  variant?: CardVariant;
};

export function Card({ variant = "default", className, ...props }: CardProps) {
  let variantClass: string;

  switch (variant) {
    case "elevated":
      variantClass =
        "rounded-3xl bg-card shadow-md ring-1 ring-[color:var(--border)]";
      break;
    case "hero":
      variantClass =
        "rounded-3xl bg-[color:var(--theall-primary-navy)] text-site-primary " +
        "shadow-xl ring-1 ring-site-border";
      break;
    case "default":
    default:
      variantClass =
        "rounded-2xl bg-card shadow-sm ring-1 ring-[color:var(--border)]";
      break;
  }

  return <div className={cn(variantClass, className)} {...props} />;
}

