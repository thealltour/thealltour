import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";
import { cleanup, render, act } from "@testing-library/react";
import { useState } from "react";
import { usePlannerDayScrollSpy } from "@/components/planner/usePlannerDayScrollSpy";

type ObserverCb = IntersectionObserverCallback;

let latestCallback: ObserverCb | null = null;
let latestRootMargin = "";
const observe = vi.fn();
const disconnect = vi.fn();

beforeEach(() => {
  cleanup();
  latestCallback = null;
  latestRootMargin = "";
  observe.mockClear();
  disconnect.mockClear();

  class MockIntersectionObserver {
    constructor(cb: ObserverCb, options?: IntersectionObserverInit) {
      latestCallback = cb;
      latestRootMargin = options?.rootMargin ?? "";
    }
    observe = observe;
    unobserve = vi.fn();
    disconnect = disconnect;
    takeRecords = () => [];
    root = null;
    rootMargin = "";
    thresholds = [];
  }

  vi.stubGlobal("IntersectionObserver", MockIntersectionObserver);
});

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

function Harness({ days }: { days: number[] }) {
  const [active, setActive] = useState(days[0] ?? 1);
  usePlannerDayScrollSpy({
    dayNumbers: days,
    onActiveDayChange: setActive,
  });
  return (
    <div>
      <div data-testid="active">{active}</div>
      {days.map((d) => (
        <section key={d} id={`planner-day-${d}`} data-planner-day={d}>
          Day {d}
        </section>
      ))}
    </div>
  );
}

describe("usePlannerDayScrollSpy", () => {
  it("updates active day when Day 2 intersects with higher ratio", async () => {
    const { getByTestId } = render(<Harness days={[1, 2, 3]} />);
    expect(getByTestId("active").textContent).toBe("1");
    expect(observe).toHaveBeenCalled();
    expect(latestCallback).toBeTruthy();

    const day1 = document.getElementById("planner-day-1")!;
    const day2 = document.getElementById("planner-day-2")!;

    await act(async () => {
      latestCallback!(
        [
          {
            target: day1,
            isIntersecting: true,
            intersectionRatio: 0.2,
          } as unknown as IntersectionObserverEntry,
          {
            target: day2,
            isIntersecting: true,
            intersectionRatio: 0.8,
          } as unknown as IntersectionObserverEntry,
        ],
        {} as IntersectionObserver,
      );
      await new Promise((r) => requestAnimationFrame(() => r(undefined)));
    });

    expect(getByTestId("active").textContent).toBe("2");
  });

  it("uses result sticky offset without search-row (112px)", () => {
    render(<Harness days={[1, 2]} />);
    expect(latestRootMargin).toBe("-112px 0px -55% 0px");
  });

  it("disconnects on unmount", () => {
    const { unmount } = render(<Harness days={[1, 2]} />);
    unmount();
    expect(disconnect).toHaveBeenCalled();
  });
});
