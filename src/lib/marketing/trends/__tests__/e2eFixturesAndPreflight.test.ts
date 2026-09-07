import { describe, expect, it } from "vitest";
import { createInMemoryResearchRepository } from "@/lib/marketing/research/repository/inMemoryResearchRepository";
import { createInMemoryTravelTrendsStagingRepository } from "../staging/inMemoryTravelTrendsStagingRepository";
import { runTrendAgendaPreflight } from "../preflight/runTrendAgendaPreflight";
import {
  FIXTURE_BUSAN_FAMILY_CRUISE,
  FIXTURE_PARENTS_FIRST_TAIWAN,
  FIXTURE_VIETNAM_FAMILY_GROUP,
} from "../fixtures/positiveFixtures";
import { NEGATIVE_TREND_FIXTURES } from "../fixtures/negativeFixtures";
import { validateTrendSignalPayloadV1 } from "../validateTrendSignalV1";
import { normalizeTrendHumanPaste } from "../normalizeHumanPaste";

describe("T-8 E2E fixtures + preflight safety", () => {
  it("positive Meta fixtures validate", () => {
    for (const f of [
      FIXTURE_BUSAN_FAMILY_CRUISE,
      FIXTURE_PARENTS_FIRST_TAIWAN,
      FIXTURE_VIETNAM_FAMILY_GROUP,
    ]) {
      expect(validateTrendSignalPayloadV1(f).ok).toBe(true);
    }
  });

  it("negative fixtures reject", () => {
    for (const n of NEGATIVE_TREND_FIXTURES) {
      const result = validateTrendSignalPayloadV1(n.build());
      expect(result.ok, n.id).toBe(false);
    }
  });

  it("preflight with zero NEW trends still succeeds", async () => {
    const result = await runTrendAgendaPreflight({
      stagingRepo: createInMemoryTravelTrendsStagingRepository(),
      researchRepo: createInMemoryResearchRepository(),
      skipSemanticEnsure: true,
    });
    expect(result.trendAdaptation.availableTrendCount).toBe(0);
    expect(result.trendAdaptation.adaptedTrendCount).toBe(0);
    expect(result.semanticCoverage.coverageRatio).toBe(1);
  });

  it("preflight adapts staged trends without throwing on empty semantic", async () => {
    const staging = createInMemoryTravelTrendsStagingRepository();
    staging.seed(FIXTURE_BUSAN_FAMILY_CRUISE);
    staging.seed(FIXTURE_PARENTS_FIRST_TAIWAN);
    const result = await runTrendAgendaPreflight({
      stagingRepo: staging,
      researchRepo: createInMemoryResearchRepository(),
      skipSemanticEnsure: true,
    });
    expect(result.trendAdaptation.adaptedTrendCount).toBe(2);
    expect(result.editorial.hypotheticalAppliedCount).toBeGreaterThan(0);
    // default shadow — appliedCount stays 0
    expect(result.editorial.mode).toBe("shadow");
    expect(result.editorial.appliedCount).toBe(0);
  });

  it("identical markdown URL normalizes; mismatch rejects", () => {
    const ok = normalizeTrendHumanPaste('{"u":"[https://x.test/a](https://x.test/a)"}');
    expect(ok.ok).toBe(true);
    const bad = normalizeTrendHumanPaste('{"u":"[https://x.test/a](https://x.test/b)"}');
    expect(bad.ok).toBe(false);
  });
});
