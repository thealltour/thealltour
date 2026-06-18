"use client";

import { Star } from "lucide-react";
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
  /** 시즌/특가(promotion) — amber 별+배지 */
  isPromotion?: boolean;
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
  isPromotion = false,
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
          isPromotion,
        }),
        isPromotion && "inline-flex items-center gap-0.5",
        className,
      )}
    >
      {isPromotion ? (
        <Star
          className="h-2.5 w-2.5 shrink-0 fill-white text-white sm:h-3 sm:w-3"
          strokeWidth={0}
          aria-hidden
        />
      ) : null}
      {text}
    </span>
  );
}
