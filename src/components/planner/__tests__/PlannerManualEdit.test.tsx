import { beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { PlannerResultView } from "@/components/planner/PlannerResultView";
import { PlannerDaySection } from "@/components/planner/PlannerDaySection";
import type { PlannerPlan, PlannerPlanDay } from "@/lib/planner/planSchemas";
import { plannerPlanSchema } from "@/lib/planner/planSchemas";

const postPlannerManualEdit = vi.hoisted(() => vi.fn());

vi.mock("next/navigation", () => ({
  useRouter: () => ({ replace: vi.fn() }),
  usePathname: () => "/planner/x",
  useSearchParams: () => ({ get: () => null, toString: () => "" }),
}));

vi.mock("next/link", () => ({
  default: ({ href, children }: { href: string; children: React.ReactNode }) => (
    <a href={href}>{children}</a>
  ),
}));

vi.mock("@/lib/analytics/trackPlannerEvents", () => ({
  trackPlannerDayNavigationClick: vi.fn(),
  trackPlannerManualEditModeStarted: vi.fn(),
  trackPlannerManualDayUpdated: vi.fn(),
  trackPlannerManualItemUpdated: vi.fn(),
  trackPlannerManualItemAdded: vi.fn(),
  trackPlannerManualItemDeleted: vi.fn(),
  trackPlannerManualItemMoved: vi.fn(),
  trackPlannerEditStarted: vi.fn(),
  trackPlannerEditSucceeded: vi.fn(),
  trackPlannerEditFailed: vi.fn(),
  trackPlannerKakaoLoginStarted: vi.fn(),
  trackPlannerKakaoMemoClicked: vi.fn(),
  trackPlannerKakaoMemoOAuthStarted: vi.fn(),
  trackPlannerKakaoCalendarClicked: vi.fn(),
  trackPlannerKakaoCalendarOAuthStarted: vi.fn(),
  trackPlannerSaveClicked: vi.fn(),
  trackPlannerSaved: vi.fn(),
}));

vi.mock("@/lib/planner/manualEdit/client", () => ({
  postPlannerManualEdit,
}));

vi.mock("@/lib/planner/saveClient", () => ({
  fetchPlannerMemberAuthenticated: vi.fn(async () => true),
  postPlannerSessionSave: vi.fn(async () => ({ ok: true })),
}));

vi.mock("@/components/planner/PlannerAffiliateOffers", () => ({
  PlannerAffiliateOffersProvider: ({
    children,
  }: {
    children: (offers: {
      summary: never[];
      preparation: never[];
      days: Record<string, never[]>;
      disclosure: string;
    }) => React.ReactNode;
  }) =>
    children({
      summary: [],
      preparation: [],
      days: {},
      disclosure: "",
    }),
}));

vi.mock("@/components/planner/PlannerPreparationHub", () => ({
  PlannerPreparationHub: () => null,
}));

vi.mock("@/components/planner/PlannerPlanSummary", () => ({
  PlannerPlanSummary: () => <div data-testid="plan-summary" />,
}));

vi.mock("@/components/planner/PlannerSavePanel", () => ({
  PlannerSavePanel: () => <div data-testid="save-panel">플랜 저장</div>,
}));

vi.mock("@/components/planner/PlannerEditPanel", () => ({
  PlannerEditPanel: () => <div data-testid="edit-panel">AI로 수정</div>,
}));

vi.mock("@/components/planner/PlannerDayMap", () => ({
  PlannerDayMap: () => null,
}));

function makePlan(): PlannerPlan {
  return plannerPlanSchema.parse({
    title: "오사카",
    summary: "요약",
    destination: { name: "오사카", country: "일본" },
    tripOverview: {
      startDate: "2026-10-01",
      endDate: "2026-10-02",
      nights: 1,
      days: 2,
      travelersSummary: "2명",
      styleSummary: "여유",
    },
    days: [
      {
        day: 1,
        date: "2026-10-01",
        title: "도착일",
        summary: "적응",
        items: [
          {
            order: 1,
            time: "12:00",
            type: "transport",
            name: "공항",
            area: "간사이",
            description: "도착",
            estimatedDurationMinutes: 60,
            travelToNext: null,
            bookingRecommended: false,
          },
          {
            order: 2,
            time: "15:00",
            type: "food",
            name: "라멘",
            area: null,
            description: "식사",
            estimatedDurationMinutes: 45,
            travelToNext: null,
            bookingRecommended: false,
          },
        ],
        tips: [],
      },
      {
        day: 2,
        date: "2026-10-02",
        title: "귀국",
        summary: "이동",
        items: [
          {
            order: 1,
            time: "10:00",
            type: "other",
            name: "체크아웃",
            area: null,
            description: "호텔",
            estimatedDurationMinutes: 30,
            travelToNext: null,
            bookingRecommended: false,
          },
        ],
        tips: [],
      },
    ],
    preparation: {
      travelTips: ["팁"],
      packingHints: ["신발"],
    },
  });
}

describe("PlannerResultView manual edit entry", () => {
  beforeEach(() => {
    cleanup();
    vi.clearAllMocks();
  });

  it("toggles manual edit mode", () => {
    render(
      <PlannerResultView
        plan={makePlan()}
        updatedAt="2026-10-31T00:00:00.000Z"
        sessionId="550e8400-e29b-41d4-a716-446655440000"
        sourceProductId={null}
        isSaved={false}
        isMemberLinked={true}
        enrichment={null}
        onSaved={vi.fn()}
        onMemberLinked={vi.fn()}
        onReloadLatest={vi.fn()}
        onPlanUpdated={vi.fn()}
      />,
    );
    expect(screen.queryByText("직접 수정 중")).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "직접 수정" }));
    expect(screen.getByText("직접 수정 중")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "수정 종료" })).toBeInTheDocument();
    expect(screen.getByTestId("planner-day-add-item-1")).toBeInTheDocument();
  });
});

describe("PlannerDaySection manual controls", () => {
  const day: PlannerPlanDay = makePlan().days[0]!;

  beforeEach(() => {
    cleanup();
  });

  it("shows edit/move/delete/add and disables edges", () => {
    const onMoveItem = vi.fn();
    render(
      <PlannerDaySection
        day={day}
        sessionId="550e8400-e29b-41d4-a716-446655440000"
        manualEditMode
        onEditDayTitle={vi.fn()}
        onEditItem={vi.fn()}
        onAddItem={vi.fn()}
        onDeleteItem={vi.fn()}
        onMoveItem={onMoveItem}
      />,
    );
    expect(screen.getByRole("button", { name: "도착일 제목 수정" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "공항 위로 이동" })).toBeDisabled();
    expect(screen.getByRole("button", { name: "라멘 아래로 이동" })).toBeDisabled();
    expect(screen.getByRole("button", { name: "공항 삭제" })).not.toBeDisabled();
    fireEvent.click(screen.getByRole("button", { name: "공항 아래로 이동" }));
    expect(onMoveItem).toHaveBeenCalledWith(1, "down");
  });

  it("disables delete when only one item", () => {
    render(
      <PlannerDaySection
        day={makePlan().days[1]!}
        sessionId="550e8400-e29b-41d4-a716-446655440000"
        manualEditMode
        onDeleteItem={vi.fn()}
      />,
    );
    expect(screen.getByRole("button", { name: "체크아웃 삭제" })).toBeDisabled();
  });
});

describe("PlannerResultView day title save", () => {
  beforeEach(() => {
    cleanup();
    vi.clearAllMocks();
    postPlannerManualEdit.mockResolvedValue({
      ok: true,
      plan: makePlan(),
      updatedAt: "2026-10-31T02:00:00.000Z",
      status: "generated",
      operation: "update_day",
    });
  });

  it("opens day title modal and saves", async () => {
    const onPlanUpdated = vi.fn();
    render(
      <PlannerResultView
        plan={makePlan()}
        updatedAt="2026-10-31T00:00:00.000Z"
        sessionId="550e8400-e29b-41d4-a716-446655440000"
        sourceProductId={null}
        isSaved={false}
        isMemberLinked={true}
        enrichment={null}
        onSaved={vi.fn()}
        onMemberLinked={vi.fn()}
        onReloadLatest={vi.fn()}
        onPlanUpdated={onPlanUpdated}
      />,
    );
    fireEvent.click(screen.getByRole("button", { name: "직접 수정" }));
    fireEvent.click(screen.getByRole("button", { name: "도착일 제목 수정" }));
    expect(screen.getByRole("heading", { name: "Day 제목 수정" })).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "저장" }));
    await waitFor(() => {
      expect(postPlannerManualEdit).toHaveBeenCalled();
      expect(onPlanUpdated).toHaveBeenCalled();
    });
  });

  it("shows conflict reload CTA", async () => {
    const onReloadLatest = vi.fn();
    postPlannerManualEdit.mockResolvedValue({
      ok: false,
      status: 409,
      code: "PLAN_VERSION_CONFLICT",
      message: "다른 곳에서 일정이 변경되었습니다.",
    });
    render(
      <PlannerResultView
        plan={makePlan()}
        updatedAt="2026-10-31T00:00:00.000Z"
        sessionId="550e8400-e29b-41d4-a716-446655440000"
        sourceProductId={null}
        isSaved={false}
        isMemberLinked={true}
        enrichment={null}
        onSaved={vi.fn()}
        onMemberLinked={vi.fn()}
        onReloadLatest={onReloadLatest}
        onPlanUpdated={vi.fn()}
      />,
    );
    fireEvent.click(screen.getByRole("button", { name: "직접 수정" }));
    fireEvent.click(screen.getByRole("button", { name: "도착일 제목 수정" }));
    fireEvent.click(screen.getByRole("button", { name: "저장" }));
    await waitFor(() => {
      expect(screen.getByText("일정이 변경되었어요.")).toBeInTheDocument();
    });
    fireEvent.click(screen.getByRole("button", { name: "최신 일정 불러오기" }));
    expect(onReloadLatest).toHaveBeenCalled();
  });
});
