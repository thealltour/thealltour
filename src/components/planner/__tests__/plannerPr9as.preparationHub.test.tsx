import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { PlannerPreparationHub } from "@/components/planner/PlannerPreparationHub";
import { PlannerResultView } from "@/components/planner/PlannerResultView";
import { AFFILIATE_DISCLOSURE_KO } from "@/lib/affiliate/planner/copy";
import {
  buildPreparationHubSummaryLabel,
  groupPreparationHubOffers,
  hasPreparationHubContent,
} from "@/lib/affiliate/planner/preparationHub";
import type { AffiliateOffer, PlannerAffiliateOffersDto } from "@/lib/affiliate/planner/types";
import type { PlannerPlan } from "@/lib/planner/planSchemas";

const trackImpression = vi.hoisted(() => vi.fn());
const trackClicked = vi.hoisted(() => vi.fn());

vi.mock("@/lib/analytics/trackPlannerEvents", () => ({
  trackAffiliateImpression: trackImpression,
  trackAffiliateClicked: trackClicked,
  trackPlannerDayNavigationClick: vi.fn(),
}));

vi.mock("next/image", () => ({
  default: (props: { src: string; alt?: string }) => (
    // eslint-disable-next-line @next/next/no-img-element
    <img src={props.src} alt={props.alt ?? ""} />
  ),
}));

vi.mock("@/components/affiliate/TpWidgetMount", () => ({
  TpWidgetMount: ({ widgetKey }: { widgetKey: string }) => (
    <div data-testid={`tp-widget-${widgetKey}`}>widget</div>
  ),
}));

const offersState = vi.hoisted(() => ({
  value: {
    summary: [],
    preparation: [],
    days: {},
    disclosure: null,
    activityDiscovery: null,
  } as PlannerAffiliateOffersDto,
}));

vi.mock("@/components/planner/PlannerAffiliateOffers", async () => {
  const actual = await vi.importActual<typeof import("@/components/planner/PlannerAffiliateOffers")>(
    "@/components/planner/PlannerAffiliateOffers",
  );
  return {
    ...actual,
    PlannerAffiliateOffersProvider: ({
      children,
    }: {
      children: (offers: PlannerAffiliateOffersDto) => import("react").ReactNode;
    }) => <>{children(offersState.value)}</>,
  };
});

const SESSION = "550e8400-e29b-41d4-a716-446655440000";

function offer(partial: Partial<AffiliateOffer> & Pick<AffiliateOffer, "offerId" | "category">): AffiliateOffer {
  return {
    providerId: "aviasales",
    placement: "preparation",
    title: partial.title ?? partial.category,
    description: null,
    ctaLabel: "보기",
    destinationLabel: "오사카",
    trackingToken: `tok-${partial.offerId}`,
    ...partial,
  };
}

function plan(): PlannerPlan {
  return {
    title: "t",
    summary: "s",
    destination: { name: "오사카", country: "JP" },
    tripOverview: {
      startDate: "2026-10-01",
      endDate: "2026-10-05",
      nights: 4,
      days: 5,
      travelersSummary: "2",
      styleSummary: "균형",
    },
    days: [
      {
        day: 1,
        date: "2026-10-01",
        title: "1일차",
        summary: "s",
        items: [
          {
            order: 1,
            time: "10:00",
            type: "attraction",
            name: "오사카성",
            area: null,
            description: "d",
            estimatedDurationMinutes: 60,
            travelToNext: null,
            bookingRecommended: true,
          },
        ],
        tips: [],
      },
    ],
    preparation: { travelTips: ["팁"], packingHints: ["짐"] },
  };
}

function stubMatchMedia(matchesLg: boolean) {
  Object.defineProperty(window, "matchMedia", {
    writable: true,
    configurable: true,
    value: vi.fn().mockImplementation((query: string) => ({
      matches: query.includes("1024") ? matchesLg : false,
      media: query,
      onchange: null,
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      addListener: vi.fn(),
      removeListener: vi.fn(),
      dispatchEvent: vi.fn(),
    })),
  });
}

beforeEach(() => {
  trackImpression.mockClear();
  trackClicked.mockClear();
  vi.stubGlobal("fetch", vi.fn(async () => new Response("{}", { status: 200 })));
  offersState.value = {
    summary: [],
    preparation: [],
    days: {},
    disclosure: null,
    activityDiscovery: null,
  };
  stubMatchMedia(false);
});

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

describe("preparationHub helpers", () => {
  it("groups booking / local / goods / activities", () => {
    const dto: PlannerAffiliateOffersDto = {
      summary: [offer({ offerId: "f", category: "flight" }), offer({ offerId: "h", category: "hotel" })],
      preparation: [
        offer({ offerId: "e", category: "esim" }),
        offer({ offerId: "r", category: "rental_car" }),
        offer({
          offerId: "g",
          category: "travel_goods",
          metadata: { travelGoods: { intent: "power_bank" } },
        }),
      ],
      days: {
        "1": [
          offer({
            offerId: "a",
            category: "activity",
            placement: "day_item",
            metadata: { dayNumber: 1, itemOrder: 1 },
          }),
        ],
      },
      disclosure: AFFILIATE_DISCLOSURE_KO,
      activityDiscovery: null,
    };
    const groups = groupPreparationHubOffers(dto);
    expect(groups.booking.map((o) => o.category)).toEqual(["flight", "hotel"]);
    expect(groups.local.map((o) => o.category)).toEqual(["esim", "rental_car"]);
    expect(groups.travelGoods).toHaveLength(1);
    expect(groups.activities).toHaveLength(1);
    expect(hasPreparationHubContent(dto)).toBe(true);
    expect(buildPreparationHubSummaryLabel(dto)).toContain("항공");
  });
});

describe("PR-9AS Preparation Hub", () => {
  const richOffers = (): PlannerAffiliateOffersDto => ({
    summary: [
      offer({ offerId: "f1", category: "flight", title: "오사카 항공권", placement: "planner_summary" }),
      offer({ offerId: "h1", category: "hotel", title: "오사카 숙소", placement: "planner_summary" }),
    ],
    preparation: [
      offer({ offerId: "e1", category: "esim", title: "오사카 eSIM" }),
      offer({
        offerId: "g1",
        category: "travel_goods",
        title: "보조배터리",
        ctaLabel: "토스쇼핑에서 보기",
        metadata: {
          travelGoods: {
            intent: "power_bank",
            imageUrl: "https://shopping.toss.im/thumb.jpg",
          },
        },
      }),
    ],
    days: {
      "1": [
        offer({
          offerId: "a1",
          category: "activity",
          title: "오사카성 입장권",
          placement: "day_item",
          metadata: { dayNumber: 1, itemOrder: 1 },
        }),
      ],
    },
    disclosure: AFFILIATE_DISCLOSURE_KO,
    activityDiscovery: {
      tiqets: {
        providerId: "tiqets",
        kind: "product_widget",
        products: [
          {
            providerId: "tiqets",
            productId: "1108257",
            title: "Osaka Castle",
            matchConfidence: "exact",
            dayNumber: 1,
            itemOrder: 1,
          },
        ],
      },
      klook: null,
    },
  });

  it("Result shows hub CTA and keeps AI tips; no inline booking/discovery", () => {
    offersState.value = richOffers();
    render(
      <PlannerResultView
        plan={plan()}
        sessionId={SESSION}
        sourceProductId={null}
        isSaved={false}
        enrichment={null}
        onSaved={vi.fn()}
        onPlanUpdated={vi.fn()}
      />,
    );
    expect(screen.getByTestId("planner-preparation-hub")).toBeInTheDocument();
    expect(screen.getByText("여행 전에 참고하세요")).toBeInTheDocument();
    expect(screen.queryByTestId("planner-booking-surface")).not.toBeInTheDocument();
    expect(screen.queryByTestId("planner-activity-discovery")).not.toBeInTheDocument();
    expect(screen.getByTestId("planner-item-reservable-1-1")).toHaveTextContent("예약 가능");
    expect(screen.queryByRole("link", { name: /투어·티켓/ })).not.toBeInTheDocument();
  });

  it("closed hub mounts no offer cards and fires no impressions", () => {
    render(
      <PlannerPreparationHub
        offers={richOffers()}
        sessionId={SESSION}
        sourceProductId={null}
        destinationName="오사카"
        startDate="2026-10-01"
        endDate="2026-10-05"
      />,
    );
    expect(screen.queryByTestId("planner-preparation-hub-content")).not.toBeInTheDocument();
    expect(trackImpression).not.toHaveBeenCalled();
    expect(vi.mocked(fetch)).not.toHaveBeenCalled();
  });

  it("opening hub mounts sections, disclosure once, discovery, and impressions", async () => {
    const user = userEvent.setup();
    render(
      <PlannerPreparationHub
        offers={richOffers()}
        sessionId={SESSION}
        sourceProductId={null}
        destinationName="오사카"
        startDate="2026-10-01"
        endDate="2026-10-05"
      />,
    );
    await user.click(screen.getAllByRole("button", { name: /여행 준비하기/ })[0]!);
    const content = screen.getByTestId("planner-preparation-hub-content");
    expect(within(content).getByTestId("planner-hub-booking")).toBeInTheDocument();
    expect(within(content).getByTestId("planner-hub-local")).toBeInTheDocument();
    expect(within(content).getByTestId("planner-hub-goods")).toBeInTheDocument();
    expect(within(content).getByTestId("planner-hub-activities")).toBeInTheDocument();
    expect(within(content).getByText("오사카 항공권")).toBeInTheDocument();
    expect(within(content).getAllByText("보조배터리").length).toBeGreaterThan(0);
    expect(within(content).getByText("토스쇼핑에서 보기")).toBeInTheDocument();
    expect(screen.getByTestId("planner-activity-discovery-tiqets")).toBeInTheDocument();
    expect(screen.getAllByText(AFFILIATE_DISCLOSURE_KO)).toHaveLength(1);
    expect(content.innerHTML).not.toMatch(/toss\.shopping|최저가|특가/);
    expect(trackImpression.mock.calls.length).toBeGreaterThan(0);
  });

  it("reopen does not duplicate impressions for same tokens", async () => {
    const user = userEvent.setup();
    render(
      <PlannerPreparationHub
        offers={{
          summary: [offer({ offerId: "f1", category: "flight", title: "항공" })],
          preparation: [],
          days: {},
          disclosure: AFFILIATE_DISCLOSURE_KO,
          activityDiscovery: null,
        }}
        sessionId={SESSION}
        sourceProductId={null}
        destinationName="오사카"
        startDate={null}
        endDate={null}
      />,
    );
    await user.click(screen.getAllByRole("button", { name: /여행 준비하기/ })[0]!);
    const firstCount = trackImpression.mock.calls.length;
    expect(firstCount).toBe(1);
    await user.click(screen.getByRole("button", { name: "닫기" }));
    await user.click(screen.getAllByRole("button", { name: /여행 준비하기/ })[0]!);
    expect(trackImpression.mock.calls.length).toBe(firstCount);
  });

  it("hides empty hub when no offers", () => {
    const { container } = render(
      <PlannerPreparationHub
        offers={{
          summary: [],
          preparation: [],
          days: {},
          disclosure: null,
          activityDiscovery: null,
        }}
        sessionId={SESSION}
        sourceProductId={null}
        destinationName="오사카"
        startDate={null}
        endDate={null}
      />,
    );
    expect(container).toBeEmptyDOMElement();
  });

  it("mobile CTA is fixed; desktop trigger is lg-only class", () => {
    render(
      <PlannerPreparationHub
        offers={richOffers()}
        sessionId={SESSION}
        sourceProductId={null}
        destinationName="오사카"
        startDate={null}
        endDate={null}
      />,
    );
    const mobile = screen.getByTestId("planner-preparation-hub-mobile-cta");
    expect(mobile.className).toContain("fixed");
    expect(mobile.className).toContain("lg:hidden");
    expect(mobile.className).toContain("z-50");
    expect(screen.getByTestId("planner-preparation-hub-desktop-trigger").className).toContain(
      "hidden lg:block",
    );
  });

  it("desktop drawer focuses close, traps Tab, restores trigger focus, cleans overflow", async () => {
    stubMatchMedia(true);
    const user = userEvent.setup();
    const { unmount } = render(
      <PlannerPreparationHub
        offers={{
          summary: [offer({ offerId: "f1", category: "flight", title: "항공" })],
          preparation: [],
          days: {},
          disclosure: AFFILIATE_DISCLOSURE_KO,
          activityDiscovery: null,
        }}
        sessionId={SESSION}
        sourceProductId={null}
        destinationName="오사카"
        startDate={null}
        endDate={null}
      />,
    );

    const trigger = within(screen.getByTestId("planner-preparation-hub-desktop-trigger")).getByRole(
      "button",
      { name: /여행 준비하기/ },
    );
    trigger.focus();
    await user.click(trigger);

    const drawer = await screen.findByTestId("planner-preparation-hub-drawer");
    const dialog = within(drawer).getByRole("dialog");
    const closeBtn = within(dialog).getByRole("button", { name: "닫기" });

    await waitFor(() => expect(closeBtn).toHaveFocus());
    expect(document.body.style.overflow).toBe("hidden");
    expect(screen.queryByTestId("planner-preparation-hub-sheet")).not.toBeInTheDocument();

    await user.tab({ shift: true });
    expect(dialog.contains(document.activeElement)).toBe(true);
    expect(trigger.contains(document.activeElement)).toBe(false);

    await user.keyboard("{Escape}");
    await waitFor(() => {
      expect(screen.queryByTestId("planner-preparation-hub-drawer")).not.toBeInTheDocument();
    });
    expect(trigger).toHaveFocus();
    expect(document.body.style.overflow).toBe("");

    await user.click(trigger);
    await screen.findByTestId("planner-preparation-hub-drawer");
    expect(document.body.style.overflow).toBe("hidden");
    unmount();
    expect(document.body.style.overflow).toBe("");
  });
});
