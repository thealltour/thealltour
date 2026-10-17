import type { ReactNode } from "react";
import { act, cleanup, render, screen, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { PlannerActivityDiscovery } from "@/components/planner/PlannerActivityDiscovery";
import { PlannerResultView } from "@/components/planner/PlannerResultView";
import type { TpWidgetStatus } from "@/components/affiliate/TpWidgetMount";
import { AFFILIATE_DISCLOSURE_KO } from "@/lib/affiliate/planner/copy";
import type { PlannerActivityDiscoveryDto } from "@/lib/affiliate/planner/discovery/types";
import type { PlannerAffiliateOffersDto } from "@/lib/affiliate/planner/types";
import { addDaysToIsoDate, type PlannerPlan } from "@/lib/planner/planSchemas";

const widgetStatus = vi.hoisted(() => new Map<string, (status: TpWidgetStatus) => void>());

vi.mock("@/components/affiliate/TpWidgetMount", () => ({
  TpWidgetMount: ({
    widgetKey,
    src,
    onStatusChange,
  }: {
    widgetKey: string;
    src: string;
    onStatusChange?: (status: TpWidgetStatus) => void;
  }) => {
    if (onStatusChange) widgetStatus.set(widgetKey, onStatusChange);
    return <div data-testid="tp-widget" data-key={widgetKey} data-src={src} />;
  },
}));

vi.mock("@/lib/analytics/trackPlannerEvents", () => ({
  trackPlannerDayNavigationClick: vi.fn(),
  trackAffiliateImpression: vi.fn(),
  trackAffiliateClicked: vi.fn(),
}));
vi.mock("@/components/planner/PlannerPlanSummary", () => ({
  PlannerPlanSummary: () => <div data-testid="plan-summary" />,
}));
vi.mock("@/components/planner/PlannerSavePanel", () => ({
  PlannerSavePanel: () => <button type="button">플랜 저장</button>,
}));
vi.mock("@/components/planner/PlannerEditPanel", () => ({
  PlannerEditPanel: () => <button type="button">AI로 수정</button>,
}));
vi.mock("@/components/planner/PlannerDaySection", () => ({
  PlannerDaySection: ({ day }: { day: { day: number } }) => <div>DAY {day.day}</div>,
}));

const offersState = vi.hoisted(() => ({ value: null as unknown }));
vi.mock("@/components/planner/PlannerAffiliateOffers", () => ({
  PlannerAffiliateOffersProvider: ({ children }: { children: (offers: unknown) => ReactNode }) =>
    children(offersState.value),
  PlannerAffiliateDaySlot: () => null,
}));

const DISCLOSURE = AFFILIATE_DISCLOSURE_KO;

const tiqetsOnly: PlannerActivityDiscoveryDto = {
  tiqets: {
    providerId: "tiqets",
    kind: "product_widget",
    products: [
      { providerId: "tiqets", productId: "1102887", title: "USJ", matchConfidence: "exact", dayNumber: 1, itemOrder: 1 },
      { providerId: "tiqets", productId: "1108257", title: "Osaka Castle Museum", matchConfidence: "exact", dayNumber: 2, itemOrder: 1 },
    ],
  },
  klook: null,
};
const klookOnly: PlannerActivityDiscoveryDto = {
  tiqets: null,
  klook: { providerId: "klook", kind: "city_widget", cityId: "29", cityLabel: "오사카", categoryId: "2" },
};
const both: PlannerActivityDiscoveryDto = { tiqets: tiqetsOnly.tiqets, klook: klookOnly.klook };

function widgets() {
  return screen.queryAllByTestId("tp-widget").map((el) => ({
    key: el.getAttribute("data-key"),
    src: new URL(el.getAttribute("data-src")!),
  }));
}

beforeEach(() => {
  widgetStatus.clear();
});

afterEach(() => cleanup());

describe("PR-9AN PlannerActivityDiscovery", () => {
  it("tiqets only → only the Tiqets section", () => {
    render(<PlannerActivityDiscovery discovery={tiqetsOnly} />);
    expect(screen.getByRole("heading", { name: "예약 가능한 명소 · 체험", level: 2 })).toBeInTheDocument();
    expect(screen.queryByText("이런 액티비티도 있어요")).not.toBeInTheDocument();
    expect(widgets().map((w) => w.key)).toEqual(["tiqets:1102887,1108257"]);
  });

  it("klook only → only the Klook section", () => {
    render(<PlannerActivityDiscovery discovery={klookOnly} />);
    expect(screen.getByRole("heading", { name: "이런 액티비티도 있어요", level: 2 })).toBeInTheDocument();
    expect(screen.queryByText("예약 가능한 명소 · 체험")).not.toBeInTheDocument();
    expect(widgets().map((w) => w.key)).toEqual(["klook:29:2"]);
  });

  it("both → both sections, Tiqets first", () => {
    render(<PlannerActivityDiscovery discovery={both} />);
    expect(widgets().map((w) => w.key)).toEqual(["tiqets:1102887,1108257", "klook:29:2"]);
  });

  it.each([
    ["null", null],
    ["undefined", undefined],
    ["empty descriptors", { tiqets: null, klook: null }],
    ["empty products", { tiqets: { providerId: "tiqets", kind: "product_widget", products: [] }, klook: null }],
    ["klook without category", { tiqets: null, klook: { ...klookOnly.klook!, categoryId: null } }],
  ] as const)("none (%s) → renders nothing", (_label, discovery) => {
    const { container } = render(
      <PlannerActivityDiscovery discovery={discovery as PlannerActivityDiscoveryDto | null | undefined} />,
    );
    expect(container).toBeEmptyDOMElement();
  });

  it("two Tiqets products → one product widget URL carrying both IDs in order", () => {
    render(<PlannerActivityDiscovery discovery={tiqetsOnly} />);
    const [tiqets] = widgets();
    expect(tiqets!.src.origin).toBe("https://tpwdgt.com");
    expect(tiqets!.src.searchParams.get("product")).toBe("1102887,1108257");
    expect(tiqets!.src.searchParams.get("promo_id")).toBe("3948");
  });

  it("Klook Osaka → city_id 29 / category 2 widget URL", () => {
    render(<PlannerActivityDiscovery discovery={klookOnly} />);
    const [klook] = widgets();
    expect(klook!.src.searchParams.get("city_id")).toBe("29");
    expect(klook!.src.searchParams.get("category")).toBe("2");
    expect(klook!.src.searchParams.get("promo_id")).toBe("4497");
  });

  it("one provider failing hides only that provider's block", () => {
    render(<PlannerActivityDiscovery discovery={both} />);
    act(() => widgetStatus.get("tiqets:1102887,1108257")!("failed"));
    expect(screen.queryByTestId("planner-activity-discovery-tiqets")).not.toBeInTheDocument();
    expect(screen.getByTestId("planner-activity-discovery-klook")).toBeInTheDocument();
    expect(widgets().map((w) => w.key)).toEqual(["klook:29:2"]);
  });

  it("non-numeric product id never reaches a widget URL", () => {
    const tampered: PlannerActivityDiscoveryDto = {
      tiqets: {
        ...tiqetsOnly.tiqets!,
        products: [{ ...tiqetsOnly.tiqets!.products[0]!, productId: "https://evil.example/x.js" }],
      },
      klook: null,
    };
    const { container } = render(<PlannerActivityDiscovery discovery={tampered} />);
    expect(container).toBeEmptyDOMElement();
  });
});

function makePlan(): PlannerPlan {
  return {
    title: "테스트 일정",
    summary: "요약",
    destination: { name: "오사카", country: "일본" },
    tripOverview: {
      startDate: "2026-10-17",
      endDate: addDaysToIsoDate("2026-10-17", 1),
      nights: 1,
      days: 2,
      travelersSummary: "성인 2명",
      styleSummary: "테스트",
    },
    days: [1, 2].map((day) => ({
      day,
      date: addDaysToIsoDate("2026-10-17", day - 1),
      title: `${day}일차`,
      summary: "하루",
      items: [
        {
          order: 1,
          time: "10:00",
          type: "attraction" as const,
          name: "명소",
          area: null,
          description: "둘러보기",
          estimatedDurationMinutes: 60,
          travelToNext: null,
          bookingRecommended: false,
        },
      ],
      tips: [],
    })),
    preparation: { travelTips: ["팁"], packingHints: ["신발"] },
  };
}

const flightOffer = {
  offerId: "f1",
  providerId: "aviasales",
  category: "flight" as const,
  placement: "planner_summary" as const,
  title: "항공권 가격 확인",
  description: null,
  ctaLabel: "항공권 보기",
  destinationLabel: "오사카",
  trackingToken: "tok-f1",
};

function renderResult(offers: Partial<PlannerAffiliateOffersDto> & { activityDiscovery?: unknown }) {
  offersState.value = { summary: [], preparation: [], days: {}, disclosure: null, ...offers };
  return render(
    <PlannerResultView
      plan={makePlan()}
      sessionId="550e8400-e29b-41d4-a716-446655440000"
      sourceProductId={null}
      isSaved={false}
      enrichment={null}
      onSaved={vi.fn()}
      onPlanUpdated={vi.fn()}
    />,
  );
}

describe("PR-9AN Result disclosure via Preparation Hub (PR-9AS)", () => {
  it("summary offer only → hub CTA; disclosure after open once", async () => {
    const user = (await import("@testing-library/user-event")).default.setup();
    renderResult({ summary: [flightOffer], disclosure: DISCLOSURE, activityDiscovery: null });
    expect(screen.queryByTestId("planner-activity-discovery")).not.toBeInTheDocument();
    expect(screen.queryByText(DISCLOSURE)).not.toBeInTheDocument();
    await user.click(screen.getAllByRole("button", { name: /여행 준비하기/ })[0]!);
    expect(screen.getAllByText(DISCLOSURE)).toHaveLength(1);
  });

  it("Tiqets discovery only → hub; discovery mounts after open", async () => {
    const user = (await import("@testing-library/user-event")).default.setup();
    renderResult({ disclosure: DISCLOSURE, activityDiscovery: tiqetsOnly });
    expect(screen.queryByTestId("planner-activity-discovery-tiqets")).not.toBeInTheDocument();
    await user.click(screen.getAllByRole("button", { name: /여행 준비하기/ })[0]!);
    expect(screen.getByTestId("planner-activity-discovery-tiqets")).toBeInTheDocument();
    expect(screen.getAllByText(DISCLOSURE)).toHaveLength(1);
  });

  it("Klook discovery only → hub; discovery mounts after open", async () => {
    const user = (await import("@testing-library/user-event")).default.setup();
    renderResult({ disclosure: DISCLOSURE, activityDiscovery: klookOnly });
    expect(screen.queryByTestId("planner-activity-discovery-klook")).not.toBeInTheDocument();
    await user.click(screen.getAllByRole("button", { name: /여행 준비하기/ })[0]!);
    expect(screen.getByTestId("planner-activity-discovery-klook")).toBeInTheDocument();
    expect(screen.getAllByText(DISCLOSURE)).toHaveLength(1);
  });

  it("summary + Tiqets + Klook → disclosure once inside hub", async () => {
    const user = (await import("@testing-library/user-event")).default.setup();
    renderResult({ summary: [flightOffer], disclosure: DISCLOSURE, activityDiscovery: both });
    await user.click(screen.getAllByRole("button", { name: /여행 준비하기/ })[0]!);
    expect(screen.getAllByText(DISCLOSURE)).toHaveLength(1);
    expect(
      within(screen.getByTestId("planner-preparation-hub-content")).getByText(DISCLOSURE),
    ).toBeInTheDocument();
  });

  it("no affiliate content → no hub / disclosure", () => {
    renderResult({ activityDiscovery: null });
    expect(screen.queryByText(DISCLOSURE)).not.toBeInTheDocument();
    expect(screen.queryByTestId("planner-preparation-hub")).not.toBeInTheDocument();
  });

  it("order: hub → days → preparation tips", () => {
    renderResult({ summary: [flightOffer], disclosure: DISCLOSURE, activityDiscovery: both });
    const order = [
      screen.getByTestId("planner-preparation-hub"),
      screen.getByTestId("planner-day-section-2"),
      screen.getByTestId("planner-result-preparation"),
    ];
    for (let i = 0; i < order.length - 1; i++) {
      expect(order[i]!.compareDocumentPosition(order[i + 1]!) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    }
    expect(screen.queryByTestId("planner-booking-surface")).not.toBeInTheDocument();
    expect(screen.queryByTestId("planner-activity-discovery")).not.toBeInTheDocument();
  });
});

describe("PR-9AN backward compatibility (hub)", () => {
  it.each([
    ["activityDiscovery missing", {}],
    ["activityDiscovery null", { activityDiscovery: null }],
  ])("%s → Result renders with hub CTA", async (_label, extra) => {
    const user = (await import("@testing-library/user-event")).default.setup();
    renderResult({ summary: [flightOffer], disclosure: DISCLOSURE, ...extra });
    expect(screen.getByTestId("planner-result-view")).toBeInTheDocument();
    expect(screen.getByTestId("planner-preparation-hub")).toBeInTheDocument();
    expect(screen.queryByTestId("planner-booking-surface")).not.toBeInTheDocument();
    expect(screen.queryByTestId("planner-activity-discovery")).not.toBeInTheDocument();
    await user.click(screen.getAllByRole("button", { name: /여행 준비하기/ })[0]!);
    expect(screen.getByText("항공권 가격 확인")).toBeInTheDocument();
    expect(screen.getAllByText(DISCLOSURE)).toHaveLength(1);
  });
});
