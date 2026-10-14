import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";
import { act, cleanup, render, screen } from "@testing-library/react";
import {
  estimatePlannerProgressPercent,
  PlannerGenerationView,
} from "@/components/planner/PlannerGenerationView";

describe("PlannerGenerationView", () => {
  beforeEach(() => {
    cleanup();
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("renders destination headline, supporting copy, progress, and status", () => {
    render(
      <PlannerGenerationView destination="후쿠오카" contextLine="7일 여행 · 혼자 · 맛집 · 균형 있게" />,
    );

    const root = screen.getByRole("status");
    expect(root).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: /후쿠오카 여행을 만들고 있어요/ })).toBeInTheDocument();
    expect(screen.getByText(/선택한 여행 조건을 바탕으로/)).toBeInTheDocument();
    expect(screen.getByText("7일 여행 · 혼자 · 맛집 · 균형 있게")).toBeInTheDocument();
    expect(screen.getByText(/여행 속도를 일정에 반영/)).toBeInTheDocument();
    const progress = screen.getByRole("progressbar", { name: "일정 생성 진행률" });
    expect(progress).toHaveAttribute("aria-valuenow", "0");
    expect(screen.getByText("0%")).toBeInTheDocument();
    expect(root.textContent).not.toMatch(/마지막 단계/);
  });

  it("advances the estimated percent over time", async () => {
    render(<PlannerGenerationView destination="오사카" />);
    await act(async () => {
      vi.advanceTimersByTime(30_000);
    });
    const progress = screen.getByRole("progressbar", { name: "일정 생성 진행률" });
    const at30s = Number(progress.getAttribute("aria-valuenow"));
    expect(at30s).toBe(estimatePlannerProgressPercent(30_000));
    expect(screen.getByText(`${at30s}%`)).toBeInTheDocument();

    await act(async () => {
      vi.advanceTimersByTime(60_000);
    });
    expect(Number(progress.getAttribute("aria-valuenow"))).toBeGreaterThan(at30s);
  });

  it("estimate rises monotonically and never claims completion", () => {
    expect(estimatePlannerProgressPercent(0)).toBe(0);
    expect(estimatePlannerProgressPercent(30_000)).toBeGreaterThan(30);
    expect(estimatePlannerProgressPercent(80_000)).toBeGreaterThan(75);
    expect(estimatePlannerProgressPercent(80_000)).toBeGreaterThan(
      estimatePlannerProgressPercent(30_000),
    );
    expect(estimatePlannerProgressPercent(600_000)).toBeGreaterThanOrEqual(90);
    expect(estimatePlannerProgressPercent(600_000)).toBeLessThanOrEqual(95);
    expect(estimatePlannerProgressPercent(10_000, "edit")).toBeGreaterThan(
      estimatePlannerProgressPercent(10_000, "create"),
    );
  });

  it("rotates status copy without claiming completion", async () => {
    render(<PlannerGenerationView destination="오사카" />);
    expect(screen.getByText(/여행 속도를 일정에 반영/)).toBeInTheDocument();
    await act(async () => {
      vi.advanceTimersByTime(2800);
    });
    expect(screen.getByText(/관심사에 맞는 하루 흐름/)).toBeInTheDocument();
  });

  it("shows long-wait reassurance after delay", async () => {
    render(<PlannerGenerationView destination="다낭" />);
    await act(async () => {
      vi.advanceTimersByTime(12_000);
    });
    expect(screen.getByText(/조금 더 세밀하게 일정을 정리/)).toBeInTheDocument();
  });
});
