/** Editorial / trend layers on ResearchBrief — separated from facts & evidence. */

export type ResearchBriefEditorialIntelligence = {
  hookSignals: string[];
  formatSignals: string[];
  audiencePainPoints: string[];
  audienceQuestions: string[];
  personaHints: string[];
  contentAngles: string[];
};

export type ResearchBriefTrendContext = {
  provider: "meta_ai";
  observationId: string;
  providerRunId: string;
  trendType: string;
  trendSignalStatus: string;
  window: { start: string; end: string };
  providerClusterHint?: string | null;
  clusterLabel?: string | null;
  verticalTags: string[];
  provenanceLevels: Array<"L1" | "L2" | "L3">;
};

/**
 * Provider market-relevance as an input feature only.
 * Must NOT be copied into koreanTravelerRelevance scoring fields.
 */
export type ResearchBriefMarketRelevanceSignals = {
  originMarket: "KR";
  travelDirection: "outbound";
  providerMarketRelevanceScore: number;
  observedBasis: string[];
  inferredBasis: string[];
};
