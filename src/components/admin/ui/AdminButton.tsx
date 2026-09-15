"use client";

import type { ButtonHTMLAttributes, ReactNode } from "react";
import Link from "next/link";
import { solidButtonShadowClasses } from "@/components/ui/Button";
import { cn } from "@/lib/cn";

type AdminButtonVariant = "primary" | "secondary" | "ghost";
type AdminButtonSize = "sm" | "md";

type BaseProps = {
  children: ReactNode;
  variant?: AdminButtonVariant;
  size?: AdminButtonSize;
  className?: string;
};

type ButtonProps = BaseProps &
  ButtonHTMLAttributes<HTMLButtonElement> & {
    href?: never;
  };

type LinkButtonProps = BaseProps & {
  href: string;
} & Omit<ButtonHTMLAttributes<HTMLAnchorElement>, "type">;

export type AdminButtonProps = ButtonProps | LinkButtonProps;

/** Shared geometry with public Button (radius, focus ring, transitions). */
const adminButtonBase =
  "inline-flex items-center justify-center rounded-[var(--radius-md)] font-semibold transition-all duration-150 " +
  "focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-[var(--focus-ring)] " +
  "disabled:opacity-50 disabled:pointer-events-none disabled:cursor-not-allowed " +
  "active:translate-y-px [&_svg]:shrink-0";

function getVariantClasses(variant: AdminButtonVariant): string {
  if (variant === "secondary") {
    // Align with public outline (muted bordered), not brand secondary gold.
    return (
      "bg-transparent border border-[var(--border-strong)] text-[var(--foreground)] " +
      "hover:bg-[var(--surface-muted)]"
    );
  }
  if (variant === "ghost") {
    return "bg-transparent text-[var(--foreground)] hover:bg-[var(--surface-muted)] border border-transparent";
  }
  return `bg-[var(--primary)] text-[var(--on-primary)] border border-transparent hover:bg-[var(--primary-hover)] active:bg-[var(--primary-active)] ${solidButtonShadowClasses}`;
}

function getSizeClasses(size: AdminButtonSize): string {
  // Denser than public md (44px); sm≈32px, md≈36px (public sm).
  return size === "sm" ? "h-8 min-h-8 px-3 text-xs" : "h-9 min-h-9 px-4 text-sm";
}

export default function AdminButton(props: AdminButtonProps) {
  const {
    children,
    variant = "primary",
    size = "md",
    className,
    ...rest
  } = props as AdminButtonProps & { children: ReactNode };

  const composed = cn(
    adminButtonBase,
    getVariantClasses(variant),
    getSizeClasses(size),
    className,
  );

  if ("href" in props && props.href) {
    const { href, ...linkRest } = rest as LinkButtonProps;
    return (
      <Link
        href={href}
        className={composed}
        {...(linkRest as Omit<
          LinkButtonProps,
          "href" | "children" | "variant" | "size" | "className"
        >)}
      >
        {children}
      </Link>
    );
  }

  return (
    <button
      className={composed}
      {...(rest as ButtonHTMLAttributes<HTMLButtonElement>)}
    >
      {children}
    </button>
  );
}
