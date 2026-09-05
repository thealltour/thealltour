import { describe, expect, it } from "vitest";
import { createPlannerSessionBodySchema } from "@/lib/planner/schemas";

/**
 * Documents API contract: memberId must never be accepted from the client body.
 * Server attaches member_id via getMemberSessionFromCookies only.
 */
describe("POST /api/planner/sessions body contract", () => {
  it("does not accept memberId in request body", () => {
    const spoof = createPlannerSessionBodySchema.safeParse({
      anonymousKey: "client-anon-abcdefgh",
      destination: "도쿄",
      memberId: "spoofed-member-id-uuid-0001",
    });
    expect(spoof.success).toBe(false);
  });

  it("requires anonymousKey and destination only", () => {
    const ok = createPlannerSessionBodySchema.safeParse({
      anonymousKey: "client-anon-abcdefgh",
      destination: "도쿄",
    });
    expect(ok.success).toBe(true);
    if (ok.success) {
      expect("memberId" in ok.data).toBe(false);
    }
  });
});
