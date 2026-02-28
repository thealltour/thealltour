"use client";

type TagVariant = "accent" | "muted" | "gold";

const variantStyles: Record<TagVariant, string> = {
  accent:
    "bg-[#eff6ff] text-[#1E3A8A] ring-[#dbeafe]",
  muted:
    "bg-slate-100 text-slate-600 ring-slate-200",
  gold:
    "bg-amber-50 text-amber-700 ring-amber-200",
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
