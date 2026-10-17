import { describe, expect, it, vi } from "vitest";

vi.mock("@/lib/affiliate/planner/offerRepository", () => ({
  persistAffiliateOfferToken: vi.fn(),
}));

import { buildAffiliateOffersForSession } from "@/lib/affiliate/planner/buildOffersForSession";
import {
  createFakeAffiliateAdapter,
  createFakeAffiliateDefinition,
} from "@/lib/affiliate/planner/__tests__/fixtures";
import { createAiraloAdapter } from "@/lib/affiliate/planner/providers/airalo/airaloAdapter";
import { createMemoryAiraloCatalogCache } from "@/lib/affiliate/planner/providers/airalo/airaloCatalogCache";
import { parseAiraloFeedXml } from "@/lib/affiliate/planner/providers/airalo/airaloFeedParser";
import { selectAiraloOffer } from "@/lib/affiliate/planner/providers/airalo/airaloSelector";
import {
  AIRALO_ALLOWED_HOSTS,
  AIRALO_TRAVELPAYOUTS_CAMPAIGN_ID,
  AIRALO_TRAVELPAYOUTS_PRODUCT_ID,
  type AiraloOfferRecord,
} from "@/lib/affiliate/planner/providers/airalo/airaloTypes";
import type {
  AffiliateOffer,
  AffiliateOfferBuild,
  AffiliateRoutingContext,
} from "@/lib/affiliate/planner/types";
import { createTravelpayoutsCommerceTarget } from "@/lib/affiliate/travelpayouts/commerceService";
import { TravelpayoutsError } from "@/lib/affiliate/travelpayouts/errors";
import { validateAffiliateSourceUrl } from "@/lib/affiliate/travelpayouts/urlPolicy";
import { createEmptyPlannerDraftInput } from "@/lib/planner/constants";
import type { PlannerPlan } from "@/lib/planner/planSchemas";

/**
 * Items copied from the Travelpayouts Airalo new feed (Airalo-Product-Catalog_GOOGLE.xml).
 * Field values are verbatim except the pxf.io path ids and intsrc, which are masked.
 */
function liveItem(p: {
  id: string;
  title: string;
  slug: string;
  price: string;
  salePrice?: string;
  saleEffective?: string;
  productType: string;
  brand: string;
}): string {
  const u = encodeURIComponent(`https://www.airalo.com/${p.slug}`);
  return `<item>
<g:id>${p.id}</g:id>
<g:title>${p.title}</g:title>
<g:link>https://airalo.pxf.io/c/1111111/2222222/33333?prodsku=${p.id}&amp;u=${u}&amp;intsrc=TEST_00000</g:link>
<g:description>Stay connected with an Airalo travel eSIM.</g:description>
<g:google_product_category>Electronics &gt; Communications &gt; Telephony &gt; Mobile Phone Accessories &gt; Mobile Phone Pre-Paid Cards &amp;amp; SIM Cards</g:google_product_category>
<g:image_link>https://cdn.airalo.com/images/test.png</g:image_link>
<g:condition>new</g:condition>
<g:availability>in stock</g:availability>
<g:price>${p.price}</g:price>
<g:product_type>${p.productType.replace(/>/g, "&gt;").replace(/&(?!gt;)/g, "&amp;")}</g:product_type>
<g:brand>${p.brand}</g:brand>
<g:mpn>esim-${p.slug.split("/")[1]}</g:mpn>
<g:sale_price>${p.salePrice ?? p.price}</g:sale_price>
${p.saleEffective ? `<g:sale_price_effective_date>${p.saleEffective}</g:sale_price_effective_date>` : ""}
<g:is_bundle>FALSE</g:is_bundle>
</item>`;
}

const JP_1GB_7D = liveItem({
  id: "8600",
  title: "1 GB Japan travel eSIM valid for 7 days",
  slug: "japan-esim/moshi-moshi-7days-1gb",
  price: "4.50 USD",
  productType: "esim > asia pacific > japan > data > 1 gb > 7 days",
  brand: "moshimoshi",
});
const JP_2GB_15D = liveItem({
  id: "8602",
  title: "2 GB Japan travel eSIM valid for 15 days",
  slug: "japan-esim/moshi-moshi-15days-2gb",
  price: "6.50 USD",
  productType: "esim > asia pacific > japan > data > 2 gb > 15 days",
  brand: "moshimoshi",
});
const JP_3GB_30D = liveItem({
  id: "8604",
  title: "3 GB Japan travel eSIM valid for 30 days",
  slug: "japan-esim/moshi-moshi-30days-3gb",
  price: "8.00 USD",
  productType: "esim > asia pacific > japan > data > 3 gb > 30 days",
  brand: "moshimoshi",
});
const JP_5GB_30D = liveItem({
  id: "8606",
  title: "5 GB Japan travel eSIM valid for 30 days",
  slug: "japan-esim/moshi-moshi-30days-5gb",
  price: "11.00 USD",
  productType: "esim > asia pacific > japan > data > 5 gb > 30 days",
  brand: "moshimoshi",
});
const JP_10GB_30D = liveItem({
  id: "8608",
  title: "10 GB Japan travel eSIM valid for 30 days",
  slug: "japan-esim/moshi-moshi-30days-10gb",
  price: "18.00 USD",
  productType: "esim > asia pacific > japan > data > 10 gb > 30 days",
  brand: "moshimoshi",
});
const KR_UNLIMITED_30D = liveItem({
  id: "2943",
  title: "Unlimited GB South Korea travel eSIM valid for 30 days",
  slug: "south-korea-esim/lgu-30-days-unlimited",
  price: "62.00 USD",
  productType: "esim > asia pacific > south korea > data > unlimited > 30 days",
  brand: "lgu",
});
const MV_DVT_20GB_10D = liveItem({
  id: "3446",
  title: "Maldives travel eSIM | 20 GB, 150 mins of local calls, 150 SMS valid for 10 days",
  slug: "maldives-esim/ooredoo-maldives-30days-20gb",
  price: "40.00 USD",
  productType: "esim > arabia & africa > maldives > data-voice-text > 20 gb > 10 days",
  brand: "ooredoo",
});
const ES_SALE_20GB_30D = liveItem({
  id: "4618",
  title: "20 GB Spain travel eSIM valid for 30 days",
  slug: "spain-esim/guay-mobile-30days-20gb",
  price: "26.00 USD",
  salePrice: "22.50 USD",
  saleEffective: "2025-08-13T00:00+0000/2025-09-05T23:59+0000",
  productType: "esim > europe & cis > spain > data > 20 gb > 30 days",
  brand: "guaymobile",
});

const JAPAN_ITEMS = [JP_1GB_7D, JP_2GB_15D, JP_3GB_30D, JP_5GB_30D, JP_10GB_30D];

function liveFeed(items: string[]): string {
  return `<?xml version="1.0" encoding="UTF-8"?>
<rss xmlns:g="http://base.google.com/ns/1.0" version="2.0">
<channel>
<title>Airalo Product Catalog</title>
<link>https://www.airalo.com</link>
<description>Airalo eSIM products</description>
${items.join("\n")}
</channel>
</rss>`;
}

const FULL_FIXTURE = liveFeed([...JAPAN_ITEMS, KR_UNLIMITED_30D, MV_DVT_20GB_10D, ES_SALE_20GB_30D]);

function gLink(id: string, slug: string): string {
  return `https://airalo.pxf.io/c/1111111/2222222/33333?prodsku=${id}&u=${encodeURIComponent(
    `https://www.airalo.com/${slug}`,
  )}&intsrc=TEST_00000`;
}

function parseRecords(xml = FULL_FIXTURE): AiraloOfferRecord[] {
  const result = parseAiraloFeedXml(xml);
  if (!result.ok) throw new Error(`fixture parse failed: ${result.errorCode}`);
  return result.records;
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

const PARTNER_LINK_RESULT = {
  affiliateUrl: "https://tp.media/r?marker=1&trs=1&p=8310&u=x&campaign_id=541&sub_id=tp_test",
  subId: "tp_aaaaaaaaaaaaaaaaaaaaaaaa",
  hostname: "airalo.pxf.io",
};

type PartnerLinkInput = { targetUrl: string; subId: string; allowedHosts?: string[] };

type PartnerLinkFn = (input: PartnerLinkInput) => Promise<typeof PARTNER_LINK_RESULT>;

function partnerLinkOk() {
  return vi.fn<PartnerLinkFn>(async () => PARTNER_LINK_RESULT);
}

function partnerLinkFails(error: TravelpayoutsError) {
  return vi.fn<PartnerLinkFn>(async () => {
    throw error;
  });
}

/** Real Commerce Core with only the Partner Links HTTP call mocked. */
function commerceWith(createPartnerLink: ReturnType<typeof partnerLinkOk>) {
  return vi.fn((input: Parameters<typeof createTravelpayoutsCommerceTarget>[0]) =>
    createTravelpayoutsCommerceTarget({
      ...input,
      createPartnerLink: createPartnerLink as never,
      createSubId: () => "tp_aaaaaaaaaaaaaaaaaaaaaaaa",
    }),
  );
}

describe("PR-9AP parser — live new feed shape", () => {
  it("parses every live item including data-voice-text, unlimited and sale effective dates", () => {
    const records = parseRecords();
    expect(records.map((r) => r.id)).toEqual([
      "8600",
      "8602",
      "8604",
      "8606",
      "8608",
      "2943",
      "3446",
      "4618",
    ]);
    for (const r of records) {
      expect(r.availability).toBe("in stock");
      expect(r.isBundle).toBe(false);
      expect(r.currency).toBe("USD");
    }
  });

  it("Japan data plans: data label + validity", () => {
    const jp = parseRecords().filter((r) => r.countryCode === "JP");
    expect(jp.map((r) => [r.dataLabel, r.validityDays])).toEqual([
      ["1GB", 7],
      ["2GB", 15],
      ["3GB", 30],
      ["5GB", 30],
      ["10GB", 30],
    ]);
  });

  it("South Korea unlimited → Unlimited / 30", () => {
    const kr = parseRecords().find((r) => r.id === "2943");
    expect(kr).toMatchObject({ countryCode: "KR", dataLabel: "Unlimited", validityDays: 30 });
  });

  it("Maldives data-voice-text → 20GB / 10 days", () => {
    const mv = parseRecords().find((r) => r.id === "3446");
    expect(mv).toMatchObject({ countryCode: "MV", dataLabel: "20GB", validityDays: 10 });
  });

  it("sale_price_effective_date is ignored safely (item kept, prices server-only)", () => {
    const es = parseRecords().find((r) => r.id === "4618");
    expect(es).toMatchObject({
      countryCode: "ES",
      price: 26,
      salePrice: 22.5,
      dataLabel: "20GB",
      validityDays: 30,
    });
    expect(es).not.toHaveProperty("salePriceEffectiveDate");
  });

  it("keeps g:link verbatim (decoded XML entities only) — u= is never unwrapped", () => {
    const jp = parseRecords().find((r) => r.id === "8600")!;
    expect(jp.sourceUrl).toBe(gLink("8600", "japan-esim/moshi-moshi-7days-1gb"));
    expect(new URL(jp.sourceUrl).hostname).toBe("airalo.pxf.io");
    expect(jp.sourceUrl.startsWith("https://www.airalo.com")).toBe(false);
  });

  it("one malformed item does not fail the catalog", () => {
    const broken = "<item><g:id>x</g:id><g:link>not a url</g:link></item>";
    const records = parseRecords(liveFeed([broken, JP_1GB_7D]));
    expect(records.map((r) => r.id)).toEqual(["8600"]);
  });
});

describe("PR-9AP source URL policy — airalo.pxf.io only", () => {
  const allowed = [...AIRALO_ALLOWED_HOSTS];
  const check = (url: string) => validateAffiliateSourceUrl(url, { allowedHosts: allowed });

  it("lists airalo.pxf.io exactly and never a generic pxf.io entry", () => {
    expect(allowed).toContain("airalo.pxf.io");
    expect(allowed).not.toContain("pxf.io");
    expect(allowed.some((h) => h.includes("*"))).toBe(false);
  });

  it("accepts the live g:link host", () => {
    expect(check(gLink("8600", "japan-esim/moshi-moshi-7days-1gb")).ok).toBe(true);
  });

  it.each([
    ["generic pxf.io subdomain", "https://foo.pxf.io/c/1/2/3?u=x"],
    ["bare pxf.io", "https://pxf.io/c/1/2/3?u=x"],
    ["http scheme", "http://airalo.pxf.io/c/1/2/3?u=x"],
    ["credentials trick", "https://airalo.pxf.io@evil.com/c/1/2/3"],
    ["suffix trick", "https://airalo.pxf.io.evil.com/c/1/2/3"],
    ["tracking host", "https://tp.media/r?marker=1&u=https%3A%2F%2Fwww.airalo.com"],
  ])("rejects %s", (_label, url) => {
    expect(check(url).ok).toBe(false);
  });
});

describe("PR-9AP selector — live Japan products", () => {
  const records = parseRecords();
  const pick = (tripDurationDays: number | null) => {
    const r = selectAiraloOffer({ records, countryCode: "JP", tripDurationDays });
    return r ? `${r.dataLabel}/${r.validityDays}` : null;
  };

  it("5-day trip → 1GB / 7 days", () => expect(pick(5)).toBe("1GB/7"));
  it("10-day trip → 2GB / 15 days", () => expect(pick(10)).toBe("2GB/15"));
  it("16-day trip → cheapest 30-day plan (3GB / 30)", () => expect(pick(16)).toBe("3GB/30"));
  it("no trip length → PR-9C cheapest-local order", () => expect(pick(null)).toBe("1GB/7"));

  it("is deterministic regardless of feed order", () => {
    const reversed = [...records].reverse();
    for (const days of [5, 10, 16, 31]) {
      expect(
        selectAiraloOffer({ records: reversed, countryCode: "JP", tripDurationDays: days })?.id,
      ).toBe(selectAiraloOffer({ records, countryCode: "JP", tripDurationDays: days })?.id);
    }
  });
});

describe("PR-9AP adapter + Commerce Core — g:link passed unchanged", () => {
  function adapterWith(createCommerceTarget: ReturnType<typeof commerceWith>, xml = FULL_FIXTURE) {
    const fetchImpl = vi.fn(async () => new Response(xml, { status: 200 }));
    return {
      fetchImpl,
      adapter: createAiraloAdapter({
        cache: createMemoryAiraloCatalogCache(),
        feedUrl: "https://example.com/airalo-feed.xml",
        fetchImpl: fetchImpl as never,
        createCommerceTarget: createCommerceTarget as never,
      }),
    };
  }

  it("parse → select → Commerce Core → Partner Links receives the original g:link", async () => {
    const createPartnerLink = partnerLinkOk();
    const commerce = commerceWith(createPartnerLink);
    const { adapter } = adapterWith(commerce);

    const offer = await adapter.buildOffer(ctx());

    const original = gLink("8600", "japan-esim/moshi-moshi-7days-1gb");
    expect(commerce).toHaveBeenCalledWith(
      expect.objectContaining({
        sourceUrl: original,
        providerId: "airalo",
        allowedHosts: expect.arrayContaining(["airalo.pxf.io"]),
        campaignId: AIRALO_TRAVELPAYOUTS_CAMPAIGN_ID,
      }),
    );
    expect(createPartnerLink).toHaveBeenCalledTimes(1);
    expect(createPartnerLink).toHaveBeenCalledWith(
      expect.objectContaining({
        targetUrl: original,
        subId: "tp_aaaaaaaaaaaaaaaaaaaaaaaa",
        allowedHosts: expect.arrayContaining(["airalo.pxf.io"]),
      }),
    );
    const partnerInput: Record<string, unknown> = { ...createPartnerLink.mock.calls[0]![0] };
    expect(partnerInput).not.toHaveProperty("campaignId");
    expect(partnerInput).not.toHaveProperty("p");

    expect(offer).toMatchObject({
      providerId: "airalo",
      title: "일본 여행용 eSIM",
      targetUrl: PARTNER_LINK_RESULT.affiliateUrl,
      sourceUrlHost: "airalo.pxf.io",
      affiliateCampaignId: "541",
      metadata: { esim: { dataLabel: "1GB", validityDays: 7 } },
    });
  });

  it("keeps the manual-template program ids as metadata only", () => {
    expect(AIRALO_TRAVELPAYOUTS_CAMPAIGN_ID).toBe("541");
    expect(AIRALO_TRAVELPAYOUTS_PRODUCT_ID).toBe("8310");
  });

  it("KR destination stays excluded even though the live feed sells South Korea plans", async () => {
    const createPartnerLink = partnerLinkOk();
    const commerce = commerceWith(createPartnerLink);
    const { adapter, fetchImpl } = adapterWith(commerce);
    const kr = ctx({ destination: { text: "서울", countryCode: "KR" } });

    expect(parseRecords().some((r) => r.countryCode === "KR")).toBe(true);
    expect(adapter.isEligible(kr)).toBe(false);
    expect(await adapter.buildOffer(kr)).toBeNull();
    expect(fetchImpl).not.toHaveBeenCalled();
    expect(commerce).not.toHaveBeenCalled();
  });

  it("Partner Links failure → no Airalo offer (fail-soft)", async () => {
    const createPartnerLink = partnerLinkFails(
      new TravelpayoutsError("provider_rejected", "Partner Links HTTP 400"),
    );
    const { adapter } = adapterWith(commerceWith(createPartnerLink));
    expect(await adapter.buildOffer(ctx())).toBeNull();
    expect(createPartnerLink).toHaveBeenCalledTimes(1);
  });
});

describe("PR-9AP integration — Planner offers with the live feed shape", () => {
  function plan(): PlannerPlan {
    return {
      title: "t",
      summary: "s",
      destination: { name: "오사카", country: "일본" },
      tripOverview: {
        startDate: "2026-10-01",
        endDate: "2026-10-10",
        nights: 9,
        days: 10,
        travelersSummary: "2",
        styleSummary: "균형",
      },
      days: [],
      preparation: { travelTips: [], packingHints: [] },
    };
  }

  function persistEcho() {
    return vi.fn(async ({ build }: { build: AffiliateOfferBuild }) =>
      ({
        offerId: `offer-${build.providerId}`,
        providerId: build.providerId,
        category: build.category,
        placement: build.placement,
        title: build.title,
        description: build.description,
        ctaLabel: build.ctaLabel,
        destinationLabel: build.destinationLabel,
        trackingToken: `token-${build.providerId}`,
        ...(build.metadata?.esim ? { metadata: { esim: build.metadata.esim } } : {}),
      }) satisfies AffiliateOffer,
    );
  }

  async function run(createPartnerLink: ReturnType<typeof partnerLinkOk>) {
    const input = createEmptyPlannerDraftInput("오사카");
    input.dates = { mode: "flexible", startDate: null, endDate: null, durationDays: 10 };
    const persist = persistEcho();
    const dto = await buildAffiliateOffersForSession({
      sessionId: "550e8400-e29b-41d4-a716-446655440000",
      plan: plan(),
      input,
      sourceProductId: null,
      deps: {
        providers: [
          createFakeAffiliateDefinition({
            id: "airalo",
            categories: ["esim"],
            supportedPlacements: ["preparation"],
            network: "travelpayouts",
          }),
          createFakeAffiliateDefinition({
            id: "stay22",
            categories: ["hotel"],
            supportedPlacements: ["planner_summary"],
          }),
        ],
        adapters: new Map([
          [
            "airalo",
            createAiraloAdapter({
              cache: createMemoryAiraloCatalogCache(),
              feedUrl: "https://example.com/airalo-feed.xml",
              fetchImpl: (async () => new Response(FULL_FIXTURE, { status: 200 })) as never,
              createCommerceTarget: commerceWith(createPartnerLink) as never,
            }),
          ],
          ["stay22", createFakeAffiliateAdapter({ providerId: "stay22" })],
        ]),
        persist: persist as never,
        resolveDestination: async () => ({ text: "오사카", countryCode: "JP" }),
      },
    });
    return { dto, persist };
  }

  it("10-day trip → one eSIM card on the 2GB / 15-day plan; hotel unaffected", async () => {
    const createPartnerLink = partnerLinkOk();
    const { dto } = await run(createPartnerLink);

    expect(dto.preparation).toHaveLength(1);
    expect(dto.preparation[0]).toMatchObject({
      providerId: "airalo",
      category: "esim",
      title: "일본 여행용 eSIM",
      metadata: { esim: { dataLabel: "2GB", validityDays: 15 } },
    });
    expect(createPartnerLink.mock.calls[0]![0]).toMatchObject({
      targetUrl: gLink("8602", "japan-esim/moshi-moshi-15days-2gb"),
    });
    expect(dto.summary.map((o) => o.providerId)).toEqual(["stay22"]);
    expect(JSON.stringify(dto)).not.toMatch(/pxf\.io|tp\.media|USD/);
  });

  it("Partner Links failure → no eSIM card; Planner offers still build", async () => {
    const createPartnerLink = partnerLinkFails(
      new TravelpayoutsError("invalid_response", "Missing partner_url"),
    );
    const { dto } = await run(createPartnerLink);
    expect(dto.preparation).toEqual([]);
    expect(dto.summary.map((o) => o.providerId)).toEqual(["stay22"]);
  });
});
