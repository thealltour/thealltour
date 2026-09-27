export type * from "@/lib/marketing/publishable/crossFixtureRegression/types";
export {
  CROSS_FIXTURE_MANIFEST,
  DAO_FIXTURE,
  PHU_QUOC_DECISION_FIXTURE,
  FUTURE_FIXTURE_SLOTS,
  getFixtureById,
  listProductionBackedFixtures,
  listUnpopulatedSlots,
} from "@/lib/marketing/publishable/crossFixtureRegression/fixtureManifest";
export {
  assertProductionFixtureEligible,
  loadPackageCanonical,
  rejectDraftForProductionFixture,
} from "@/lib/marketing/publishable/crossFixtureRegression/eligibility";
export {
  verifyChannelArtifact,
  verifyProductionFixture,
  contentPassRequiresExactProse,
  preserveNonPassVerdict,
} from "@/lib/marketing/publishable/crossFixtureRegression/verify";
export {
  buildRegressionInventory,
  formatInventoryMarkdown,
} from "@/lib/marketing/publishable/crossFixtureRegression/inventory";
export {
  buildFixtureSummaryTable,
  buildChannelDetailTable,
  renderCrossFixtureMarkdownReport,
} from "@/lib/marketing/publishable/crossFixtureRegression/report";
export {
  runCrossFixtureHarness,
  describeManifestCoverage,
} from "@/lib/marketing/publishable/crossFixtureRegression/harness";
export type { HarnessMode, RunHarnessOptions } from "@/lib/marketing/publishable/crossFixtureRegression/harness";
