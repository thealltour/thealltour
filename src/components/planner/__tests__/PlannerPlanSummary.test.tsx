import { describe, expect, it, afterEach } from "vitest";
import { cleanup, render, screen, within } from "@testing-library/react";
import { PlannerPlanSummary } from "@/components/planner/PlannerPlanSummary";
import type { PlannerPlan } from "@/lib/planner/planSchemas";

afterEach(() => {
  cleanup();
});

function makePlan(overrides?: Partial<PlannerPlan>): PlannerPlan {
  return {
    title: "후쿠오카 6박 7일 맛집 탐방 자유여행",
    summary: "현지 맛집과 여유로운 동선을 중심으로 구성한 일정입니다.",
    destination: { name: "후쿠오카", country: "일본" },
    tripOverview: {
      startDate: "2026-10-17",
      endDate: "2026-10-23",
      nights: 6,
      days: 7,
      travelersSummary: "혼자 · 성인 1명",
      styleSummary: "균형 있게 · 미식 중심",
    },
    days: [
      {
        day: 1,
        date: "2026-10-17",
        title: "도착",
        summary: "적응",
        items: [
          {
            order: 1,
            time: "12:00",
            type: "transport",
            name: "공항",
            area: null,
            description: "도착",
            estimatedDurationMinutes: 30,
            travelToNext: null,
            bookingRecommended: false,
          },
        ],
        tips: [],
      },
    ],
    preparation: { travelTips: ["팁"], packingHints: ["신발"] },
    ...overrides,
  };
}

describe("PlannerPlanSummary overview", () => {
  it("renders title, summary, and 2x2 compact facts with pace", () => {
    render(<PlannerPlanSummary plan={makePlan()} originText="서울" pace="balanced" />);

    expect(screen.getByRole("heading", { level: 1 })).toHaveTextContent(
      "후쿠오카 6박 7일 맛집 탐방 자유여행",
    );
    expect(
      screen.getByText("현지 맛집과 여유로운 동선을 중심으로 구성한 일정입니다."),
    ).toBeInTheDocument();

    const overview = screen.getByTestId("planner-plan-overview");
    expect(overview).toHaveClass("grid-cols-2");
    expect(overview).toHaveTextContent("여행지");
    expect(overview).toHaveTextContent("서울 → 후쿠오카");
    expect(overview).toHaveTextContent("일본");
    expect(overview).toHaveTextContent("기간");
    expect(overview).toHaveTextContent("2026.10.17 → 2026.10.23 · 6박 7일");
    expect(overview).toHaveTextContent("인원");
    expect(overview).toHaveTextContent("혼자 · 성인 1명");
    expect(overview).toHaveTextContent("여행 속도");
    expect(overview).toHaveTextContent("균형 있게");
    expect(overview).not.toHaveTextContent("스타일");

    const items = within(overview).getAllByRole("term");
    expect(items).toHaveLength(4);
    for (const item of overview.querySelectorAll(":scope > div")) {
      expect(item.className).not.toMatch(/col-span-2/);
    }

    // Route must live in overview only — not as a separate caption above the title.
    const header = screen.getByTestId("planner-plan-summary");
    const h1 = screen.getByRole("heading", { level: 1 });
    const beforeTitle = header.firstElementChild;
    expect(beforeTitle).toBe(h1);
  });

  it("shows destination-only route when origin is missing", () => {
    render(<PlannerPlanSummary plan={makePlan()} pace="relaxed" />);
    const overview = screen.getByTestId("planner-plan-overview");
    expect(overview).toHaveTextContent("후쿠오카");
    expect(overview).not.toHaveTextContent("서울 →");
    expect(overview).toHaveTextContent("여유롭게");
  });

  it("formats flexible dates without inventing a range", () => {
    render(
      <PlannerPlanSummary
        plan={makePlan({
          tripOverview: {
            startDate: null,
            endDate: null,
            nights: 6,
            days: 7,
            travelersSummary: "성인 2명",
            styleSummary: "여유롭게",
          },
        })}
        originText="서울"
        pace="relaxed"
      />,
    );
    expect(screen.getByText("7일 · 날짜 미정")).toBeInTheDocument();
  });

  it("renders styleSummary outside the 2x2 grid without truncating", () => {
    const longStyle = "현지 미식과 쇼핑을 여유롭게 즐기는 밸런스 여행";
    render(
      <PlannerPlanSummary
        plan={makePlan({
          tripOverview: {
            startDate: "2026-10-17",
            endDate: "2026-10-23",
            nights: 6,
            days: 7,
            travelersSummary: "성인 1명",
            styleSummary: longStyle,
          },
        })}
        originText="서울"
        pace="balanced"
      />,
    );

    const overview = screen.getByTestId("planner-plan-overview");
    expect(overview).toHaveClass("grid-cols-2");
    expect(overview).not.toHaveTextContent(longStyle);

    const styleSection = screen.getByTestId("planner-plan-style");
    expect(styleSection).toHaveTextContent("여행 스타일");
    expect(styleSection).toHaveTextContent(longStyle);
    expect(screen.queryByText(/\.\.\.$/)).not.toBeInTheDocument();
    expect(styleSection.className).not.toMatch(/col-span/);
  });

  it("falls back pace cell to styleSummary when pace is missing", () => {
    render(<PlannerPlanSummary plan={makePlan()} originText="서울" />);
    const overview = screen.getByTestId("planner-plan-overview");
    expect(overview).toHaveTextContent("여행 속도");
    expect(overview).toHaveTextContent("균형 있게 · 미식 중심");
  });
});
