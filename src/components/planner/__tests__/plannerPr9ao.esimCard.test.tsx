import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";
import { AffiliateOfferCard } from "@/components/planner/AffiliateOfferCard";
import { PlannerBookingSurface } from "@/components/planner/PlannerBookingSurface";
import type { AffiliateOffer } from "@/lib/affiliate/planner/types";

vi.mock("@/lib/analytics/trackPlannerEvents", () => ({
  trackAffiliateImpression: vi.fn(),
  trackAffiliateClicked: vi.fn(),
}));

const SESSION_ID = "550e8400-e29b-41d4-a716-446655440000";

function esimOffer(metadata?: AffiliateOffer["metadata"]): AffiliateOffer {
  return {
    offerId: "esim-1",
    providerId: "airalo",
    category: "esim",
    placement: "preparation",
    title: "일본 여행용 eSIM",
    description: "일본에서 사용할 eSIM을 확인해 보세요.",
    ctaLabel: "여행용 eSIM 보기",
    destinationLabel: "오사카",
    trackingToken: "00000000-0000-4000-8000-000000000001",
    ...(metadata ? { metadata } : {}),
  };
}

beforeEach(() => {
  vi.stubGlobal("fetch", vi.fn(async () => new Response("{}", { status: 200 })));
});

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

describe("PR-9AO eSIM card metadata line", () => {
  it("data + validity → '10GB · 30일'", () => {
    render(
      <AffiliateOfferCard
        offer={esimOffer({ esim: { dataLabel: "10GB", validityDays: 30 } })}
        sessionId={SESSION_ID}
      />,
    );
    expect(screen.getByTestId("affiliate-offer-esim-meta")).toHaveTextContent("10GB · 30일");
    expect(screen.getByText("일본 여행용 eSIM")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "여행용 eSIM 보기" })).toHaveAttribute(
      "href",
      "/r/affiliate/00000000-0000-4000-8000-000000000001",
    );
  });

  it("data only → '10GB'", () => {
    render(
      <AffiliateOfferCard
        offer={esimOffer({ esim: { dataLabel: "10GB", validityDays: null } })}
        sessionId={SESSION_ID}
      />,
    );
    expect(screen.getByTestId("affiliate-offer-esim-meta")).toHaveTextContent(/^10GB$/);
  });

  it("validity only → '30일'", () => {
    render(
      <AffiliateOfferCard
        offer={esimOffer({ esim: { dataLabel: null, validityDays: 30 } })}
        sessionId={SESSION_ID}
      />,
    );
    expect(screen.getByTestId("affiliate-offer-esim-meta")).toHaveTextContent(/^30일$/);
  });

  it("no metadata → no line; card otherwise unchanged", () => {
    render(<AffiliateOfferCard offer={esimOffer()} sessionId={SESSION_ID} />);
    expect(screen.queryByTestId("affiliate-offer-esim-meta")).not.toBeInTheDocument();
    expect(screen.getByText("제휴 링크")).toBeInTheDocument();
    expect(screen.getByText("일본에서 사용할 eSIM을 확인해 보세요.")).toBeInTheDocument();
  });

  it("other providers with day metadata render no eSIM line", () => {
    render(
      <AffiliateOfferCard
        offer={{
          offerId: "a1",
          providerId: "klook",
          category: "activity",
          placement: "day_item",
          title: "오사카 투어·티켓",
          description: null,
          ctaLabel: "이 장소의 투어·티켓 보기",
          destinationLabel: "오사카",
          trackingToken: "00000000-0000-4000-8000-000000000002",
          metadata: { dayNumber: 1, itemOrder: 2 },
        }}
        sessionId={SESSION_ID}
      />,
    );
    expect(screen.queryByTestId("affiliate-offer-esim-meta")).not.toBeInTheDocument();
  });

  it("booking surface shows a single eSIM card with the metadata line", () => {
    render(
      <PlannerBookingSurface
        offers={{
          summary: [],
          preparation: [esimOffer({ esim: { dataLabel: "3GB", validityDays: 15 } })],
          days: {},
          disclosure: "일부 링크를 통해 예약·구매 시 더올투어가 수수료를 받을 수 있습니다.",
        }}
        sessionId={SESSION_ID}
        sourceProductId={null}
        destinationName="오사카"
        startDate="2026-10-01"
        endDate="2026-10-05"
      />,
    );
    expect(screen.getByText("eSIM")).toBeInTheDocument();
    expect(screen.getAllByTestId("affiliate-offer-esim-meta")).toHaveLength(1);
    expect(screen.getByTestId("affiliate-offer-esim-meta")).toHaveTextContent("3GB · 15일");
  });
});
