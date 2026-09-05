import { describe, expect, it } from "vitest";
import { ENABLE_FREE_TRAVEL_PLANNER } from "@/config/featureFlags";
import { z } from "zod";
import { plannerAnonymousKeySchema } from "@/lib/planner/schemas";

const enrichBodySchema = z
  .object({
    anonymousKey: plannerAnonymousKeySchema.optional(),
  })
  .strict();

describe("POST /api/planner/sessions/[id]/enrich contract", () => {
  it("feature flag is boolean", () => {
    expect(typeof ENABLE_FREE_TRAVEL_PLANNER).toBe("boolean");
  });

  it("accepts empty or anonymousKey-only body", () => {
    expect(enrichBodySchema.safeParse({}).success).toBe(true);
    expect(enrichBodySchema.safeParse({ anonymousKey: "anon-key-12345678" }).success).toBe(true);
  });
});
