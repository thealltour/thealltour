import { describe, expect, it, vi } from "vitest";
import { createWeGoTripAdapter } from "@/lib/affiliate/planner/providers/wegotrip/weGoTripAdapter";
import { createMemoryWeGoTripCache } from "@/lib/affiliate/planner/providers/wegotrip/weGoTripCache";
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
    placement: "day_item",
    category: "activity",
    dayNumber: 1,
    itemOrder: 1,
    placeName: "Historic Highlights",
    sourceProductId: null,
    ...overrides,
  };
}

function mockFetchSequence(responses: Array<() => Response | Promise<Response>>) {
  let i = 0;
  return vi.fn(async () => {
    const next = responses[Math.min(i, responses.length - 1)]!;
    i += 1;
    return next();
  });
}

describe("weGoTripAdapter", () => {
  it("requires activity + day_item", () => {
    const adapter = createWeGoTripAdapter();
    expect(adapter.isEligible(ctx({ category: "esim" }))).toBe(false);
    expect(adapter.isEligible(ctx({ placement: "preparation" }))).toBe(false);
    expect(adapter.isEligible(ctx())).toBe(true);
  });

  it("resolves city → products → commerce metadata", async () => {
    const cache = createMemoryWeGoTripCache();
    const fetchImpl = mockFetchSequence([
      () =>
        new Response(
          JSON.stringify({
            data: {
              results: [
                {
                  id: 1853909,
                  name: "Osaka",
                  slug: "osaka",
                  type: "city",
                  available: true,
                },
              ],
            },
          }),
          { status: 200 },
        ),
      () =>
        new Response(JSON.stringify({ data: { results: [] } }), { status: 404 }), // languages
      () =>
        new Response(
          JSON.stringify({
            data: [{ id: 2, code: "USD", name: "USD" }],
          }),
          { status: 200 },
        ),
      () =>
        new Response(
          JSON.stringify({
            data: {
              results: [
                {
                  id: 10677,
                  title: "Osaka: Historic Highlights Audio Tour",
                  slug: "historic-highlights-of-osaka",
                  available: true,
                  rating: 4,
                  reviewsCount: 1,
                  category: "History",
                  city: { id: 1853909, name: "Osaka", slug: "osaka" },
                },
              ],
            },
          }),
          { status: 200 },
        ),
    ]);

    const createCommerceTarget = vi.fn(async (input: { sourceUrl: string }) => ({
      affiliateUrl: "https://tp.media/r?wego=1",
      providerSubId: "tp_cccccccccccccccccccccccc",
      affiliateNetwork: "travelpayouts" as const,
      sourceUrlHost: "wegotrip.com",
      sourceUrl: input.sourceUrl,
    }));

    const adapter = createWeGoTripAdapter({
      cache,
      fetchImpl: fetchImpl as never,
      createCommerceTarget,
    });
    const offer = await adapter.buildOffer(ctx());
    expect(offer?.providerId).toBe("wegotrip");
    expect(offer?.providerSubId).toBe("tp_cccccccccccccccccccccccc");
    expect(offer?.affiliateNetwork).toBe("travelpayouts");
    expect(offer?.sourceUrlHost).toBe("wegotrip.com");
    expect(offer?.dayNumber).toBe(1);
    expect(createCommerceTarget).toHaveBeenCalledOnce();
    expect(createCommerceTarget.mock.calls[0]?.[0].sourceUrl).toMatch(
      /^https:\/\/wegotrip\.com\/osaka-d1853909\/historic-highlights-of-osaka-p10677\/$/,
    );
    expect(JSON.stringify(offer)).not.toContain("10677");
  });

  it("returns null when no products", async () => {
    const cache = createMemoryWeGoTripCache();
    const fetchImpl = mockFetchSequence([
      () =>
        new Response(
          JSON.stringify({
            data: {
              results: [{ id: 1, name: "Osaka", slug: "osaka", type: "city", available: true }],
            },
          }),
          { status: 200 },
        ),
      () => new Response("{}", { status: 404 }),
      () => new Response(JSON.stringify({ data: [{ code: "USD" }] }), { status: 200 }),
      () => new Response(JSON.stringify({ data: { results: [] } }), { status: 200 }),
    ]);
    const adapter = createWeGoTripAdapter({
      cache,
      fetchImpl: fetchImpl as never,
      createCommerceTarget: vi.fn(),
    });
    expect(await adapter.buildOffer(ctx())).toBeNull();
  });
});
