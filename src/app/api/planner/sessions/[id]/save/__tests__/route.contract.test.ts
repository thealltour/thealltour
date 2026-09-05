import { describe, expect, it } from "vitest";
import { z } from "zod";
import { ENABLE_FREE_TRAVEL_PLANNER } from "@/config/featureFlags";
import { plannerAnonymousKeySchema } from "@/lib/planner/schemas";

const saveBodySchema = z
  .object({
    anonymousKey: plannerAnonymousKeySchema,
  })
  .strict();

describe("POST /api/planner/sessions/[id]/save contract", () => {
  it("feature flag constant is boolean", () => {
    expect(typeof ENABLE_FREE_TRAVEL_PLANNER).toBe("boolean");
  });

  it("requires anonymousKey and rejects spoof fields", () => {
    expect(saveBodySchema.safeParse({}).success).toBe(false);
    expect(saveBodySchema.safeParse({ anonymousKey: "short" }).success).toBe(false);
    expect(
      saveBodySchema.safeParse({
        anonymousKey: "anon-key-12345678",
        memberId: "x",
      }).success,
    ).toBe(false);
  });
});
