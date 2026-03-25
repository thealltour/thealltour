"use client";

import { useMemo } from "react";
import { AlertCircle, AlertTriangle, Info } from "lucide-react";
import type { AdminProductListWarning } from "./adminProductsList.types";
import { formatAllWarningLabelsForTooltip } from "./adminProductsList.helpers";

type AdminProductsRowWarningsProps = {
  warnings: AdminProductListWarning[];
  className?: string;
};

const PLACEHOLDER_CLS =
  "inline-flex h-5 w-7 shrink-0 items-center justify-center rounded-sm border border-transparent";

/**
 * 스캔 우선: 치명·주의·정보 중 **대표 1아이콘**만 표시, 전체 라벨은 title.
 * - critical이 하나라도 있으면 크고 선명한 빨간 아이콘
 * - 없으면 warning만 (더 작고 옅게)
 * - 그다음 info
 */
export default function AdminProductsRowWarnings({ warnings, className }: AdminProductsRowWarningsProps) {
  const { mode, tooltip } = useMemo(() => {
    const crits = warnings.filter((w) => w.severity === "critical");
    const warns = warnings.filter((w) => w.severity === "warning");
    const infos = warnings.filter((w) => w.severity === "info");
    const tooltip = formatAllWarningLabelsForTooltip(warnings);
    if (crits.length > 0) return { mode: "critical" as const, tooltip };
    if (warns.length > 0) return { mode: "warning" as const, tooltip };
    if (infos.length > 0) return { mode: "info" as const, tooltip };
    return { mode: "clean" as const, tooltip: "" };
  }, [warnings]);

  if (warnings.length === 0 || mode === "clean") {
    return (
      <span className={`${PLACEHOLDER_CLS} ${className ?? ""}`} aria-hidden>
        <span className="select-none text-[12px] leading-none text-[var(--text-muted)]/15">·</span>
      </span>
    );
  }

  if (mode === "info") {
    return (
      <span
        className={`${PLACEHOLDER_CLS} cursor-default text-[var(--text-muted)]/80 ${className ?? ""}`}
        title={tooltip}
        role="img"
        aria-label={tooltip}
      >
        <Info className="h-3 w-3 shrink-0 opacity-65" strokeWidth={1.75} aria-hidden />
      </span>
    );
  }

  if (mode === "critical") {
    return (
      <span
        className={`inline-flex h-5 w-7 shrink-0 cursor-default items-center justify-center ${className ?? ""}`}
        title={tooltip}
        role="img"
        aria-label={tooltip}
      >
        <AlertCircle
          className="h-[1.3rem] w-[1.3rem] shrink-0 text-red-600 drop-shadow-[0_0_2px_rgba(220,38,38,0.55)] dark:text-red-400"
          strokeWidth={3}
          aria-hidden
        />
      </span>
    );
  }

  return (
    <span
      className={`inline-flex h-5 w-7 shrink-0 cursor-default items-center justify-center ${className ?? ""}`}
      title={tooltip}
      role="img"
      aria-label={tooltip}
    >
      <AlertTriangle
        className="h-3 w-3 shrink-0 text-amber-600/50 dark:text-amber-500/38"
        strokeWidth={1.85}
        aria-hidden
      />
    </span>
  );
}
