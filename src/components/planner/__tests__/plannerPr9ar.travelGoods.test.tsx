import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, screen, within } from "@testing-library/react";
import { PlannerBookingSurface } from "@/components/planner/PlannerBookingSurface";
import type { AffiliateOffer } from "@/lib/affiliate/planner/types";

vi.mock("next/image", () => ({
  default: (props: { src: string; alt?: string }) => (
    // eslint-disable-next-line @next/next/no-img-element
    <img src={props.src} alt={props.alt ?? ""} />
  ),
}));

vi.mock("@/lib/analytics/trackPlannerEvents", () => ({
  trackAffiliateImpression: vi.fn(),
  trackAffiliateClicked: vi.fn(),
}));

const SESSION_ID = "550e8400-e29b-41d4-a716-446655440000";
const TOKEN_A = "00000000-0000-4000-8000-0000000000aa";
const TOKEN_B = "00000000-0000-4000-8000-0000000000bb";
const TOKEN_ESIM = "00000000-0000-4000-8000-0000000000cc";

const esimOffer: AffiliateOffer = {
  offerId: "esim-1",
  providerId: "airalo",
  category: "esim",
  placement: "preparation",
  title: "오사카 eSIM",
  description: null,
  ctaLabel: "여행용 eSIM 보기",
  destinationLabel: "오사카",
  trackingToken: TOKEN_ESIM,
};

const goodsA: AffiliateOffer = {
  offerId: "goods-1",
  providerId: "toss_shopping",
  category: "travel_goods",
  placement: "preparation",
  title: "테스트 보조배터리 20000mAh",
  description: "보조배터리 — 해외 일정 중 충전이 필요할 때 확인해 보세요.",
  ctaLabel: "토스쇼핑에서 보기",
  destinationLabel: "오사카",
  trackingToken: TOKEN_A,
  metadata: {
    travelGoods: {
      intent: "power_bank",
      imageUrl: "https://shopping.toss.im/thumb/1001.jpg",
    },
  },
};

const goodsB: AffiliateOffer = {
  offerId: "goods-2",
  providerId: "toss_shopping",
  category: "travel_goods",
  placement: "preparation",
  title: "방수팩 프로",
  description: "방수팩 — 물놀이·해변 일정에 챙겨두면 좋아요.",
  ctaLabel: "토스쇼핑에서 보기",
  destinationLabel: "오사카",
  trackingToken: TOKEN_B,
  metadata: {
    travelGoods: { intent: "waterproof_pouch" },
  },
};

beforeEach(() => {
  vi.stubGlobal("fetch", vi.fn(async () => new Response("{}", { status: 200 })));
});

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

describe("PR-9AR travel goods subsection", () => {
  it("renders 여행 준비물 with product title, category, CTA, optional image, token-only href", () => {
    render(
      <PlannerBookingSurface
        offers={{
          summary: [],
          preparation: [esimOffer, goodsA, goodsB],
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

    const surface = screen.getByTestId("planner-booking-surface");
    expect(within(surface).getByTestId("planner-booking-services")).toBeInTheDocument();
    expect(within(surface).getByText("오사카 eSIM")).toBeInTheDocument();

    const goods = within(surface).getByTestId("planner-travel-goods");
    expect(within(goods).getByText("여행 준비물")).toBeInTheDocument();
    expect(
      within(goods).getByText("여행 전에 챙겨두면 좋은 준비물을 확인해 보세요."),
    ).toBeInTheDocument();
    expect(within(goods).getByText("보조배터리")).toBeInTheDocument();
    expect(within(goods).getByText("방수팩")).toBeInTheDocument();
    expect(within(goods).getByText("테스트 보조배터리 20000mAh")).toBeInTheDocument();
    expect(within(goods).getAllByRole("link", { name: "토스쇼핑에서 보기" })).toHaveLength(2);

    const cta = within(goods).getAllByRole("link", { name: "토스쇼핑에서 보기" })[0]!;
    expect(cta).toHaveAttribute("href", `/r/affiliate/${TOKEN_A}`);

    expect(within(goods).getByTestId("affiliate-offer-travel-goods-image")).toBeInTheDocument();
    expect(surface.innerHTML).not.toMatch(/toss\.shopping|최저가|특가|₩|KRW|29900|discount/i);

    const disclosures = within(surface).getAllByText(
      "일부 링크를 통해 예약·구매 시 더올투어가 수수료를 받을 수 있습니다.",
    );
    expect(disclosures).toHaveLength(1);
  });

  it("works without product image", () => {
    render(
      <PlannerBookingSurface
        offers={{
          summary: [],
          preparation: [goodsB],
          days: {},
          disclosure: null,
        }}
        sessionId={SESSION_ID}
        sourceProductId={null}
        destinationName="오사카"
        startDate={null}
        endDate={null}
      />,
    );
    expect(screen.queryByTestId("affiliate-offer-travel-goods-image")).not.toBeInTheDocument();
    expect(screen.getByText("방수팩 프로")).toBeInTheDocument();
  });
});
