import { describe, expect, it, vi } from "vitest";
import { createKlookAdapter } from "@/lib/affiliate/planner/providers/klook/klookAdapter";
import {
  KLOOK_ACTIVITY_SOURCE_URLS,
  KLOOK_ALLOWED_HOSTS,
  klookSourceUrlFor,
} from "@/lib/affiliate/planner/providers/klook/klookSourceUrl";
import type { AffiliateRoutingContext } from "@/lib/affiliate/planner/types";

const KLOOK_USJ =
  "https://www.klook.com/en-US/activity/46604-universal-studios-japan-e-ticket-osaka-qr-code-direct-entry/";

function ctx(overrides?: Partial<AffiliateRoutingContext>): AffiliateRoutingContext {
  return {
    plannerSessionId: "550e8400-e29b-41d4-a716-446655440000",
    destination: { text: "오사카", countryCode: "JP" },
    dates: { mode: "fixed", startDate: "2027-01-28", endDate: "2027-02-01", durationDays: 5 },
    travelers: { adults: 3, children: 0 },
    companionType: "friends",
    interests: [],
    pace: "balanced",
    placement: "day_item",
    category: "activity",
    dayNumber: 3,
    itemOrder: 2,
    itemType: "activity",
    placeName: "유니버설 스튜디오 재팬",
    sourceProductId: null,
    ...overrides,
  };
}

type CommerceInput = { sourceUrl: string; providerId: string; allowedHosts?: string[] };
type CommerceTarget = {
  affiliateUrl: string;
  providerSubId: string;
  affiliateNetwork: "travelpayouts";
  sourceUrlHost: string;
};

function commerceSpy() {
  return vi.fn<(input: CommerceInput) => Promise<CommerceTarget>>(async () => ({
    affiliateUrl: "https://tp.media/r?klook=1",
    providerSubId: "tp_aaaaaaaaaaaaaaaaaaaaaaaa",
    affiliateNetwork: "travelpayouts",
    sourceUrlHost: "www.klook.com",
  }));
}

describe("klookSourceUrl", () => {
  it("USJ → exact clean Studio Pass product page (activity 46604, no query)", () => {
    expect(klookSourceUrlFor("universal_studios_japan")).toBe(KLOOK_USJ);
    const url = new URL(KLOOK_USJ);
    expect(url.search).toBe("");
    expect(url.pathname).toContain("/activity/46604-");
  });

  it("allowlist is the minimal klook host set", () => {
    expect([...KLOOK_ALLOWED_HOSTS]).toEqual(["klook.com", "www.klook.com"]);
  });

  it("every catalog source is clean (no other-network aid/aff_* params)", () => {
    for (const raw of Object.values(KLOOK_ACTIVITY_SOURCE_URLS)) {
      expect(raw).not.toMatch(/[?#]|aid=|aff_|af_wid/);
    }
  });
});

describe("klookAdapter (PR-9AJ)", () => {
  it("USJ → offer via Commerce Core with the clean source URL", async () => {
    const createCommerceTarget = commerceSpy();
    const adapter = createKlookAdapter({ createCommerceTarget });

    expect(adapter.isEligible(ctx())).toBe(true);
    const offer = await adapter.buildOffer(ctx());

    expect(createCommerceTarget).toHaveBeenCalledTimes(1);
    expect(createCommerceTarget.mock.calls[0]![0]).toEqual({
      sourceUrl: KLOOK_USJ,
      providerId: "klook",
      allowedHosts: ["klook.com", "www.klook.com"],
    });
    expect(offer).toEqual({
      providerId: "klook",
      category: "activity",
      placement: "day_item",
      title: "유니버설 스튜디오 재팬 입장권",
      description: "여행 일정에 맞춰 입장권 예약 조건을 확인해 보세요.",
      ctaLabel: "이 장소의 투어·티켓 보기",
      destinationLabel: "오사카",
      targetUrl: "https://tp.media/r?klook=1",
      dayNumber: 3,
      itemOrder: 2,
      providerSubId: "tp_aaaaaaaaaaaaaaaaaaaaaaaa",
      affiliateNetwork: "travelpayouts",
      affiliateCampaignId: null,
      sourceUrlHost: "www.klook.com",
    });
    expect(JSON.stringify(offer)).not.toMatch(/최저|할인|특가|실시간|원\b|₩/);
  });

  it.each([
    ["unknown place", ctx({ placeName: "우메다 스카이 빌딩" })],
    ["missing place name", ctx({ placeName: null })],
    ["other Universal park", ctx({ placeName: "Universal Studios Singapore" })],
    ["USJ alias outside Japan", ctx({ destination: { text: "싱가포르", countryCode: "SG" } })],
    ["wrong category", ctx({ category: "hotel" })],
    ["wrong placement", ctx({ placement: "planner_summary" })],
  ])("%s → ineligible, null, no Commerce call", async (_label, context) => {
    const createCommerceTarget = commerceSpy();
    const adapter = createKlookAdapter({ createCommerceTarget });
    expect(adapter.isEligible(context)).toBe(false);
    expect(await adapter.buildOffer(context)).toBeNull();
    expect(createCommerceTarget).not.toHaveBeenCalled();
  });

  it("Commerce Core failure → null + safe diagnostic (no raw klook fallback)", async () => {
    const info = vi.spyOn(console, "info").mockImplementation(() => {});
    const adapter = createKlookAdapter({
      createCommerceTarget: vi.fn(async () => {
        throw Object.assign(new Error("nope"), { code: "provider_rejected" });
      }),
    });
    expect(await adapter.buildOffer(ctx())).toBeNull();
    expect(info).toHaveBeenCalledWith("[klook] commerce_failed", {
      providerId: "klook",
      hostname: "www.klook.com",
      errorCode: "provider_rejected",
    });
    info.mockRestore();
  });
});
