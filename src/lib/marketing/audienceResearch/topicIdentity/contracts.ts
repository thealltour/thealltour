/**
 * MQ-1 — Agenda Topic Identity contract.
 * Durable semantic identity of the selected agenda for RA-1 → CS guards.
 */

export const AGENDA_TOPIC_IDENTITY_CONTRACT = "agenda-topic-identity-v1" as const;

export const TRAVEL_PRODUCT_TYPES = [
  "package",
  "cruise",
  "flight",
  "hotel",
  "free_independent_travel",
  "attraction",
  "transportation",
  "destination_general",
  "promotion_general",
  "unknown",
] as const;
export type TravelProductType = (typeof TRAVEL_PRODUCT_TYPES)[number];

export const TRAVEL_MODES = ["air", "cruise", "land", "mixed", "unknown"] as const;
export type TravelMode = (typeof TRAVEL_MODES)[number];

export const IDENTITY_CONFLICT_DIMENSIONS = [
  "destination",
  "product_type",
  "travel_mode",
  "entity",
  "origin",
] as const;
export type IdentityConflictDimension = (typeof IDENTITY_CONFLICT_DIMENSIONS)[number];

export type AgendaTopicIdentity = {
  contract: typeof AGENDA_TOPIC_IDENTITY_CONTRACT;
  destinationEntities: string[];
  originEntities: string[];
  productTypes: TravelProductType[];
  travelModes: TravelMode[];
  topicEntities: string[];
  commercialSubject: string | null;
  campaignSeasonality: string[];
  sourceKeywords: string[];
  /** 0–1 confidence in the derived identity overall. */
  confidence: number;
  derivationSources: string[];
};

export type IdentityValidationIssue = {
  dimension: IdentityConflictDimension;
  rejectedText: string;
  reason: string;
};

export type IdentityValidationResult = {
  ok: boolean;
  issues: IdentityValidationIssue[];
};

export type IdentityConflictDiagnostic = {
  stage: string;
  agendaId: string | null;
  candidateId?: string | null;
  conflictDimension: IdentityConflictDimension;
  rejectedText: string;
  identitySummary: string;
};

export function summarizeTopicIdentity(identity: AgendaTopicIdentity): string {
  const parts = [
    identity.originEntities.length ? `origin=${identity.originEntities.join(",")}` : null,
    identity.destinationEntities.length
      ? `dest=${identity.destinationEntities.join(",")}`
      : null,
    identity.productTypes.length ? `product=${identity.productTypes.join(",")}` : null,
    identity.travelModes.length ? `mode=${identity.travelModes.join(",")}` : null,
    identity.campaignSeasonality.length
      ? `season=${identity.campaignSeasonality.join(",")}`
      : null,
  ].filter(Boolean);
  return parts.join("|") || "identity=empty";
}

export function identityIncludesProduct(
  identity: AgendaTopicIdentity,
  product: TravelProductType,
): boolean {
  return identity.productTypes.includes(product);
}

export function identityIsCruise(identity: AgendaTopicIdentity): boolean {
  return (
    identityIncludesProduct(identity, "cruise") || identity.travelModes.includes("cruise")
  );
}

export function identityIsPackage(identity: AgendaTopicIdentity): boolean {
  return identityIncludesProduct(identity, "package");
}
