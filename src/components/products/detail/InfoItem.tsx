"use client";

import type { ReactNode } from "react";
import { Icon } from "@/components/ui/Icon";
import type { IconName } from "@/icons";

export type InfoItemProps = {
  icon: IconName;
  label: string;
  value?: ReactNode;
  className?: string;
};

/**
 * 상품 상세 정보 행 공통 패턴 (라벨 + 값 스캔 UX).
 * 아이콘은 장식용(decorative)만 사용 — 라벨이 텍스트로 의미 전달.
 */
export function InfoItem({ icon, label, value, className = "" }: InfoItemProps) {
  const hasValue = value != null && value !== "";

  return (
    <div className={`flex min-w-0 items-start justify-between gap-3 ${className}`}>
      <div className="flex min-w-0 shrink-0 items-center gap-2 text-content-muted">
        <Icon name={icon} size={18} className="h-[18px] w-[18px] shrink-0" decorative />
        <span className="whitespace-normal text-sm">{label}</span>
      </div>
      {hasValue ? (
        <div className="min-w-0 max-w-[min(100%,20rem)] text-right text-sm leading-snug whitespace-normal text-foreground sm:max-w-[22rem]">
          {value}
        </div>
      ) : null}
    </div>
  );
}
