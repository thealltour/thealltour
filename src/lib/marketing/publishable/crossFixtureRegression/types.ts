/**
 * Cross-fixture regression harness — types only.
 * Does not change production generation behavior.
 */

export type CrossFixtureRole =
  | "discovery_contrast"
  | "decision_comparison"
  | "practical_informational"
  | "commercial_conversion"
  | "supported_region_geo"
  | "strong_dramatic_hook";

export type CrossFixtureChannel =
  | "narrative"
  | "threads"
  | "instagramCarousel"
  | "instagramCardCopy"
  | "instagramCaption"
  | "blogStructure"
  | "blogCopy"
  | "band"
  | "kakao"
  | "shortform";

export type CrossFixtureVerdict =
  | "PASS"
  | "PASS_WITH_MINOR"
  | "FAIL"
  | "UNTESTED"
  | "BLOCKED";

export type FixtureBacking = "production_backed" | "synthetic_unit_only" | "unpopulated_slot";

/** Behavior expectations — not banned-word lists. */
export type FixtureBehaviorExpectations = {
  preservesSupportedDecisionCriteria?: boolean;
  doesNotInventReaderTransformation?: boolean;
  informationalCtaOptional?: boolean;
  commercialCtaSurvivesWhenSupported?: boolean;
  geographicScopePreserved?: boolean;
  evidenceLimitationsSurviveCompression?: boolean;
  strongSupportedHookPossible?: boolean;
  naturalKoreanNotTranslationese?: boolean;
  plannerLanguageDoesNotLeakToSurface?: boolean;
  decisionTopicNotMistakenForCta?: boolean;
  unauthorizedImperativeCtaStillBlocked?: boolean;
};

export type FixtureProhibitedRegressions = {
  forcedDecisionCriterionOnDiscovery?: boolean;
  forcedPerspectiveAwarenessLesson?: boolean;
  unsupportedOnSiteExperience?: boolean;
  unsupportedGeographicRegrouping?: boolean;
  decisionUtilitySuppressedAsCta?: boolean;
  conversionSuppressedWhenSupported?: boolean;
  flatUnsupportedHookWhenDramaticCanonical?: boolean;
};

export type ProductionBackedFixture = {
  fixtureId: string;
  backing: "production_backed";
  packageRoot: string;
  assetId: string;
  titleKo: string;
  canonicalStatusRequired: "approved";
  editorialArchetype: string | null;
  commercialIntent: string;
  role: CrossFixtureRole;
  supportedFacts: string[];
  limitations: string[];
  expectedBehaviors: FixtureBehaviorExpectations;
  prohibitedRegressions: FixtureProhibitedRegressions;
  channelsToTest: CrossFixtureChannel[];
  /** Manual baseline reference from verified runs — not exact prose goldens. */
  baselineNotes: Partial<Record<CrossFixtureChannel, CrossFixtureVerdict>>;
  diagnosticMarkers?: string[];
};

export type UnpopulatedFixtureSlot = {
  fixtureId: string;
  backing: "unpopulated_slot";
  role: CrossFixtureRole;
  reason: string;
  requiredForCoverage: string[];
};

export type CrossFixtureManifestEntry = ProductionBackedFixture | UnpopulatedFixtureSlot;

export type ChannelAutomatedCheck = {
  channel: CrossFixtureChannel;
  freshness: CrossFixtureVerdict;
  materialize: CrossFixtureVerdict;
  style: CrossFixtureVerdict;
  archetypeFit: CrossFixtureVerdict;
  evidence: CrossFixtureVerdict;
  overall: CrossFixtureVerdict;
  generatedAt: string | null;
  modelProfile: string | null;
  publishableSuccess: boolean | null;
  artifactPath: string | null;
  notes: string[];
  blockers: string[];
};

export type FixtureVerifyResult = {
  fixtureId: string;
  eligible: boolean;
  eligibilityBlockers: string[];
  channels: ChannelAutomatedCheck[];
  overall: CrossFixtureVerdict;
};

export type CrossFixtureRunReport = {
  contract: "cross-fixture-regression-report-v1";
  generatedAt: string;
  mode: "inventory" | "verify" | "report" | "regenerate" | "regenerate-all";
  inventoryNotes: string[];
  fixtures: FixtureVerifyResult[];
  markdown: string;
};
