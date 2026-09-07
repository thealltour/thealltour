import type { AffiliateProviderDefinition } from "@/lib/affiliate/planner/types";

/**
 * Static provider catalog foundation.
 * Airalo/WeGoTrip adapters exist (PR-9C) but stay enabled:false until live
 * feed/API + Partner Links verification. Do not invent capabilities.
 */
export const PLANNER_AFFILIATE_PROVIDER_CATALOG: AffiliateProviderDefinition[] = [
  {
    id: "travelpayouts_white_label",
    displayName: "Travelpayouts",
    categories: ["flight", "hotel"],
    enabled: false,
    supportedDateModes: ["fixed"],
    supportedPlacements: ["planner_summary"],
    priority: 80,
    network: "travelpayouts",
    capabilities: { deepLink: false, search: false, api: false, widget: false },
  },
  {
    id: "aviasales",
    displayName: "Aviasales",
    categories: ["flight"],
    // PR-9E: enabled after full live Data API → Partner Links acceptance (서울→SEL, 오사카→OSA).
    enabled: true,
    supportedDateModes: ["fixed"],
    supportedPlacements: ["planner_summary"],
    priority: 70,
    network: "travelpayouts",
    // Data API + aviasales.com search URL → Partner Links (docs-confirmed).
    capabilities: { deepLink: true, search: false, api: true, widget: false },
  },
  {
    id: "klook",
    displayName: "Klook",
    categories: ["activity", "transfer"],
    enabled: false,
    supportedDateModes: ["fixed", "flexible"],
    supportedPlacements: ["day_item", "transport", "planner_summary"],
    priority: 60,
    network: "travelpayouts",
    capabilities: { deepLink: false, search: false, api: false, widget: false },
  },
  {
    id: "kkday",
    displayName: "KKday",
    categories: ["activity"],
    enabled: false,
    supportedDateModes: ["fixed", "flexible"],
    supportedPlacements: ["day_item"],
    priority: 55,
    network: "travelpayouts",
    capabilities: { deepLink: false, search: false, api: false, widget: false },
  },
  {
    id: "tiqets",
    displayName: "Tiqets",
    categories: ["activity"],
    enabled: false,
    supportedDateModes: ["fixed", "flexible"],
    supportedPlacements: ["day_item"],
    priority: 50,
    network: "travelpayouts",
    capabilities: { deepLink: false, search: false, api: false, widget: false },
  },
  {
    id: "yesim",
    displayName: "Yesim",
    categories: ["esim"],
    enabled: false,
    supportedDateModes: ["fixed", "flexible"],
    supportedPlacements: ["preparation"],
    priority: 65,
    network: "travelpayouts",
    capabilities: { deepLink: false, search: false, api: false, widget: false },
  },
  {
    id: "airalo",
    displayName: "Airalo",
    categories: ["esim"],
    enabled: false,
    supportedDateModes: ["fixed", "flexible"],
    supportedPlacements: ["preparation"],
    priority: 60,
    network: "travelpayouts",
    // Feed-based deep links — not a REST API.
    capabilities: { deepLink: true, search: false, api: false, widget: false },
  },
  {
    id: "wegotrip",
    displayName: "WeGoTrip",
    categories: ["activity"],
    enabled: false,
    supportedDateModes: ["fixed", "flexible"],
    // day_item only — summary loop is flight/hotel; no planner_summary for MVP.
    supportedPlacements: ["day_item"],
    priority: 58,
    network: "travelpayouts",
    capabilities: { deepLink: true, search: true, api: true, widget: false },
  },
  {
    id: "kiwitaxi",
    displayName: "Kiwitaxi",
    categories: ["transfer"],
    enabled: false,
    supportedDateModes: ["fixed"],
    supportedPlacements: ["transport"],
    priority: 45,
    network: "travelpayouts",
    capabilities: { deepLink: false, search: false, api: false, widget: false },
  },
  {
    id: "toss_shopping",
    displayName: "Toss Shopping",
    categories: ["travel_goods"],
    enabled: false,
    supportedDateModes: ["fixed", "flexible"],
    supportedPlacements: ["preparation"],
    priority: 40,
    capabilities: { deepLink: false, search: false, api: false, widget: false },
  },
  {
    id: "coupang",
    displayName: "Coupang",
    categories: ["travel_goods"],
    enabled: false,
    supportedDateModes: ["fixed", "flexible"],
    supportedPlacements: ["preparation"],
    priority: 35,
    capabilities: { deepLink: false, search: false, api: false, widget: false },
  },
];

/** Optional destination overrides — structure only; empty until real providers. */
export type AffiliateDestinationOverride = {
  category: AffiliateProviderDefinition["categories"][number];
  /** ISO country code or normalized destination key. */
  destinationKey: string;
  providerId: AffiliateProviderDefinition["id"];
  priority: number;
};

export const PLANNER_AFFILIATE_DESTINATION_OVERRIDES: AffiliateDestinationOverride[] = [];
