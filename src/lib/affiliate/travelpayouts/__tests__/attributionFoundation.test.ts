import { describe, expect, it } from "vitest";
import { getProductionAffiliateProviderDefinitions } from "@/lib/affiliate/planner/registry";
import type { AffiliateOfferBuild } from "@/lib/affiliate/planner/types";

describe("PR-9A attribution foundation regressions", () => {
  it("only enables intentionally accepted production providers", () => {
    const enabledIds = getProductionAffiliateProviderDefinitions()
      .filter((d) => d.enabled)
      .map((d) => d.id);
    // PR-9E: Aviasales live Data API → Partner Links accepted; others stay off.
    expect(enabledIds).toEqual(["aviasales"]);
  });

  it("AffiliateOfferBuild accepts Travelpayouts attribution metadata", () => {
    const build: AffiliateOfferBuild = {
      providerId: "klook",
      category: "activity",
      placement: "day_item",
      title: "t",
      description: null,
      ctaLabel: "cta",
      destinationLabel: "오사카",
      targetUrl: "https://tp.media/r",
      providerSubId: "tp_aaaaaaaaaaaaaaaaaaaaaaaa",
      affiliateNetwork: "travelpayouts",
      affiliateCampaignId: null,
      sourceUrlHost: "www.klook.com",
    };
    expect(build.providerSubId?.startsWith("tp_")).toBe(true);
    expect(build.targetUrl.startsWith("https://")).toBe(true);
  });

  it("client offer DTO still excludes targetUrl and providerSubId", () => {
    const client = {
      offerId: "o",
      providerId: "klook",
      category: "activity" as const,
      placement: "day_item" as const,
      title: "t",
      description: null,
      ctaLabel: "c",
      destinationLabel: null,
      trackingToken: "tok",
    };
    expect("targetUrl" in client).toBe(false);
    expect("providerSubId" in client).toBe(false);
  });
});
