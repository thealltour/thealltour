import { describe, expect, it } from "vitest";
import {
  getCompanionTravelersConsistencyError,
  getDefaultTravelersForCompanion,
  getTravelerConstraints,
} from "@/lib/planner/travelers";
import type { PlannerCompanionType } from "@/types/planner";

const DEFAULTS: Array<{
  type: PlannerCompanionType;
  adults: number;
  children: number;
}> = [
  { type: "solo", adults: 1, children: 0 },
  { type: "couple", adults: 2, children: 0 },
  { type: "friends", adults: 2, children: 0 },
  { type: "family", adults: 2, children: 0 },
  { type: "parents", adults: 2, children: 0 },
  { type: "with_children", adults: 2, children: 1 },
];

describe("getDefaultTravelersForCompanion", () => {
  it.each(DEFAULTS)("$type → adults $adults / children $children", ({ type, adults, children }) => {
    expect(getDefaultTravelersForCompanion(type)).toEqual({ adults, children });
  });
});

describe("getTravelerConstraints", () => {
  it("locks solo counters", () => {
    expect(getTravelerConstraints("solo")).toEqual({
      adultsMin: 1,
      adultsMax: 1,
      childrenMin: 0,
      childrenMax: 0,
    });
  });

  it("locks couple counters", () => {
    expect(getTravelerConstraints("couple")).toEqual({
      adultsMin: 2,
      adultsMax: 2,
      childrenMin: 0,
      childrenMax: 0,
    });
  });

  it("friends: adults ≥2, children locked 0", () => {
    expect(getTravelerConstraints("friends")).toEqual({
      adultsMin: 2,
      adultsMax: 20,
      childrenMin: 0,
      childrenMax: 0,
    });
  });

  it("family: free range", () => {
    expect(getTravelerConstraints("family")).toEqual({
      adultsMin: 1,
      adultsMax: 20,
      childrenMin: 0,
      childrenMax: 20,
    });
  });

  it("parents: adults ≥2, children locked 0", () => {
    expect(getTravelerConstraints("parents")).toEqual({
      adultsMin: 2,
      adultsMax: 20,
      childrenMin: 0,
      childrenMax: 0,
    });
  });

  it("with_children: children ≥1", () => {
    expect(getTravelerConstraints("with_children")).toEqual({
      adultsMin: 1,
      adultsMax: 20,
      childrenMin: 1,
      childrenMax: 20,
    });
  });
});

describe("getCompanionTravelersConsistencyError", () => {
  it("rejects solo + adults 2", () => {
    expect(
      getCompanionTravelersConsistencyError({
        companionType: "solo",
        adults: 2,
        children: 0,
      }),
    ).toMatch(/혼자/);
  });

  it("rejects with_children + children 0", () => {
    expect(
      getCompanionTravelersConsistencyError({
        companionType: "with_children",
        adults: 2,
        children: 0,
      }),
    ).toMatch(/아이/);
  });

  it("rejects friends + adults 1", () => {
    expect(
      getCompanionTravelersConsistencyError({
        companionType: "friends",
        adults: 1,
        children: 0,
      }),
    ).toMatch(/친구/);
  });

  it("accepts family + adults 1 children 0", () => {
    expect(
      getCompanionTravelersConsistencyError({
        companionType: "family",
        adults: 1,
        children: 0,
      }),
    ).toBeNull();
  });

  it.each(DEFAULTS)("accepts canonical $type defaults", ({ type, adults, children }) => {
    expect(
      getCompanionTravelersConsistencyError({
        companionType: type,
        adults,
        children,
      }),
    ).toBeNull();
  });
});
