import { afterEach, describe, expect, it, vi } from "vitest";
import * as desiredDeparture from "@/lib/inquiry/desiredDeparture";
import {
  filterBookableDepartureYmds,
  isBookableDepartureYmd,
  resolveFirstBookableDepartureMonth,
} from "@/lib/products/bookableDepartureDates";

afterEach(() => {
  vi.restoreAllMocks();
});

describe("filterBookableDepartureYmds", () => {
  it("KST 오늘 이전 날짜를 제거한다", () => {
    vi.spyOn(desiredDeparture, "kstTodayYmd").mockReturnValue("2026-11-27");
    expect(
      filterBookableDepartureYmds(["2023-11-04", "2026-11-27", "2026-12-01", "2026-11-26"]),
    ).toEqual(["2026-11-27", "2026-12-01"]);
  });
});

describe("resolveFirstBookableDepartureMonth", () => {
  it("첫 유효 출발일이 있는 월을 반환한다", () => {
    const month = resolveFirstBookableDepartureMonth(
      ["2023-11-04", "2026-12-15"],
      "2026-11-27",
    );
    expect(month?.getFullYear()).toBe(2026);
    expect(month?.getMonth()).toBe(11);
  });

  it("유효일이 없으면 null", () => {
    expect(resolveFirstBookableDepartureMonth(["2023-11-04"], "2026-11-27")).toBeNull();
  });
});

describe("isBookableDepartureYmd", () => {
  it("과거·형식 오류는 false", () => {
    expect(isBookableDepartureYmd("2023-11-04", "2026-11-27")).toBe(false);
    expect(isBookableDepartureYmd("not-a-date", "2026-11-27")).toBe(false);
    expect(isBookableDepartureYmd("2026-11-27", "2026-11-27")).toBe(true);
  });
});
