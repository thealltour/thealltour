"use client";

import { cn } from "@/lib/cn";
import type { CampaignBadgeTone } from "@/types/productCampaignCard";
import type { CampaignBadgeSurface, CampaignCardKind } from "@/lib/productCampaignPresentation";
import { getCampaignBadgeClassName } from "@/lib/productCampaignPresentation";

export type ProductCampaignBadgeProps = {
  label: string;
  /** true: 우선순위 1위 대표 배지 */
  isPrimary: boolean;
  /** 카드 유형별 크기·톤 */
  kind: CampaignCardKind;
  /** PR3: taxonomy CMS 톤. 없으면 라벨로 추론 */
  badgeTone?: CampaignBadgeTone | null;
  /** md: 오버레이·related, sm: 리스트/모바일 인라인 */
  size?: "sm" | "md";
  /** overlay: 이미지 위, inline: 제목 인접(본문 배경) */
  surface?: CampaignBadgeSurface;
  className?: string;
};

/**
 * 기획/추천(campaign) 대표 배지 — 카드 간 동일 라벨 동일 인상.
 */
export function ProductCampaignBadge({
  label,
  isPrimary,
  kind,
  badgeTone,
  size = "md",
  surface = "overlay",
  className,
}: ProductCampaignBadgeProps) {
  const text = label.trim();
  if (!text) return null;

  return (
    <span
      title={text}
      className={cn(
        getCampaignBadgeClassName(text, {
          isPrimary,
          kind,
          badgeTone: badgeTone ?? undefined,
          size,
          surface,
        }),
        className,
      )}
    >
      {text}
    </span>
  );
}
