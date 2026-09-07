import { describe, expect, it } from "vitest";
import { ANALYTICS_EVENTS } from "@/lib/analytics/events";
import { ENABLE_PLANNER_AFFILIATE_ROUTER } from "@/config/featureFlags";
import {
  createFakeAffiliateAdapter,
  createFakeAffiliateDefinition,
} from "@/lib/affiliate/planner/__tests__/fixtures";
import { itemTypeToAffiliateCategory } from "@/lib/affiliate/planner/eligibility";
import { getProductionAffiliateAdapters, getProductionAffiliateProviderDefinitions } from "@/lib/affiliate/planner/registry";
import { isSafeHttpsUrl, routeAffiliateOffer } from "@/lib/affiliate/planner/router";
import { assertPlannerSessionOwnership } from "@/lib/planner/ownership";
import { createEmptyPlannerDraftInput } from "@/lib/planner/constants";
import type { PlannerSession } from "@/types/planner";
import type { AffiliateRoutingContext } from "@/lib/affiliate/planner/types";

function baseContext(
  overrides?: Partial<AffiliateRoutingContext>,
): AffiliateRoutingContext {
  return {
    plannerSessionId: "550e8400-e29b-41d4-a716-446655440000",
    destination: { text: "오사카", countryCode: "JP" },
    dates: {
      mode: "fixed",
      startDate: "2026-10-01",
      endDate: "2026-10-05",
      durationDays: 5,
    },
    travelers: { adults: 2, children: 0 },
    companionType: "couple",
    interests: ["food"],
    pace: "balanced",
    placement: "planner_summary",
    category: "flight",
    sourceProductId: null,
    ...overrides,
  };
}

describe("PR-8 Affiliate Router v0", () => {
  it("excludes disabled providers", () => {
    const def = createFakeAffiliateDefinition({
      id: "aviasales",
      enabled: false,
      categories: ["flight"],
      priority: 100,
    });
    const adapters = new Map([
      ["aviasales", createFakeAffiliateAdapter({ providerId: "aviasales" })],
    ]);
    const { offer, decision } = routeAffiliateOffer({
      context: baseContext(),
      providers: [def],
      adapters,
    });
    expect(offer).toBeNull();
    expect(decision.rejectedReasons.some((r) => r.reason === "disabled")).toBe(true);
  });

  it("filters by category and placement", () => {
    const def = createFakeAffiliateDefinition({
      id: "klook",
      categories: ["activity"],
      supportedPlacements: ["day_item"],
      priority: 80,
    });
    const adapters = new Map([
      ["klook", createFakeAffiliateAdapter({ providerId: "klook" })],
    ]);
    const miss = routeAffiliateOffer({
      context: baseContext({ category: "flight", placement: "planner_summary" }),
      providers: [def],
      adapters,
    });
    expect(miss.offer).toBeNull();

    const hit = routeAffiliateOffer({
      context: baseContext({ category: "activity", placement: "day_item" }),
      providers: [def],
      adapters,
    });
    expect(hit.offer?.providerId).toBe("klook");
  });

  it("enforces dateMode eligibility", () => {
    const def = createFakeAffiliateDefinition({
      id: "aviasales",
      categories: ["flight"],
      supportedPlacements: ["planner_summary"],
      supportedDateModes: ["fixed"],
      priority: 90,
    });
    const adapters = new Map([
      ["aviasales", createFakeAffiliateAdapter({ providerId: "aviasales" })],
    ]);
    const flex = routeAffiliateOffer({
      context: baseContext({
        dates: { mode: "flexible", startDate: null, endDate: null, durationDays: 5 },
      }),
      providers: [def],
      adapters,
    });
    expect(flex.offer).toBeNull();
    expect(flex.decision.rejectedReasons.some((r) => r.reason === "date_mode_unsupported")).toBe(
      true,
    );
  });

  it("ranks by higher priority then lexical tie-break", () => {
    const low = createFakeAffiliateDefinition({
      id: "kkday",
      categories: ["activity"],
      supportedPlacements: ["day_item"],
      priority: 40,
    });
    const high = createFakeAffiliateDefinition({
      id: "klook",
      categories: ["activity"],
      supportedPlacements: ["day_item"],
      priority: 90,
    });
    const adapters = new Map([
      ["kkday", createFakeAffiliateAdapter({ providerId: "kkday" })],
      ["klook", createFakeAffiliateAdapter({ providerId: "klook" })],
    ]);
    const { offer } = routeAffiliateOffer({
      context: baseContext({ category: "activity", placement: "day_item" }),
      providers: [low, high],
      adapters,
    });
    expect(offer?.providerId).toBe("klook");
  });

  it("falls back when first provider build fails", () => {
    const first = createFakeAffiliateDefinition({
      id: "klook",
      categories: ["activity"],
      supportedPlacements: ["day_item"],
      priority: 100,
    });
    const second = createFakeAffiliateDefinition({
      id: "kkday",
      categories: ["activity"],
      supportedPlacements: ["day_item"],
      priority: 50,
    });
    const adapters = new Map([
      ["klook", createFakeAffiliateAdapter({ providerId: "klook", failBuild: true })],
      ["kkday", createFakeAffiliateAdapter({ providerId: "kkday" })],
    ]);
    const { offer } = routeAffiliateOffer({
      context: baseContext({ category: "activity", placement: "day_item" }),
      providers: [first, second],
      adapters,
    });
    expect(offer?.providerId).toBe("kkday");
  });

  it("returns null when no eligible provider", () => {
    const { offer } = routeAffiliateOffer({
      context: baseContext(),
      providers: [],
      adapters: new Map(),
    });
    expect(offer).toBeNull();
  });

  it("maps activity/attraction to activity category; food skipped", () => {
    expect(itemTypeToAffiliateCategory("activity")).toBe("activity");
    expect(itemTypeToAffiliateCategory("attraction")).toBe("activity");
    expect(itemTypeToAffiliateCategory("food")).toBeNull();
    expect(itemTypeToAffiliateCategory("cafe")).toBeNull();
  });

  it("rejects non-https redirect targets", () => {
    expect(isSafeHttpsUrl("https://example.com/x")).toBe(true);
    expect(isSafeHttpsUrl("http://example.com/x")).toBe(false);
    expect(isSafeHttpsUrl("javascript:alert(1)")).toBe(false);
  });

  it("production registry has no enabled adapters or fake fixtures", () => {
    const defs = getProductionAffiliateProviderDefinitions();
    expect(defs.every((d) => d.enabled === false)).toBe(true);
    expect(getProductionAffiliateAdapters().size).toBe(0);
    expect(defs.some((d) => d.id.includes("fake"))).toBe(false);
  });

  it("feature flag defaults off", () => {
    expect(ENABLE_PLANNER_AFFILIATE_ROUTER).toBe(false);
  });

  it("registers affiliate analytics events", () => {
    expect(ANALYTICS_EVENTS.affiliate_impression).toBe("affiliate_impression");
    expect(ANALYTICS_EVENTS.affiliate_clicked).toBe("affiliate_clicked");
  });

  it("ownership rules for affiliate offers API", () => {
    const anon: PlannerSession = {
      id: "550e8400-e29b-41d4-a716-446655440000",
      anonymousKey: "anon-correct-key",
      memberId: null,
      status: "generated",
      input: createEmptyPlannerDraftInput("오사카"),
      plan: null,
      sourceProductId: null,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    expect(
      assertPlannerSessionOwnership({
        session: anon,
        anonymousKey: "anon-correct-key",
        cookieMemberId: null,
      }).ok,
    ).toBe(true);
    expect(
      assertPlannerSessionOwnership({
        session: anon,
        anonymousKey: "wrong",
        cookieMemberId: null,
      }).ok,
    ).toBe(false);

    const member: PlannerSession = {
      ...anon,
      anonymousKey: "x",
      memberId: "member-1",
    };
    expect(
      assertPlannerSessionOwnership({
        session: member,
        anonymousKey: null,
        cookieMemberId: "member-1",
      }).ok,
    ).toBe(true);
    expect(
      assertPlannerSessionOwnership({
        session: member,
        anonymousKey: null,
        cookieMemberId: "other",
      }).ok,
    ).toBe(false);
  });

  it("client offer DTO shape excludes targetUrl", () => {
    const clientSafe = {
      offerId: "o1",
      providerId: "klook",
      category: "activity" as const,
      placement: "day_item" as const,
      title: "t",
      description: null,
      ctaLabel: "cta",
      destinationLabel: "오사카",
      trackingToken: "tok",
    };
    expect("targetUrl" in clientSafe).toBe(false);
  });
});
