import { afterEach, describe, expect, it, vi } from "vitest";
import {
  createStay22Adapter,
  isStay22Eligible,
  STAY22_HOTEL_DESCRIPTION,
} from "@/lib/affiliate/planner/providers/stay22/stay22Adapter";
import type { AffiliateRoutingContext } from "@/lib/affiliate/planner/types";

const TEST_AID = "test-aid";

function ctx(overrides?: Partial<AffiliateRoutingContext>): AffiliateRoutingContext {
  return {
    plannerSessionId: "550e8400-e29b-41d4-a716-446655440000",
    destination: { text: "오사카", countryCode: "JP" },
    dates: { mode: "fixed", startDate: "2027-01-28", endDate: "2027-02-01", durationDays: 5 },
    travelers: { adults: 3, children: 0 },
    companionType: "friends",
    interests: [],
    pace: "balanced",
    placement: "planner_summary",
    category: "hotel",
    sourceProductId: null,
    ...overrides,
  };
}

afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

describe("stay22Adapter eligibility", () => {
  it("hotel + planner_summary + fixed dates → eligible", () => {
    expect(isStay22Eligible(ctx())).toBe(true);
    expect(createStay22Adapter().isEligible(ctx())).toBe(true);
  });

  it.each<[string, Partial<AffiliateRoutingContext>]>([
    ["activity", { category: "activity" }],
    ["flight", { category: "flight" }],
    ["preparation", { placement: "preparation" }],
    ["day_item", { placement: "day_item" }],
    [
      "flexible",
      { dates: { mode: "flexible", startDate: null, endDate: null, durationDays: 4 } },
    ],
    [
      "missing checkin",
      { dates: { mode: "fixed", startDate: null, endDate: "2027-02-01", durationDays: 5 } },
    ],
    [
      "missing checkout",
      { dates: { mode: "fixed", startDate: "2027-01-28", endDate: null, durationDays: 5 } },
    ],
    ["empty destination", { destination: { text: "   ", countryCode: "JP" } }],
    ["adults 0", { travelers: { adults: 0, children: 1 } }],
  ])("%s → ineligible", (_label, overrides) => {
    expect(isStay22Eligible(ctx(overrides))).toBe(false);
  });
});

describe("stay22Adapter buildOffer", () => {
  it("builds a hotel offer with an exact Allez roam URL and no network call", async () => {
    const fetchSpy = vi.fn();
    vi.stubGlobal("fetch", fetchSpy);
    const adapter = createStay22Adapter({ env: { STAY22_AID: TEST_AID } });

    const offer = await Promise.resolve(adapter.buildOffer(ctx()));

    expect(fetchSpy).not.toHaveBeenCalled();
    expect(offer).toMatchObject({
      providerId: "stay22",
      category: "hotel",
      placement: "planner_summary",
      title: "오사카 숙소",
      description: STAY22_HOTEL_DESCRIPTION,
      ctaLabel: "숙소 찾아보기",
      destinationLabel: "오사카",
      affiliateNetwork: null,
      affiliateCampaignId: "planner_hotel",
      sourceUrlHost: "www.stay22.com",
    });
    const url = new URL(offer!.targetUrl);
    expect(`${url.origin}${url.pathname}`).toBe("https://www.stay22.com/allez/roam");
    expect(url.searchParams.get("aid")).toBe(TEST_AID);
    expect(url.searchParams.get("address")).toBe("Osaka, Japan");
    expect(url.searchParams.get("checkin")).toBe("2027-01-28");
    expect(url.searchParams.get("checkout")).toBe("2027-02-01");
    expect(url.searchParams.get("adults")).toBe("3");
    expect(url.searchParams.has("children")).toBe(false);
    expect(url.searchParams.get("campaign")).toBe("planner_hotel");
  });

  it("destination without canonical alias → raw text address, offer kept, Korean UI labels", async () => {
    const adapter = createStay22Adapter({ env: { STAY22_AID: TEST_AID } });
    const offer = await Promise.resolve(
      adapter.buildOffer(ctx({ destination: { text: "가와치나가노", countryCode: "JP" } })),
    );
    expect(offer).not.toBeNull();
    expect(offer).toMatchObject({ title: "가와치나가노 숙소", destinationLabel: "가와치나가노" });
    expect(new URL(offer!.targetUrl).searchParams.get("address")).toBe("가와치나가노");
  });

  it("passes children when present", async () => {
    const adapter = createStay22Adapter({ env: { STAY22_AID: TEST_AID } });
    const offer = await Promise.resolve(
      adapter.buildOffer(ctx({ travelers: { adults: 2, children: 1 } })),
    );
    expect(new URL(offer!.targetUrl).searchParams.get("children")).toBe("1");
  });

  it("description avoids unbacked price/ranking claims", () => {
    for (const banned of ["최저가", "가장 저렴한", "최적 가격", "베스트 호텔"]) {
      expect(STAY22_HOTEL_DESCRIPTION).not.toContain(banned);
    }
  });

  it.each([[{}], [{ STAY22_AID: "" }], [{ STAY22_AID: "   " }]])(
    "missing AID %j → null without logging the AID",
    async (env) => {
      const info = vi.spyOn(console, "info").mockImplementation(() => {});
      const adapter = createStay22Adapter({ env });
      const offer = await Promise.resolve(adapter.buildOffer(ctx()));
      expect(offer).toBeNull();
      expect(info).toHaveBeenCalledWith("[stay22] offer_skipped", {
        providerId: "stay22",
        errorCode: "config_missing",
      });
    },
  );

  it("never logs the AID value on failure", async () => {
    const info = vi.spyOn(console, "info").mockImplementation(() => {});
    const adapter = createStay22Adapter({ env: { STAY22_AID: "secret-aid-value" } });
    await Promise.resolve(
      adapter.buildOffer(
        ctx({ dates: { mode: "fixed", startDate: "2027-02-01", endDate: "2027-01-28", durationDays: 5 } }),
      ),
    );
    expect(JSON.stringify(info.mock.calls)).not.toContain("secret-aid-value");
  });

  it("flexible dates → null", async () => {
    const adapter = createStay22Adapter({ env: { STAY22_AID: TEST_AID } });
    const offer = await Promise.resolve(
      adapter.buildOffer(
        ctx({ dates: { mode: "flexible", startDate: null, endDate: null, durationDays: 4 } }),
      ),
    );
    expect(offer).toBeNull();
  });
});
