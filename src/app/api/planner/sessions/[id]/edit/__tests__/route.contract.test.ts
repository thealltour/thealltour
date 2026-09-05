import { describe, expect, it } from "vitest";
import { ENABLE_FREE_TRAVEL_PLANNER } from "@/config/featureFlags";
import { plannerEditBodySchema } from "@/lib/planner/schemas";

describe("POST /api/planner/sessions/[id]/edit contract", () => {
  it("feature flag is boolean", () => {
    expect(typeof ENABLE_FREE_TRAVEL_PLANNER).toBe("boolean");
  });

  it("body requires instruction and rejects spoof fields", () => {
    expect(plannerEditBodySchema.safeParse({}).success).toBe(false);
    expect(
      plannerEditBodySchema.safeParse({
        instruction: "여유롭게",
        plan_json: {},
        memberId: "x",
      }).success,
    ).toBe(false);
    expect(
      plannerEditBodySchema.safeParse({
        instruction: "여유롭게",
        anonymousKey: "anon-key-12345678",
      }).success,
    ).toBe(true);
  });
});
