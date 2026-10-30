import type { LucideIcon } from "lucide-react";
import {
  Car,
  CarFront,
  Hotel,
  Plane,
  ShieldCheck,
  ShoppingBag,
  Ticket,
  Wifi,
} from "lucide-react";
import { PLANNER_AFFILIATE_PROVIDER_CATALOG } from "@/lib/affiliate/planner/providerConfig";
import { sanitizeAffiliateEsimMetadata } from "@/lib/affiliate/planner/offerMetadata";
import type {
  AffiliateCategory,
  AffiliateOfferEsimMetadata,
  AffiliateProviderId,
} from "@/lib/affiliate/planner/types";

const PROVIDER_DISPLAY_NAME = new Map<string, string>(
  PLANNER_AFFILIATE_PROVIDER_CATALOG.map((def) => [def.id, def.displayName]),
);

/** Hub-scoped React-cyan action palette (not a global brand token). */
export const PREPARATION_HUB_VISUAL = {
  primary: "#087EA4",
  primaryHover: "#076B8C",
  primaryActive: "#065A75",
  softBg: "#EAF9FD",
  softBorder: "#CBEFF7",
  accentGlow: "#61DAFB",
} as const;

export const preparationHubCtaClassName =
  "inline-flex min-h-11 items-center justify-center gap-1.5 rounded-[10px] px-4 " +
  "type-btn font-semibold text-white " +
  "bg-[#087EA4] hover:bg-[#076B8C] active:bg-[#065A75] " +
  "shadow-[0_1px_2px_rgba(8,126,164,0.25)] hover:shadow-[0_4px_12px_rgba(8,126,164,0.28)] " +
  "motion-safe:transition-all motion-safe:duration-150 " +
  "focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-[#087EA4]/40 " +
  "active:scale-[0.99] " +
  "[&_svg]:h-4 [&_svg]:w-4 [&_svg]:shrink-0 " +
  "motion-safe:[&_svg]:transition-transform motion-safe:[&_svg]:duration-150 " +
  "hover:[&_svg]:translate-x-0.5";

export const preparationHubCardShellClassName =
  "rounded-xl border border-[var(--border)] bg-[var(--surface)] " +
  "motion-safe:transition-all motion-safe:duration-150 " +
  "hover:border-[#CBEFF7] hover:shadow-[0_6px_16px_rgba(8,126,164,0.08)] " +
  "motion-safe:hover:-translate-y-px active:scale-[0.99]";

export const preparationHubIconClassName =
  "inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-lg " +
  "bg-[#EAF9FD] text-[#087EA4] [&_svg]:h-4 [&_svg]:w-4";

export const preparationHubAccentBarClassName = "h-1 w-8 rounded-full bg-[#61DAFB]";

/** Purpose-first CTA for Hub presentation (DTO ctaLabel stays unchanged for adapters). */
export function preparationHubCtaLabel(category: AffiliateCategory): string {
  switch (category) {
    case "flight":
      return "항공권 보기";
    case "hotel":
      return "숙소 보기";
    case "activity":
      return "티켓 · 액티비티 보기";
    case "esim":
      return "eSIM 보기";
    case "rental_car":
      return "렌터카 보기";
    case "transfer":
      return "공항 이동 보기";
    case "insurance":
      return "여행자보험 보기";
    case "travel_goods":
      return "여행 준비물 보기";
    default:
      return "자세히 보기";
  }
}

export function preparationHubProviderLabel(providerId: string | null | undefined): string | null {
  if (!providerId) return null;
  return PROVIDER_DISPLAY_NAME.get(providerId) ?? null;
}

export function preparationHubCategoryLabel(category: AffiliateCategory): string {
  switch (category) {
    case "flight":
      return "항공권";
    case "hotel":
      return "숙소";
    case "activity":
      return "티켓·액티비티";
    case "esim":
      return "eSIM";
    case "rental_car":
      return "렌터카";
    case "transfer":
      return "공항 이동";
    case "insurance":
      return "여행자보험";
    case "travel_goods":
      return "준비물";
    default:
      return "준비";
  }
}

export function preparationHubCategoryIcon(category: AffiliateCategory): LucideIcon {
  switch (category) {
    case "flight":
      return Plane;
    case "hotel":
      return Hotel;
    case "activity":
      return Ticket;
    case "esim":
      return Wifi;
    case "rental_car":
      return Car;
    case "transfer":
      return CarFront;
    case "insurance":
      return ShieldCheck;
    case "travel_goods":
      return ShoppingBag;
    default:
      return Ticket;
  }
}

export function preparationHubBookingBlurb(
  category: "flight" | "hotel",
  destinationName: string,
): string {
  const dest = destinationName.trim();
  if (category === "flight") return "일정에 맞는 항공권을 확인하세요.";
  return dest ? `${dest}에서 머물 숙소를 찾아보세요.` : "일정에 맞는 숙소를 찾아보세요.";
}

export function preparationHubActivityBlurb(destinationName: string): string {
  const dest = destinationName.trim();
  return dest
    ? `${dest}에서 즐길 티켓과 체험을 확인해 보세요.`
    : "일정에 맞는 입장권과 체험을 확인해 보세요.";
}

/** Shorter card-level hint — avoids repeating the section description verbatim. */
export function preparationHubActivityCardHint(destinationName: string): string {
  const dest = destinationName.trim();
  return dest ? `${dest} 입장권 · 체험을 바로 살펴보세요.` : "입장권 · 체험을 바로 살펴보세요.";
}

export function preparationHubEsimBadges(
  raw: AffiliateOfferEsimMetadata | null | undefined,
): string[] {
  const esim = sanitizeAffiliateEsimMetadata(raw);
  if (!esim) return [];
  const badges: string[] = [];
  if (esim.dataLabel) badges.push(esim.dataLabel === "Unlimited" ? "무제한" : esim.dataLabel);
  if (esim.validityDays != null) badges.push(`${esim.validityDays}일`);
  return badges.slice(0, 2);
}

export function isKnownAffiliateProviderId(id: string): id is AffiliateProviderId {
  return PROVIDER_DISPLAY_NAME.has(id);
}
