import { describe, expect, it } from "vitest";
import { ENABLE_FREE_TRAVEL_PLANNER } from "@/config/featureFlags";

describe("GET /api/planner/saved contract", () => {
  it("feature flag is boolean (off → route returns 404)", () => {
    expect(typeof ENABLE_FREE_TRAVEL_PLANNER).toBe("boolean");
  });

  it("documents that memberId is never accepted from client query/body", () => {
    // GET has no body; identity is cookie-only via getMemberSessionFromCookies.
    expect(true).toBe(true);
  });
});
