import { beforeEach, describe, expect, it, vi } from "vitest";

const insertedRows = vi.hoisted(() => [] as Array<Record<string, unknown>>);

vi.mock("@/lib/supabaseAdmin", () => ({
  supabaseAdmin: {
    from: () => ({
      insert: (row: Record<string, unknown>) => {
        insertedRows.push(row);
        return {
          select: () => ({
            single: async () => ({
              data: {
                id: `00000000-0000-4000-8000-00000000000${insertedRows.length}`,
                provider_id: row.provider_id,
                category: row.category,
                placement: row.placement,
                title: row.title,
                description: row.description,
                cta_label: row.cta_label,
                destination: row.destination,
                day_number: row.day_number,
                item_order: row.item_order,
              },
              error: null,
            }),
          }),
        };
      },
    }),
  },
}));

import { buildAffiliateOffersForSession } from "@/lib/affiliate/planner/buildOffersForSession";
import { createFakeAffiliateDefinition } from "@/lib/affiliate/planner/__tests__/fixtures";
import { persistAffiliateOfferToken } from "@/lib/affiliate/planner/offerRepository";
import {
  formatAffiliateEsimMetadataLine,
  sanitizeAffiliateEsimMetadata,
} from "@/lib/affiliate/planner/offerMetadata";
import { createAiraloAdapter } from "@/lib/affiliate/planner/providers/airalo/airaloAdapter";
import { createMemoryAiraloCatalogCache } from "@/lib/affiliate/planner/providers/airalo/airaloCatalogCache";
import type { AffiliateOfferBuild } from "@/lib/affiliate/planner/types";
import { createEmptyPlannerDraftInput } from "@/lib/planner/constants";
import type { PlannerPlan } from "@/lib/planner/planSchemas";

const FEED = `<?xml version="1.0"?><rss xmlns:g="http://base.google.com/ns/1.0"><channel>
<item>
  <g:id>jp-30</g:id><g:title>JP 10GB 30 Days</g:title>
  <g:link>https://www.airalo.com/japan-esim/jp-30</g:link>
  <g:price>26.00 USD</g:price><g:sale_price>20.00 USD</g:sale_price>
  <g:availability>in stock</g:availability>
  <g:product_type>esim &gt; Asia &gt; Japan &gt; Data &gt; 10GB &gt; 30 Days</g:product_type>
  <g:is_bundle>false</g:is_bundle>
</item></channel></rss>`;

const SESSION_ID = "550e8400-e29b-41d4-a716-446655440000";

function plan(): PlannerPlan {
  return {
    title: "t",
    summary: "s",
    destination: { name: "오사카", country: "일본" },
    tripOverview: {
      startDate: "2026-10-01",
      endDate: "2026-10-05",
      nights: 4,
      days: 5,
      travelersSummary: "2",
      styleSummary: "균형",
    },
    days: [],
    preparation: { travelTips: [], packingHints: [] },
  };
}

function build(overrides: Partial<AffiliateOfferBuild> = {}): AffiliateOfferBuild {
  return {
    providerId: "airalo",
    category: "esim",
    placement: "preparation",
    title: "일본 여행용 eSIM",
    description: null,
    ctaLabel: "여행용 eSIM 보기",
    destinationLabel: "오사카",
    targetUrl: "https://tp.media/r?a=1",
    ...overrides,
  };
}

beforeEach(() => {
  insertedRows.length = 0;
});

describe("PR-9AO esim metadata — build → persist → client DTO", () => {
  it("Airalo build metadata survives persist into the client offer (no DB column)", async () => {
    const airalo = createAiraloAdapter({
      cache: createMemoryAiraloCatalogCache(),
      feedUrl: "https://example.com/feed.xml",
      fetchImpl: (async () => new Response(FEED, { status: 200 })) as never,
      createCommerceTarget: async () => ({
        affiliateUrl: "https://tp.media/r?a=1",
        providerSubId: "tp_dddddddddddddddddddddddd",
        affiliateNetwork: "travelpayouts",
        campaignId: "541",
        sourceUrlHost: "www.airalo.com",
      }),
    });

    const dto = await buildAffiliateOffersForSession({
      sessionId: SESSION_ID,
      plan: plan(),
      input: createEmptyPlannerDraftInput("오사카"),
      sourceProductId: null,
      deps: {
        providers: [
          createFakeAffiliateDefinition({
            id: "airalo",
            categories: ["esim"],
            supportedPlacements: ["preparation"],
            enabled: true,
            network: "travelpayouts",
          }),
        ],
        adapters: new Map([["airalo", airalo]]),
        resolveDestination: async () => ({ text: "오사카", countryCode: "JP" }),
      },
    });

    expect(dto.preparation).toHaveLength(1);
    const offer = dto.preparation[0]!;
    expect(offer.title).toBe("일본 여행용 eSIM");
    expect(offer.metadata).toEqual({ esim: { dataLabel: "10GB", validityDays: 30 } });
    expect(JSON.stringify(offer)).not.toMatch(/price|currency|USD|targetUrl|tp\.media/i);

    expect(insertedRows).toHaveLength(1);
    expect(insertedRows[0]).not.toHaveProperty("metadata");
    expect(insertedRows[0]).toMatchObject({
      provider_id: "airalo",
      affiliate_campaign_id: "541",
      source_url_host: "www.airalo.com",
      target_url: "https://tp.media/r?a=1",
    });
  });

  it("keeps dayNumber/itemOrder metadata for day offers and adds no esim key", async () => {
    const offer = await persistAffiliateOfferToken({
      sessionId: SESSION_ID,
      build: build({
        providerId: "klook",
        category: "activity",
        placement: "day_item",
        dayNumber: 2,
        itemOrder: 3,
      }),
      destination: "오사카",
      sourceProductId: null,
    });
    expect(offer?.metadata).toEqual({ dayNumber: 2, itemOrder: 3 });
  });

  it("offers without day or esim metadata keep metadata undefined", async () => {
    const offer = await persistAffiliateOfferToken({
      sessionId: SESSION_ID,
      build: build({ providerId: "aviasales", category: "flight", placement: "planner_summary" }),
      destination: "오사카",
      sourceProductId: null,
    });
    expect(offer?.metadata).toBeUndefined();
  });

  it("drops unsafe or malformed esim values before they reach the client", async () => {
    const offer = await persistAffiliateOfferToken({
      sessionId: SESSION_ID,
      build: build({
        metadata: { esim: { dataLabel: "<img src=x>", validityDays: 30.5 } },
      }),
      destination: "오사카",
      sourceProductId: null,
    });
    expect(offer?.metadata).toBeUndefined();

    expect(sanitizeAffiliateEsimMetadata({ dataLabel: "3GB", validityDays: 0 })).toEqual({
      dataLabel: "3GB",
      validityDays: null,
    });
    expect(sanitizeAffiliateEsimMetadata({ dataLabel: "Unlimited", validityDays: 15 })).toEqual({
      dataLabel: "Unlimited",
      validityDays: 15,
    });
  });

  it("formats the card line", () => {
    expect(formatAffiliateEsimMetadataLine({ dataLabel: "10GB", validityDays: 30 })).toBe(
      "10GB · 30일",
    );
    expect(formatAffiliateEsimMetadataLine({ dataLabel: "10GB", validityDays: null })).toBe("10GB");
    expect(formatAffiliateEsimMetadataLine({ dataLabel: null, validityDays: 30 })).toBe("30일");
    expect(formatAffiliateEsimMetadataLine({ dataLabel: "Unlimited", validityDays: 7 })).toBe(
      "무제한 · 7일",
    );
    expect(formatAffiliateEsimMetadataLine(null)).toBeNull();
    expect(formatAffiliateEsimMetadataLine({ dataLabel: null, validityDays: null })).toBeNull();
  });
});
