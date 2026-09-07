import { describe, expect, it } from "vitest";
import {
  createTravelpayoutsSubId,
  TRAVELPAYOUTS_SUB_ID_PATTERN,
  validateTravelpayoutsSubId,
} from "@/lib/affiliate/travelpayouts/subId";

describe("Travelpayouts SubID", () => {
  it("generates opaque tp_ + hex format", () => {
    const id = createTravelpayoutsSubId();
    expect(id).toMatch(TRAVELPAYOUTS_SUB_ID_PATTERN);
    expect(validateTravelpayoutsSubId(id)).toBe(true);
  });

  it("uses only ascii letters digits underscore", () => {
    for (let i = 0; i < 20; i += 1) {
      expect(createTravelpayoutsSubId()).toMatch(/^[a-z0-9_]+$/);
    }
  });

  it("does not embed session/member/anonymous plaintext", () => {
    const id = createTravelpayoutsSubId();
    expect(id.includes("session")).toBe(false);
    expect(id.includes("member")).toBe(false);
    expect(id.includes("anon")).toBe(false);
    expect(id.includes("-")).toBe(false);
  });

  it("avoids collisions across many draws", () => {
    const set = new Set(Array.from({ length: 200 }, () => createTravelpayoutsSubId()));
    expect(set.size).toBe(200);
  });

  it("rejects invalid formats", () => {
    expect(validateTravelpayoutsSubId("")).toBe(false);
    expect(validateTravelpayoutsSubId("tp_SHORT")).toBe(false);
    expect(validateTravelpayoutsSubId("TP_aaaaaaaaaaaaaaaaaaaaaaaa")).toBe(false);
    expect(validateTravelpayoutsSubId("550e8400-e29b-41d4-a716-446655440000")).toBe(false);
    expect(validateTravelpayoutsSubId("tp_aaaaaaaaaaaaaaaaaaaaaaa!")).toBe(false);
  });
});
