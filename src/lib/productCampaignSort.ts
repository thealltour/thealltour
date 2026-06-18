import type { ProductCampaignCardMeta } from "@/types/productCampaignCard";

const DEFAULT_BADGE_PRIORITY = 100;

function badgePriorityValue(meta: ProductCampaignCardMeta): number {
  return typeof meta.badge_priority === "number" && Number.isFinite(meta.badge_priority)
    ? meta.badge_priority
    : DEFAULT_BADGE_PRIORITY;
}

/**
 * 상품 카드 배지·피치용: badge_visible=true만, badge_priority ASC → displayLabel.
 * 관리자 기획/추천 taxonomy의 「배지 우선순위」가 카드 왼쪽→오른쪽 순서의 단일 소스.
 */
export function sortVisibleCampaignCardMeta(
  meta: ProductCampaignCardMeta[],
): ProductCampaignCardMeta[] {
  return [...meta]
    .filter((m) => m.badge_visible === true)
    .sort((a, b) => {
      const pa = badgePriorityValue(a);
      const pb = badgePriorityValue(b);
      if (pa !== pb) return pa - pb;
      return a.displayLabel.localeCompare(b.displayLabel, "ko");
    });
}
