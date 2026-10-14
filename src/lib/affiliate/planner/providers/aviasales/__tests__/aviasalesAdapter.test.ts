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

const FARE_LINK =
  "/search/SEL2801OSA01021?t=fare-sig&expected_price=240321&expected_price_currency=usd" +
  "&expected_price_source=share&expected_price_uuid=00000000-0000-4000-8000-000000000000" +
  "&static_fare_key=fare-key&itinerary_key=itin-key&search_date=14102026";

function productionCtx(overrides?: Partial<AffiliateRoutingContext>): AffiliateRoutingContext {
  return ctx({
    destination: { text: "오사카", countryCode: "JP" },
    dates: { mode: "fixed", startDate: "2027-01-28", endDate: "2027-02-01", durationDays: 5 },
    travelers: { adults: 3, children: 0 },
    flightOrigin: { text: "서울", iata: "SEL" },
    ...overrides,
  });
}

function priceApiFetch() {
  return vi.fn(async (input: RequestInfo) => {
    const url = String(input);
    if (url.includes("autocomplete")) {
      return new Response(
        JSON.stringify([
          { type: "city", code: "OSA", name: "오사카", country_code: "JP", weight: 100 },
        ]),
        { status: 200 },
      );
    }
    return new Response(
      JSON.stringify({
        success: true,
        data: [
          { origin: "SEL", destination: "OSA", price: 240321, airline: "7C", link: FARE_LINK, transfers: 0 },
        ],
      }),
      { status: 200 },
    );
  });
}

async function sourceUrlFor(context: AffiliateRoutingContext): Promise<string | null> {
  const sourceUrls: string[] = [];
  const adapter = createAviasalesAdapter({
    cache: createMemoryAviasalesCache(),
    fetchImpl: priceApiFetch() as never,
    getApiToken: () => "tok",
    createCommerceTarget: vi.fn(async (input: { sourceUrl: string }) => {
      sourceUrls.push(input.sourceUrl);
      return {
        affiliateUrl: "https://tp.media/r?avia=1",
        providerSubId: "tp_ffffffffffffffffffffffff",
        affiliateNetwork: "travelpayouts" as const,
        sourceUrlHost: "www.aviasales.com",
      };
    }),
  });
  const offer = await adapter.buildOffer(context);
  return offer ? (sourceUrls[0] ?? null) : null;
}

describe("aviasalesAdapter traveler parity (PR-9AH)", () => {
  it("3 adults → canonical Planner search URL (not the 1-passenger fare link)", async () => {
    expect(await sourceUrlFor(productionCtx())).toBe(
      "https://www.aviasales.com/search/SEL2801OSA01023?locale=ko&currency=krw&market=kr",
    );
  });

  it("2 adults + 1 child → suffix 21", async () => {
    const source = await sourceUrlFor(productionCtx({ travelers: { adults: 2, children: 1 } }));
    expect(new URL(source!).pathname).toBe("/search/SEL2801OSA010221");
  });

  it("1 adult → suffix 1", async () => {
    const source = await sourceUrlFor(productionCtx({ travelers: { adults: 1, children: 0 } }));
    expect(new URL(source!).pathname).toBe("/search/SEL2801OSA01021");
  });

  it("never copies Data API fare-specific query into the target source URL", async () => {
    const source = new URL((await sourceUrlFor(productionCtx()))!);
    for (const key of [
      "t",
      "expected_price",
      "expected_price_currency",
      "expected_price_source",
      "expected_price_uuid",
      "static_fare_key",
      "itinerary_key",
      "search_date",
    ]) {
      expect(source.searchParams.has(key)).toBe(false);
    }
    expect(source.toString()).not.toMatch(/240321|fare-sig|fare-key|itin-key/);
  });

  it.each([
    [{ adults: 10, children: 0 }],
    [{ adults: 2, children: 10 }],
  ])("unsupported travelers %j → no offer, no network, safe diagnostic", async (travelers) => {
    const fetchImpl = vi.fn();
    const createCommerceTarget = vi.fn();
    const info = vi.spyOn(console, "info").mockImplementation(() => {});
    const adapter = createAviasalesAdapter({
      cache: createMemoryAviasalesCache(),
      fetchImpl: fetchImpl as never,
      getApiToken: () => "tok",
      createCommerceTarget,
    });
    expect(await adapter.buildOffer(productionCtx({ travelers }))).toBeNull();
    expect(fetchImpl).not.toHaveBeenCalled();
    expect(createCommerceTarget).not.toHaveBeenCalled();
    expect(info).toHaveBeenCalledWith("[aviasales] offer_skipped", {
      providerId: "aviasales",
      errorCode: "unsupported_travelers",
    });
    info.mockRestore();
  });

  it("9 adults supported (no clamp)", async () => {
    const source = await sourceUrlFor(productionCtx({ travelers: { adults: 9, children: 0 } }));
    expect(new URL(source!).pathname).toBe("/search/SEL2801OSA01029");
  });
});

const CANONICAL_3_ADULTS =
  "https://www.aviasales.com/search/SEL2801OSA01023?locale=ko&currency=krw&market=kr";

function osakaAutocomplete(): Response {
  return new Response(
    JSON.stringify([{ type: "city", code: "OSA", name: "오사카", country_code: "JP", weight: 100 }]),
    { status: 200 },
  );
}

function fetchWithPrices(prices: () => Response | Promise<Response>) {
  return vi.fn(async (input: RequestInfo) =>
    String(input).includes("autocomplete") ? osakaAutocomplete() : prices(),
  );
}

type CommerceTarget = {
  affiliateUrl: string;
  providerSubId: string;
  affiliateNetwork: "travelpayouts";
  sourceUrlHost: string;
};

function commerceSpy() {
  return vi.fn<(input: { sourceUrl: string }) => Promise<CommerceTarget>>(async () => ({
    affiliateUrl: "https://tp.media/r?avia=1",
    providerSubId: "tp_ffffffffffffffffffffffff",
    affiliateNetwork: "travelpayouts",
    sourceUrlHost: "www.aviasales.com",
  }));
}

describe("aviasalesAdapter Data API is a soft signal, not a CTA gate (PR-9AI)", () => {
  it.each([
    [
      "rows = []",
      () => new Response(JSON.stringify({ success: true, data: [] }), { status: 200 }),
      "[aviasales] prices_empty",
    ],
    [
      "timeout",
      () => {
        const error = new Error("aborted");
        error.name = "AbortError";
        throw error;
      },
      "[aviasales] prices_failed",
    ],
    ["HTTP 429", () => new Response("{}", { status: 429 }), "[aviasales] prices_failed"],
    ["HTTP 503", () => new Response("{}", { status: 503 }), "[aviasales] prices_failed"],
    ["invalid response", () => new Response("not json", { status: 200 }), "[aviasales] prices_failed"],
  ])("%s → canonical flight offer via Partner Links", async (_label, prices, diagnostic) => {
    const info = vi.spyOn(console, "info").mockImplementation(() => {});
    const createCommerceTarget = commerceSpy();
    const adapter = createAviasalesAdapter({
      cache: createMemoryAviasalesCache(),
      fetchImpl: fetchWithPrices(prices) as never,
      getApiToken: () => "tok",
      createCommerceTarget,
    });

    const offer = await adapter.buildOffer(productionCtx());

    expect(offer?.providerId).toBe("aviasales");
    expect(offer?.targetUrl).toBe("https://tp.media/r?avia=1");
    expect(offer?.title).toBe(AVIASALES_OFFER_TITLE);
    expect(createCommerceTarget).toHaveBeenCalledTimes(1);
    expect(createCommerceTarget.mock.calls[0]![0].sourceUrl).toBe(CANONICAL_3_ADULTS);
    expect(info).toHaveBeenCalledWith(diagnostic, expect.objectContaining({ providerId: "aviasales" }));
    expect(info).not.toHaveBeenCalledWith("[aviasales] offer_skipped", expect.anything());
    info.mockRestore();
  });

  it("missing Data API token → canonical flight offer, price API never called", async () => {
    const prices = vi.fn(() => new Response("{}", { status: 200 }));
    const createCommerceTarget = commerceSpy();
    const adapter = createAviasalesAdapter({
      cache: createMemoryAviasalesCache(),
      fetchImpl: fetchWithPrices(prices) as never,
      getApiToken: () => null,
      createCommerceTarget,
    });

    const offer = await adapter.buildOffer(productionCtx());

    expect(offer?.providerId).toBe("aviasales");
    expect(prices).not.toHaveBeenCalled();
    expect(createCommerceTarget.mock.calls[0]![0].sourceUrl).toBe(CANONICAL_3_ADULTS);
  });

  it("rows present → offer still targets the canonical URL, never the fare link", async () => {
    const createCommerceTarget = commerceSpy();
    const adapter = createAviasalesAdapter({
      cache: createMemoryAviasalesCache(),
      fetchImpl: priceApiFetch() as never,
      getApiToken: () => "tok",
      createCommerceTarget,
    });

    expect(await adapter.buildOffer(productionCtx())).not.toBeNull();
    expect(createCommerceTarget.mock.calls[0]![0].sourceUrl).toBe(CANONICAL_3_ADULTS);
  });

  it("empty rows keep child parity (2 adults + 1 child → 21)", async () => {
    const createCommerceTarget = commerceSpy();
    const adapter = createAviasalesAdapter({
      cache: createMemoryAviasalesCache(),
      fetchImpl: fetchWithPrices(
        () => new Response(JSON.stringify({ success: true, data: [] }), { status: 200 }),
      ) as never,
      getApiToken: () => "tok",
      createCommerceTarget,
    });

    await adapter.buildOffer(productionCtx({ travelers: { adults: 2, children: 1 } }));
    expect(new URL(createCommerceTarget.mock.calls[0]![0].sourceUrl).pathname).toBe(
      "/search/SEL2801OSA010221",
    );
  });

  it("destination IATA unresolved → no offer, no price call, no Partner Links", async () => {
    const fetchImpl = vi.fn(async (input: RequestInfo) =>
      String(input).includes("autocomplete")
        ? new Response("[]", { status: 200 })
        : new Response(JSON.stringify({ success: true, data: [] }), { status: 200 }),
    );
    const createCommerceTarget = commerceSpy();
    const adapter = createAviasalesAdapter({
      cache: createMemoryAviasalesCache(),
      fetchImpl: fetchImpl as never,
      getApiToken: () => "tok",
      createCommerceTarget,
    });

    expect(await adapter.buildOffer(productionCtx())).toBeNull();
    expect(fetchImpl.mock.calls.every(([url]) => String(url).includes("autocomplete"))).toBe(true);
    expect(createCommerceTarget).not.toHaveBeenCalled();
  });

  it("origin IATA missing → no offer even when the Data API would be fine", async () => {
    const fetchImpl = priceApiFetch();
    const createCommerceTarget = commerceSpy();
    const adapter = createAviasalesAdapter({
      cache: createMemoryAviasalesCache(),
      fetchImpl: fetchImpl as never,
      getApiToken: () => "tok",
      createCommerceTarget,
    });

    expect(await adapter.buildOffer(productionCtx({ flightOrigin: null }))).toBeNull();
    expect(fetchImpl).not.toHaveBeenCalled();
    expect(createCommerceTarget).not.toHaveBeenCalled();
  });

  it("invalid dates → no offer", async () => {
    const createCommerceTarget = commerceSpy();
    const adapter = createAviasalesAdapter({
      cache: createMemoryAviasalesCache(),
      fetchImpl: priceApiFetch() as never,
      getApiToken: () => "tok",
      createCommerceTarget,
    });

    const offer = await adapter.buildOffer(
      productionCtx({
        dates: { mode: "fixed", startDate: "2027-02-30", endDate: "2027-03-02", durationDays: 3 },
      }),
    );
    expect(offer).toBeNull();
    expect(createCommerceTarget).not.toHaveBeenCalled();
  });

  it("Partner Links failure → no offer (no raw aviasales.com fallback)", async () => {
    const info = vi.spyOn(console, "info").mockImplementation(() => {});
    const createCommerceTarget = vi.fn(async () => {
      throw Object.assign(new Error("rejected"), { code: "provider_rejected" });
    });
    const adapter = createAviasalesAdapter({
      cache: createMemoryAviasalesCache(),
      fetchImpl: fetchWithPrices(
        () => new Response(JSON.stringify({ success: true, data: [] }), { status: 200 }),
      ) as never,
      getApiToken: () => "tok",
      createCommerceTarget,
    });

    expect(await adapter.buildOffer(productionCtx())).toBeNull();
    expect(createCommerceTarget).toHaveBeenCalledTimes(1);
    expect(info).toHaveBeenCalledWith("[aviasales] commerce_failed", {
      providerId: "aviasales",
      hostname: "www.aviasales.com",
      errorCode: "provider_rejected",
    });
    info.mockRestore();
  });
});
