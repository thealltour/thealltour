import type { ReactNode } from "react";
import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";
import { cleanup, render, screen, within } from "@testing-library/react";
import { PlannerResultView } from "@/components/planner/PlannerResultView";
import { addDaysToIsoDate } from "@/lib/planner/planSchemas";
import type { PlannerPlan } from "@/lib/planner/planSchemas";
import type { PlannerAffiliateOffersDto } from "@/lib/affiliate/planner/types";

const trackImpression = vi.hoisted(() => vi.fn());
const trackClicked = vi.hoisted(() => vi.fn());

vi.mock("@/lib/analytics/trackPlannerEvents", () => ({
  trackPlannerDayNavigationClick: vi.fn(),
  trackAffiliateImpression: trackImpression,
  trackAffiliateClicked: trackClicked,
}));

vi.mock("@/components/planner/PlannerPlanSummary", () => ({
  PlannerPlanSummary: () => <div data-testid="plan-summary" />,
}));

vi.mock("@/components/planner/PlannerSavePanel", () => ({
  PlannerSavePanel: ({ compact }: { compact?: boolean }) => (
    <button type="button" data-testid="save-panel">
      {compact ? "플랜 저장" : "이 플랜 저장하기"}
    </button>
  ),
}));

vi.mock("@/components/planner/PlannerEditPanel", () => ({
  PlannerEditPanel: ({ compact }: { compact?: boolean }) => (
    <button type="button" data-testid="edit-panel">
      {compact ? "AI로 수정" : "AI로 일정 수정하기"}
    </button>
  ),
}));

vi.mock("@/components/planner/PlannerDaySection", () => ({
  PlannerDaySection: ({ day }: { day: { day: number; title: string } }) => (
    <div data-testid={`day-section-inner-${day.day}`}>
      DAY {day.day} · {day.title}
    </div>
  ),
}));

const offersState = vi.hoisted(() => ({
  value: {
    summary: [],
    preparation: [],
    days: {},
    disclosure: null,
  } as PlannerAffiliateOffersDto,
}));

vi.mock("@/components/planner/PlannerAffiliateOffers", () => ({
  PlannerAffiliateOffersProvider: ({
    children,
  }: {
    children: (offers: PlannerAffiliateOffersDto) => ReactNode;
  }) => children(offersState.value),
  PlannerAffiliateDaySlot: ({ dayNumber }: { dayNumber: number }) => (
    <div data-testid={`affiliate-day-${dayNumber}`} />
  ),
  PlannerAffiliateSummarySlot: () => <div data-testid="legacy-summary-slot" />,
  PlannerAffiliatePreparationSlot: () => <div data-testid="legacy-prep-slot" />,
}));

function makePlan(dayCount: number): PlannerPlan {
  return {
    title: "테스트 일정",
    summary: "테스트 요약입니다.",
    destination: { name: "오사카", country: "일본" },
    tripOverview: {
      startDate: "2026-10-17",
      endDate: addDaysToIsoDate("2026-10-17", dayCount - 1),
      nights: Math.max(0, dayCount - 1),
      days: dayCount,
      travelersSummary: "성인 2명",
      styleSummary: "테스트",
    },
    days: Array.from({ length: dayCount }, (_, i) => ({
      day: i + 1,
      date: addDaysToIsoDate("2026-10-17", i),
      title: `${i + 1}일차`,
      summary: "하루 요약",
      items: [
        {
          order: 1,
          time: "10:00",
          type: "attraction" as const,
          name: "명소",
          area: "난바",
          description: "둘러보기",
          estimatedDurationMinutes: 90,
          travelToNext: null,
          bookingRecommended: false,
        },
      ],
      tips: ["팁"],
    })),
    preparation: {
      travelTips: ["팁"],
      packingHints: ["신발"],
    },
  };
}

function makeOffer(
  partial: Partial<PlannerAffiliateOffersDto["summary"][number]> & {
    offerId: string;
    category: PlannerAffiliateOffersDto["summary"][number]["category"];
  },
) {
  return {
    providerId: "aviasales",
    placement: "planner_summary" as const,
    title: partial.title ?? "항공권 가격 확인",
    description: partial.description ?? "설명",
    ctaLabel: partial.ctaLabel ?? "항공권 보기",
    destinationLabel: partial.destinationLabel ?? "오사카",
    trackingToken: partial.trackingToken ?? `tok-${partial.offerId}`,
    ...partial,
  };
}

beforeEach(() => {
  cleanup();
  Element.prototype.scrollIntoView = vi.fn();
  trackImpression.mockClear();
  trackClicked.mockClear();
  offersState.value = {
    summary: [],
    preparation: [],
    days: {},
    disclosure: null,
  };
});

afterEach(() => {
  cleanup();
});

describe("PlannerResultView day navigation", () => {
  it("renders all day sections with planner-day ids", () => {
    render(
      <PlannerResultView
        plan={makePlan(3)}
        sessionId="550e8400-e29b-41d4-a716-446655440000"
        sourceProductId={null}
        isSaved={false}
        enrichment={null}
        onSaved={vi.fn()}
        onPlanUpdated={vi.fn()}
      />,
    );

    expect(document.getElementById("planner-day-1")).toBeTruthy();
    expect(document.getElementById("planner-day-2")).toBeTruthy();
    expect(document.getElementById("planner-day-3")).toBeTruthy();
    expect(screen.getByTestId("day-section-inner-1")).toBeInTheDocument();
    expect(screen.getByTestId("affiliate-day-1")).toBeInTheDocument();
  });

  it("shows day navigation for multi-day plans", () => {
    render(
      <PlannerResultView
        plan={makePlan(3)}
        sessionId="550e8400-e29b-41d4-a716-446655440000"
        sourceProductId={null}
        isSaved={false}
        enrichment={null}
        onSaved={vi.fn()}
        onPlanUpdated={vi.fn()}
      />,
    );
    expect(screen.getByTestId("planner-day-navigation")).toBeInTheDocument();
  });

  it("hides day navigation for 1-day plans but still renders the day", () => {
    render(
      <PlannerResultView
        plan={makePlan(1)}
        sessionId="550e8400-e29b-41d4-a716-446655440000"
        sourceProductId={null}
        isSaved={false}
        enrichment={null}
        onSaved={vi.fn()}
        onPlanUpdated={vi.fn()}
      />,
    );
    expect(screen.queryByTestId("planner-day-navigation")).not.toBeInTheDocument();
    expect(document.getElementById("planner-day-1")).toBeTruthy();
  });
});

describe("PlannerResultView information architecture", () => {
  it("orders summary → actions → days → booking → preparation → notices", () => {
    offersState.value = {
      summary: [makeOffer({ offerId: "f1", category: "flight" })],
      preparation: [],
      days: {},
      disclosure: "제휴 고지",
    };

    render(
      <PlannerResultView
        plan={makePlan(2)}
        sessionId="550e8400-e29b-41d4-a716-446655440000"
        sourceProductId={null}
        isSaved={false}
        enrichment={{
          planFingerprint: "fp",
          places: [],
          routes: [],
          weather: { availability: "too_early", days: [] },
          partialFailure: true,
          message: null,
        }}
        originText="서울"
        onSaved={vi.fn()}
        onPlanUpdated={vi.fn()}
      />,
    );

    const root = screen.getByTestId("planner-result-view");
    const order = [
      screen.getByTestId("plan-summary"),
      screen.getByTestId("planner-result-actions"),
      screen.getByText("일정"),
      screen.getByTestId("planner-day-section-1"),
      screen.getByTestId("planner-booking-surface"),
      screen.getByTestId("planner-result-preparation"),
      screen.getByTestId("planner-result-notices"),
    ];
    for (let i = 0; i < order.length - 1; i++) {
      expect(
        order[i]!.compareDocumentPosition(order[i + 1]!) & Node.DOCUMENT_POSITION_FOLLOWING,
      ).toBeTruthy();
    }
    expect(within(root).queryByTestId("legacy-summary-slot")).not.toBeInTheDocument();
    expect(within(root).queryByTestId("legacy-prep-slot")).not.toBeInTheDocument();
    expect(screen.queryByText("AI 초안 안내")).not.toBeInTheDocument();
    expect(screen.queryByText("일자별 일정")).not.toBeInTheDocument();
    expect(screen.getByText(/AI가 입력하신 여행 조건/)).toBeInTheDocument();
    expect(screen.getByText(/일부 장소 정보를 확인하지 못했습니다/)).toBeInTheDocument();
    expect(screen.getByText(/여행일이 가까워지면 최신 날씨/)).toBeInTheDocument();
  });

  it("omits BookingSurface when no global offers", () => {
    render(
      <PlannerResultView
        plan={makePlan(2)}
        sessionId="550e8400-e29b-41d4-a716-446655440000"
        sourceProductId={null}
        isSaved={false}
        enrichment={null}
        onSaved={vi.fn()}
        onPlanUpdated={vi.fn()}
      />,
    );
    expect(screen.queryByTestId("planner-booking-surface")).not.toBeInTheDocument();
  });

  it("keeps compact result actions in a two-column grid", () => {
    render(
      <PlannerResultView
        plan={makePlan(2)}
        sessionId="550e8400-e29b-41d4-a716-446655440000"
        sourceProductId={null}
        isSaved={false}
        enrichment={null}
        onSaved={vi.fn()}
        onPlanUpdated={vi.fn()}
      />,
    );
    const actions = screen.getByTestId("planner-result-actions");
    expect(actions).toHaveClass("grid-cols-2");
    expect(screen.getByTestId("save-panel")).toHaveTextContent("플랜 저장");
    expect(screen.getByTestId("edit-panel")).toHaveTextContent("AI로 수정");
  });
});

describe("PlannerBookingSurface", () => {
  it("renders flight only and shows city route + dates", async () => {
    const { PlannerBookingSurface } = await import(
      "@/components/planner/PlannerBookingSurface"
    );
    render(
      <PlannerBookingSurface
        offers={{
          summary: [makeOffer({ offerId: "f1", category: "flight" })],
          preparation: [],
          days: {},
          disclosure: "고지",
        }}
        sessionId="550e8400-e29b-41d4-a716-446655440000"
        sourceProductId={null}
        originText="서울"
        destinationName="오사카"
        startDate="2026-10-17"
        endDate="2026-10-21"
      />,
    );
    expect(screen.getByTestId("planner-booking-surface")).toBeInTheDocument();
    expect(screen.getByText("항공권")).toBeInTheDocument();
    expect(screen.getByText("서울 → 오사카")).toBeInTheDocument();
    expect(screen.getByText("10.17 → 10.21")).toBeInTheDocument();
    expect(screen.queryByText(/인천/)).not.toBeInTheDocument();
    expect(screen.queryByText(/간사이/)).not.toBeInTheDocument();
    expect(screen.getByText("고지")).toBeInTheDocument();
  });

  it("renders flight + esim and excludes activity", async () => {
    const { PlannerBookingSurface, collectBookingSurfaceOffers } = await import(
      "@/components/planner/PlannerBookingSurface"
    );
    const offers: PlannerAffiliateOffersDto = {
      summary: [makeOffer({ offerId: "f1", category: "flight" })],
      preparation: [
        makeOffer({
          offerId: "e1",
          category: "esim",
          placement: "preparation",
          title: "eSIM",
          ctaLabel: "eSIM 보기",
          providerId: "airalo",
        }),
      ],
      days: {
        "1": [
          makeOffer({
            offerId: "a1",
            category: "activity",
            placement: "day_item",
            title: "투어",
            providerId: "wegotrip",
          }),
        ],
      },
      disclosure: null,
    };
    expect(collectBookingSurfaceOffers(offers).map((o) => o.category)).toEqual([
      "flight",
      "esim",
    ]);

    render(
      <PlannerBookingSurface
        offers={offers}
        sessionId="550e8400-e29b-41d4-a716-446655440000"
        sourceProductId={null}
        originText="서울"
        destinationName="오사카"
        startDate="2026-10-17"
        endDate="2026-10-21"
      />,
    );
    expect(screen.getByText("항공권")).toBeInTheDocument();
    expect(screen.getAllByText("eSIM").length).toBeGreaterThanOrEqual(1);
    expect(screen.queryByText("투어")).not.toBeInTheDocument();
  });

  it("returns null when empty", async () => {
    const { PlannerBookingSurface } = await import(
      "@/components/planner/PlannerBookingSurface"
    );
    const { container } = render(
      <PlannerBookingSurface
        offers={{ summary: [], preparation: [], days: {}, disclosure: null }}
        sessionId="550e8400-e29b-41d4-a716-446655440000"
        sourceProductId={null}
        originText="서울"
        destinationName="오사카"
        startDate={null}
        endDate={null}
      />,
    );
    expect(container).toBeEmptyDOMElement();
  });
});
