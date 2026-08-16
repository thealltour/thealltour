"use client";

type StatusVariant = "pending" | "completed" | "delayed";

type StatusBadgeProps = {
  variant: StatusVariant;
  label: string;
};

const STYLES: Record<
  StatusVariant,
  { bg: string; text: string; dot: string }
> = {
  pending: {
    bg: "bg-[var(--warning-bg)]",
    text: "text-[var(--warning)]",
    dot: "bg-[var(--warning)]",
  },
  completed: {
    bg: "bg-[var(--success-bg)]",
    text: "text-[var(--success)]",
    dot: "bg-[var(--success)]",
  },
  delayed: {
    bg: "bg-[var(--danger-bg)]",
    text: "text-[var(--danger)]",
    dot: "bg-[var(--danger)]",
  },
};

export default function StatusBadge({ variant, label }: StatusBadgeProps) {
  const style = STYLES[variant];
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px] font-medium ${style.bg} ${style.text}`}
    >
      <span className={`h-1.5 w-1.5 rounded-full ${style.dot}`} />
      {label}
    </span>
  );
}

