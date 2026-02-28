"use client";

import { AlertTriangle, Info, MessageSquare } from "lucide-react";

export type AlertCardVariant = "warning" | "info" | "neutral";

const variantConfig: Record<
  AlertCardVariant,
  { icon: typeof AlertTriangle; className: string }
> = {
  warning: {
    icon: AlertTriangle,
    className: "bg-amber-50 ring-amber-200 text-amber-800 [&_.alert-icon]:text-amber-600",
  },
  info: {
    icon: Info,
    className: "bg-[#f8fbff] ring-[#dbeafe] text-[#1e3a8a] [&_.alert-icon]:text-[#2563eb]",
  },
  neutral: {
    icon: MessageSquare,
    className: "bg-slate-50 ring-slate-200 text-slate-700 [&_.alert-icon]:text-slate-500",
  },
};

type AlertCardProps = {
  variant?: AlertCardVariant;
  title?: string;
  children: React.ReactNode;
  className?: string;
};

export default function AlertCard({
  variant = "neutral",
  title,
  children,
  className = "",
}: AlertCardProps) {
  const { icon: Icon, className: variantClass } = variantConfig[variant];
  return (
    <div
      className={`rounded-xl ring-1 p-4 ${variantClass} ${className}`}
      role="region"
      aria-label={title ?? "안내"}
    >
      <div className="flex gap-3">
        <span className="alert-icon shrink-0" aria-hidden>
          <Icon className="h-5 w-5" />
        </span>
        <div className="min-w-0 flex-1">
          {title ? (
            <h3 className="mb-1.5 text-sm font-semibold">{title}</h3>
          ) : null}
          <div className="text-sm leading-[1.7] text-slate-700">{children}</div>
        </div>
      </div>
    </div>
  );
}
