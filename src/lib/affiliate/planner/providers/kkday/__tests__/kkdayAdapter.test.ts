import { describe, expect, it, vi } from "vitest";
import { createKkdayAdapter } from "@/lib/affiliate/planner/providers/kkday/kkdayAdapter";
import {
  KKDAY_ACTIVITY_SOURCE_URLS,
  KKDAY_ALLOWED_HOSTS,
  kkdaySourceUrlFor,
} from "@/lib/affiliate/planner/providers/kkday/kkdaySourceUrl";
import type { AffiliateRoutingContext } from "@/lib/affiliate/planner/types";

const KKDAY_USJ = "https://www.kkday.com/en/product/2247-universal-studios-japan-ticket-osaka";

function ctx(overrides?: Partial<AffiliateRoutingContext>): AffiliateRoutingContext {
  return {
    plannerSessionId: "550e8400-e29b-41d4-a716-446655440000",
    destination: { text: "오사카", countryCode: "JP" },
    dates: { mode: "fixed", startDate: "2027-01-28", endDate: "2027-02-01", durationDays: 5 },
    travelers: { adults: 3, children: 0 },
    companionType: "friends",
    interests: [],
    pace: "balanced",
    placement: "day_item",
    category: "activity",
    dayNumber: 3,
    itemOrder: 2,
    itemType: "activity",
    placeName: "유니버설 스튜디오 재팬",
    sourceProductId: null,
    ...overrides,
  };
}

type CommerceInput = { sourceUrl: string; providerId: string; allowedHosts?: string[] };
type CommerceTarget = {
  affiliateUrl: string;
  providerSubId: string;
  affiliateNetwork: "travelpayouts";
  sourceUrlHost: string;
};

function commerceSpy() {
  return vi.fn<(input: CommerceInput) => Promise<CommerceTarget>>(async () => ({
    affiliateUrl: "https://tp.media/r?kkday=1",
    providerSubId: "tp_bbbbbbbbbbbbbbbbbbbbbbbb",
    affiliateNetwork: "travelpayouts",
    sourceUrlHost: "www.kkday.com",
  }));
}

describe("kkdaySourceUrl", () => {
  it("USJ → exact clean admission ticket product page (product 2247, no query)", () => {
    expect(kkdaySourceUrlFor("universal_studios_japan")).toBe(KKDAY_USJ);
    const url = new URL(KKDAY_USJ);
    expect(url.search).toBe("");
    expect(url.pathname).toBe("/en/product/2247-universal-studios-japan-ticket-osaka");
  });

  it("allowlist is the minimal kkday host set", () => {
    expect([...KKDAY_ALLOWED_HOSTS]).toEqual(["kkday.com", "www.kkday.com"]);
  });

  it("every catalog source is clean (no other-network cid/UD1/UD2/r params)", () => {
    for (const raw of Object.values(KKDAY_ACTIVITY_SOURCE_URLS)) {
      expect(raw).not.toMatch(/[?#]|cid=|UD1|UD2/);
    }
  });
});

describe("kkdayAdapter (PR-9AJ)", () => {
  it("USJ → offer via Commerce Core with the clean source URL", async () => {
    const createCommerceTarget = commerceSpy();
    const adapter = createKkdayAdapter({ createCommerceTarget });

    expect(adapter.isEligible(ctx())).toBe(true);
    const offer = await adapter.buildOffer(ctx());

    expect(createCommerceTarget).toHaveBeenCalledTimes(1);
    expect(createCommerceTarget.mock.calls[0]![0]).toEqual({
      sourceUrl: KKDAY_USJ,
      providerId: "kkday",
      allowedHosts: ["kkday.com", "www.kkday.com"],
    });
    expect(offer).toMatchObject({
      providerId: "kkday",
      category: "activity",
      placement: "day_item",
      title: "유니버설 스튜디오 재팬 입장권",
      ctaLabel: "이 장소의 투어·티켓 보기",
      destinationLabel: "오사카",
      targetUrl: "https://tp.media/r?kkday=1",
      dayNumber: 3,
      itemOrder: 2,
      affiliateNetwork: "travelpayouts",
      affiliateCampaignId: null,
      sourceUrlHost: "www.kkday.com",
    });
  });

  it.each([
    ["unknown place", ctx({ placeName: "우메다 스카이 빌딩" })],
    ["missing place name", ctx({ placeName: "  " })],
    ["other Universal park", ctx({ placeName: "Universal Studios Singapore" })],
    ["USJ alias outside Japan", ctx({ destination: { text: "LA", countryCode: "US" } })],
  ])("%s → ineligible, null, no Commerce call", async (_label, context) => {
    const createCommerceTarget = commerceSpy();
    const adapter = createKkdayAdapter({ createCommerceTarget });
    expect(adapter.isEligible(context)).toBe(false);
    expect(await adapter.buildOffer(context)).toBeNull();
    expect(createCommerceTarget).not.toHaveBeenCalled();
  });

  it("Commerce Core failure → null", async () => {
    const info = vi.spyOn(console, "info").mockImplementation(() => {});
    const adapter = createKkdayAdapter({
      createCommerceTarget: vi.fn(async () => {
        throw Object.assign(new Error("nope"), { code: "timeout" });
      }),
    });
    expect(await adapter.buildOffer(ctx())).toBeNull();
    expect(info).toHaveBeenCalledWith("[kkday] commerce_failed", {
      providerId: "kkday",
      hostname: "www.kkday.com",
      errorCode: "timeout",
    });
    info.mockRestore();
  });
});
