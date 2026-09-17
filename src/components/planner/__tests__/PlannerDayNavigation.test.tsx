import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { PlannerDayNavigation } from "@/components/planner/PlannerDayNavigation";
import type { PlannerPlanDay } from "@/lib/planner/planSchemas";

function makeDays(count: number): PlannerPlanDay[] {
  return Array.from({ length: count }, (_, i) => ({
    day: i + 1,
    date: null,
    title: `${i + 1}일차`,
    summary: "요약",
    items: [
      {
        order: 1,
        time: "10:00",
        type: "attraction" as const,
        name: "명소",
        area: "중심",
        description: "둘러보기",
        estimatedDurationMinutes: 60,
        travelToNext: null,
        bookingRecommended: false,
      },
    ],
    tips: [],
  }));
}

beforeEach(() => {
  cleanup();
});

afterEach(() => {
  cleanup();
});

describe("PlannerDayNavigation", () => {
  it("renders Day 1/2/3 buttons for 3 days", () => {
    render(
      <PlannerDayNavigation days={makeDays(3)} activeDay={1} onDaySelect={vi.fn()} />,
    );
    expect(screen.getByRole("navigation", { name: "여행 일정 일자 이동" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Day 1" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Day 2" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Day 3" })).toBeInTheDocument();
  });

  it("marks initial active Day 1 with aria-current", () => {
    render(
      <PlannerDayNavigation days={makeDays(3)} activeDay={1} onDaySelect={vi.fn()} />,
    );
    expect(screen.getByRole("button", { name: "Day 1" })).toHaveAttribute(
      "aria-current",
      "true",
    );
    expect(screen.getByRole("button", { name: "Day 2" })).not.toHaveAttribute(
      "aria-current",
    );
  });

  it("calls onDaySelect with day 2 when Day 2 is clicked", () => {
    const onDaySelect = vi.fn();
    render(
      <PlannerDayNavigation days={makeDays(3)} activeDay={1} onDaySelect={onDaySelect} />,
    );
    fireEvent.click(screen.getByRole("button", { name: "Day 2" }));
    expect(onDaySelect).toHaveBeenCalledWith(2);
  });

  it("moves aria-current to Day 2 when activeDay=2", () => {
    render(
      <PlannerDayNavigation days={makeDays(3)} activeDay={2} onDaySelect={vi.fn()} />,
    );
    expect(screen.getByRole("button", { name: "Day 2" })).toHaveAttribute(
      "aria-current",
      "true",
    );
    expect(screen.getByRole("button", { name: "Day 1" })).not.toHaveAttribute(
      "aria-current",
    );
  });

  it("uses nowrap horizontal strip for many days", () => {
    const { container } = render(
      <PlannerDayNavigation days={makeDays(12)} activeDay={1} onDaySelect={vi.fn()} />,
    );
    const strip = container.querySelector(".flex-nowrap.overflow-x-auto");
    expect(strip).toBeTruthy();
    expect(screen.getByRole("button", { name: "Day 12" })).toBeInTheDocument();
  });

  it("hides nav when only one day", () => {
    render(
      <PlannerDayNavigation days={makeDays(1)} activeDay={1} onDaySelect={vi.fn()} />,
    );
    expect(screen.queryByTestId("planner-day-navigation")).not.toBeInTheDocument();
  });
});
