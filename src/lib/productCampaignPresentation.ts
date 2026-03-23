/**
 * 캠페인 대표 배지 **표시 정책** (PR2 + PR3).
 * PR3: `badge_tone`·taxonomy `description`(badge_description) 데이터 기반, 레거시 라벨 fallback.
 */

import type { Product } from "@/types/product";
import type { CampaignBadgeTone } from "@/types/productCampaignCard";
import { cn } from "@/lib/cn";
import { getPrimaryRepresentativeCampaignLabel, normalizeCampaignLabel } from "@/lib/productCampaignBadges";

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
  const sorted = [...meta]
    .filter((m) => m.badge_visible === true)
    .sort((a, b) => {
      if (a.badge_priority !== b.badge_priority) return a.badge_priority - b.badge_priority;
      return a.displayLabel.localeCompare(b.displayLabel, "ko");
    });
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
 * Tailwind 클래스 — 핵심 3종은 캐릭터, 기타는 절제된 pill.
 * - `size`: md = related·그리드 오버레이, sm = 리스트/모바일 인라인
 * - `surface`: overlay = 어두운 보조 배지 허용, inline = 표면 위 보조 칩은 절제
 */
export function getCampaignBadgeClassName(
  label: string,
  opts: {
    isPrimary: boolean;
    kind: CampaignCardKind;
    badgeTone?: CampaignBadgeTone;
    size?: "sm" | "md";
    surface?: CampaignBadgeSurface;
  },
): string {
  const tone: CampaignVisualTone =
    opts.badgeTone != null ? visualToneFromBadgeTone(opts.badgeTone) : getCampaignBadgeTone(label);
  const { isPrimary, kind } = opts;
  const size = opts.size ?? "md";
  const surface = opts.surface ?? "overlay";

  const sizePrimaryMd =
    kind === "related"
      ? "px-2.5 py-1 text-[11px] sm:text-xs"
      : kind === "list"
        ? "px-2 py-0.5 text-[10px] md:px-2.5 md:py-1 md:text-[11px]"
        : kind === "home"
          ? "px-2 py-0.5 text-[10px] sm:px-2 sm:py-1 sm:text-[11px]"
          : kind === "mobile"
            ? "px-1.5 py-0.5 text-[9px] leading-tight"
            : "px-2 py-0.5 text-[10px] sm:text-[11px]";

  const sizePrimarySm =
    "px-1.5 py-0.5 text-[9px] leading-tight sm:px-2 sm:py-0.5 sm:text-[10px]";

  const sizeSecondaryMd =
    kind === "related"
      ? "px-2 py-0.5 text-[10px] sm:text-[11px]"
      : kind === "list"
        ? "px-1.5 py-0.5 text-[9px] md:px-2 md:py-0.5 md:text-[10px]"
        : kind === "home"
          ? "px-1.5 py-0.5 text-[9px] sm:px-2 sm:py-0.5 sm:text-[10px]"
          : kind === "mobile"
            ? "px-1.5 py-0.5 text-[8px] leading-tight"
            : "px-1.5 py-0.5 text-[9px] sm:text-[10px]";

  const sizeSecondarySm =
    "px-1.5 py-0.5 text-[8px] leading-tight sm:text-[9px]";

  const sizePrimary = size === "sm" ? sizePrimarySm : sizePrimaryMd;
  const sizeSecondary = size === "sm" ? sizeSecondarySm : sizeSecondaryMd;

  const baseOverlay = "max-w-[min(100%,10.5rem)] shrink-0 truncate rounded-full font-semibold leading-none ring-1";
  const baseInline =
    "max-w-[min(100%,7rem)] sm:max-w-[8.5rem] shrink-0 truncate rounded-full font-semibold leading-none ring-1";

  const base = surface === "inline" ? baseInline : baseOverlay;

  if (!isPrimary) {
    if (surface === "inline") {
      return cn(
        base,
        sizeSecondary,
        "border border-[var(--border)] bg-[var(--surface-muted)] text-[var(--text-secondary)] ring-0 shadow-none",
      );
    }
    return cn(
      base,
      sizeSecondary,
      "bg-black/38 text-white/92 ring-white/18 backdrop-blur-sm",
      kind === "grid" && "opacity-90",
      kind === "related" && "ring-white/25",
    );
  }

  const tonePrimary: Record<CampaignVisualTone, string> = {
    recommend:
      "bg-[var(--primary)] text-[var(--on-primary)] ring-black/15",
    popular: "bg-blue-800 text-white ring-blue-950/20",
    new: "bg-emerald-700 text-white ring-emerald-950/15",
    secondary: "bg-slate-900/88 text-white ring-white/15",
  };

  if (surface === "inline") {
    return cn(base, sizePrimary, tonePrimary[tone], "shadow-sm");
  }

  return cn(base, sizePrimary, tonePrimary[tone]);
}
