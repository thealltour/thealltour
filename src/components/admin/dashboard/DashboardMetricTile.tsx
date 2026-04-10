"use client";

import Link from "next/link";
import { ArrowDown, ArrowUp, Minus } from "lucide-react";

export type DashboardMetricTileProps = {
  label: string;
  value: string | number;
  href?: string;
  changePercent?: number | null;
  /** 집계 없음 등 부가 설명 (선택) */
  footnote?: string;
};

function toDirection(value?: number | null): "up" | "down" | "flat" | undefined {
  if (typeof value !== "number") return undefined;
  if (value === 0) return "flat";
  return value < 0 ? "down" : "up";
}

function formatDelta(value?: number | null): string | null {
  if (typeof value !== "number") return null;
  const sign = value > 0 ? "+" : "";
  return `${sign}${value}%`;
}

/**
 * 대시보드 문의 KPI·탐색/전환 KPI 공통 compact 타일 (모바일 2열 그리드용).
 */
export function DashboardMetricTile({ label, value, href, changePercent, footnote }: DashboardMetricTileProps) {
  const direction = toDirection(changePercent);
  const deltaText = formatDelta(changePercent);
  const hasDelta = deltaText !== null;
  const deltaColor =
    !hasDelta || direction === "flat"
      ? "text-[var(--text-muted)]"
      : direction === "down"
        ? "text-[var(--danger)]"
        : "text-[var(--success)]";

  const DeltaIcon =
    !hasDelta || direction === "flat" ? Minus : direction === "down" ? ArrowDown : ArrowUp;

  const inner = (
    <div
      className={`group relative flex min-h-[3.5rem] flex-col justify-between overflow-hidden rounded-lg border border-[var(--border)] bg-gradient-to-b from-[var(--card)]/90 via-[var(--surface-muted)] to-[var(--surface-muted)] px-2 py-1.5 shadow-sm transition-[transform,box-shadow,border-color] before:pointer-events-none before:absolute before:inset-x-0 before:top-0 before:h-px before:bg-gradient-to-r before:from-transparent before:via-[var(--brand)]/25 before:to-transparent md:min-h-[4rem] md:px-2.5 md:py-2 ${
        href
          ? "hover:border-[var(--brand)]/35 hover:shadow-md active:scale-[0.98] md:active:scale-100"
          : ""
      } `}
    >
      <p className="line-clamp-2 min-h-[2rem] text-[9px] font-medium leading-snug text-[var(--text-muted)] md:min-h-0 md:text-[10px] lg:text-[11px]">
        {label}
      </p>
      <p className="mt-0.5 text-lg font-bold tabular-nums leading-none tracking-tight text-[var(--text-primary)] md:text-xl lg:text-2xl">
        {value}
      </p>
      {hasDelta ? (
        <p
          className={`mt-0.5 flex items-center gap-0.5 text-[9px] font-semibold tabular-nums md:text-[10px] ${deltaColor}`}
        >
          <DeltaIcon className="h-3 w-3 shrink-0 opacity-90" strokeWidth={2.5} aria-hidden />
          <span>{deltaText}</span>
          <span className="sr-only">전일 대비</span>
        </p>
      ) : (
        <p className="mt-0.5 flex min-h-[1rem] items-center text-[9px] tabular-nums text-[var(--text-muted)] md:text-[10px]">
          {footnote ?? "—"}
        </p>
      )}
    </div>
  );

  if (href) {
    return (
      <Link
        href={href}
        className="block min-w-0 cursor-pointer rounded-lg focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--brand)] focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--bg)]"
      >
        {inner}
      </Link>
    );
  }

  return <div className="min-w-0 rounded-lg">{inner}</div>;
}
