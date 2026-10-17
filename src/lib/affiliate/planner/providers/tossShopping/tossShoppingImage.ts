import { TOSS_PRODUCT_IMAGE_HOST } from "@/lib/affiliate/planner/providers/tossShopping/tossShoppingTypes";

/** Accept only https://shopping.toss.im/... — never wildcard toss.im. */
export function sanitizeTossProductImageUrl(raw: string | null | undefined): string | null {
  if (!raw?.trim()) return null;
  try {
    const url = new URL(raw.trim());
    if (url.protocol !== "https:") return null;
    if (url.username || url.password) return null;
    if (url.hostname.toLowerCase() !== TOSS_PRODUCT_IMAGE_HOST) return null;
    return url.toString();
  } catch {
    return null;
  }
}
