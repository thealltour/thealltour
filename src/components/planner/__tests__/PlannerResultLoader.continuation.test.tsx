import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, waitFor } from "@testing-library/react";
import { PlannerResultLoader } from "@/components/planner/PlannerResultLoader";
import {
  clearPlannerContinuationIntent,
  setPlannerContinuationIntent,
} from "@/lib/planner/continuationIntent";
import { setPlannerSaveIntent, clearPlannerSaveIntent } from "@/lib/planner/saveIntent";

const fetchMock = vi.hoisted(() => vi.fn());
const postClaim = vi.hoisted(() => vi.fn());
const postSave = vi.hoisted(() => vi.fn());
const fetchAuth = vi.hoisted(() => vi.fn());
const trackClaimed = vi.hoisted(() => vi.fn());
const trackSaved = vi.hoisted(() => vi.fn());

vi.mock("@/lib/planner/anonymousKey", () => ({
  getOrCreatePlannerAnonymousKey: () => "anon-loader-test-key1",
}));

vi.mock("@/lib/planner/saveClient", () => ({
  fetchPlannerMemberAuthenticated: fetchAuth,
  postPlannerSessionSave: postSave,
}));

vi.mock("@/lib/planner/claimClient", () => ({
  postPlannerSessionClaim: postClaim,
}));

vi.mock("@/lib/analytics/trackPlannerEvents", () => ({
  trackPlannerEnrichmentFailed: vi.fn(),
  trackPlannerEnrichmentLoaded: vi.fn(),
  trackPlannerRoutesFailed: vi.fn(),
  trackPlannerRoutesLoaded: vi.fn(),
  trackPlannerSaved: trackSaved,
  trackPlannerGuestPlanClaimed: trackClaimed,
  trackPlannerGuestPlanClaimFailed: vi.fn(),
}));

const resultViewProps = vi.hoisted(() => ({ current: null as null | Record<string, unknown> }));

vi.mock("@/components/planner/PlannerResultView", () => ({
  PlannerResultView: (props: Record<string, unknown>) => {
    resultViewProps.current = props;
    return <div data-testid="mock-result-view" data-saved={String(props.isSaved)} />;
  },
}));

vi.stubGlobal("fetch", fetchMock);

const SESSION_ID = "550e8400-e29b-41d4-a716-446655440000";

function planPayload() {
  return {
    title: "테스트",
    summary: "요약",
    destination: { name: "오사카", country: "일본" },
    tripOverview: {
      startDate: "2026-10-01",
      endDate: "2026-10-02",
      nights: 1,
      days: 2,
      travelersSummary: "2",
      styleSummary: "여유",
    },
    days: [
      {
        day: 1,
        date: "2026-10-01",
        title: "1",
        summary: "s",
        items: [
          {
            order: 1,
            time: "10:00",
            type: "attraction",
            name: "장소",
            area: null,
            description: "d",
            estimatedDurationMinutes: 60,
            travelToNext: null,
            bookingRecommended: false,
          },
        ],
        tips: [],
      },
      {
        day: 2,
        date: "2026-10-02",
        title: "2",
        summary: "s",
        items: [
          {
            order: 1,
            time: "11:00",
            type: "other",
            name: "이동",
            area: null,
            description: "d",
            estimatedDurationMinutes: 30,
            travelToNext: null,
            bookingRecommended: false,
          },
        ],
        tips: [],
      },
    ],
    preparation: { travelTips: [], packingHints: [] },
  };
}

afterEach(() => {
  cleanup();
  clearPlannerContinuationIntent();
  clearPlannerSaveIntent();
});

beforeEach(() => {
  vi.clearAllMocks();
  resultViewProps.current = null;
  sessionStorage.clear();
  fetchAuth.mockResolvedValue(true);
  fetchMock.mockImplementation(async (input: RequestInfo) => {
    const url = String(input);
    if (url.includes("/read")) {
      return new Response(
        JSON.stringify({
          session: {
            id: SESSION_ID,
            status: "generated",
            isSaved: false,
            isOwner: false,
            updatedAt: "2026-10-31T00:00:00.000Z",
            sourceProductId: null,
            plan: planPayload(),
            input: { destination: { text: "오사카" }, pace: "balanced" },
          },
        }),
        { status: 200 },
      );
    }
    if (url.includes("/enrich")) {
      return new Response(JSON.stringify({ enrichment: null }), { status: 200 });
    }
    return new Response("{}", { status: 404 });
  });
});

describe("PlannerResultLoader continuation vs save", () => {
  it("continuationIntent → claim only, no auto save, stays generated", async () => {
    setPlannerContinuationIntent(SESSION_ID);
    postClaim.mockResolvedValue({
      ok: true,
      claimed: true,
      session: {
        id: SESSION_ID,
        status: "generated",
        isSaved: false,
        updatedAt: "2026-10-31T00:00:00.000Z",
      },
    });

    render(<PlannerResultLoader sessionId={SESSION_ID} />);

    await waitFor(() => {
      expect(postClaim).toHaveBeenCalledWith(SESSION_ID);
    });
    expect(postSave).not.toHaveBeenCalled();
    expect(trackClaimed).toHaveBeenCalled();
    expect(trackSaved).not.toHaveBeenCalled();
    await waitFor(() => {
      expect(resultViewProps.current?.isSaved).toBe(false);
      expect(resultViewProps.current?.isMemberLinked).toBe(true);
      expect(resultViewProps.current?.updatedAt).toBe("2026-10-31T00:00:00.000Z");
    });
  });

  it("intent sessionId mismatch → no claim", async () => {
    setPlannerContinuationIntent("aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeeeeeee");
    fetchAuth.mockResolvedValue(true);

    render(<PlannerResultLoader sessionId={SESSION_ID} />);

    await waitFor(() => expect(resultViewProps.current?.plan).toBeTruthy());
    expect(postClaim).not.toHaveBeenCalled();
    expect(postSave).not.toHaveBeenCalled();
  });

  it("expired continuationIntent → no claim", async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    vi.setSystemTime(new Date("2026-10-31T00:00:00.000Z"));
    setPlannerContinuationIntent(SESSION_ID);
    vi.setSystemTime(new Date("2026-10-31T02:00:00.000Z"));

    render(<PlannerResultLoader sessionId={SESSION_ID} />);

    await waitFor(() => expect(resultViewProps.current?.plan).toBeTruthy());
    expect(postClaim).not.toHaveBeenCalled();
    vi.useRealTimers();
  });

  it("logged in without intent → no automatic claim", async () => {
    fetchAuth.mockResolvedValue(true);
    clearPlannerContinuationIntent();
    clearPlannerSaveIntent();

    render(<PlannerResultLoader sessionId={SESSION_ID} />);

    await waitFor(() => expect(resultViewProps.current?.plan).toBeTruthy());
    expect(postClaim).not.toHaveBeenCalled();
    expect(postSave).not.toHaveBeenCalled();
  });

  it("claim failure keeps plan visible and does not save", async () => {
    setPlannerContinuationIntent(SESSION_ID);
    postClaim.mockResolvedValue({ ok: false, message: "fail", status: 403 });

    render(<PlannerResultLoader sessionId={SESSION_ID} />);

    await waitFor(() => expect(postClaim).toHaveBeenCalled());
    expect(postSave).not.toHaveBeenCalled();
    await waitFor(() => {
      expect(resultViewProps.current?.plan).toBeTruthy();
      expect(resultViewProps.current?.isMemberLinked).toBe(false);
    });
  });

  it("saveIntent still auto-saves", async () => {
    setPlannerSaveIntent(SESSION_ID);
    postSave.mockResolvedValue({
      ok: true,
      claimed: true,
      session: {
        id: SESSION_ID,
        status: "saved",
        isSaved: true,
        updatedAt: "2026-10-31T01:00:00.000Z",
      },
    });

    render(<PlannerResultLoader sessionId={SESSION_ID} />);

    await waitFor(() => expect(postSave).toHaveBeenCalledWith(SESSION_ID));
    expect(postClaim).not.toHaveBeenCalled();
    await waitFor(() => {
      expect(resultViewProps.current?.isSaved).toBe(true);
      expect(resultViewProps.current?.updatedAt).toBe("2026-10-31T01:00:00.000Z");
    });
  });
});
