import { compactActivityName } from "@/lib/affiliate/planner/discovery/normalizeActivityName";

/**
 * Verified Tiqets product seed, consulted before the runtime suggest lookup.
 * Not a global catalog: add only product IDs and aliases verified by hand.
 */
export type TiqetsVerifiedProduct = {
  productId: string;
  title: string;
  countryCode: string;
  cityEnglish: string;
  aliases: string[];
};

export const TIQETS_VERIFIED_PRODUCTS: readonly TiqetsVerifiedProduct[] = [
  {
    productId: "1102887",
    title: "Universal Studios Japan: 1, 1.5, or 2-Day Pass",
    countryCode: "JP",
    cityEnglish: "Osaka",
    aliases: [
      "Universal Studios Japan",
      "USJ",
      "유니버설 스튜디오 재팬",
      "유니버설 스튜디오 재팬 USJ",
    ],
  },
  {
    productId: "1108257",
    title: "Osaka Castle Museum",
    countryCode: "JP",
    cityEnglish: "Osaka",
    aliases: ["Osaka Castle Museum", "Osaka Castle", "오사카성", "오사카성 천수각"],
  },
];

const ALIAS_INDEX = new Map<string, TiqetsVerifiedProduct>();
for (const product of TIQETS_VERIFIED_PRODUCTS) {
  for (const alias of product.aliases) ALIAS_INDEX.set(compactActivityName(alias), product);
}

/**
 * Exact alias lookup (spacing/punctuation-insensitive) over the given labels, in order.
 * Destination guard: unknown country never matches; a known country or city that differs never matches.
 */
export function lookupTiqetsVerifiedProduct(params: {
  labels: ReadonlyArray<string | null | undefined>;
  destination: { countryCode: string | null; cityEnglish: string | null };
}): TiqetsVerifiedProduct | null {
  const countryCode = params.destination.countryCode?.toUpperCase() ?? null;
  if (!countryCode) return null;
  for (const label of params.labels) {
    const key = compactActivityName(label ?? "");
    if (!key) continue;
    const product = ALIAS_INDEX.get(key);
    if (!product) continue;
    if (product.countryCode !== countryCode) continue;
    if (params.destination.cityEnglish && params.destination.cityEnglish !== product.cityEnglish) {
      continue;
    }
    return product;
  }
  return null;
}
