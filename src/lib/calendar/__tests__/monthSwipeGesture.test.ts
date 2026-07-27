import { describe, expect, it } from "vitest";
import {
  addCalendarMonths,
  resolveMonthSwipeDelta,
} from "@/lib/calendar/monthSwipeGesture";

describe("resolveMonthSwipeDelta", () => {
  it("ignores short horizontal movement", () => {
    expect(resolveMonthSwipeDelta(-40, 0)).toBe(0);
  });

  it("maps left swipe to next month", () => {
    expect(resolveMonthSwipeDelta(-80, 10)).toBe(1);
  });

  it("maps right swipe to previous month", () => {
    expect(resolveMonthSwipeDelta(80, 10)).toBe(-1);
  });

  it("ignores mostly vertical gesture", () => {
    expect(resolveMonthSwipeDelta(-80, 120)).toBe(0);
  });
});

describe("addCalendarMonths", () => {
  it("advances month without day overflow", () => {
    const jan31 = new Date(2026, 0, 31);
    const next = addCalendarMonths(jan31, 1);
    expect(next.getFullYear()).toBe(2026);
    expect(next.getMonth()).toBe(1);
    expect(next.getDate()).toBe(1);
  });
});
