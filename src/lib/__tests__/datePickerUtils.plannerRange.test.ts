import { describe, expect, it } from "vitest";
import {
  getNextPlannerDateRangeSelection,
  isDateRangeSelectionComplete,
} from "@/lib/datePickerUtils";

describe("getNextPlannerDateRangeSelection", () => {
  it("empty → first click becomes start only", () => {
    expect(getNextPlannerDateRangeSelection("", "", "2026-09-17")).toEqual({
      from: "2026-09-17",
      to: "",
    });
    expect(isDateRangeSelectionComplete("2026-09-17", "", true)).toBe(false);
  });

  it("start-only + later click completes range", () => {
    expect(getNextPlannerDateRangeSelection("2026-09-17", "", "2026-09-21")).toEqual({
      from: "2026-09-17",
      to: "2026-09-21",
    });
    expect(isDateRangeSelectionComplete("2026-09-17", "2026-09-21", true)).toBe(true);
  });

  it("completed range + new click resets to new start", () => {
    expect(
      getNextPlannerDateRangeSelection("2026-09-17", "2026-09-21", "2026-09-24"),
    ).toEqual({
      from: "2026-09-24",
      to: "",
    });
  });

  it("start-only + earlier click replaces start without swap", () => {
    expect(getNextPlannerDateRangeSelection("2026-09-24", "", "2026-09-20")).toEqual({
      from: "2026-09-20",
      to: "",
    });
  });

  it("start-only + same date stays incomplete", () => {
    expect(getNextPlannerDateRangeSelection("2026-09-20", "", "2026-09-20")).toEqual({
      from: "2026-09-20",
      to: "",
    });
    expect(isDateRangeSelectionComplete("2026-09-20", "2026-09-20", true)).toBe(false);
  });

  it("completed range + earlier click resets to that start only", () => {
    expect(
      getNextPlannerDateRangeSelection("2026-09-17", "2026-09-21", "2026-09-15"),
    ).toEqual({
      from: "2026-09-15",
      to: "",
    });
  });
});
