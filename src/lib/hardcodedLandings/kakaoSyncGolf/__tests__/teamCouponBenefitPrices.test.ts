import { describe, expect, it } from "vitest";
import { buildTeamCouponBenefitPrices } from "@/lib/hardcodedLandings/kakaoSyncGolf/teamCouponBenefitPrices";

describe("buildTeamCouponBenefitPrices", () => {
  it("builds 4-person list and coupon-applied totals from per-person list price", () => {
    const r = buildTeamCouponBenefitPrices(1_399_000);
    expect(r.pax).toBe(4);
    expect(r.listTeamWon).toBe(5_596_000);
    expect(r.discountWon).toBe(200_000);
    expect(r.memberTeamWon).toBe(5_396_000);
  });

  it("never returns negative member team price", () => {
    const r = buildTeamCouponBenefitPrices(10_000);
    expect(r.memberTeamWon).toBe(0);
  });
});
