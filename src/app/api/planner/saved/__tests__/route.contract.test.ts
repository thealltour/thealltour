import { beforeEach, describe, expect, it, vi } from "vitest";

const listSaved = vi.hoisted(() => vi.fn());
const listGenerated = vi.hoisted(() => vi.fn());
const getMemberSessionFromCookies = vi.hoisted(() => vi.fn());

vi.mock("@/config/featureFlags", () => ({
  ENABLE_FREE_TRAVEL_PLANNER: true,
}));

vi.mock("@/lib/memberSession", () => ({
  getMemberSessionFromCookies,
}));

vi.mock("@/lib/planner/repository", () => ({
  listSavedPlannerSessionsForMember: listSaved,
  listGeneratedPlannerSessionsForMember: listGenerated,
}));

vi.mock("next/headers", () => ({
  cookies: vi.fn(async () => ({})),
}));

import { GET } from "@/app/api/planner/saved/route";

describe("GET /api/planner/saved backward compatibility", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    getMemberSessionFromCookies.mockReturnValue({
      memberId: "11111111-1111-4111-8111-111111111111",
    });
  });

  it("keeps plans as saved-only and adds generatedPlans", async () => {
    const saved = [{ id: "s1", title: "saved" }];
    const generated = [{ id: "g1", title: "gen" }];
    listSaved.mockResolvedValue(saved);
    listGenerated.mockResolvedValue(generated);

    const res = await GET();
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.plans).toEqual(saved);
    expect(json.count).toBe(1);
    expect(json.generatedPlans).toEqual(generated);
    expect(json.generatedCount).toBe(1);
    expect(listSaved).toHaveBeenCalled();
    expect(listGenerated).toHaveBeenCalled();
  });
});
