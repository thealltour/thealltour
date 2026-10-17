/**
 * Planner activity discovery — provider-neutral, client-safe contract.
 * Descriptors carry identifiers only: no secrets, affiliate/target URLs, markers, script URLs or HTML.
 * Widget script URLs are assembled by the UI layer from these descriptors.
 */

export type ActivityDiscoveryMatchConfidence = "exact" | "high";

/** One traveler mustDo entry, optionally linked to a generated plan item. */
export type PlannerActivityIntent = {
  /** Index in draft.mustDo (input order). */
  requestIndex: number;
  rawLabel: string;
  normalizedLabel: string;
  dayNumber: number | null;
  itemOrder: number | null;
  planItemName: string | null;
};

export type TiqetsProductWidgetItem = {
  providerId: "tiqets";
  productId: string;
  title: string;
  matchConfidence: ActivityDiscoveryMatchConfidence;
  dayNumber: number | null;
  itemOrder: number | null;
};

export type TiqetsProductWidgetDescriptor = {
  providerId: "tiqets";
  kind: "product_widget";
  products: TiqetsProductWidgetItem[];
};

export type KlookCityWidgetDescriptor = {
  providerId: "klook";
  kind: "city_widget";
  cityId: string;
  cityLabel: string;
  categoryId: string | null;
};

export type PlannerActivityDiscoveryDto = {
  tiqets: TiqetsProductWidgetDescriptor | null;
  klook: KlookCityWidgetDescriptor | null;
};
