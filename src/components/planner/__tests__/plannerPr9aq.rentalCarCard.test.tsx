import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, screen, within } from "@testing-library/react";
import { PlannerBookingSurface } from "@/components/planner/PlannerBookingSurface";
import type { AffiliateOffer } from "@/lib/affiliate/planner/types";

vi.mock("@/lib/analytics/trackPlannerEvents", () => ({
  trackAffiliateImpression: vi.fn(),
  trackAffiliateClicked: vi.fn(),
}));

const SESSION_ID = "550e8400-e29b-41d4-a716-446655440000";
const TOKEN = "00000000-0000-4000-8000-000000000002";

const rentalCarOffer: AffiliateOffer = {
  offerId: "rental-1",
  providerId: "localrent",
  category: "rental_car",
  placement: "preparation",
  title: "로마 렌터카",
  description: "여행 일정에 맞는 렌터카를 확인해 보세요.",
  ctaLabel: "렌터카 보기",
  destinationLabel: "로마",
  trackingToken: TOKEN,
};

beforeEach(() => {
  vi.stubGlobal("fetch", vi.fn(async () => new Response("{}", { status: 200 })));
});

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

describe("PR-9AQ rental-car card in the booking surface", () => {
  it("renders one native card with trip dates, token-only link and no price", () => {
    render(
      <PlannerBookingSurface
        offers={{
          summary: [],
          preparation: [rentalCarOffer],
          days: {},
          disclosure: "일부 링크를 통해 예약·구매 시 더올투어가 수수료를 받을 수 있습니다.",
        }}
        sessionId={SESSION_ID}
        sourceProductId={null}
        destinationName="로마"
        startDate="2026-12-10"
        endDate="2026-12-14"
      />,
    );

    const surface = screen.getByTestId("planner-booking-surface");
    expect(within(surface).getByText("렌터카")).toBeInTheDocument();
    expect(within(surface).getByText("로마 렌터카")).toBeInTheDocument();
    expect(within(surface).getByText("12.10 → 12.14")).toBeInTheDocument();

    const cta = within(surface).getByRole("link", { name: "렌터카 보기" });
    expect(cta).toHaveAttribute("href", `/r/affiliate/${TOKEN}`);
    expect(surface.innerHTML).not.toMatch(/localrent\.com|tp\.media|₩|KRW/);
  });
});
