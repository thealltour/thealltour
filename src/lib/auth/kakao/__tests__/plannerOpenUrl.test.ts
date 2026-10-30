import { describe, expect, it } from "vitest";
import { buildPlannerOpenAbsoluteUrl } from "@/lib/auth/kakao/buildPlannerKakaoMemoTemplate";
import { buildPlannerKakaoMemoRedirectPath } from "@/lib/auth/kakao/plannerKakaoMemoQuery";
import { isPlannerSessionId } from "@/lib/auth/oauthAction";

describe("planner open / memo query helpers", () => {
  it("builds canonical open URL (not /planner/{id} directly)", () => {
    process.env.NEXT_PUBLIC_APP_URL = "https://thealltour.com";
    const id = "aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeeeeeee";
    const url = buildPlannerOpenAbsoluteUrl(id);
    expect(url).toBe(`https://thealltour.com/planner/open/${id}`);
    expect(url).not.toMatch(/\/planner\/aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeeeeeee$/);
  });

  it("validates session id format", () => {
    expect(isPlannerSessionId("aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeeeeeee")).toBe(true);
    expect(isPlannerSessionId("../etc/passwd")).toBe(false);
    expect(isPlannerSessionId("not-uuid")).toBe(false);
  });

  it("builds status redirect paths", () => {
    const id = "aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeeeeeee";
    expect(buildPlannerKakaoMemoRedirectPath(id, "sent")).toBe(
      `/planner/${id}?plannerKakaoMemo=sent`,
    );
    expect(buildPlannerKakaoMemoRedirectPath(id, "failed")).toContain("failed");
  });
});
