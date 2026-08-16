/**
 * 캠페인 대표 배지 **표시 정책** (PR2 + PR3).
 * PR3: `badge_tone`·taxonomy `description`(badge_description) 데이터 기반, 레거시 라벨 fallback.
 */

import type { Product } from "@/types/product";
import type { CampaignBadgeTone } from "@/types/productCampaignCard";
import { cn } from "@/lib/cn";
import { getPrimaryRepresentativeCampaignLabel, normalizeCampaignLabel } from "@/lib/productCampaignBadges";
import { sortVisibleCampaignCardMeta } from "@/lib/productCampaignSort";

/** 카드 표면 종류 — 데이터는 동일, 표현 강도만 조절 */
export type CampaignCardKind = "related" | "list" | "grid" | "mobile" | "home";

export type CampaignVisualTone = "recommend" | "popular" | "new" | "secondary";

function campaignKey(label: string): string {
  return normalizeCampaignLabel(label).toLowerCase();
}

export function getCampaignBadgeTone(label: string): CampaignVisualTone {
  const k = campaignKey(label);
  if (k === "추천") return "recommend";
  if (k === "인기") return "popular";
  if (k === "신규") return "new";
  return "secondary";
}

/** @deprecated 이름 명확화: `getCampaignBadgeTone` */
export function getCampaignBadgeStyle(label: string): CampaignVisualTone {
  return getCampaignBadgeTone(label);
}

/**
 * 대표 캠페인 1줄 설명 (라벨 매핑만, 관리자 자유 입력 없음).
 */
export function getCampaignBadgeDescription(
  label: string,
  opts?: { maxLength?: number },
): string | undefined {
  const raw = normalizeCampaignLabel(label);
  if (!raw) return undefined;
  const k = campaignKey(raw);
  let out: string;
  if (k === "추천") out = "MD가 추천하는 일정";
  else if (k === "인기") out = "요즘 많이 찾는 상품";
  else if (k === "신규") out = "최근 등록된 기획 상품";
  else out = `${raw} 기획 상품`;

  const max = opts?.maxLength ?? 42;
  if (out.length > max) return `${out.slice(0, Math.max(8, max - 1))}…`;
  return out;
}

export function shouldShowCampaignPitch(kind: CampaignCardKind): boolean {
  return kind !== "grid";
}

/**
 * 카드 유형에 맞는 피치 문구 (grid는 생략).
 */
export function getCampaignPitchForLabel(label: string, kind: CampaignCardKind): string | undefined {
  if (!shouldShowCampaignPitch(kind)) return undefined;
  const max =
    kind === "home"
      ? 30
      : kind === "mobile"
        ? 34
        : kind === "list"
          ? 40
          : 44;
  return getCampaignBadgeDescription(label, { maxLength: max });
}

function pitchMaxLengthForKind(kind: CampaignCardKind): number {
  if (kind === "home") return 30;
  if (kind === "mobile") return 34;
  if (kind === "list") return 40;
  return 44;
}

function clipCampaignPitch(text: string, max: number): string {
  const t = text.replace(/\s+/g, " ").trim();
  if (!t) return "";
  if (t.length <= max) return t;
  return `${t.slice(0, Math.max(8, max - 1))}…`;
}

/** 대표 캠페인(visible·priority 1위)의 CMS 설명 1줄 */
function getPrimaryCampaignPitchFromMeta(product: Product, kind: CampaignCardKind): string | undefined {
  if (!shouldShowCampaignPitch(kind)) return undefined;
  const meta = product.campaign_card_meta;
  if (!meta?.length) return undefined;
  const sorted = sortVisibleCampaignCardMeta(meta);
  const raw = sorted[0]?.description?.trim();
  if (!raw) return undefined;
  const clipped = clipCampaignPitch(raw, pitchMaxLengthForKind(kind));
  return clipped || undefined;
}

export function buildCampaignPitchLineFromProduct(
  product: Product,
  kind: CampaignCardKind,
): string | undefined {
  const fromMeta = getPrimaryCampaignPitchFromMeta(product, kind);
  if (fromMeta) return fromMeta;

  const primary = getPrimaryRepresentativeCampaignLabel(product);
  if (!primary) return undefined;
  return getCampaignPitchForLabel(primary, kind);
}

function visualToneFromBadgeTone(tone: CampaignBadgeTone): CampaignVisualTone {
  if (tone === "primary") return "recommend";
  if (tone === "highlight") return "popular";
  return "new";
}

/** ProductCard layout + 옵션 → 표현 kind */
export function resolveCampaignCardKind(args: {
  layout: "grid" | "list" | "related" | "stack";
  analyticsSection?: string | null;
  presentationKind?: CampaignCardKind;
}): CampaignCardKind {
  if (args.presentationKind) return args.presentationKind;
  if (args.analyticsSection === "related_products" || args.layout === "related") return "related";
  if (args.layout === "list") return "list";
  return "grid";
}

/** 이미지 오버레이 vs 본문 인라인(리스트 카드 제목 주변) */
export type CampaignBadgeSurface = "overlay" | "inline";

/**
 * 배지 톤 ↔ 브랜드 토큰 매핑. violet/sky/emerald 같은 브랜드와 무관한 "기본 후보 색"
 * 대신, 사이트 전역에서 이미 쓰는 --primary/--accent/--success/--foreground만 사용한다.
 */
const CAMPAIGN_BADGE_TONE_PALETTE: Record<CampaignVisualTone, string> = {
  recommend: "bg-[var(--primary)]/95 text-white ring-[var(--primary-active)]/35",
  popular: "bg-[var(--accent)]/95 text-white ring-[var(--accent-hover)]/35",
  new: "bg-[var(--success)]/95 text-white ring-[var(--success)]/35",
  secondary: "bg-[var(--foreground)]/90 text-white ring-[var(--foreground)]/25",
};

/** 시즌/특가(promotion) — --warning 톤 (기존 amber와 색감 유지, 토큰화만) */
export const CAMPAIGN_BADGE_PROMOTION_PALETTE = "bg-[var(--warning)]/95 text-white ring-[var(--warning)]/35";

function campaignBadgeShellClasses(surface: CampaignBadgeSurface): string {
  const maxW =
    surface === "inline"
      ? "max-w-[min(100%,7rem)] sm:max-w-[8.5rem]"
      : "max-w-[min(100%,11rem)]";
  return cn(
    maxW,
    "shrink-0 truncate rounded-md font-bold ring-1 leading-tight",
    surface === "overlay" && "shadow-sm",
  );
}

function campaignBadgePrimarySizeClasses(kind: CampaignCardKind, size: "sm" | "md"): string {
  if (size === "sm") {
    return "px-1.5 py-0.5 text-[9px] leading-tight sm:px-2 sm:py-0.5 sm:text-[10px]";
  }
  if (kind === "related") return "px-2.5 py-1 text-[11px] sm:text-xs";
  if (kind === "list") return "px-2 py-0.5 text-[10px] md:px-2.5 md:py-1 md:text-[11px]";
  if (kind === "home") return "px-2 py-0.5 text-[10px] sm:px-2 sm:py-1 sm:text-[11px]";
  if (kind === "mobile") return "px-1.5 py-0.5 text-[9px] leading-tight";
  return "px-2 py-1 text-[10px] sm:text-[11px]";
}

/**
 * Tailwind 클래스 — 모든 캠페인 배지 동등 크기·풀 컬러 (rounded-md 솔리드).
 * - `size`: md = related·그리드 오버레이, sm = 리스트/모바일 인라인
 * - `surface`: overlay = 이미지 위, inline = 제목 인접(본문 배경)
 */
export function getCampaignBadgeClassName(
  label: string,
  opts: {
    /** @deprecated 스타일에 미사용. 하위 호환용 */
    isPrimary?: boolean;
    kind: CampaignCardKind;
    badgeTone?: CampaignBadgeTone;
    size?: "sm" | "md";
    surface?: CampaignBadgeSurface;
    isPromotion?: boolean;
  },
): string {
  const tone: CampaignVisualTone =
    opts.badgeTone != null ? visualToneFromBadgeTone(opts.badgeTone) : getCampaignBadgeTone(label);
  const { kind } = opts;
  const size = opts.size ?? "md";
  const surface = opts.surface ?? "overlay";

  if (opts.isPromotion) {
    return cn(
      campaignBadgeShellClasses(surface),
      campaignBadgePrimarySizeClasses(kind, size),
      CAMPAIGN_BADGE_PROMOTION_PALETTE,
    );
  }

  const palette = CAMPAIGN_BADGE_TONE_PALETTE[tone];
  return cn(
    campaignBadgeShellClasses(surface),
    campaignBadgePrimarySizeClasses(kind, size),
    palette,
  );
}
