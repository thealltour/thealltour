import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, screen, waitFor } from "@testing-library/react";
import { PlannerResultLoader } from "@/components/planner/PlannerResultLoader";

const fetchMock = vi.hoisted(() => vi.fn());

vi.mock("@/lib/planner/anonymousKey", () => ({
  getOrCreatePlannerAnonymousKey: () => "anon-loader-test-key1",
}));

vi.mock("@/lib/planner/saveClient", () => ({
  fetchPlannerMemberAuthenticated: vi.fn(async () => false),
  postPlannerSessionSave: vi.fn(),
}));

vi.mock("@/lib/analytics/trackPlannerEvents", () => ({
  trackPlannerEnrichmentFailed: vi.fn(),
  trackPlannerEnrichmentLoaded: vi.fn(),
  trackPlannerRoutesFailed: vi.fn(),
  trackPlannerRoutesLoaded: vi.fn(),
  trackPlannerSaved: vi.fn(),
}));

vi.mock("@/components/planner/PlannerResultView", () => ({
  PlannerResultView: (props: {
    originText?: string | null;
    pace?: string | null;
    plan: { title: string };
  }) => (
    <div
      data-testid="mock-result-view"
      data-origin={props.originText ?? ""}
      data-pace={props.pace ?? ""}
    >
      {props.plan.title}
    </div>
  ),
}));

vi.stubGlobal("fetch", fetchMock);

afterEach(() => {
  cleanup();
});

beforeEach(() => {
  vi.clearAllMocks();
});

describe("PlannerResultLoader pace wiring", () => {
  it("passes read input pace and originText to ResultView", async () => {
    fetchMock.mockImplementation(async (input: RequestInfo) => {
      const url = String(input);
      if (url.includes("/read")) {
        return new Response(
          JSON.stringify({
            session: {
              id: "sess-1",
              status: "generated",
              sourceProductId: null,
              isSaved: false,
              input: {
                origin: { text: "서울" },
                destination: { text: "후쿠오카" },
                pace: "balanced",
                interests: ["food"],
              },
              plan: {
                title: "테스트 플랜",
                summary: "요약",
                destination: { name: "후쿠오카", country: "일본" },
                tripOverview: {
                  startDate: "2026-10-01",
                  endDate: "2026-10-03",
                  nights: 2,
                  days: 3,
                  travelersSummary: "성인 2명",
                  styleSummary: "미식",
                },
                days: [
                  {
                    day: 1,
                    date: "2026-10-01",
                    title: "1일차",
                    summary: "요약",
                    items: [
                      {
                        order: 1,
                        time: "10:00",
                        type: "attraction",
                        name: "명소",
                        area: null,
                        description: "설명",
                        estimatedDurationMinutes: 60,
                        travelToNext: null,
                        bookingRecommended: false,
                      },
                      {
                        order: 2,
                        time: "12:00",
                        type: "food",
                        name: "식사",
                        area: null,
                        description: "설명",
                        estimatedDurationMinutes: 60,
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
              },
            },
          }),
          { status: 200 },
        );
      }
      if (url.includes("/enrich")) {
        return new Response(JSON.stringify({ enrichment: { places: [], routes: [] } }), {
          status: 200,
        });
      }
      return new Response("{}", { status: 404 });
    });

    render(<PlannerResultLoader sessionId="sess-1" />);

    await waitFor(() => {
      expect(screen.getByTestId("mock-result-view")).toBeInTheDocument();
    });
    const view = screen.getByTestId("mock-result-view");
    expect(view).toHaveAttribute("data-origin", "서울");
    expect(view).toHaveAttribute("data-pace", "balanced");
    expect(view).toHaveTextContent("테스트 플랜");
  });

  it("omits invalid pace values", async () => {
    fetchMock.mockImplementation(async (input: RequestInfo) => {
      const url = String(input);
      if (url.includes("/read")) {
        return new Response(
          JSON.stringify({
            session: {
              id: "sess-2",
              status: "generated",
              sourceProductId: null,
              isSaved: false,
              input: {
                origin: { text: "부산" },
                pace: "turbo",
              },
              plan: {
                title: "플랜2",
                summary: "요약",
                destination: { name: "오사카", country: null },
                tripOverview: {
                  startDate: null,
                  endDate: null,
                  nights: 2,
                  days: 3,
                  travelersSummary: "성인 1명",
                  styleSummary: "스타일",
                },
                days: [
                  {
                    day: 1,
                    date: null,
                    title: "1일차",
                    summary: "요약",
                    items: [
                      {
                        order: 1,
                        time: null,
                        type: "other",
                        name: "일정",
                        area: null,
                        description: "설명",
                        estimatedDurationMinutes: 30,
                        travelToNext: null,
                        bookingRecommended: false,
                      },
                      {
                        order: 2,
                        time: null,
                        type: "food",
                        name: "식사",
                        area: null,
                        description: "설명",
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
              },
            },
          }),
          { status: 200 },
        );
      }
      return new Response(JSON.stringify({ enrichment: { places: [], routes: [] } }), {
        status: 200,
      });
    });

    render(<PlannerResultLoader sessionId="sess-2" />);
    await waitFor(() => {
      expect(screen.getByTestId("mock-result-view")).toBeInTheDocument();
    });
    expect(screen.getByTestId("mock-result-view")).toHaveAttribute("data-pace", "");
    expect(screen.getByTestId("mock-result-view")).toHaveAttribute("data-origin", "부산");
  });
});
