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

function badgeTypeToTagVariant(type: string): "accent" | "muted" | "gold" {
  const t = type?.toLowerCase() ?? "";
  if (t === "accent" || t === "primary" || t === "인기" || t === "추천") return "accent";
  if (t === "gold" || t === "제철" || t === "마감임박") return "gold";
  return "muted";
}

/**
 * CTR용 카드 상단 배지 최대 2개.
 * 1) 마감 / 마감임박(LIMITED)  2) 인기·추천  3) 프로모션·기타
 */
export function pickDisplayChips(
  status: ProductCardStatus | undefined,
  activeBadges: ProductCardBadge[],
): DisplayChip[] {
  const chips: DisplayChip[] = [];

  if (status === "SOLD_OUT") {
    chips.push({ label: "마감", variant: "muted" });
  } else if (status === "LIMITED") {
    chips.push({ label: "마감임박", variant: "gold" });
  } else if (status === "CONSULT_REQUIRED") {
    chips.push({ label: "상담 후 안내", variant: "muted" });
  }

  const rank = (b: ProductCardBadge): number => {
    const L = b.label.toLowerCase();
    if (L.includes("인기")) return 1;
    if (L.includes("추천")) return 2;
    if (L.includes("프로모션") || L.includes("혜택")) return 3;
    return 10;
  };

  const sorted = [...activeBadges].filter((b) => b.isActive !== false).sort((a, b) => rank(a) - rank(b));

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
