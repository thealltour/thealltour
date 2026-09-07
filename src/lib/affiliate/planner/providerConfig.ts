import type { AffiliateProviderDefinition } from "@/lib/affiliate/planner/types";

/**
 * Static provider catalog foundation.
 * All production entries are enabled:false until PR-9+ real integrations.
 * Do not invent capabilities as true without evidence.
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
    capabilities: { deepLink: false, search: false, api: false, widget: false },
  },
  {
    id: "aviasales",
    displayName: "Aviasales",
    categories: ["flight"],
    enabled: false,
    supportedDateModes: ["fixed"],
    supportedPlacements: ["planner_summary"],
    priority: 70,
    capabilities: { deepLink: false, search: false, api: false, widget: false },
  },
  {
    id: "klook",
    displayName: "Klook",
    categories: ["activity", "transfer"],
    enabled: false,
    supportedDateModes: ["fixed", "flexible"],
    supportedPlacements: ["day_item", "transport", "planner_summary"],
    priority: 60,
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
    capabilities: { deepLink: false, search: false, api: false, widget: false },
  },
  {
    id: "kiwitaxi",
    displayName: "Kiwitaxi",
    categories: ["transfer"],
    enabled: false,
    supportedDateModes: ["fixed"],
    supportedPlacements: ["transport"],
    priority: 45,
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
