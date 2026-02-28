import * as React from "react";
import { cn } from "@/lib/cn";

type ButtonVariant = "primary" | "secondary" | "kakao" | "ghost" | "outline";
type ButtonSize = "sm" | "md" | "lg";

export type ButtonProps = React.ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: ButtonVariant;
  size?: ButtonSize;
  loading?: boolean;
};

export function buttonVariants(options?: {
  variant?: ButtonVariant;
  size?: ButtonSize;
  className?: string;
}) {
  const { variant = "primary", size = "md", className } = options ?? {};

  const base =
    "inline-flex items-center justify-center rounded-full type-btn transition-colors duration-150 " +
    "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/30 " +
    "disabled:opacity-50 disabled:cursor-not-allowed";

  const sizeClass =
    size === "sm"
      ? "px-3 py-1.5"
      : size === "lg"
        ? "px-6 py-3"
        : "px-4 py-2.5";

  let variantClass: string;
  switch (variant) {
    case "secondary":
      variantClass =
        "bg-transparent border border-[color:var(--border)] text-content-primary " +
        "hover:bg-[color:color-mix(in_oklab,var(--border)_8%,white)]";
      break;
    case "kakao":
      variantClass =
        "bg-[color:var(--theall-kakao-bg)] text-[color:var(--theall-kakao-text)] " +
        "border border-[color:var(--theall-kakao-border)] " +
        "hover:border-[color:color-mix(in_oklab,var(--theall-premium-gold)_78%,black)]";
      break;
    case "ghost":
      variantClass =
        "bg-transparent text-content-primary hover:bg-[color:color-mix(in_oklab,var(--border)_12%,white)]";
      break;
    case "outline":
      variantClass =
        "bg-transparent border border-primary/40 text-primary hover:bg-primary/5";
      break;
    case "primary":
    default:
      variantClass =
        "bg-[#1E3A8A] text-white hover:bg-[#1d4ed8]";
      break;
  }

  return cn(base, sizeClass, variantClass, className);
}

export const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ variant = "primary", size = "md", loading, className, children, ...props }, ref) => {
    return (
      <button
        ref={ref}
        className={buttonVariants({ variant, size, className })}
        disabled={loading || props.disabled}
        {...props}
      >
        {loading ? (
          <span className="mr-1 inline-flex h-3.5 w-3.5 animate-spin rounded-full border border-white/40 border-t-transparent" />
        ) : null}
        {children}
      </button>
    );
  },
);

Button.displayName = "Button";

