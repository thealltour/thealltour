import { describe, expect, it } from "vitest";
import { scoreBusinessImportance } from "@/lib/marketing/scoring/scoreBusinessImportance";
import { CAMPAIGN_ID, NOW, candidate, createContentRequest, memory, product } from "./fixtures";

describe("business importance scoring", () => {
  it("scores an active product higher than an inactive one", () => {
    const active = scoreBusinessImportance(candidate("product", product({ isActive: true })), createContentRequest);
    const inactive = scoreBusinessImportance(
      candidate("product", product({ isActive: false, status: "SOLD_OUT" })),
      createContentRequest,
    );
    expect(active).toBeGreaterThan(inactive);
  });

  it("downranks expired memory", () => {
    const live = scoreBusinessImportance(candidate("memory", memory({ expiresAt: null })), createContentRequest);
    const expired = scoreBusinessImportance(
      candidate("memory", memory({ expiresAt: "2026-01-01T00:00:00.000Z" })),
      createContentRequest,
      new Date(NOW),
    );
    expect(live).toBeGreaterThan(expired);
  });

  it("boosts a product that belongs to the current campaign", () => {
    const inCampaign = scoreBusinessImportance(candidate("product", product()), createContentRequest);
    const other = scoreBusinessImportance(
      candidate("product", product({ campaigns: [] })),
      createContentRequest,
    );
    expect(inCampaign).toBeGreaterThan(other);
    expect(CAMPAIGN_ID).toBeTruthy();
  });
});
