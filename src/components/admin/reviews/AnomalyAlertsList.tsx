"use client";

import Link from "next/link";
import type { ReviewAnomalyAlert } from "@/types/reviewAnomalies";

type AnomalyAlertsListProps = {
  alerts: ReviewAnomalyAlert[];
};

function SeverityBadge({ severity }: { severity: string }) {
  const classes =
    severity === "high"
      ? "bg-red-100 text-red-800"
      : severity === "medium"
        ? "bg-amber-100 text-amber-800"
        : "bg-slate-100 text-slate-700";
  return (
    <span className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium ${classes}`}>
      {severity}
    </span>
  );
}

export function AnomalyAlertsList({ alerts }: AnomalyAlertsListProps) {
  if (alerts.length === 0) {
    return (
      <div className="rounded-xl border border-[var(--border)] bg-[var(--surface)] p-4">
        <h3 className="text-sm font-semibold text-[var(--text-primary)]">운영 알림</h3>
        <p className="mt-2 text-xs text-[var(--text-muted)]">
          현재 감지된 이상 징후가 없습니다.
        </p>
      </div>
    );
  }

  return (
    <div className="rounded-xl border border-[var(--border)] bg-[var(--surface)] p-4">
      <h3 className="text-sm font-semibold text-[var(--text-primary)]">운영 알림</h3>
      <p className="mt-0.5 text-xs text-[var(--text-muted)]">
        severity 기준 정렬 (high → medium → low)
      </p>
      <ul className="mt-4 space-y-3">
        {alerts.map((alert, i) => (
          <li
            key={`${alert.type}-${alert.productId ?? alert.reviewId ?? i}`}
            className="flex flex-col gap-1 border-b border-[var(--border)]/50 pb-3 last:border-0 last:pb-0"
          >
            <div className="flex flex-wrap items-center gap-2">
              <SeverityBadge severity={alert.severity} />
              <span className="text-xs text-[var(--text-muted)]">{alert.type}</span>
              {alert.createdAt && (
                <span className="text-xs text-[var(--text-muted)]">{alert.createdAt.slice(0, 10)}</span>
              )}
            </div>
            <p className="font-medium text-[var(--text-primary)]">{alert.title}</p>
            <p className="text-sm text-[var(--text-secondary)]">{alert.description}</p>
            <div className="flex gap-2">
              {alert.productId && (
                <Link
                  href={`/products/${alert.productId}`}
                  className="text-xs text-[var(--primary)] hover:underline"
                >
                  상품 보기
                </Link>
              )}
              {alert.reviewId && (
                <Link
                  href={`/reviews/${alert.reviewId}`}
                  className="text-xs text-[var(--primary)] hover:underline"
                >
                  리뷰 보기
                </Link>
              )}
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}
