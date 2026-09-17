import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";
import { act, cleanup, render, screen } from "@testing-library/react";
import { PlannerGenerationView } from "@/components/planner/PlannerGenerationView";

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
    expect(root.textContent).not.toMatch(/%/);
    expect(root.textContent).not.toMatch(/100%/);
    expect(root.textContent).not.toMatch(/마지막 단계/);
    expect(root.querySelector('[aria-hidden="true"].relative')).toBeTruthy();
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
