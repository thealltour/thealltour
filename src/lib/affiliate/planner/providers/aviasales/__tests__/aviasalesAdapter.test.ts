import { describe, expect, it, vi } from "vitest";
import {
  AVIASALES_OFFER_CTA,
  AVIASALES_OFFER_TITLE,
  createAviasalesAdapter,
} from "@/lib/affiliate/planner/providers/aviasales/aviasalesAdapter";
import { createMemoryAviasalesCache } from "@/lib/affiliate/planner/providers/aviasales/aviasalesCache";
import type { AffiliateRoutingContext } from "@/lib/affiliate/planner/types";

function ctx(overrides?: Partial<AffiliateRoutingContext>): AffiliateRoutingContext {
  return {
    plannerSessionId: "550e8400-e29b-41d4-a716-446655440000",
    destination: { text: "Osaka", countryCode: "JP" },
    dates: { mode: "fixed", startDate: "2026-10-01", endDate: "2026-10-05", durationDays: 5 },
    travelers: { adults: 1, children: 0 },
    companionType: "solo",
    interests: [],
    pace: "balanced",
    placement: "planner_summary",
    category: "flight",
    sourceProductId: null,
    flightOrigin: { text: "Seoul", iata: "ICN" },
    ...overrides,
  };
}

describe("aviasalesAdapter", () => {
  it("requires flight + planner_summary + fixed dates + origin IATA", () => {
    const adapter = createAviasalesAdapter();
    expect(adapter.isEligible(ctx())).toBe(true);
    expect(adapter.isEligible(ctx({ category: "hotel" }))).toBe(false);
    expect(adapter.isEligible(ctx({ placement: "preparation" }))).toBe(false);
    expect(adapter.isEligible(ctx({ dates: { mode: "flexible", startDate: null, endDate: null, durationDays: 5 } }))).toBe(false);
    expect(adapter.isEligible(ctx({ flightOrigin: null }))).toBe(false);
    expect(adapter.isEligible(ctx({ flightOrigin: { text: "x", iata: "IC" } }))).toBe(false);
  });

  it("missing origin → no price API call", async () => {
    const fetchImpl = vi.fn();
    const adapter = createAviasalesAdapter({
      cache: createMemoryAviasalesCache(),
      fetchImpl: fetchImpl as never,
      getApiToken: () => "tok",
      createCommerceTarget: vi.fn(),
    });
    const offer = await adapter.buildOffer(ctx({ flightOrigin: null }));
    expect(offer).toBeNull();
    expect(fetchImpl).not.toHaveBeenCalled();
  });

  it("builds commerce offer with safe copy (no price/airline fields)", async () => {
    const fetchImpl = vi.fn(async (input: RequestInfo) => {
      const url = String(input);
      if (url.includes("autocomplete")) {
        return new Response(
          JSON.stringify([
            { type: "city", code: "OSA", name: "Osaka", country_code: "JP", weight: 100 },
          ]),
          { status: 200 },
        );
      }
      return new Response(
        JSON.stringify({
          success: true,
          data: [
            {
              origin: "ICN",
              destination: "OSA",
              price: 199,
              airline: "KE",
              link: "/search/ICN0110OSA05101?t=demo",
              transfers: 0,
            },
          ],
          currency: "usd",
        }),
        { status: 200 },
      );
    });

    const createCommerceTarget = vi.fn(async (input: { sourceUrl: string }) => {
      expect(input.sourceUrl).toContain("aviasales.com/search/");
      return {
        affiliateUrl: "https://tp.media/r?avia=1",
        providerSubId: "tp_ffffffffffffffffffffffff",
        affiliateNetwork: "travelpayouts" as const,
        sourceUrlHost: "www.aviasales.com",
      };
    });

    const adapter = createAviasalesAdapter({
      cache: createMemoryAviasalesCache(),
      fetchImpl: fetchImpl as never,
      getApiToken: () => "tok",
      createCommerceTarget,
    });

    const offer = await adapter.buildOffer(ctx());
    expect(offer).not.toBeNull();
    expect(offer?.title).toBe(AVIASALES_OFFER_TITLE);
    expect(offer?.ctaLabel).toBe(AVIASALES_OFFER_CTA);
    expect(offer?.targetUrl).toBe("https://tp.media/r?avia=1");
    expect(offer?.affiliateNetwork).toBe("travelpayouts");
    expect(JSON.stringify(offer)).not.toMatch(/199|airline|KE|최저|실시간|현재/);
    expect(createCommerceTarget).toHaveBeenCalled();
  });
});
