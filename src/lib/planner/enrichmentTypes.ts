export type PlaceResolutionStatus = "resolved" | "ambiguous" | "unresolved";

/** Client-safe resolved place (no scoring internals). */
export type PlannerResolvedPlace = {
  status: PlaceResolutionStatus;
  originalName: string;
  placeId: string | null;
  displayName: string | null;
  formattedAddress: string | null;
  location: { lat: number; lng: number } | null;
  types: string[];
  googleMapsUri: string | null;
};

export type PlannerPlaceEnrichmentItem = {
  dayNumber: number;
  itemOrder: number;
  place: PlannerResolvedPlace;
};

export type PlannerWeatherAvailability = "forecast" | "too_early" | "unavailable";

export type PlannerWeatherDay = {
  date: string;
  condition: string;
  minC: number | null;
  maxC: number | null;
  precipitationChance: number | null;
};

export type PlannerWeatherSummary = {
  availability: PlannerWeatherAvailability;
  days: PlannerWeatherDay[];
};

/** Client enrichment DTO — never includes API keys or raw provider payloads. */
export type PlannerEnrichmentDto = {
  planFingerprint: string;
  places: PlannerPlaceEnrichmentItem[];
  weather: PlannerWeatherSummary;
  partialFailure: boolean;
  message: string | null;
};
