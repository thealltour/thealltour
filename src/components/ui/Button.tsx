import * as React from "react";
import { cn } from "@/lib/cn";

type ButtonVariant = "primary" | "secondary" | "kakao" | "ghost" | "outline";
type ButtonSize = "sm" | "md" | "lg";

export type ButtonProps = React.ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: ButtonVariant;
  size?: ButtonSize;
  loading?: boolean;
};

/** 높이: sm 36px, md 44px, lg 52px. radius 12px. focus-visible ring 3px --focus-ring. */
export function buttonVariants(options?: {
  variant?: ButtonVariant;
  size?: ButtonSize;
  className?: string;
}) {
  const { variant = "primary", size = "md", className } = options ?? {};

  const base =
    "inline-flex items-center justify-center rounded-xl type-btn transition-all duration-150 " +
    "focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-[var(--focus-ring)] " +
    "disabled:opacity-50 disabled:pointer-events-none disabled:cursor-not-allowed " +
    "active:translate-y-px";

  const sizeClass =
    size === "sm"
      ? "h-9 min-h-9 px-3"
      : size === "lg"
        ? "min-h-[52px] px-6 py-3"
        : "min-h-[44px] px-4 py-2.5";

  let variantClass: string;
  switch (variant) {
    case "secondary":
      variantClass =
        "bg-[var(--secondary)] text-white hover:bg-[var(--secondary-hover)]";
      break;
    case "kakao":
      variantClass =
        "bg-[var(--theall-kakao-bg)] text-[var(--theall-kakao-text)] " +
        "border border-[var(--theall-kakao-border)] " +
        "hover:border-[color:color-mix(in_oklab,var(--theall-premium-gold)_78%,black)]";
      break;
    case "ghost":
      variantClass =
        "bg-transparent text-[var(--foreground)] hover:bg-[var(--surface-muted)]";
      break;
    case "outline":
      variantClass =
        "bg-transparent border border-[var(--border-strong)] text-[var(--foreground)] " +
        "hover:bg-[var(--surface-muted)]";
      break;
    case "primary":
    default:
      variantClass =
        "bg-[var(--primary)] text-white hover:bg-[var(--primary-hover)]";
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
          <span className="mr-1.5 inline-flex h-4 w-4 animate-spin rounded-full border-2 border-white/40 border-t-transparent" />
        ) : null}
        {children}
      </button>
    );
  },
);

Button.displayName = "Button";
