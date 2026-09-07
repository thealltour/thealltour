import { describe, expect, it, vi } from "vitest";
import { createAiraloAdapter } from "@/lib/affiliate/planner/providers/airalo/airaloAdapter";
import { createMemoryAiraloCatalogCache } from "@/lib/affiliate/planner/providers/airalo/airaloCatalogCache";
import { AIRALO_CATALOG_CACHE_KEY } from "@/lib/affiliate/planner/providers/airalo/airaloTypes";
import type { AffiliateRoutingContext } from "@/lib/affiliate/planner/types";

const FEED = `<?xml version="1.0"?>
<rss xmlns:g="http://base.google.com/ns/1.0"><channel>
<item>
  <g:id>jp-1</g:id>
  <g:title>JP plan</g:title>
  <g:link>https://www.airalo.com/japan-esim/jp-1</g:link>
  <g:price>4.00 USD</g:price>
  <g:availability>in stock</g:availability>
  <g:product_type>esim &gt; Asia &gt; Japan &gt; Data &gt; 1GB &gt; 7 Days</g:product_type>
  <g:is_bundle>false</g:is_bundle>
</item>
</channel></rss>`;

function ctx(overrides?: Partial<AffiliateRoutingContext>): AffiliateRoutingContext {
  return {
    plannerSessionId: "550e8400-e29b-41d4-a716-446655440000",
    destination: { text: "오사카", countryCode: "JP" },
    dates: { mode: "fixed", startDate: "2026-10-01", endDate: "2026-10-05", durationDays: 5 },
    travelers: { adults: 1, children: 0 },
    companionType: "solo",
    interests: [],
    pace: "balanced",
    placement: "preparation",
    category: "esim",
    sourceProductId: null,
    ...overrides,
  };
}

describe("airaloAdapter", () => {
  it("is ineligible for wrong category/placement or missing countryCode", () => {
    const adapter = createAiraloAdapter();
    expect(adapter.isEligible(ctx({ category: "activity" }))).toBe(false);
    expect(adapter.isEligible(ctx({ placement: "day_item" }))).toBe(false);
    expect(
      adapter.isEligible(ctx({ destination: { text: "오사카", countryCode: null } })),
    ).toBe(false);
  });

  it("returns null when destination countryCode is null (no offer)", async () => {
    const cache = createMemoryAiraloCatalogCache();
    const createCommerceTarget = vi.fn();
    const adapter = createAiraloAdapter({
      cache,
      feedUrl: "https://example.com/airalo-feed.xml",
      fetchImpl: (async () => new Response(FEED, { status: 200 })) as never,
      createCommerceTarget,
    });
    expect(
      await adapter.buildOffer(ctx({ destination: { text: "오사카", countryCode: null } })),
    ).toBeNull();
    expect(createCommerceTarget).not.toHaveBeenCalled();
  });

  it("passes g:link as sourceUrl to commerce — never treats feed link as final affiliate URL", async () => {
    const cache = createMemoryAiraloCatalogCache();
    const createCommerceTarget = vi.fn(async () => ({
      affiliateUrl: "https://tp.media/r?x=1",
      providerSubId: "tp_aaaaaaaaaaaaaaaaaaaaaaaa",
      affiliateNetwork: "travelpayouts" as const,
      campaignId: "541",
      sourceUrlHost: "www.airalo.com",
    }));
    const fetchImpl = vi.fn(async () => new Response(FEED, { status: 200 }));
    const adapter = createAiraloAdapter({
      cache,
      feedUrl: "https://example.com/airalo-feed.xml",
      fetchImpl: fetchImpl as never,
      createCommerceTarget,
    });

    const offer = await adapter.buildOffer(ctx());
    expect(offer?.providerId).toBe("airalo");
    expect(offer?.targetUrl).toBe("https://tp.media/r?x=1");
    expect(offer?.providerSubId).toBe("tp_aaaaaaaaaaaaaaaaaaaaaaaa");
    expect(offer?.affiliateNetwork).toBe("travelpayouts");
    expect(offer?.sourceUrlHost).toBe("www.airalo.com");
    expect(createCommerceTarget).toHaveBeenCalledWith(
      expect.objectContaining({
        providerId: "airalo",
        allowedHosts: expect.arrayContaining(["airalo.com", "www.airalo.com"]),
        sourceUrl: "https://www.airalo.com/japan-esim/jp-1",
      }),
    );
    // Offer must expose commerce affiliate URL, not raw feed g:link.
    expect(JSON.stringify(offer)).not.toContain("airalo.com/japan-esim");
    expect(offer?.targetUrl).not.toContain("airalo.com");
  });

  it("still routes g:link host through commerce conversion even when link form looks final", async () => {
    const cache = createMemoryAiraloCatalogCache();
    const createCommerceTarget = vi.fn(async (input: { sourceUrl: string }) => ({
      affiliateUrl: "https://tp.media/r?converted=1",
      providerSubId: "tp_cccccccccccccccccccccccc",
      affiliateNetwork: "travelpayouts" as const,
      campaignId: "541",
      sourceUrlHost: "www.airalo.com",
      sourceUrl: input.sourceUrl,
    }));
    const adapter = createAiraloAdapter({
      cache,
      feedUrl: "https://example.com/airalo-feed.xml",
      fetchImpl: (async () => new Response(FEED, { status: 200 })) as never,
      createCommerceTarget,
    });
    const offer = await adapter.buildOffer(ctx());
    expect(createCommerceTarget).toHaveBeenCalledTimes(1);
    expect(createCommerceTarget.mock.calls[0]?.[0].sourceUrl).toMatch(/^https:\/\/www\.airalo\.com\//);
    expect(offer?.targetUrl).toBe("https://tp.media/r?converted=1");
  });

  it("returns null when commerce fails", async () => {
    const cache = createMemoryAiraloCatalogCache();
    const adapter = createAiraloAdapter({
      cache,
      feedUrl: "https://example.com/airalo-feed.xml",
      fetchImpl: (async () => new Response(FEED, { status: 200 })) as never,
      createCommerceTarget: async () => {
        throw Object.assign(new Error("fail"), { code: "config_missing" });
      },
    });
    expect(await adapter.buildOffer(ctx())).toBeNull();
  });

  it("uses cache on second load (no second fetch)", async () => {
    const cache = createMemoryAiraloCatalogCache();
    const fetchImpl = vi.fn(async () => new Response(FEED, { status: 200 }));
    const adapter = createAiraloAdapter({
      cache,
      feedUrl: "https://example.com/airalo-feed.xml",
      fetchImpl: fetchImpl as never,
      createCommerceTarget: async () => ({
        affiliateUrl: "https://tp.media/r?x=1",
        providerSubId: "tp_bbbbbbbbbbbbbbbbbbbbbbbb",
        affiliateNetwork: "travelpayouts",
        sourceUrlHost: "www.airalo.com",
      }),
    });
    await adapter.buildOffer(ctx());
    await adapter.buildOffer(ctx());
    expect(fetchImpl).toHaveBeenCalledTimes(1);
    const cached = await cache.readFresh(AIRALO_CATALOG_CACHE_KEY);
    expect(cached?.length).toBeGreaterThan(0);
  });
});
