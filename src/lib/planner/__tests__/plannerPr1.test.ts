import { describe, expect, it, vi } from "vitest";
import {
  createPlannerSessionBodySchema,
  plannerDestinationSchema,
} from "@/lib/planner/schemas";
import { getHomeHeroQuickActions, HOME_HERO_QUICK_ACTIONS } from "@/lib/homeHeroQuickActions";
import { ANALYTICS_EVENTS, ANALYTICS_SOURCES } from "@/lib/analytics/events";
import {
  PLANNER_ANONYMOUS_KEY_STORAGE_KEY,
  createPlannerAnonymousKey,
  getOrCreatePlannerAnonymousKey,
} from "@/lib/planner/anonymousKey";

describe("planner schemas", () => {
  it("accepts valid create body", () => {
    const parsed = createPlannerSessionBodySchema.parse({
      anonymousKey: "a1b2c3d4-e5f6-7890-abcd-ef1234567890",
      destination: "오사카",
      sourceProductId: "550e8400-e29b-41d4-a716-446655440000",
    });
    expect(parsed.destination).toBe("오사카");
  });

  it("rejects empty destination", () => {
    const result = plannerDestinationSchema.safeParse("   ");
    expect(result.success).toBe(false);
  });

  it("strips client-supplied memberId (cannot spoof)", () => {
    const result = createPlannerSessionBodySchema.safeParse({
      anonymousKey: "anon-key-12345678",
      destination: "제주",
      memberId: "22222222-2222-2222-2222-222222222222",
    });
    expect(result.success).toBe(false);
  });

  it("allows null sourceProductId", () => {
    const parsed = createPlannerSessionBodySchema.parse({
      anonymousKey: "anon-key-12345678",
      destination: "다낭",
      sourceProductId: null,
    });
    expect(parsed.sourceProductId).toBeNull();
  });
});

describe("home hero planner quick action", () => {
  it("includes planner when feature flag is enabled (default)", () => {
    const actions = getHomeHeroQuickActions();
    expect(actions.some((a) => a.id === "planner")).toBe(true);
    expect(actions.find((a) => a.id === "planner")?.href).toBe("/planner");
    // existing exploration CTAs remain
    expect(actions.some((a) => a.id === "golf")).toBe(true);
    expect(actions.some((a) => a.id === "all")).toBe(true);
    expect(HOME_HERO_QUICK_ACTIONS.every((a) => a.id !== "planner")).toBe(true);
  });

  it("hides planner when enabled override is false", () => {
    const actions = getHomeHeroQuickActions({ enabled: false });
    expect(actions.some((a) => a.id === "planner")).toBe(false);
    expect(actions).toHaveLength(5);
  });
});

describe("planner analytics constants", () => {
  it("registers PR-1 events and source", () => {
    expect(ANALYTICS_EVENTS.planner_landing_view).toBe("planner_landing_view");
    expect(ANALYTICS_EVENTS.planner_started).toBe("planner_started");
    expect(ANALYTICS_SOURCES.planner).toBe("planner");
  });
});

describe("planner anonymous key", () => {
  it("creates opaque non-PII keys", () => {
    const key = createPlannerAnonymousKey();
    expect(key.length).toBeGreaterThanOrEqual(8);
    expect(key).not.toMatch(/@/);
  });

  it("persists in localStorage under theall_ prefix", () => {
    const store = new Map<string, string>();
    vi.stubGlobal("localStorage", {
      getItem: (k: string) => store.get(k) ?? null,
      setItem: (k: string, v: string) => {
        store.set(k, v);
      },
      removeItem: (k: string) => {
        store.delete(k);
      },
    });
    const a = getOrCreatePlannerAnonymousKey();
    const b = getOrCreatePlannerAnonymousKey();
    expect(a).toBe(b);
    expect(store.get(PLANNER_ANONYMOUS_KEY_STORAGE_KEY)).toBe(a);
    vi.unstubAllGlobals();
  });
});
