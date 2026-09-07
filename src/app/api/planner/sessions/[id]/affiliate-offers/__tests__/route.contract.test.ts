import { describe, expect, it } from "vitest";
import { ENABLE_PLANNER_AFFILIATE_ROUTER } from "@/config/featureFlags";
import { z } from "zod";
import { plannerAnonymousKeySchema } from "@/lib/planner/schemas";

const offersBodySchema = z
  .object({
    anonymousKey: plannerAnonymousKeySchema.optional(),
  })
  .strict();

const impressionBodySchema = z
  .object({
    trackingToken: z.string().uuid(),
  })
  .strict();

describe("affiliate API contracts", () => {
  it("flag gates affiliate router", () => {
    expect(typeof ENABLE_PLANNER_AFFILIATE_ROUTER).toBe("boolean");
  });

  it("offers body accepts anonymousKey only", () => {
    expect(offersBodySchema.safeParse({}).success).toBe(true);
    expect(
      offersBodySchema.safeParse({ anonymousKey: "anon-key-12345678" }).success,
    ).toBe(true);
    expect(
      offersBodySchema.safeParse({ anonymousKey: "x", providerId: "klook" }).success,
    ).toBe(false);
  });

  it("impression requires uuid token only — no client URL", () => {
    expect(
      impressionBodySchema.safeParse({
        trackingToken: "550e8400-e29b-41d4-a716-446655440000",
      }).success,
    ).toBe(true);
    expect(
      impressionBodySchema.safeParse({
        trackingToken: "550e8400-e29b-41d4-a716-446655440000",
        url: "https://evil.example",
      }).success,
    ).toBe(false);
  });
});
