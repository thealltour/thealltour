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
    bg: "bg-amber-50",
    text: "text-amber-700",
    dot: "bg-amber-500",
  },
  completed: {
    bg: "bg-emerald-50",
    text: "text-emerald-700",
    dot: "bg-emerald-500",
  },
  delayed: {
    bg: "bg-rose-50",
    text: "text-rose-700",
    dot: "bg-rose-500",
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

