import { describe, expect, it } from "vitest";
import { mapReserveResultToBlocked } from "@/lib/planner/quota/http";
import { getNextKstMidnightUtcIso, formatKstBusinessDate } from "@/lib/planner/quota/kst";
import { resolvePlannerQuotaSubject } from "@/lib/planner/quota/resolveSubject";

describe("resolvePlannerQuotaSubject", () => {
  it("uses cookie memberId + KST day window (not session.member_id)", () => {
    const now = new Date("2026-10-31T10:00:00+09:00");
    expect(
      resolvePlannerQuotaSubject({
        cookieMemberId: "11111111-1111-4111-8111-111111111111",
        anonymousKey: "guest-key-should-be-ignored",
        now,
      }),
    ).toEqual({
      subjectType: "member",
      subjectId: "11111111-1111-4111-8111-111111111111",
      windowType: "kst_day",
      windowKey: "2026-10-31",
    });
  });

  it("uses anonymousKey lifetime when no member cookie", () => {
    expect(
      resolvePlannerQuotaSubject({
        cookieMemberId: null,
        anonymousKey: "anon-device-key-bbbb",
      }),
    ).toEqual({
      subjectType: "anonymous_key",
      subjectId: "anon-device-key-bbbb",
      windowType: "lifetime",
      windowKey: "lifetime",
    });
  });
});

describe("quota http mapping", () => {
  const member = resolvePlannerQuotaSubject({
    cookieMemberId: "11111111-1111-4111-8111-111111111111",
    anonymousKey: "x",
    now: new Date("2026-10-31T12:00:00+09:00"),
  });
  const anon = resolvePlannerQuotaSubject({
    cookieMemberId: null,
    anonymousKey: "anon-zzzzzzzzzzzz",
  });

  it("maps member consumed → 429 AI_DAILY_QUOTA_EXCEEDED + nextAvailableAt", () => {
    const mapped = mapReserveResultToBlocked({
      subject: member,
      result: "already_consumed",
    });
    expect(mapped.status).toBe(429);
    expect(mapped.code).toBe("AI_DAILY_QUOTA_EXCEEDED");
    expect(typeof mapped.nextAvailableAt).toBe("string");
    expect(mapped.nextAvailableAt).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/);
  });

  it("maps anonymous consumed → 429 ANONYMOUS_LIFETIME_QUOTA_EXCEEDED", () => {
    const mapped = mapReserveResultToBlocked({
      subject: anon,
      result: "already_consumed",
    });
    expect(mapped.status).toBe(429);
    expect(mapped.code).toBe("ANONYMOUS_LIFETIME_QUOTA_EXCEEDED");
    expect(mapped.nextAvailableAt).toBeUndefined();
  });

  it("maps already_reserved → 409 GENERATION_ALREADY_IN_PROGRESS", () => {
    const mapped = mapReserveResultToBlocked({
      subject: member,
      result: "already_reserved",
    });
    expect(mapped.status).toBe(409);
    expect(mapped.code).toBe("GENERATION_ALREADY_IN_PROGRESS");
  });
});

describe("KST nextAvailableAt", () => {
  it("2026-10-31 KST usage → next midnight = 2026-10-31T15:00:00.000Z", () => {
    const now = new Date("2026-10-31T12:00:00+09:00");
    expect(formatKstBusinessDate(now)).toBe("2026-10-31");
    expect(getNextKstMidnightUtcIso(now)).toBe("2026-10-31T15:00:00.000Z");
  });
});
