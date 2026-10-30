import { beforeEach, describe, expect, it, vi } from "vitest";

const attachPlannerSessionToMember = vi.hoisted(() => vi.fn());
const getMemberSessionFromCookies = vi.hoisted(() => vi.fn());

vi.mock("@/config/featureFlags", () => ({
  ENABLE_FREE_TRAVEL_PLANNER: true,
}));

vi.mock("@/lib/memberSession", () => ({
  getMemberSessionFromCookies,
}));

vi.mock("@/lib/planner/repository", () => ({
  attachPlannerSessionToMember,
}));

vi.mock("next/headers", () => ({
  cookies: vi.fn(async () => ({})),
}));

import { POST } from "@/app/api/planner/sessions/[id]/claim/route";

const SESSION_ID = "550e8400-e29b-41d4-a716-446655440000";
const MEMBER_ID = "11111111-1111-4111-8111-111111111111";

function makeRequest(body: unknown) {
  return new Request(`http://localhost/api/planner/sessions/${SESSION_ID}/claim`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

describe("POST /api/planner/sessions/[id]/claim", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    getMemberSessionFromCookies.mockReturnValue({ memberId: MEMBER_ID });
  });

  it("unauthenticated → 401", async () => {
    getMemberSessionFromCookies.mockReturnValue(null);
    const res = await POST(makeRequest({ anonymousKey: "anon-key-12345678" }), {
      params: Promise.resolve({ id: SESSION_ID }),
    });
    expect(res.status).toBe(401);
    expect(attachPlannerSessionToMember).not.toHaveBeenCalled();
  });

  it("rejects client-supplied memberId", async () => {
    const res = await POST(
      makeRequest({ anonymousKey: "anon-key-12345678", memberId: "spoof" }),
      { params: Promise.resolve({ id: SESSION_ID }) },
    );
    expect(res.status).toBe(400);
    expect(attachPlannerSessionToMember).not.toHaveBeenCalled();
  });

  it("guest owner → 200 with generated status and updatedAt", async () => {
    attachPlannerSessionToMember.mockResolvedValue({
      ok: true,
      claimed: true,
      session: {
        id: SESSION_ID,
        status: "generated",
        sourceProductId: null,
        plan: { title: "x" },
        updatedAt: "2026-10-31T00:00:00.000Z",
      },
    });
    const res = await POST(makeRequest({ anonymousKey: "anon-key-12345678" }), {
      params: Promise.resolve({ id: SESSION_ID }),
    });
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.claimed).toBe(true);
    expect(json.session).toMatchObject({
      id: SESSION_ID,
      status: "generated",
      isSaved: false,
      updatedAt: "2026-10-31T00:00:00.000Z",
    });
    expect(attachPlannerSessionToMember).toHaveBeenCalledWith({
      id: SESSION_ID,
      memberId: MEMBER_ID,
      anonymousKey: "anon-key-12345678",
    });
  });

  it("same member repeat → claimed:false", async () => {
    attachPlannerSessionToMember.mockResolvedValue({
      ok: true,
      claimed: false,
      session: {
        id: SESSION_ID,
        status: "generated",
        sourceProductId: null,
        plan: { title: "x" },
        updatedAt: "2026-10-31T00:00:00.000Z",
      },
    });
    const res = await POST(makeRequest({ anonymousKey: "anon-key-12345678" }), {
      params: Promise.resolve({ id: SESSION_ID }),
    });
    expect(res.status).toBe(200);
    expect((await res.json()).claimed).toBe(false);
  });

  it("forbidden → 403", async () => {
    attachPlannerSessionToMember.mockResolvedValue({ ok: false, reason: "forbidden" });
    const res = await POST(makeRequest({ anonymousKey: "anon-key-12345678" }), {
      params: Promise.resolve({ id: SESSION_ID }),
    });
    expect(res.status).toBe(403);
  });

  it("invalid_status → 409", async () => {
    attachPlannerSessionToMember.mockResolvedValue({ ok: false, reason: "invalid_status" });
    const res = await POST(makeRequest({ anonymousKey: "anon-key-12345678" }), {
      params: Promise.resolve({ id: SESSION_ID }),
    });
    expect(res.status).toBe(409);
    expect((await res.json()).code).toBe("invalid_status");
  });
});
