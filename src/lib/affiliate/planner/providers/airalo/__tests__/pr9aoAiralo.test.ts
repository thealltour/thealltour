import { describe, expect, it, vi } from "vitest";
import { createAiraloAdapter } from "@/lib/affiliate/planner/providers/airalo/airaloAdapter";
import { createMemoryAiraloCatalogCache } from "@/lib/affiliate/planner/providers/airalo/airaloCatalogCache";
import {
  deriveAiraloCountryCode,
  parseAiraloProductTypePlanDetails,
} from "@/lib/affiliate/planner/providers/airalo/airaloCountry";
import {
  createAiraloCatalogMemoryLayer,
  loadAiraloCatalog,
} from "@/lib/affiliate/planner/providers/airalo/airaloFeedClient";
import {
  normalizeAiraloAvailability,
  parseAiraloFeedXml,
} from "@/lib/affiliate/planner/providers/airalo/airaloFeedParser";
import { selectAiraloOffer } from "@/lib/affiliate/planner/providers/airalo/airaloSelector";
import {
  AIRALO_CATALOG_CACHE_KEY,
  AIRALO_CATALOG_TTL_MS,
  type AiraloOfferRecord,
} from "@/lib/affiliate/planner/providers/airalo/airaloTypes";
import type { AffiliateRoutingContext } from "@/lib/affiliate/planner/types";
import { createTravelpayoutsCommerceTarget } from "@/lib/affiliate/travelpayouts/commerceService";

function item(fields: Record<string, string>): string {
  return `<item>${Object.entries(fields)
    .map(([k, v]) => `<g:${k}>${v}</g:${k}>`)
    .join("")}</item>`;
}

function feed(...items: string[]): string {
  return `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0" xmlns:g="http://base.google.com/ns/1.0"><channel><title>Airalo</title>
${items.join("\n")}
</channel></rss>`;
}

function jpItem(id: string, volume: string, days: string, extra: Record<string, string> = {}) {
  return item({
    id,
    title: `Moshi Moshi ${volume} ${days}`,
    link: `https://www.airalo.com/japan-esim/${id}`,
    description: "Japan eSIM",
    availability: "in stock",
    product_type: `esim &gt; Asia &gt; Japan &gt; Data &gt; ${volume} &gt; ${days}`,
    price: "9.00 USD",
    is_bundle: "false",
    ...extra,
  });
}

function rec(
  partial: Partial<AiraloOfferRecord> & Pick<AiraloOfferRecord, "id">,
): AiraloOfferRecord {
  return {
    title: `title-${partial.id}`,
    sourceUrl: `https://www.airalo.com/japan-esim/${partial.id}`,
    countryCode: "JP",
    price: 10,
    salePrice: null,
    currency: "USD",
    availability: "in stock",
    productType: "esim > Asia > Japan > Data > 1GB > 7 Days",
    description: null,
    imageUrl: null,
    brand: "Airalo",
    isBundle: false,
    mpn: null,
    ...partial,
  };
}

function plan(id: string, volume: string, days: number, price: number): AiraloOfferRecord {
  return rec({
    id,
    price,
    productType: `esim > Asia > Japan > Data > ${volume} > ${days} Days`,
  });
}

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

const COMMERCE_OK = async () => ({
  affiliateUrl: "https://tp.media/r?x=1",
  providerSubId: "tp_aaaaaaaaaaaaaaaaaaaaaaaa",
  affiliateNetwork: "travelpayouts" as const,
  campaignId: "541",
  sourceUrlHost: "www.airalo.com",
});

describe("PR-9AO parser — official new feed shape", () => {
  it("parses id/title/link/description/availability/product_type/price/sale_price/is_bundle", () => {
    const result = parseAiraloFeedXml(
      feed(jpItem("jp-10gb", "10GB", "30 Days", { sale_price: "7.50 USD" })),
    );
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.records).toHaveLength(1);
    const r = result.records[0]!;
    expect(r).toMatchObject({
      id: "jp-10gb",
      title: "Moshi Moshi 10GB 30 Days",
      sourceUrl: "https://www.airalo.com/japan-esim/jp-10gb",
      description: "Japan eSIM",
      availability: "in stock",
      countryCode: "JP",
      price: 9,
      salePrice: 7.5,
      currency: "USD",
      isBundle: false,
      dataLabel: "10GB",
      validityDays: 30,
    });
  });

  it("parses data allowance labels (GB/MB/decimal/space/Unlimited)", () => {
    const details = (pt: string) => parseAiraloProductTypePlanDetails(pt);
    expect(details("esim > Asia > Japan > Data > 1GB > 7 Days").dataLabel).toBe("1GB");
    expect(details("esim > Asia > Japan > Data > 3 GB > 15 Days").dataLabel).toBe("3GB");
    expect(details("esim > Asia > Japan > Data > 500MB > 3 Days").dataLabel).toBe("500MB");
    expect(details("esim > Asia > Japan > Data > 1.5GB > 7 Days").dataLabel).toBe("1.5GB");
    expect(details("esim > Americas > United States > Unlimited > 10 Days")).toMatchObject({
      dataLabel: "Unlimited",
      validityDays: 10,
    });
  });

  it("parses validity days (Day/Days, singular, no DATA TYPE segment)", () => {
    const days = (pt: string) => parseAiraloProductTypePlanDetails(pt).validityDays;
    expect(days("esim > Asia > Japan > Data > 1GB > 1 Day")).toBe(1);
    expect(days("esim > Asia > Japan > Data > 20GB > 30 Days")).toBe(30);
    expect(days("esim > Asia > Japan > 5GB > 15Days")).toBe(15);
    expect(days("esim > Asia > Japan > Data > 5GB > 0 Days")).toBeNull();
    expect(days("esim > Asia > Japan > Data > 5GB > 999 Days")).toBeNull();
  });

  it("unknown product_type plan segments keep the core record with null metadata", () => {
    const result = parseAiraloFeedXml(
      feed(
        item({
          id: "jp-odd",
          title: "Odd",
          link: "https://www.airalo.com/japan-esim/jp-odd",
          availability: "in stock",
          product_type: "esim &gt; Asia &gt; Japan &gt; Data &gt; Plenty &gt; A while",
        }),
      ),
    );
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.records[0]).toMatchObject({
      id: "jp-odd",
      countryCode: "JP",
      dataLabel: null,
      validityDays: null,
    });
  });

  it("unknown availability values are not treated as sellable", () => {
    expect(normalizeAiraloAvailability("in stock")).toBe("in stock");
    expect(normalizeAiraloAvailability("IN_STOCK")).toBe("in stock");
    expect(normalizeAiraloAvailability("out of stock")).toBe("out of stock");
    expect(normalizeAiraloAvailability("pre-order")).toBe("preorder");
    expect(normalizeAiraloAvailability("available")).toBeNull();
    expect(normalizeAiraloAvailability("limited availability")).toBeNull();
    expect(normalizeAiraloAvailability("")).toBeNull();

    const result = parseAiraloFeedXml(
      feed(jpItem("jp-weird", "1GB", "7 Days", { availability: "available" })),
    );
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.records[0]?.availability).toBeNull();
    expect(selectAiraloOffer({ records: result.records, countryCode: "JP" })).toBeNull();
  });

  it("skips items with a missing source link but keeps the rest of the catalog", () => {
    const noLink = item({
      id: "jp-nolink",
      title: "No link",
      availability: "in stock",
      product_type: "esim &gt; Asia &gt; Japan &gt; Data &gt; 1GB &gt; 7 Days",
    });
    const httpLink = jpItem("jp-http", "1GB", "7 Days", {
      link: "http://www.airalo.com/japan-esim/jp-http",
    });
    const result = parseAiraloFeedXml(feed(noLink, httpLink, jpItem("jp-ok", "1GB", "7 Days")));
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.records.map((r) => r.id)).toEqual(["jp-ok"]);
  });

  it("accepts leading-currency prices without failing the item", () => {
    const result = parseAiraloFeedXml(feed(jpItem("jp-lead", "1GB", "7 Days", { price: "USD 4.50" })));
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.records[0]).toMatchObject({ price: 4.5, currency: "USD" });
  });

  it("maps feed country spelling aliases to ISO", () => {
    const iso = (country: string) =>
      deriveAiraloCountryCode({ productType: `esim > Asia > ${country} > Data > 1GB > 7 Days` });
    expect(iso("Korea, Republic of")).toBe("KR");
    expect(iso("Republic of Korea")).toBe("KR");
    expect(iso("South Korea")).toBe("KR");
    expect(iso("Viet Nam")).toBe("VN");
    expect(iso("Vietnam")).toBe("VN");
    expect(iso("Macao")).toBe("MO");
    expect(iso("Macau")).toBe("MO");
    expect(iso("Hong Kong")).toBe("HK");
    expect(iso("Taiwan")).toBe("TW");
    expect(iso("Thailand")).toBe("TH");
    expect(iso("Japan")).toBe("JP");
    expect(iso("Northern Mariana Islands")).toBeNull();
  });
});

describe("PR-9AO selector — trip duration fit", () => {
  it("trip 5 days: picks the 7-day plan over a cheaper 3-day plan and a 30-day plan", () => {
    const selected = selectAiraloOffer({
      countryCode: "JP",
      tripDurationDays: 5,
      records: [plan("a-3d", "1GB", 3, 2), plan("b-7d", "1GB", 7, 5), plan("c-30d", "5GB", 30, 12)],
    });
    expect(selected?.id).toBe("b-7d");
  });

  it("trip 10 days: picks the 15-day plan over 7-day and 30-day plans", () => {
    const selected = selectAiraloOffer({
      countryCode: "JP",
      tripDurationDays: 10,
      records: [plan("p7", "3GB", 7, 6), plan("p15", "3GB", 15, 9), plan("p30", "3GB", 30, 14)],
    });
    expect(selected?.id).toBe("p15");
  });

  it("validity unknown only: falls back to deterministic price → id order", () => {
    const unknown = (id: string, price: number) =>
      rec({ id, price, productType: "esim > Asia > Japan > Data" });
    const selected = selectAiraloOffer({
      countryCode: "JP",
      tripDurationDays: 5,
      records: [unknown("z", 4), unknown("b", 3), unknown("a", 3)],
    });
    expect(selected?.id).toBe("a");
  });

  it("same validity: lower price, then larger data, then id", () => {
    const records = [plan("x-1gb", "1GB", 7, 5), plan("y-3gb", "3GB", 7, 8)];
    expect(selectAiraloOffer({ countryCode: "JP", tripDurationDays: 5, records })?.id).toBe("x-1gb");

    const samePrice = [plan("x-1gb", "1GB", 7, 5), plan("y-3gb", "3GB", 7, 5)];
    expect(
      selectAiraloOffer({ countryCode: "JP", tripDurationDays: 5, records: samePrice })?.id,
    ).toBe("y-3gb");
  });

  it("prefers a covering plan over unknown validity, and unknown over too short", () => {
    const unknownValidity = rec({ id: "unknown", price: 1, productType: "esim > Asia > Japan > Data" });
    const tooShort = plan("short", "1GB", 3, 1);
    const covering = plan("cover", "1GB", 7, 9);
    expect(
      selectAiraloOffer({
        countryCode: "JP",
        tripDurationDays: 5,
        records: [unknownValidity, tooShort, covering],
      })?.id,
    ).toBe("cover");
    expect(
      selectAiraloOffer({ countryCode: "JP", tripDurationDays: 5, records: [unknownValidity, tooShort] })
        ?.id,
    ).toBe("unknown");
  });

  it("only too-short plans: the longest one is chosen (offer still exists)", () => {
    const selected = selectAiraloOffer({
      countryCode: "JP",
      tripDurationDays: 20,
      records: [plan("p3", "1GB", 3, 2), plan("p15", "3GB", 15, 9), plan("p7", "1GB", 7, 4)],
    });
    expect(selected?.id).toBe("p15");
  });

  it("local plan still outranks a longer-fitting bundle", () => {
    const selected = selectAiraloOffer({
      countryCode: "JP",
      tripDurationDays: 10,
      records: [
        rec({ id: "bundle", isBundle: true, price: 1, productType: "esim > Global > Japan > Data > 20GB > 30 Days" }),
        plan("local-7", "1GB", 7, 5),
      ],
    });
    expect(selected?.id).toBe("local-7");
  });

  it("without a usable trip length keeps the PR-9C cheapest-local order", () => {
    const records = [plan("p30", "10GB", 30, 20), plan("p3", "1GB", 3, 2)];
    expect(selectAiraloOffer({ countryCode: "JP", records })?.id).toBe("p3");
    expect(selectAiraloOffer({ countryCode: "JP", tripDurationDays: 0, records })?.id).toBe("p3");
  });

  it("reads plan details from product_type for records cached before PR-9AO", () => {
    const legacy = (id: string, days: number) => {
      const r = plan(id, "1GB", days, 5);
      delete (r as Partial<AiraloOfferRecord>).dataLabel;
      delete (r as Partial<AiraloOfferRecord>).validityDays;
      return r;
    };
    expect(
      selectAiraloOffer({ countryCode: "JP", tripDurationDays: 5, records: [legacy("l3", 3), legacy("l7", 7)] })
        ?.id,
    ).toBe("l7");
  });
});

describe("PR-9AO adapter — KR exclusion, copy, metadata, source guard", () => {
  function adapterFor(xml: string, createCommerceTarget = vi.fn(COMMERCE_OK)) {
    const fetchImpl = vi.fn(async () => new Response(xml, { status: 200 }));
    const adapter = createAiraloAdapter({
      cache: createMemoryAiraloCatalogCache(),
      feedUrl: "https://example.com/airalo-feed.xml",
      fetchImpl: fetchImpl as never,
      createCommerceTarget,
    });
    return { adapter, fetchImpl, createCommerceTarget };
  }

  it("KR destination is ineligible and never loads the catalog", async () => {
    const krFeed = feed(
      item({
        id: "kr-1",
        title: "KR",
        link: "https://www.airalo.com/south-korea-esim/kr-1",
        availability: "in stock",
        product_type: "esim &gt; Asia &gt; South Korea &gt; Data &gt; 1GB &gt; 7 Days",
      }),
    );
    const { adapter, fetchImpl, createCommerceTarget } = adapterFor(krFeed);
    const kr = ctx({ destination: { text: "제주", countryCode: "KR" } });
    expect(adapter.isEligible(kr)).toBe(false);
    expect(adapter.isEligible(ctx({ destination: { text: "제주", countryCode: "kr" } }))).toBe(false);
    expect(await adapter.buildOffer(kr)).toBeNull();
    expect(fetchImpl).not.toHaveBeenCalled();
    expect(createCommerceTarget).not.toHaveBeenCalled();
  });

  it("JP/VN/TH/TW stay eligible", () => {
    const { adapter } = adapterFor(feed(jpItem("jp", "1GB", "7 Days")));
    for (const countryCode of ["JP", "VN", "TH", "TW"]) {
      expect(adapter.isEligible(ctx({ destination: { text: "x", countryCode } }))).toBe(true);
    }
  });

  it("uses the country-level label for title/description and emits esim metadata", async () => {
    const { adapter, createCommerceTarget } = adapterFor(
      feed(jpItem("jp-3d", "1GB", "3 Days"), jpItem("jp-30d", "10GB", "30 Days")),
    );
    const offer = await adapter.buildOffer(ctx());
    expect(offer?.title).toBe("일본 여행용 eSIM");
    expect(offer?.description).toBe("일본에서 사용할 eSIM을 확인해 보세요.");
    expect(offer?.ctaLabel).toBe("여행용 eSIM 보기");
    expect(offer?.destinationLabel).toBe("오사카");
    expect(offer?.metadata).toEqual({ esim: { dataLabel: "10GB", validityDays: 30 } });
    expect(createCommerceTarget).toHaveBeenCalledWith(
      expect.objectContaining({ sourceUrl: "https://www.airalo.com/japan-esim/jp-30d" }),
    );
    const serialized = JSON.stringify(offer);
    expect(serialized).not.toMatch(/price|currency|USD/i);
  });

  it("falls back to destination text when the country has no Korean label", async () => {
    const { adapter } = adapterFor(
      feed(
        item({
          id: "pr-1",
          title: "PR",
          link: "https://www.airalo.com/puerto-rico-esim/pr-1",
          availability: "in stock",
          product_type: "esim &gt; Americas &gt; Puerto Rico &gt; Data &gt; 1GB &gt; 7 Days",
        }),
      ),
    );
    const offer = await adapter.buildOffer(
      ctx({ destination: { text: "산후안", countryCode: "PR" } }),
    );
    expect(offer?.title).toBe("산후안 여행용 eSIM");
  });

  it("no parseable plan details → offer still built without metadata", async () => {
    const { adapter } = adapterFor(
      feed(
        item({
          id: "jp-plain",
          title: "Plain",
          link: "https://www.airalo.com/japan-esim/jp-plain",
          availability: "in stock",
          product_type: "esim &gt; Asia &gt; Japan &gt; Data",
        }),
      ),
    );
    const offer = await adapter.buildOffer(ctx());
    expect(offer?.targetUrl).toBe("https://tp.media/r?x=1");
    expect(offer?.metadata).toBeUndefined();
  });

  it("omits metadata when the only plan is shorter than the trip", async () => {
    const { adapter } = adapterFor(feed(jpItem("jp-3d", "1GB", "3 Days")));
    const offer = await adapter.buildOffer(ctx());
    expect(offer?.title).toBe("일본 여행용 eSIM");
    expect(offer?.metadata).toBeUndefined();
  });

  it("non-Airalo source hosts are rejected by Commerce Core before Partner Links", async () => {
    const createPartnerLink = vi.fn();
    const realCommerce = vi.fn((input: Parameters<typeof createTravelpayoutsCommerceTarget>[0]) =>
      createTravelpayoutsCommerceTarget({ ...input, createPartnerLink }),
    );
    const { adapter } = adapterFor(
      feed(
        jpItem("jp-tp", "1GB", "7 Days", { link: "https://tp.media/r?marker=1&amp;u=airalo" }),
      ),
      realCommerce as never,
    );
    expect(await adapter.buildOffer(ctx())).toBeNull();
    expect(realCommerce).toHaveBeenCalledTimes(1);
    expect(createPartnerLink).not.toHaveBeenCalled();
  });
});

describe("PR-9AO catalog cache — memory L1 → store L2 → remote", () => {
  const FEED = feed(jpItem("jp-1", "1GB", "7 Days"));
  const SEED = [plan("seed", "1GB", 7, 5)];

  function spyStore() {
    const inner = createMemoryAiraloCatalogCache();
    return {
      inner,
      store: {
        readFresh: vi.fn(inner.readFresh),
        readFreshEntry: vi.fn(inner.readFreshEntry!),
        readStale: vi.fn(inner.readStale),
        write: vi.fn(inner.write),
      },
    };
  }

  it("memory hit skips the store and the remote feed", async () => {
    const memory = createAiraloCatalogMemoryLayer();
    memory.write(SEED, Date.now() + 60_000);
    const { store } = spyStore();
    const fetchImpl = vi.fn();
    const result = await loadAiraloCatalog({
      cache: store,
      memory,
      feedUrl: "https://example.com/feed.xml",
      fetchImpl: fetchImpl as never,
    });
    expect(result).toMatchObject({ ok: true, fromCache: true });
    expect(store.readFreshEntry).not.toHaveBeenCalled();
    expect(store.readFresh).not.toHaveBeenCalled();
    expect(fetchImpl).not.toHaveBeenCalled();
  });

  it("memory miss + store fresh → no remote fetch, memory populated with the store expiry", async () => {
    const memory = createAiraloCatalogMemoryLayer();
    const { inner, store } = spyStore();
    await inner.write(AIRALO_CATALOG_CACHE_KEY, SEED, 60_000);
    const fetchImpl = vi.fn();
    const result = await loadAiraloCatalog({
      cache: store,
      memory,
      feedUrl: "https://example.com/feed.xml",
      fetchImpl: fetchImpl as never,
    });
    expect(result).toMatchObject({ ok: true, fromCache: true });
    expect(fetchImpl).not.toHaveBeenCalled();
    expect(memory.readFresh(Date.now())?.[0]?.id).toBe("seed");
    expect(memory.readFresh(Date.now() + 61_000)).toBeNull();
  });

  it("memory miss + store miss → remote fetch, store write, memory write", async () => {
    const memory = createAiraloCatalogMemoryLayer();
    const { store } = spyStore();
    const fetchImpl = vi.fn(async () => new Response(FEED, { status: 200 }));
    const result = await loadAiraloCatalog({
      cache: store,
      memory,
      feedUrl: "https://example.com/feed.xml",
      fetchImpl: fetchImpl as never,
    });
    expect(result).toMatchObject({ ok: true, fromCache: false });
    expect(fetchImpl).toHaveBeenCalledTimes(1);
    expect(store.write).toHaveBeenCalledWith(
      AIRALO_CATALOG_CACHE_KEY,
      expect.any(Array),
      AIRALO_CATALOG_TTL_MS,
    );
    expect(memory.readFresh(Date.now())?.[0]?.id).toBe("jp-1");
  });

  it("two concurrent cold requests share one remote fetch", async () => {
    const memory = createAiraloCatalogMemoryLayer();
    const { store } = spyStore();
    let release!: () => void;
    const gate = new Promise<void>((resolve) => {
      release = resolve;
    });
    const fetchImpl = vi.fn(async () => {
      await gate;
      return new Response(FEED, { status: 200 });
    });
    const deps = {
      cache: store,
      memory,
      feedUrl: "https://example.com/feed.xml",
      fetchImpl: fetchImpl as never,
    };
    const first = loadAiraloCatalog(deps);
    const second = loadAiraloCatalog(deps);
    release();
    const [a, b] = await Promise.all([first, second]);
    expect(fetchImpl).toHaveBeenCalledTimes(1);
    expect(a).toEqual(b);
    expect(memory.inflight).toBeNull();
  });

  it("remote failure + store stale → stale records", async () => {
    const memory = createAiraloCatalogMemoryLayer();
    const { inner, store } = spyStore();
    await inner.write(AIRALO_CATALOG_CACHE_KEY, SEED, 1);
    await new Promise((r) => setTimeout(r, 5));
    const result = await loadAiraloCatalog({
      cache: store,
      memory,
      feedUrl: "https://example.com/feed.xml",
      fetchImpl: (async () => new Response("nope", { status: 503 })) as never,
    });
    expect(result).toMatchObject({ ok: true, staleFallback: true });
    if (result.ok) expect(result.records[0]?.id).toBe("seed");
  });

  it("process-memory expiry falls through to the next layer", async () => {
    const memory = createAiraloCatalogMemoryLayer();
    const { inner, store } = spyStore();
    let clock = 1_000_000;
    memory.write([plan("old-memory", "1GB", 7, 5)], clock + 1_000);
    await inner.write(AIRALO_CATALOG_CACHE_KEY, SEED, 60_000);
    clock += 2_000;
    const result = await loadAiraloCatalog({
      cache: store,
      memory,
      now: () => clock,
      feedUrl: "https://example.com/feed.xml",
      fetchImpl: vi.fn() as never,
    });
    expect(store.readFreshEntry).toHaveBeenCalledTimes(1);
    if (result.ok) expect(result.records[0]?.id).toBe("seed");
  });

  it("no feed URL and no cache → config_missing (no throw)", async () => {
    const result = await loadAiraloCatalog({
      cache: createMemoryAiraloCatalogCache(),
      memory: createAiraloCatalogMemoryLayer(),
      feedUrl: "",
    });
    expect(result).toEqual({ ok: false, errorCode: "config_missing" });
  });
});
