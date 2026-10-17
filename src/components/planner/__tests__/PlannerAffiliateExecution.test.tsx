import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";

const trackImpression = vi.hoisted(() => vi.fn());
const trackClicked = vi.hoisted(() => vi.fn());

vi.mock("@/lib/analytics/trackPlannerEvents", () => ({
  trackAffiliateImpression: trackImpression,
  trackAffiliateClicked: trackClicked,
}));

vi.mock("@/lib/planner/anonymousKey", () => ({
  getOrCreatePlannerAnonymousKey: () => "anon-key-12345678",
}));

import {
  PlannerAffiliateDaySlot,
  PlannerAffiliateOffersProvider,
} from "@/components/planner/PlannerAffiliateOffers";
import { PlannerDaySection } from "@/components/planner/PlannerDaySection";
import { getItemOffersForDay } from "@/lib/affiliate/planner/contextualOffers";
import type { AffiliateOffer, PlannerAffiliateOffersDto } from "@/lib/affiliate/planner/types";
import type { PlannerPlanDay } from "@/lib/planner/planSchemas";

const SESSION_ID = "550e8400-e29b-41d4-a716-446655440000";
const TOKEN = "11111111-2222-4333-8444-555555555555";

const day: PlannerPlanDay = {
  day: 1,
  date: "2026-10-17",
  title: "오사카 하이라이트",
  summary: "테마파크와 저녁 식사",
  items: [
    {
      order: 1,
      time: "09:00",
      type: "food",
      name: "아침 식당",
      area: null,
      description: "든든한 아침",
      estimatedDurationMinutes: 45,
      travelToNext: null,
      bookingRecommended: false,
    },
    {
      order: 2,
      time: "10:30",
      type: "attraction",
      name: "유니버설 스튜디오 재팬",
      area: null,
      description: "하루 종일 테마파크",
      estimatedDurationMinutes: 480,
      travelToNext: null,
      bookingRecommended: true,
    },
  ],
  tips: [],
};

function activityOffer(token: string, metadata?: AffiliateOffer["metadata"]): AffiliateOffer {
  return {
    offerId: `id-${token}`,
    providerId: "wegotrip",
    category: "activity",
    placement: "day_item",
    title: "USJ 입장권",
    description: null,
    ctaLabel: "이 장소의 투어·티켓 보기",
    destinationLabel: "오사카",
    trackingToken: token,
    metadata,
  };
}

function dto(days: PlannerAffiliateOffersDto["days"]): PlannerAffiliateOffersDto {
  return { summary: [], preparation: [], days, disclosure: "제휴 고지" };
}

const fetchMock = vi.fn();

beforeEach(() => {
  trackImpression.mockClear();
  trackClicked.mockClear();
  fetchMock.mockReset();
  fetchMock.mockResolvedValue(new Response("{}", { status: 200 }));
  vi.stubGlobal("fetch", fetchMock);
});

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

describe("itinerary contextual affiliate (PR-9AS badge)", () => {
  it("renders reservable badge on the exact matched item only (no external CTA)", () => {
    const offers = dto({ "1": [activityOffer(TOKEN, { dayNumber: 1, itemOrder: 2 })] });
    render(
      <PlannerDaySection
        day={day}
        sessionId={SESSION_ID}
        itemOffers={getItemOffersForDay(offers, 1)}
        sourceProductId={null}
      />,
    );

    const items = screen.getAllByRole("listitem");
    expect(within(items[0]!).queryByText("예약 가능")).not.toBeInTheDocument();
    expect(within(items[1]!).getByText("예약 가능")).toBeInTheDocument();
    expect(screen.queryByRole("link", { name: /이 장소의 투어·티켓 보기/ })).not.toBeInTheDocument();
    expect(screen.getByTestId("planner-item-reservable-1-2")).toBeInTheDocument();
  });

  it("does not fire affiliate impression from Day item badges", () => {
    const offers = dto({ "1": [activityOffer(TOKEN, { dayNumber: 1, itemOrder: 2 })] });
    render(
      <PlannerDaySection
        day={day}
        sessionId={SESSION_ID}
        itemOffers={getItemOffersForDay(offers, 1)}
        sourceProductId={null}
      />,
    );

    expect(trackImpression).not.toHaveBeenCalled();
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("offers without itemOrder are not attached to items", () => {
    const offers = dto({ "1": [activityOffer(TOKEN, { dayNumber: 1 })] });
    render(
      <PlannerDaySection
        day={day}
        sessionId={SESSION_ID}
        itemOffers={getItemOffersForDay(offers, 1)}
      />,
    );
    expect(screen.queryByTestId(/planner-item-reservable-/)).not.toBeInTheDocument();
    expect(screen.queryByText("USJ 입장권")).not.toBeInTheDocument();
  });

  it("Klook USJ offer: badge only inside the USJ item, no raw affiliate URL", () => {
    const klookOffer: AffiliateOffer = {
      ...activityOffer(TOKEN, { dayNumber: 1, itemOrder: 2 }),
      providerId: "klook",
      title: "유니버설 스튜디오 재팬 입장권",
    };
    const offers = dto({ "1": [klookOffer] });
    const { container } = render(
      <>
        <PlannerDaySection
          day={day}
          sessionId={SESSION_ID}
          itemOffers={getItemOffersForDay(offers, 1)}
          sourceProductId={null}
        />
        <PlannerAffiliateDaySlot
          offers={offers}
          dayNumber={1}
          sessionId={SESSION_ID}
          sourceProductId={null}
        />
      </>,
    );

    const items = screen.getAllByRole("listitem");
    expect(within(items[0]!).queryByText("예약 가능")).not.toBeInTheDocument();
    expect(within(items[1]!).getByText("예약 가능")).toBeInTheDocument();
    expect(screen.queryByRole("link", { name: /이 장소의 투어·티켓 보기/ })).not.toBeInTheDocument();
    expect(container.innerHTML).not.toMatch(/klook\.com|kkday\.com|tp\.media/);
    expect(trackImpression).not.toHaveBeenCalled();
  });

  it("item-attached offers are not duplicated in the day-level slot helper", () => {
    const offers = dto({ "1": [activityOffer(TOKEN, { dayNumber: 1, itemOrder: 2 })] });
    render(
      <PlannerAffiliateDaySlot
        offers={offers}
        dayNumber={1}
        sessionId={SESSION_ID}
        sourceProductId={null}
      />,
    );
    expect(screen.queryByText("USJ 입장권")).not.toBeInTheDocument();
  });
});

describe("PlannerAffiliateOffersProvider refresh", () => {
  function offersResponse(token: string) {
    return new Response(
      JSON.stringify({ offers: dto({ "1": [activityOffer(token, { dayNumber: 1, itemOrder: 2 })] }) }),
      { status: 200 },
    );
  }

  function Probe({ planRevision }: { planRevision: number }) {
    return (
      <PlannerAffiliateOffersProvider
        sessionId={SESSION_ID}
        sourceProductId={null}
        planRevision={planRevision}
      >
        {(offers) => (
          <p data-testid="probe">{offers.days["1"]?.[0]?.trackingToken ?? "none"}</p>
        )}
      </PlannerAffiliateOffersProvider>
    );
  }

  const offersCalls = () =>
    fetchMock.mock.calls.filter(([url]) => String(url).includes("/affiliate-offers"));

  it("refetches once per plan revision and not on plain re-render", async () => {
    fetchMock.mockImplementationOnce(async () => offersResponse("tok-a"));
    const { rerender } = render(<Probe planRevision={0} />);
    await waitFor(() => expect(screen.getByTestId("probe")).toHaveTextContent("tok-a"));
    expect(offersCalls()).toHaveLength(1);

    rerender(<Probe planRevision={0} />);
    expect(offersCalls()).toHaveLength(1);

    fetchMock.mockImplementationOnce(async () => offersResponse("tok-b"));
    rerender(<Probe planRevision={1} />);
    await waitFor(() => expect(screen.getByTestId("probe")).toHaveTextContent("tok-b"));
    expect(offersCalls()).toHaveLength(2);
    const [url, init] = offersCalls()[1]!;
    expect(url).toBe(`/api/planner/sessions/${SESSION_ID}/affiliate-offers`);
    expect(JSON.parse(String((init as RequestInit).body))).toEqual({
      anonymousKey: "anon-key-12345678",
    });
  });

  it("clears stale offers on revision change and soft-fails to empty", async () => {
    fetchMock.mockImplementationOnce(async () => offersResponse("tok-a"));
    const { rerender } = render(<Probe planRevision={0} />);
    await waitFor(() => expect(screen.getByTestId("probe")).toHaveTextContent("tok-a"));

    fetchMock.mockImplementationOnce(async () => {
      throw new Error("network down");
    });
    rerender(<Probe planRevision={1} />);
    await waitFor(() => expect(offersCalls()).toHaveLength(2));
    expect(screen.getByTestId("probe")).toHaveTextContent("none");
  });
});
