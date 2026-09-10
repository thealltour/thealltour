import { describe, expect, it } from "vitest";

import { isStaleFreshness } from "@/lib/marketing/research/services/freshnessScorer";
import { createInMemoryResearchRepository } from "@/lib/marketing/research/repository/inMemoryResearchRepository";
import { getMarketingManagerResearchContext } from "@/lib/marketing/research/manager/getMarketingManagerResearchContext";
import {
  adaptTrendSignalToResearch,
  persistAdaptedTrend,
  resolveMetaTrendExpiresAt,
  META_TREND_FRESHNESS_TTL_HOURS,
} from "../adapter/trendSourceAdapter";
import { buildTrendEditorialPlans } from "../editorial/trendEditorialPlanning";
import { FIXTURE_BUSAN_FAMILY_CRUISE } from "../fixtures/positiveFixtures";
import type { TrendSignalPayloadV1 } from "../types";

function overnightPayload(observationId: string): TrendSignalPayloadV1 {
  // window.end intentionally equals observedAt (the production failure shape).
  return {
    ...FIXTURE_BUSAN_FAMILY_CRUISE,
    observation_id: observationId,
    provider_run_at: "2026-09-09T17:00:00+09:00",
    observed_at: "2026-09-09T17:00:00+09:00",
    captured_at: "2026-09-09T16:50:00+09:00",
    window: {
      start: "2026-09-06T17:00:00+09:00",
      end: "2026-09-09T17:00:00+09:00",
    },
    topic: `TTL freshness cruise fixture ${observationId}`,
  } as TrendSignalPayloadV1;
}

describe("Meta trend freshness TTL", () => {
  it("sets expiresAt = observedAt + 72h, not window.end", () => {
    const adapted = adaptTrendSignalToResearch(overnightPayload("obs_ttl_map_001"));
    expect(adapted.signal.observedAt).toBe("2026-09-09T08:00:00.000Z");
    expect(adapted.layers.discovery.window.end).toBe("2026-09-09T08:00:00.000Z");
    expect(adapted.signal.expiresAt).toBe("2026-09-12T08:00:00.000Z");
    expect(adapted.brief.freshness.expiresAt).toBe("2026-09-12T08:00:00.000Z");
    expect(adapted.brief.validUntil).toBe("2026-09-12T08:00:00.000Z");
    expect(adapted.signal.expiresAt).not.toBe(adapted.layers.discovery.window.end);
    expect(META_TREND_FRESHNESS_TTL_HOURS).toBe(72);
    expect(resolveMetaTrendExpiresAt("2026-09-09T08:00:00.000Z")).toBe(
      "2026-09-12T08:00:00.000Z",
    );
  });

  it("is NOT stale at next-day 09:00 KST MM run", () => {
    const adapted = adaptTrendSignalToResearch(overnightPayload("obs_ttl_nextday_001"));
    const mmRun = new Date("2026-09-10T00:00:00.000Z"); // 09:00 KST
    expect(isStaleFreshness(adapted.brief.freshness, 0.15, mmRun)).toBe(false);
  });

  it("is NOT stale at observedAt + 71h", () => {
    const adapted = adaptTrendSignalToResearch(overnightPayload("obs_ttl_71h_001"));
    const at71h = new Date(Date.parse(adapted.signal.observedAt) + 71 * 60 * 60 * 1000);
    expect(isStaleFreshness(adapted.brief.freshness, 0.15, at71h)).toBe(false);
  });

  it("is stale at observedAt + 73h", () => {
    const adapted = adaptTrendSignalToResearch(overnightPayload("obs_ttl_73h_001"));
    const at73h = new Date(Date.parse(adapted.signal.observedAt) + 73 * 60 * 60 * 1000);
    expect(isStaleFreshness(adapted.brief.freshness, 0.15, at73h)).toBe(true);
  });

  it("enters MM pool next day and yields live appliedCount > 0", async () => {
    const payload = overnightPayload("obs_ttl_mm_pool_001");
    const adapted = adaptTrendSignalToResearch(payload, new Date("2026-09-09T08:05:00.000Z"));
    const research = createInMemoryResearchRepository();
    await persistAdaptedTrend(adapted, research);

    const mmRun = new Date("2026-09-10T00:00:00.000Z");
    const ctx = await getMarketingManagerResearchContext(
      {},
      {
        now: mmRun,
        repo: research,
        checkSemanticInfrastructure: async () => false,
      },
    );

    expect(ctx.agendaCandidates.some((c) => c.researchBriefId === adapted.brief.id)).toBe(
      true,
    );
    expect(isStaleFreshness(adapted.brief.freshness, 0.15, mmRun)).toBe(false);

    const briefs = [];
    for (const c of ctx.agendaCandidates.slice(0, 28)) {
      const brief = await research.findBriefById(c.researchBriefId);
      if (brief?.editorialIntelligence || brief?.trendContext) briefs.push(brief);
    }
    const plan = buildTrendEditorialPlans({
      briefs,
      mode: "live",
      availableTrendCount: 1,
      adaptedTrendCount: 1,
    });
    expect(plan.diagnostics.mode).toBe("live");
    expect(plan.diagnostics.editorialSignalCount).toBeGreaterThan(0);
    expect(plan.diagnostics.appliedCount).toBeGreaterThan(0);
    expect(plan.plansByBriefId.has(adapted.brief.id)).toBe(true);
  });
});
