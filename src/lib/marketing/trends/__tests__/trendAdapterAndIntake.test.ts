import { describe, expect, it } from "vitest";
import { createInMemoryResearchRepository } from "@/lib/marketing/research/repository/inMemoryResearchRepository";
import { adaptTrendSignalToResearch, persistAdaptedTrend } from "../adapter/trendSourceAdapter";
import { FIXTURE_BUSAN_FAMILY_CRUISE } from "../fixtures/positiveFixtures";
import { resolveMarketingTrendEditorialMode } from "../editorial/trendEditorialModeConfig";
import {
  buildTrendEditorialPlanForBrief,
  decideRecommendedChannelFormat,
} from "../editorial/trendEditorialPlanning";
import { createInMemoryTravelTrendsStagingRepository } from "../staging/inMemoryTravelTrendsStagingRepository";
import { processNewTrendStagingObservations } from "../staging/processNewTrendStaging";
import { ingestTrendIntakePaste, previewTrendIntakePaste } from "../intake/trendIntakeService";

describe("TrendSourceAdapter layers", () => {
  it("separates discovery / editorial / factual / provenance and keeps claims unverified", async () => {
    const adapted = adaptTrendSignalToResearch(FIXTURE_BUSAN_FAMILY_CRUISE);
    expect(adapted.layers.discovery.trendType).toBe("activity_trend");
    expect(adapted.layers.editorial.hookSignals.length).toBeGreaterThan(0);
    expect(adapted.layers.factualClaimsUnverified.every((c) => !c.includes("verified"))).toBe(
      true,
    );
    expect(adapted.brief.claims.every((c) => c.includes("[unverified"))).toBe(true);
    expect(adapted.brief.marketRelevanceSignals?.providerMarketRelevanceScore).toBe(
      FIXTURE_BUSAN_FAMILY_CRUISE.market_relevance.score,
    );
    // Must not copy Meta score into koreanTravelerRelevance field name on brief.
    expect(JSON.stringify(adapted.brief)).not.toMatch(/koreanTravelerRelevance/);

    const repo = createInMemoryResearchRepository();
    const persisted = await persistAdaptedTrend(adapted, repo);
    expect(persisted.brief.editorialIntelligence?.contentAngles[0]).toContain("가족");
    const found = await repo.findBriefById(persisted.brief.id);
    expect(found?.trendContext?.observationId).toBe(
      FIXTURE_BUSAN_FAMILY_CRUISE.observation_id,
    );
  });
});

describe("trend editorial mode gate", () => {
  it("defaults unset/blank/invalid to shadow", () => {
    expect(resolveMarketingTrendEditorialMode({})).toBe("shadow");
    expect(resolveMarketingTrendEditorialMode({ MARKETING_TREND_EDITORIAL_MODE: "  " })).toBe(
      "shadow",
    );
    expect(resolveMarketingTrendEditorialMode({ MARKETING_TREND_EDITORIAL_MODE: "weird" })).toBe(
      "shadow",
    );
    expect(resolveMarketingTrendEditorialMode({ MARKETING_TREND_EDITORIAL_MODE: "live" })).toBe(
      "live",
    );
  });

  it("does not map vertical_tags directly to channel", () => {
    const decision = decideRecommendedChannelFormat({
      editorial: {
        hookSignals: [],
        formatSignals: [],
        audiencePainPoints: [],
        audienceQuestions: [],
        personaHints: [],
        contentAngles: [],
      },
      topics: ["activity_trend"],
      destinations: ["부산"],
      verticalTags: ["instagram_only_fake"],
    });
    expect(decision.rationale).toContain("vertical_tags_context_only_not_channel_map");
    expect(decision.channel).not.toBe("instagram_only_fake");
  });
});

describe("staging processor", () => {
  it("adapts new rows and marks ingested; item failure does not throw", async () => {
    const staging = createInMemoryTravelTrendsStagingRepository();
    staging.seed(FIXTURE_BUSAN_FAMILY_CRUISE);
    const research = createInMemoryResearchRepository();
    const diag = await processNewTrendStagingObservations({
      stagingRepo: staging,
      researchRepo: research,
    });
    expect(diag.adaptedTrendCount).toBe(1);
    expect(diag.researchBriefIds).toHaveLength(1);
    const remaining = await staging.getNewTrendObservations();
    expect(remaining).toHaveLength(0);
  });
});

describe("trend intake partial acceptance", () => {
  it("accepts valid items while rejecting invalid in same batch", async () => {
    const paste = JSON.stringify({
      provider: "meta_ai",
      items: [
        FIXTURE_BUSAN_FAMILY_CRUISE,
        {
          ...FIXTURE_BUSAN_FAMILY_CRUISE,
          observation_id: "bad_verified",
          factual_claims: [{ claim: "x", verification_status: "verified" }],
        },
      ],
    });
    const preview = previewTrendIntakePaste(paste);
    expect(preview.counts.valid).toBe(1);
    expect(preview.counts.rejected).toBe(1);

    const repo = createInMemoryTravelTrendsStagingRepository();
    const result = await ingestTrendIntakePaste(paste, repo);
    expect(result.counts.accepted).toBe(1);
    expect(result.counts.rejected).toBe(1);
  });
});

describe("editorial plan from adapted brief", () => {
  it("produces planning fields without using Meta scores as multipliers", () => {
    const adapted = adaptTrendSignalToResearch(FIXTURE_BUSAN_FAMILY_CRUISE);
    const plan = buildTrendEditorialPlanForBrief(adapted.brief);
    expect(plan?.recommendedChannel).toBeTruthy();
    expect(plan?.hookSignals.length).toBeGreaterThan(0);
    expect(plan?.editorialRationale).toBeTruthy();
  });
});
