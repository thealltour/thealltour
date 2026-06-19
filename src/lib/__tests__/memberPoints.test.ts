import { describe, expect, it } from "vitest";
import {
  buildMemberPointUpdatePayload,
  getMemberPointBalance,
} from "@/server/services/rewards/memberPoints";

describe("memberPoints", () => {
  it("prefers point_balance over legacy points", () => {
    expect(getMemberPointBalance({ point_balance: 100, points: 50 })).toBe(100);
    expect(getMemberPointBalance({ points: 50 })).toBe(50);
  });

  it("builds update payload for v2 balance column", () => {
    expect(buildMemberPointUpdatePayload({ point_balance: 10 }, 20)).toEqual({ point_balance: 20 });
    expect(buildMemberPointUpdatePayload({ points: 10 }, 20)).toEqual({ points: 20 });
  });
});
