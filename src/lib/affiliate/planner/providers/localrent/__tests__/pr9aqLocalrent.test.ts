import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/affiliate/planner/offerRepository", () => ({
  persistAffiliateOfferToken: vi.fn(),
}));

import { buildAffiliateOffersForSession } from "@/lib/affiliate/planner/buildOffersForSession";
import {
  createFakeAffiliateAdapter,
  createFakeAffiliateDefinition,
} from "@/lib/affiliate/planner/__tests__/fixtures";
import {
  applyAffiliateProviderEnvOverrides,
  PLANNER_AFFILIATE_PROVIDER_CATALOG,
  PLANNER_AFFILIATE_PROVIDER_ENV_KEYS,
} from "@/lib/affiliate/planner/providerConfig";
import {
  createLocalrentAdapter,
  isLocalrentEligible,
  LOCALRENT_RENTAL_CAR_DESCRIPTION,
} from "@/lib/affiliate/planner/providers/localrent/localrentAdapter";
import { buildLocalrentDeepLink } from "@/lib/affiliate/planner/providers/localrent/localrentDeepLink";
import { resolveLocalrentDestination } from "@/lib/affiliate/planner/providers/localrent/localrentDestinationResolver";
import {
  LOCALRENT_ALLOWED_HOSTS,
  LOCALRENT_DESTINATIONS,
  LOCALRENT_TRAVELPAYOUTS_CAMPAIGN_ID,
  LOCALRENT_TRAVELPAYOUTS_PRODUCT_ID,
  type LocalrentDestination,
} from "@/lib/affiliate/planner/providers/localrent/localrentDestinations";
import { getProductionAffiliateAdapters } from "@/lib/affiliate/planner/registry";
import type {
  AffiliateOffer,
  AffiliateOfferBuild,
  AffiliateRoutingContext,
} from "@/lib/affiliate/planner/types";
import { createTravelpayoutsCommerceTarget } from "@/lib/affiliate/travelpayouts/commerceService";
import { TravelpayoutsError } from "@/lib/affiliate/travelpayouts/errors";
import { createEmptyPlannerDraftInput } from "@/lib/planner/constants";
import type { PlannerPlan } from "@/lib/planner/planSchemas";

function destination(citySlug: string): LocalrentDestination {
  const found = LOCALRENT_DESTINATIONS.find((d) => d.citySlug === citySlug);
  if (!found) throw new Error(`missing verified destination ${citySlug}`);
  return found;
}

const ROME = destination("rome");

function ctx(overrides?: Partial<AffiliateRoutingContext>): AffiliateRoutingContext {
  return {
    plannerSessionId: "550e8400-e29b-41d4-a716-446655440000",
    destination: { text: "로마", countryCode: "IT" },
    dates: { mode: "fixed", startDate: "2026-12-10", endDate: "2026-12-14", durationDays: 5 },
    travelers: { adults: 2, children: 0 },
    companionType: "couple",
    interests: [],
    pace: "balanced",
    placement: "preparation",
    category: "rental_car",
    sourceProductId: null,
    ...overrides,
  };
}

const PARTNER_LINK_RESULT = {
  affiliateUrl: "https://tp.media/r?marker=1&trs=1&p=2043&u=x&campaign_id=87&sub_id=tp_test",
  subId: "tp_aaaaaaaaaaaaaaaaaaaaaaaa",
  hostname: "www.localrent.com",
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

afterEach(() => {
  vi.restoreAllMocks();
});

describe("PR-9AQ Localrent deep link", () => {
  const build = (pickupDate: string | null, dropoffDate: string | null, dest = ROME) =>
    buildLocalrentDeepLink({ destination: dest, pickupDate, dropoffDate });

  it("verified destination → https://www.localrent.com/ko/<countrySlug>/", () => {
    const url = new URL(build("2026-12-10", "2026-12-14")!);
    expect(url.protocol).toBe("https:");
    expect(url.host).toBe("www.localrent.com");
    expect(url.pathname).toBe("/ko/italy/");
  });

  it("fixes currency=KRW and preserves dates, slugs and city ids", () => {
    const url = new URL(build("2026-12-10", "2026-12-14")!);
    expect(Object.fromEntries(url.searchParams)).toEqual({
      pickup_date: "2026-12-10",
      dropoff_date: "2026-12-14",
      pc: "rome",
      dc: "rome",
      pickup_city_id: "54441",
      dropoff_city_id: "54441",
      currency: "KRW",
    });
  });

  it("keeps underscore slugs verbatim (Chiang Mai)", () => {
    const url = new URL(build("2026-12-10", "2026-12-14", destination("chiang_mai"))!);
    expect(url.pathname).toBe("/ko/thailand/");
    expect(url.searchParams.get("pc")).toBe("chiang_mai");
    expect(url.searchParams.get("pickup_city_id")).toBe("84061");
  });

  it("missing or invalid city id → no link", () => {
    expect(build("2026-12-10", "2026-12-14", { ...ROME, cityId: 0 })).toBeNull();
    expect(build("2026-12-10", "2026-12-14", { ...ROME, cityId: Number.NaN })).toBeNull();
  });

  it.each([
    ["missing pickup", null, "2026-12-14"],
    ["missing dropoff", "2026-12-10", null],
    ["not a date", "next week", "2026-12-14"],
    ["impossible calendar date", "2026-02-31", "2026-03-02"],
    ["same start/end", "2026-12-10", "2026-12-10"],
    ["end before start", "2026-12-14", "2026-12-10"],
  ])("%s → null", (_label, pickup, dropoff) => {
    expect(build(pickup, dropoff)).toBeNull();
  });
});

describe("PR-9AQ Localrent destination resolver", () => {
  const resolve = (text: string, countryCode: string | null) =>
    resolveLocalrentDestination({ text, countryCode });

  it("Korean alias → verified city", () => {
    expect(resolve("로마", "IT")).toEqual({ ok: true, destination: ROME });
    expect(resolve("바르셀로나", "ES")).toMatchObject({ ok: true, destination: { cityId: 60691 } });
  });

  it("English alias → verified city", () => {
    expect(resolve("Florence", "IT")).toMatchObject({ ok: true, destination: { cityId: 120371 } });
    expect(resolve("Paris", "FR")).toMatchObject({ ok: true, destination: { cityId: 53741 } });
  });

  it("normalizes case and spacing only", () => {
    expect(resolve("  chiang   MAI ", "TH")).toMatchObject({ ok: true, destination: { cityId: 84061 } });
    expect(resolve("치앙 마이", "TH")).toMatchObject({ ok: true, destination: { cityId: 84061 } });
    expect(resolve("방 콕", "TH")).toMatchObject({ ok: true, destination: { cityId: 62861 } });
  });

  it("unsupported city or country → unsupported_destination (no country-level fallback)", () => {
    expect(resolve("도쿄", "JP")).toEqual({ ok: false, reason: "unsupported_destination" });
    expect(resolve("오키나와", "JP")).toEqual({ ok: false, reason: "unsupported_destination" });
    expect(resolve("괌", "GU")).toEqual({ ok: false, reason: "unsupported_destination" });
    expect(resolve("로스앤젤레스", "US")).toEqual({ ok: false, reason: "unsupported_destination" });
    expect(resolve("베네치아", "IT")).toEqual({ ok: false, reason: "unsupported_destination" });
    expect(resolve("이탈리아", "IT")).toEqual({ ok: false, reason: "unsupported_destination" });
    expect(resolve("로마·피렌체", "IT")).toEqual({ ok: false, reason: "unsupported_destination" });
  });

  it("alias in another country never matches (Paris, Texas is not Paris, France)", () => {
    expect(resolve("Paris", "US")).toEqual({ ok: false, reason: "unsupported_destination" });
  });

  it("Phuket (several Localrent pickup locations) → ambiguous_destination", () => {
    expect(resolve("푸켓", "TH")).toEqual({ ok: false, reason: "ambiguous_destination" });
    expect(resolve("Phuket", "TH")).toEqual({ ok: false, reason: "ambiguous_destination" });
  });

  it("alias shared by two verified cities → ambiguous_destination", () => {
    const duplicate = { ...ROME, citySlug: "rome_alt", cityId: 1 };
    expect(
      resolveLocalrentDestination(
        { text: "로마", countryCode: "IT" },
        { destinations: [ROME, duplicate] },
      ),
    ).toEqual({ ok: false, reason: "ambiguous_destination" });
  });

  it("KR destination excluded; unknown country → no match", () => {
    expect(resolve("제주", "KR")).toEqual({ ok: false, reason: "country_excluded" });
    expect(resolve("로마", null)).toEqual({ ok: false, reason: "country_unknown" });
  });

  it("SSOT holds only ISO alpha-2, positive city ids and Korean labels", () => {
    for (const d of LOCALRENT_DESTINATIONS) {
      expect(d.countryCode).toMatch(/^[A-Z]{2}$/);
      expect(d.countryCode).not.toBe("KR");
      expect(Number.isInteger(d.cityId) && d.cityId > 0).toBe(true);
      expect(d.aliases).toContain(d.labelKo);
    }
  });
});

describe("PR-9AQ Localrent adapter", () => {
  function adapterWith(createPartnerLink = partnerLinkOk()) {
    const commerce = commerceWith(createPartnerLink);
    return {
      adapter: createLocalrentAdapter({ createCommerceTarget: commerce as never }),
      commerce,
      createPartnerLink,
    };
  }

  it("builds one rental_car offer through Commerce Core with the Korean/KRW deep link", async () => {
    const { adapter, commerce, createPartnerLink } = adapterWith();
    const offer = await adapter.buildOffer(ctx());

    expect(commerce).toHaveBeenCalledTimes(1);
    const input = commerce.mock.calls[0]![0];
    expect(input.providerId).toBe("localrent");
    expect(input.allowedHosts).toEqual(["www.localrent.com", "localrent.com"]);

    const source = new URL(input.sourceUrl);
    expect(source.host).toBe("www.localrent.com");
    expect(source.pathname).toBe("/ko/italy/");
    expect(source.searchParams.get("currency")).toBe("KRW");
    expect(source.searchParams.get("pickup_date")).toBe("2026-12-10");
    expect(source.searchParams.get("dropoff_date")).toBe("2026-12-14");
    expect(source.searchParams.get("pickup_city_id")).toBe("54441");
    expect(source.searchParams.get("dropoff_city_id")).toBe("54441");

    expect(createPartnerLink).toHaveBeenCalledTimes(1);
    expect(createPartnerLink.mock.calls[0]![0]).toEqual({
      targetUrl: input.sourceUrl,
      subId: "tp_aaaaaaaaaaaaaaaaaaaaaaaa",
      allowedHosts: ["www.localrent.com", "localrent.com"],
    });

    expect(offer).toEqual({
      providerId: "localrent",
      category: "rental_car",
      placement: "preparation",
      title: "로마 렌터카",
      description: LOCALRENT_RENTAL_CAR_DESCRIPTION,
      ctaLabel: "렌터카 보기",
      destinationLabel: "로마",
      targetUrl: PARTNER_LINK_RESULT.affiliateUrl,
      providerSubId: "tp_aaaaaaaaaaaaaaaaaaaaaaaa",
      affiliateNetwork: "travelpayouts",
      affiliateCampaignId: "87",
      sourceUrlHost: "www.localrent.com",
    });
  });

  it("Partner Links input carries no campaign/product ids (Travelpayouts attributes from the URL)", async () => {
    const { adapter, createPartnerLink } = adapterWith();
    await adapter.buildOffer(ctx());
    const plInput = createPartnerLink.mock.calls[0]![0];
    expect(Object.keys(plInput).sort()).toEqual(["allowedHosts", "subId", "targetUrl"]);
    const target = new URL(plInput.targetUrl);
    for (const key of ["campaign_id", "p", "promo_id", "marker", "trs", "trace_id"]) {
      expect(target.searchParams.has(key)).toBe(false);
    }
    expect(LOCALRENT_TRAVELPAYOUTS_CAMPAIGN_ID).toBe("87");
    expect(LOCALRENT_TRAVELPAYOUTS_PRODUCT_ID).toBe("2043");
    expect([...LOCALRENT_ALLOWED_HOSTS]).toEqual(["www.localrent.com", "localrent.com"]);
  });

  it("copy has no price or best-price claims", async () => {
    const { adapter } = adapterWith();
    const offer = await adapter.buildOffer(ctx());
    const text = `${offer!.title} ${offer!.description} ${offer!.ctaLabel}`;
    expect(text).not.toMatch(/최저가|가장 저렴|최적의 가격|추천 차량|가격 비교|₩|원|KRW/);
  });

  it.each([
    ["flexible trip", { dates: { mode: "flexible", startDate: null, endDate: null, durationDays: 5 } }],
    ["missing end date", { dates: { mode: "fixed", startDate: "2026-12-10", endDate: null, durationDays: 5 } }],
    ["KR trip", { destination: { text: "제주", countryCode: "KR" } }],
    ["unknown country", { destination: { text: "로마", countryCode: null } }],
    ["other category", { category: "hotel" }],
    ["other placement", { placement: "planner_summary" }],
  ] as const)("ineligible: %s → no commerce call", async (_label, overrides) => {
    const { adapter, commerce } = adapterWith();
    const context = ctx(overrides as Partial<AffiliateRoutingContext>);
    expect(isLocalrentEligible(context)).toBe(false);
    expect(await adapter.buildOffer(context)).toBeNull();
    expect(commerce).not.toHaveBeenCalled();
  });

  it.each([
    ["unsupported city", { destination: { text: "도쿄", countryCode: "JP" } }, "unsupported_destination"],
    ["ambiguous city", { destination: { text: "푸켓", countryCode: "TH" } }, "ambiguous_destination"],
    [
      "same-day trip",
      { dates: { mode: "fixed", startDate: "2026-12-10", endDate: "2026-12-10", durationDays: 1 } },
      "invalid_dates",
    ],
    [
      "end before start",
      { dates: { mode: "fixed", startDate: "2026-12-14", endDate: "2026-12-10", durationDays: 5 } },
      "invalid_dates",
    ],
  ] as const)("%s → null with a structured reason only", async (_label, overrides, reason) => {
    const info = vi.spyOn(console, "info").mockImplementation(() => {});
    const { adapter, commerce } = adapterWith();
    expect(await adapter.buildOffer(ctx(overrides as Partial<AffiliateRoutingContext>))).toBeNull();
    expect(commerce).not.toHaveBeenCalled();
    expect(info).toHaveBeenCalledWith("[localrent] offer_skipped", {
      providerId: "localrent",
      errorCode: reason,
    });
    expect(JSON.stringify(info.mock.calls)).not.toMatch(/도쿄|푸켓/);
  });

  it("Commerce failure → null (fail-soft)", async () => {
    vi.spyOn(console, "info").mockImplementation(() => {});
    const createPartnerLink = partnerLinkFails(
      new TravelpayoutsError("provider_rejected", "Partner Links HTTP 400"),
    );
    const { adapter } = adapterWith(createPartnerLink);
    expect(await adapter.buildOffer(ctx())).toBeNull();
    expect(createPartnerLink).toHaveBeenCalledTimes(1);
  });
});

describe("PR-9AQ Localrent config + registry", () => {
  it("catalog: rental_car / preparation / fixed dates, off by default", () => {
    const def = PLANNER_AFFILIATE_PROVIDER_CATALOG.find((d) => d.id === "localrent");
    expect(def).toMatchObject({
      categories: ["rental_car"],
      enabled: false,
      supportedDateModes: ["fixed"],
      supportedPlacements: ["preparation"],
      network: "travelpayouts",
      capabilities: { deepLink: true, search: false, api: false, widget: false },
    });
    expect(PLANNER_AFFILIATE_PROVIDER_CATALOG.filter((d) => d.categories.includes("rental_car"))).toHaveLength(1);
  });

  it("ENABLE_PLANNER_AFFILIATE_LOCALRENT toggles the provider", () => {
    expect(PLANNER_AFFILIATE_PROVIDER_ENV_KEYS.localrent).toBe("ENABLE_PLANNER_AFFILIATE_LOCALRENT");
    const enabled = (env: Record<string, string | undefined>) =>
      applyAffiliateProviderEnvOverrides(PLANNER_AFFILIATE_PROVIDER_CATALOG, env).find(
        (d) => d.id === "localrent",
      )!.enabled;
    expect(enabled({})).toBe(false);
    expect(enabled({ ENABLE_PLANNER_AFFILIATE_LOCALRENT: "true" })).toBe(true);
    expect(enabled({ ENABLE_PLANNER_AFFILIATE_LOCALRENT: "maybe" })).toBe(false);
  });

  it("production registry wires the Localrent adapter", () => {
    expect(getProductionAffiliateAdapters().get("localrent")?.providerId).toBe("localrent");
  });
});

describe("PR-9AQ integration — Planner offers", () => {
  const SESSION = "550e8400-e29b-41d4-a716-446655440000";

  function plan(params: { name: string; country: string; start: string | null; end: string | null }): PlannerPlan {
    return {
      title: "t",
      summary: "s",
      destination: { name: params.name, country: params.country },
      tripOverview: {
        startDate: params.start,
        endDate: params.end,
        nights: 4,
        days: 5,
        travelersSummary: "2",
        styleSummary: "균형",
      },
      days: [
        {
          day: 1,
          items: [{ order: 1, type: "attraction", name: "콜로세움", bookingRecommended: true }],
        },
      ],
      preparation: { travelTips: [], packingHints: [] },
    } as unknown as PlannerPlan;
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
      }) satisfies AffiliateOffer,
    );
  }

  const DISCOVERY = { tiqets: null, klook: null };

  async function run(params: {
    text: string;
    countryCode: string;
    country: string;
    fixed: boolean;
    createPartnerLink?: ReturnType<typeof partnerLinkOk>;
  }) {
    const input = createEmptyPlannerDraftInput(params.text);
    input.dates = params.fixed
      ? { mode: "fixed", startDate: "2026-12-10", endDate: "2026-12-14", durationDays: 5 }
      : { mode: "flexible", startDate: null, endDate: null, durationDays: 5 };
    const createPartnerLink = params.createPartnerLink ?? partnerLinkOk();
    const persist = persistEcho();
    const dto = await buildAffiliateOffersForSession({
      sessionId: SESSION,
      plan: plan({
        name: params.text,
        country: params.country,
        start: params.fixed ? "2026-12-10" : null,
        end: params.fixed ? "2026-12-14" : null,
      }),
      input,
      sourceProductId: null,
      deps: {
        providers: [
          createFakeAffiliateDefinition({ id: "aviasales", categories: ["flight"], supportedPlacements: ["planner_summary"] }),
          createFakeAffiliateDefinition({ id: "stay22", categories: ["hotel"], supportedPlacements: ["planner_summary"] }),
          createFakeAffiliateDefinition({ id: "airalo", categories: ["esim"], supportedPlacements: ["preparation"] }),
          createFakeAffiliateDefinition({ id: "klook", categories: ["activity"], supportedPlacements: ["day_item"], priority: 60 }),
          createFakeAffiliateDefinition({ id: "kkday", categories: ["activity"], supportedPlacements: ["day_item"], priority: 55 }),
          {
            ...PLANNER_AFFILIATE_PROVIDER_CATALOG.find((d) => d.id === "localrent")!,
            enabled: true,
          },
        ],
        adapters: new Map([
          ["aviasales", createFakeAffiliateAdapter({ providerId: "aviasales" })],
          ["stay22", createFakeAffiliateAdapter({ providerId: "stay22" })],
          ["airalo", createFakeAffiliateAdapter({ providerId: "airalo" })],
          ["klook", createFakeAffiliateAdapter({ providerId: "klook" })],
          ["kkday", createFakeAffiliateAdapter({ providerId: "kkday" })],
          ["localrent", createLocalrentAdapter({ createCommerceTarget: commerceWith(createPartnerLink) as never })],
        ]),
        persist: persist as never,
        resolveDestination: async () => ({ text: params.text, countryCode: params.countryCode }),
        buildDiscovery: async () => DISCOVERY as never,
      },
    });
    return { dto, createPartnerLink };
  }

  const others = (dto: Awaited<ReturnType<typeof run>>["dto"]) => ({
    summary: dto.summary.map((o) => o.providerId),
    preparation: dto.preparation.filter((o) => o.providerId !== "localrent").map((o) => o.providerId),
    days: Object.values(dto.days).flat().map((o) => o.providerId),
    discovery: dto.activityDiscovery,
  });

  const OTHERS_FIXED = {
    summary: ["aviasales", "stay22"],
    preparation: ["airalo"],
    days: ["klook"],
    discovery: DISCOVERY,
  };

  it("supported city + fixed dates → exactly one Localrent card; other providers unchanged", async () => {
    vi.spyOn(console, "info").mockImplementation(() => {});
    const { dto, createPartnerLink } = await run({ text: "로마", countryCode: "IT", country: "이탈리아", fixed: true });

    const localrent = dto.preparation.filter((o) => o.providerId === "localrent");
    expect(localrent).toHaveLength(1);
    expect(localrent[0]).toMatchObject({
      category: "rental_car",
      placement: "preparation",
      title: "로마 렌터카",
      ctaLabel: "렌터카 보기",
      trackingToken: "token-localrent",
    });
    expect(createPartnerLink).toHaveBeenCalledTimes(1);
    expect(others(dto)).toEqual(OTHERS_FIXED);
    expect(JSON.stringify(dto)).not.toMatch(/localrent\.com|tp\.media|currency|KRW/);
  });

  it.each([
    ["unsupported destination", { text: "도쿄", countryCode: "JP", country: "일본", fixed: true }],
    ["KR trip", { text: "제주", countryCode: "KR", country: "대한민국", fixed: true }],
  ])("%s → no Localrent card; other providers unchanged", async (_label, params) => {
    vi.spyOn(console, "info").mockImplementation(() => {});
    const { dto, createPartnerLink } = await run(params);
    expect(dto.preparation.some((o) => o.providerId === "localrent")).toBe(false);
    expect(createPartnerLink).not.toHaveBeenCalled();
    expect(others(dto)).toEqual(OTHERS_FIXED);
  });

  it("no dates (flexible trip) → no Localrent card", async () => {
    const { dto, createPartnerLink } = await run({ text: "로마", countryCode: "IT", country: "이탈리아", fixed: false });
    expect(dto.preparation.some((o) => o.providerId === "localrent")).toBe(false);
    expect(createPartnerLink).not.toHaveBeenCalled();
    expect(dto.preparation.map((o) => o.providerId)).toEqual(["airalo"]);
  });

  it("Partner Links failure → no Localrent card; other providers unchanged", async () => {
    vi.spyOn(console, "info").mockImplementation(() => {});
    const { dto } = await run({
      text: "로마",
      countryCode: "IT",
      country: "이탈리아",
      fixed: true,
      createPartnerLink: partnerLinkFails(new TravelpayoutsError("network_failed", "reset")),
    });
    expect(dto.preparation.some((o) => o.providerId === "localrent")).toBe(false);
    expect(others(dto)).toEqual(OTHERS_FIXED);
  });
});
