import type { ProductCardBadge, ProductCardStatus } from "@/components/products/ProductCard";

export type DisplayChip = {
  label: string;
  variant: "accent" | "muted" | "gold";
};

/** ProductCard / HomeProductCard 공통 칩 표면 스타일 */
export function displayChipSurfaceClass(variant: DisplayChip["variant"]): string {
  if (variant === "accent") {
    return "border-blue-200 bg-blue-600/95 text-white";
  }
  if (variant === "gold") {
    return "border-amber-200 bg-amber-500/95 text-white";
  }
  return "border-[var(--border)] bg-[var(--surface)] text-[var(--text-primary)]";
}

/**
 * 테마·상태 등 **정보성** 칩 — 캠페인 대표 배지보다 한 단계 낮은 계층 (PR2).
 */
export function infoDisplayChipSurfaceClass(variant: DisplayChip["variant"]): string {
  if (variant === "gold") {
    return "border-amber-200/70 bg-amber-500/88 text-white";
  }
  if (variant === "accent") {
    return "border-[var(--border)]/70 bg-[var(--surface-muted)] text-[var(--text-muted)]";
  }
  return "border-[var(--border)]/60 bg-[var(--surface-muted)]/80 text-[var(--text-subtle)]";
}

function badgeTypeToTagVariant(type: string): "accent" | "muted" | "gold" {
  const t = type?.toLowerCase() ?? "";
  if (t === "accent" || t === "primary" || t === "인기" || t === "추천") return "accent";
  if (t === "gold" || t === "제철" || t === "마감임박") return "gold";
  return "muted";
}

/**
 * 상태 + 테마 등 **정보성** 배지 칩 (최대 2개).
 * 캠페인 대표 배지는 `badges`(campaign)와 분리 — 여기서는 다루지 않음.
 */
export function pickInfoDisplayChips(
  status: ProductCardStatus | undefined,
  infoBadges: ProductCardBadge[],
): DisplayChip[] {
  const chips: DisplayChip[] = [];

  if (status === "SOLD_OUT") {
    chips.push({ label: "마감", variant: "muted" });
  } else if (status === "LIMITED") {
    chips.push({ label: "마감임박", variant: "gold" });
  } else if (status === "CONSULT_REQUIRED") {
    chips.push({ label: "상담 후 안내", variant: "muted" });
  }

  const sorted = [...infoBadges].filter((b) => b.isActive !== false).sort((a, b) => {
    const pa = a.priority ?? 0;
    const pb = b.priority ?? 0;
    if (pb !== pa) return pb - pa;
    return a.label.localeCompare(b.label, "ko");
  });

  for (const b of sorted) {
    if (chips.length >= 2) break;
    const label = b.label.trim();
    if (!label) continue;
    const low = label.toLowerCase();
    if (status === "SOLD_OUT" && (low.includes("마감") || low.includes("sold"))) continue;
    if (status === "LIMITED" && low.includes("마감임박")) continue;
    const variant = badgeTypeToTagVariant(b.type);
    const key = `${variant}-${label}`;
    if (chips.some((c) => `${c.variant}-${c.label}` === key)) continue;
    chips.push({ label, variant });
  }

  return chips.slice(0, 2);
}

/** 이미지 오버레이용: 캠페인 대표 배지(badges) → DisplayChip, 최대 2개 */
export function campaignBadgesToDisplayChips(badges: ProductCardBadge[]): DisplayChip[] {
  const sorted = [...badges].filter((b) => b.isActive !== false).sort((a, b) => {
    const pa = a.priority ?? 0;
    const pb = b.priority ?? 0;
    if (pb !== pa) return pb - pa;
    return a.label.localeCompare(b.label, "ko");
  });
  const out: DisplayChip[] = [];
  for (const b of sorted) {
    if (out.length >= 2) break;
    const label = b.label.trim();
    if (!label) continue;
    out.push({ label, variant: badgeTypeToTagVariant(b.type) });
  }
  return out;
}

/**
 * @deprecated `pickInfoDisplayChips` 사용 — 인자는 정보성 배지(`infoBadges`)만 넘기세요.
 */
export function pickDisplayChips(
  status: ProductCardStatus | undefined,
  activeBadges: ProductCardBadge[],
): DisplayChip[] {
  return pickInfoDisplayChips(status, activeBadges);
}
