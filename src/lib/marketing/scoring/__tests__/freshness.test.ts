import { describe, expect, it } from "vitest";
import { FRESHNESS_HALF_LIFE_DAYS } from "@/lib/marketing/scoring/constants";
import { freshnessHalfLifeDays, scoreFreshness, scoreFreshnessFromAge } from "@/lib/marketing/scoring/scoreFreshness";
import { NOW, candidate, contentItem } from "./fixtures";

const now = new Date(NOW);

describe("freshness scoring", () => {
  it("scores newer data higher than older data", () => {
    const recent = scoreFreshnessFromAge({
      occurredAt: "2026-08-23T00:00:00.000Z",
      sourceType: "publication",
      now,
    });
    const old = scoreFreshnessFromAge({
      occurredAt: "2026-01-01T00:00:00.000Z",
      sourceType: "publication",
      now,
    });
    expect(recent).toBeGreaterThan(old);
    expect(recent).toBeGreaterThan(0.9);
  });

  it("decays performance faster than product information", () => {
    const occurredAt = "2026-07-24T00:00:00.000Z";
    const productScore = scoreFreshnessFromAge({ occurredAt, sourceType: "product", now });
    const performanceScore = scoreFreshnessFromAge({ occurredAt, sourceType: "performance", now });
    expect(FRESHNESS_HALF_LIFE_DAYS.performance).toBeLessThan(FRESHNESS_HALF_LIFE_DAYS.product);
    expect(performanceScore).toBeLessThan(productScore);
  });

  it("barely decays evergreen brand memory", () => {
    expect(freshnessHalfLifeDays("memory", "brand_knowledge")).toBeGreaterThan(freshnessHalfLifeDays("memory"));
    const evergreen = scoreFreshnessFromAge({
      occurredAt: "2024-08-24T00:00:00.000Z",
      sourceType: "memory",
      memoryType: "brand_knowledge",
      now,
    });
    const insight = scoreFreshnessFromAge({
      occurredAt: "2024-08-24T00:00:00.000Z",
      sourceType: "memory",
      memoryType: "customer_insight",
      now,
    });
    expect(evergreen).toBeGreaterThan(insight);
    expect(evergreen).toBeGreaterThan(0.7);
  });

  it("uses today as 1.0 for a just-published item", () => {
    expect(scoreFreshness(candidate("contentHistory", contentItem({ publishedAt: NOW })), now)).toBe(1);
  });
});
