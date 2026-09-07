import { beforeEach, describe, expect, it, vi } from "vitest";
import { ENABLE_PLANNER_AFFILIATE_ROUTER } from "@/config/featureFlags";
import {
  getAffiliateRolloutBucket,
  isPlannerAffiliateEnabledForKey,
} from "@/config/affiliateRollout";
import { createEmptyPlannerDraftInput } from "@/lib/planner/constants";
import type { PlannerPlan } from "@/lib/planner/planSchemas";
import type { PlannerSession } from "@/types/planner";

const buildAffiliateOffersForSession = vi.fn();
const getPlannerSessionById = vi.fn();
const getMemberSessionFromCookies = vi.fn();
const assertPlannerSessionOwnership = vi.fn();
const cookies = vi.fn();

vi.mock("@/lib/affiliate/planner/buildOffersForSession", () => ({
  buildAffiliateOffersForSession: (...args: unknown[]) =>
    buildAffiliateOffersForSession(...args),
}));

vi.mock("@/lib/planner/repository", () => ({
  getPlannerSessionById: (...args: unknown[]) => getPlannerSessionById(...args),
}));

vi.mock("@/lib/memberSession", () => ({
  getMemberSessionFromCookies: (...args: unknown[]) =>
    getMemberSessionFromCookies(...args),
}));

vi.mock("@/lib/planner/ownership", () => ({
  assertPlannerSessionOwnership: (...args: unknown[]) =>
    assertPlannerSessionOwnership(...args),
}));

vi.mock("next/headers", () => ({
  cookies: () => cookies(),
}));

function plan(): PlannerPlan {
  return {
    title: "t",
    summary: "s",
    destination: { name: "Osaka", country: "JP" },
    tripOverview: {
      startDate: "2026-10-01",
      endDate: "2026-10-05",
      nights: 4,
      days: 5,
      travelersSummary: "2",
      styleSummary: "균형",
    },
    days: [
      {
        day: 1,
        date: "2026-10-01",
        title: "1",
        summary: "s",
        items: [
          {
            order: 1,
            time: "10:00",
            type: "attraction",
            name: "성",
            area: null,
            description: "d",
            estimatedDurationMinutes: 60,
            travelToNext: null,
            bookingRecommended: false,
          },
        ],
        tips: [],
      },
    ],
    preparation: { travelTips: [], packingHints: [] },
  };
}

function session(overrides?: Partial<PlannerSession>): PlannerSession {
  const draft = createEmptyPlannerDraftInput("Osaka", "서울");
  draft.dates = {
    mode: "fixed",
    startDate: "2026-10-01",
    endDate: "2026-10-05",
    durationDays: 5,
  };
  return {
    id: "550e8400-e29b-41d4-a716-446655440000",
    anonymousKey: "anon-included-key-zzzz",
    memberId: null,
    status: "generated",
    input: draft,
    plan: plan(),
    sourceProductId: null,
    createdAt: "2026-09-01T00:00:00.000Z",
    updatedAt: "2026-09-01T00:00:00.000Z",
    ...overrides,
  };
}

describe("PR-9G offers API + redirect canary gates", () => {
  beforeEach(() => {
    vi.unstubAllEnvs();
    vi.resetModules();
    vi.clearAllMocks();
    cookies.mockResolvedValue({});
    getMemberSessionFromCookies.mockReturnValue(null);
    assertPlannerSessionOwnership.mockReturnValue({ ok: true });
    buildAffiliateOffersForSession.mockResolvedValue({
      summary: [{ offerId: "o1", providerId: "aviasales" }],
      preparation: [],
      days: {},
      disclosure: "disclosure",
    });
  });

  it("committed master default remains false", () => {
    expect(ENABLE_PLANNER_AFFILIATE_ROUTER).toBe(false);
  });

  it("master false → offers API 404 (kill switch)", async () => {
    vi.stubEnv("ENABLE_PLANNER_AFFILIATE_ROUTER", "false");
    vi.stubEnv("PLANNER_AFFILIATE_ROLLOUT_PERCENT", "100");
    const { POST } = await import(
      "@/app/api/planner/sessions/[id]/affiliate-offers/route"
    );
    const res = await POST(
      new Request("http://localhost/api", {
        method: "POST",
        body: JSON.stringify({ anonymousKey: "anon-included-key-zzzz" }),
      }),
      { params: Promise.resolve({ id: session().id }) },
    );
    expect(res.status).toBe(404);
    expect(buildAffiliateOffersForSession).not.toHaveBeenCalled();
    vi.unstubAllEnvs();
  });

  it("master true + excluded percent → empty DTO 200, no network/build", async () => {
    // Find a key that is excluded at 5%
    let excludedKey = "anon-excluded-0";
    for (let i = 0; i < 500; i += 1) {
      const k = `anon-excluded-${i}`;
      if (getAffiliateRolloutBucket(k) >= 5) {
        excludedKey = k;
        break;
      }
    }
    expect(getAffiliateRolloutBucket(excludedKey)).toBeGreaterThanOrEqual(5);

    vi.stubEnv("ENABLE_PLANNER_AFFILIATE_ROUTER", "true");
    vi.stubEnv("PLANNER_AFFILIATE_ROLLOUT_PERCENT", "5");
    getPlannerSessionById.mockResolvedValue(session({ anonymousKey: excludedKey }));

    const { POST } = await import(
      "@/app/api/planner/sessions/[id]/affiliate-offers/route"
    );
    const res = await POST(
      new Request("http://localhost/api", {
        method: "POST",
        body: JSON.stringify({ anonymousKey: excludedKey }),
      }),
      { params: Promise.resolve({ id: session().id }) },
    );
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.offers).toEqual({
      summary: [],
      preparation: [],
      days: {},
      disclosure: null,
    });
    expect(buildAffiliateOffersForSession).not.toHaveBeenCalled();
    vi.unstubAllEnvs();
  });

  it("master true + included percent → builds offers", async () => {
    let includedKey = "anon-included-0";
    for (let i = 0; i < 500; i += 1) {
      const k = `anon-included-${i}`;
      if (getAffiliateRolloutBucket(k) < 5) {
        includedKey = k;
        break;
      }
    }
    expect(
      isPlannerAffiliateEnabledForKey(includedKey, {
        masterEnabled: true,
        percent: 5,
      }),
    ).toBe(true);

    vi.stubEnv("ENABLE_PLANNER_AFFILIATE_ROUTER", "true");
    vi.stubEnv("PLANNER_AFFILIATE_ROLLOUT_PERCENT", "5");
    getPlannerSessionById.mockResolvedValue(session({ anonymousKey: includedKey }));

    const { POST } = await import(
      "@/app/api/planner/sessions/[id]/affiliate-offers/route"
    );
    const res = await POST(
      new Request("http://localhost/api", {
        method: "POST",
        body: JSON.stringify({ anonymousKey: includedKey }),
      }),
      { params: Promise.resolve({ id: session().id }) },
    );
    expect(res.status).toBe(200);
    expect(buildAffiliateOffersForSession).toHaveBeenCalledTimes(1);
    const body = await res.json();
    expect(body.offers.summary[0]?.providerId).toBe("aviasales");
    vi.unstubAllEnvs();
  });

  it("redirect route source does not gate on ENABLE_PLANNER_AFFILIATE_ROUTER or percent", async () => {
    const fs = await import("node:fs/promises");
    const path = await import("node:path");
    const file = path.join(
      process.cwd(),
      "src/app/r/affiliate/[token]/route.ts",
    );
    const src = await fs.readFile(file, "utf8");
    expect(src).not.toMatch(/ENABLE_PLANNER_AFFILIATE_ROUTER/);
    expect(src).not.toMatch(/isPlannerAffiliateEnabledForKey/);
    expect(src).not.toMatch(/PLANNER_AFFILIATE_ROLLOUT_PERCENT/);
    expect(src).toMatch(/ENABLE_FREE_TRAVEL_PLANNER/);
  });
});
