"use client";

import Link from "next/link";
import AdminCard from "./AdminCard";

type AdminStatCardProps = {
  title: string;
  value: number | string;
  changePercent?: number | null;
  changeDirection?: "up" | "down";
  href?: string;
};

function formatChange(changePercent?: number | null) {
  if (typeof changePercent !== "number") return null;
  const sign = changePercent > 0 ? "+" : "";
  return `${sign}${changePercent.toFixed(1)}%`;
}

export default function AdminStatCard({
  title,
  value,
  changePercent,
  changeDirection,
  href,
}: AdminStatCardProps) {
  const hasChange = typeof changePercent === "number";
  const isDown = hasChange && changeDirection === "down";
  const isUp = hasChange && changeDirection === "up";

  const body = (
    <AdminCard variant="glass" className="kpi-card h-full">
      <p className="text-sm font-medium text-[var(--text-secondary)]">
        {title}
      </p>
      <p className="mt-2 text-2xl font-bold text-[var(--text-primary)]">
        {value}
      </p>
      {hasChange ? (
        <p
          className={`mt-3 inline-flex items-center text-xs font-semibold ${
            isDown
              ? "text-[var(--danger)]"
              : isUp
              ? "text-[var(--success)]"
              : "text-[var(--text-secondary)]"
          }`}
        >
          {isDown ? "▼" : "▲"} {formatChange(changePercent as number)}
        </p>
      ) : null}
    </AdminCard>
  );

  if (href) {
    return (
      <Link
        href={href}
        className="block focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--background)]"
      >
        {body}
      </Link>
    );
  }

  return body;
}

