"use client";

type TagVariant = "accent" | "muted" | "gold";

const variantStyles: Record<TagVariant, string> = {
  accent:
    "bg-[color:color-mix(in_oklab,var(--primary)_12%,white)] text-[var(--primary)] ring-[var(--border)]",
  muted:
    "bg-[var(--card-muted)] text-[var(--text-secondary)] ring-[var(--border)]",
  gold:
    "bg-[var(--warning-bg)] text-[var(--secondary)] ring-[color:color-mix(in_oklab,var(--secondary)_45%,transparent)]",
};

type TagProps = {
  children: React.ReactNode;
  variant?: TagVariant;
  size?: "sm";
  className?: string;
};

export default function Tag({
  children,
  variant = "muted",
  size = "sm",
  className = "",
}: TagProps) {
  const sizeClass = size === "sm" ? "px-2.5 py-1 text-xs font-medium" : "";
  return (
    <span
      className={`inline-flex items-center rounded-full ring-1 transition ${variantStyles[variant]} ${sizeClass} ${className}`}
    >
      {children}
    </span>
  );
}
