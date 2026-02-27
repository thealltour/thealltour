"use client";

import type { ReactNode } from "react";

type AdminSectionProps = {
  title?: string;
  description?: string;
  children: ReactNode;
  className?: string;
  headerRight?: ReactNode;
};

function cx(...values: Array<string | false | null | undefined>) {
  return values.filter(Boolean).join(" ");
}

export default function AdminSection({
  title,
  description,
  children,
  className,
  headerRight,
}: AdminSectionProps) {
  return (
    <section className={cx("space-y-3", className)}>
      {(title || description || headerRight) && (
        <div className="flex items-baseline justify-between gap-2">
          <div className="space-y-0.5">
            {title && (
              <h2 className="text-sm font-semibold text-[var(--text-primary)]">
                {title}
              </h2>
            )}
            {description && (
              <p className="text-xs text-[var(--text-muted)]">
                {description}
              </p>
            )}
          </div>
          {headerRight ? (
            <div className="flex items-center gap-2">{headerRight}</div>
          ) : null}
        </div>
      )}
      {children}
    </section>
  );
}

