"use client";

import type { ButtonHTMLAttributes, ReactNode } from "react";
import Link from "next/link";

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

function cx(...values: Array<string | false | null | undefined>) {
  return values.filter(Boolean).join(" ");
}

function getVariantClasses(variant: AdminButtonVariant): string {
  if (variant === "secondary") {
    return "bg-[var(--surface-muted)] text-[var(--text-primary)] hover:bg-[var(--border)] border border-transparent";
  }
  if (variant === "ghost") {
    return "bg-transparent text-[var(--text-secondary)] hover:bg-[var(--surface-muted)] border border-transparent";
  }
  // primary
  return "bg-[var(--primary)] text-white hover:bg-[var(--primary-hover)] border border-transparent";
}

function getSizeClasses(size: AdminButtonSize): string {
  return size === "sm" ? "px-3 py-1.5 text-xs" : "px-4 py-2 text-sm";
}

export default function AdminButton(props: AdminButtonProps) {
  const {
    children,
    variant = "primary",
    size = "md",
    className,
    ...rest
  } = props as any;

  const base =
    "inline-flex items-center justify-center rounded-lg font-semibold transition-colors duration-150 disabled:opacity-60 disabled:cursor-not-allowed";

  const composed = cx(
    base,
    getVariantClasses(variant),
    getSizeClasses(size),
    className,
  );

  if ("href" in props && props.href) {
    return (
      <Link href={props.href} className={composed} {...(rest as any)}>
        {children}
      </Link>
    );
  }

  return (
    <button className={composed} {...(rest as any)}>
      {children}
    </button>
  );
}

