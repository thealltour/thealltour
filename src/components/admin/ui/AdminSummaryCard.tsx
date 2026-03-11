"use client";

import type { ReactNode } from "react";
import Link from "next/link";
import { cn } from "@/lib/cn";
import AdminCard from "./AdminCard";

export type AdminSummaryCardProps = {
  /** 카드 상단 라벨 */
  title: string;
  /** 표시할 값 (숫자, 문자열, 퍼센트 등) */
  value: ReactNode;
  /** 카드 래퍼 추가 클래스 (테두리 강조 등) */
  className?: string;
  /** value 영역 추가 클래스 (색상 등) */
  valueClassName?: string;
  /** 있으면 카드 전체를 링크로 */
  href?: string;
};

/**
 * Admin 대시보드용 요약 카드. 라벨 + 값 표시.
 * change 퍼센트/링크가 필요하면 AdminStatCard 사용.
 */
export default function AdminSummaryCard({
  title,
  value,
  className,
  valueClassName,
  href,
}: AdminSummaryCardProps) {
  const body = (
    <AdminCard variant="muted" className={className}>
      <p className="text-xs font-medium text-[var(--text-muted)]">{title}</p>
      <p
        className={cn(
          "mt-1 text-2xl font-semibold text-[var(--text-primary)]",
          valueClassName
        )}
      >
        {value}
      </p>
    </AdminCard>
  );

  if (href) {
    return (
      <Link
        href={href}
        className="block focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--primary)] focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--background)]"
      >
        {body}
      </Link>
    );
  }

  return body;
}
