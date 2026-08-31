import type { ProductTaxonomy } from "@/types/productTaxonomy";

const DOMESTIC_ROOT_NAME = "국내";
const OVERSEAS_ROOT_NAME = "해외";

/**
 * destination taxonomy가 「국내」 루트(또는 그 하위)인지 판별.
 * parent chain을 따라 올라가며 루트 이름을 확인 — slug 하드코딩 추측 없음.
 */
export function isDomesticDestinationTaxonomy(
  destination: ProductTaxonomy,
  allDestinations: ProductTaxonomy[],
): boolean {
  const byId = new Map(allDestinations.map((d) => [d.id, d]));
  let current: ProductTaxonomy | undefined = destination;
  const visited = new Set<string>();

  while (current) {
    const name = (current.name ?? "").trim();
    if (name === DOMESTIC_ROOT_NAME) return true;
    if (name === OVERSEAS_ROOT_NAME) return false;

    const currentId = current.id?.trim();
    if (currentId) visited.add(currentId);

    const parentId = current.parent_id?.trim();
    if (!parentId || visited.has(parentId)) break;
    current = byId.get(parentId);
  }

  return false;
}

/** slug + hub destinations로 region 랜딩 쿠팡 노출 여부 */
export function shouldShowCoupangBannerForRegionSlug(input: {
  slug: string;
  matchedDestination: ProductTaxonomy | null | undefined;
  hubDestinations: ProductTaxonomy[];
}): boolean {
  if (input.matchedDestination) {
    return isDomesticDestinationTaxonomy(input.matchedDestination, input.hubDestinations);
  }
  return false;
}
