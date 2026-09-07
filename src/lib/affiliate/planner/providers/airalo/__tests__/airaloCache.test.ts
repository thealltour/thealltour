import { describe, expect, it, vi } from "vitest";
import { createMemoryAiraloCatalogCache } from "@/lib/affiliate/planner/providers/airalo/airaloCatalogCache";
import { loadAiraloCatalog } from "@/lib/affiliate/planner/providers/airalo/airaloFeedClient";
import { AIRALO_CATALOG_CACHE_KEY } from "@/lib/affiliate/planner/providers/airalo/airaloTypes";
import type { AiraloOfferRecord } from "@/lib/affiliate/planner/providers/airalo/airaloTypes";

const FEED = `<?xml version="1.0"?><rss xmlns:g="http://base.google.com/ns/1.0"><channel>
<item>
  <g:id>1</g:id>
  <g:title>t</g:title>
  <g:link>https://www.airalo.com/japan-esim/1</g:link>
  <g:availability>in stock</g:availability>
  <g:product_type>esim &gt; Asia &gt; Japan &gt; Data &gt; 1GB &gt; 7 Days</g:product_type>
  <g:is_bundle>false</g:is_bundle>
</item>
</channel></rss>`;

describe("airalo catalog cache semantics", () => {
  it("cache hit skips fetch", async () => {
    const cache = createMemoryAiraloCatalogCache();
    const seed: AiraloOfferRecord[] = [
      {
        id: "1",
        title: "t",
        sourceUrl: "https://www.airalo.com/japan-esim/1",
        countryCode: "JP",
        price: 1,
        salePrice: null,
        currency: "USD",
        availability: "in stock",
        productType: "esim > Asia > Japan > Data > 1GB > 7 Days",
        description: null,
        imageUrl: null,
        brand: null,
        isBundle: false,
        mpn: null,
      },
    ];
    await cache.write(AIRALO_CATALOG_CACHE_KEY, seed);
    const fetchImpl = vi.fn();
    const result = await loadAiraloCatalog({
      cache,
      feedUrl: "https://example.com/feed.xml",
      fetchImpl: fetchImpl as never,
    });
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.fromCache).toBe(true);
      expect(result.records[0]?.id).toBe("1");
    }
    expect(fetchImpl).not.toHaveBeenCalled();
  });

  it("stale fallback when fetch fails after expiry", async () => {
    const cache = createMemoryAiraloCatalogCache();
    const seed: AiraloOfferRecord[] = [
      {
        id: "stale",
        title: "t",
        sourceUrl: "https://www.airalo.com/japan-esim/stale",
        countryCode: "JP",
        price: 1,
        salePrice: null,
        currency: "USD",
        availability: "in stock",
        productType: "esim > Asia > Japan > Data > 1GB > 7 Days",
        description: null,
        imageUrl: null,
        brand: null,
        isBundle: false,
        mpn: null,
      },
    ];
    await cache.write(AIRALO_CATALOG_CACHE_KEY, seed, 1);
    await new Promise((r) => setTimeout(r, 5));
    const result = await loadAiraloCatalog({
      cache,
      feedUrl: "https://example.com/feed.xml",
      fetchImpl: (async () => new Response("nope", { status: 500 })) as never,
    });
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.staleFallback).toBe(true);
      expect(result.records[0]?.id).toBe("stale");
    }
  });

  it("writes normalized catalog after successful fetch", async () => {
    const cache = createMemoryAiraloCatalogCache();
    const result = await loadAiraloCatalog({
      cache,
      feedUrl: "https://example.com/feed.xml",
      fetchImpl: (async () => new Response(FEED, { status: 200 })) as never,
    });
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.fromCache).toBe(false);
    const fresh = await cache.readFresh(AIRALO_CATALOG_CACHE_KEY);
    expect(fresh?.[0]?.countryCode).toBe("JP");
    expect(fresh?.[0]?.availability).toBe("in stock");
  });
});
