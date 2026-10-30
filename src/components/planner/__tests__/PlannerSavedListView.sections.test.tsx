import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, screen, waitFor } from "@testing-library/react";
import { PlannerSavedListView } from "@/components/planner/PlannerSavedListView";

const fetchMock = vi.hoisted(() => vi.fn());

vi.mock("@/lib/auth/oauthStart", () => ({
  startOAuthLogin: vi.fn(),
}));

vi.mock("@/lib/analytics/trackPlannerEvents", () => ({
  trackPlannerSavedListViewed: vi.fn(),
  trackPlannerSavedPlanOpened: vi.fn(),
}));

vi.stubGlobal("fetch", fetchMock);

afterEach(() => {
  cleanup();
});

beforeEach(() => {
  vi.clearAllMocks();
});

const item = (id: string, title: string) => ({
  id,
  title,
  destination: "오사카",
  dateMode: "fixed" as const,
  startDate: "2026-10-01",
  endDate: "2026-10-02",
  days: 2,
  travelersSummary: "2명",
  styleSummary: "여유",
  updatedAt: "2026-10-31T00:00:00.000Z",
  sourceProductId: null,
});

describe("PlannerSavedListView sections", () => {
  it("shows 작성 중 and 저장한 플랜 separately", async () => {
    fetchMock.mockResolvedValue(
      new Response(
        JSON.stringify({
          plans: [item("saved-1", "저장된 플랜")],
          count: 1,
          generatedPlans: [item("gen-1", "작성중 플랜")],
          generatedCount: 1,
        }),
        { status: 200 },
      ),
    );

    render(<PlannerSavedListView />);

    await waitFor(() => {
      expect(screen.getByRole("heading", { name: "작성 중" })).toBeInTheDocument();
    });
    expect(screen.getByRole("heading", { name: "저장한 플랜" })).toBeInTheDocument();
    expect(screen.getByText("작성중 플랜")).toBeInTheDocument();
    expect(screen.getByText("저장된 플랜")).toBeInTheDocument();
    expect(screen.getByText("이어서 보기")).toBeInTheDocument();
    expect(screen.getByTestId("planner-in-progress-card").getAttribute("href")).toBe(
      "/planner/gen-1",
    );
  });

  it("empty when both lists empty", async () => {
    fetchMock.mockResolvedValue(
      new Response(JSON.stringify({ plans: [], generatedPlans: [] }), { status: 200 }),
    );
    render(<PlannerSavedListView />);
    await waitFor(() => {
      expect(screen.getByText("아직 여행 플랜이 없어요.")).toBeInTheDocument();
    });
  });
});
