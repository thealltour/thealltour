import { describe, expect, it } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach } from "vitest";
import { PlannerDaySection } from "@/components/planner/PlannerDaySection";
import type { PlannerPlanDay } from "@/lib/planner/planSchemas";
import type {
  PlannerPlaceEnrichmentItem,
  PlannerRouteEnrichment,
} from "@/lib/planner/enrichmentTypes";

afterEach(() => {
  cleanup();
});

const day: PlannerPlanDay = {
  day: 1,
  date: "2026-10-17",
  title: "도착과 적응",
  summary: "시내로 이동해 저녁을 즐깁니다.",
  items: [
    {
      order: 1,
      time: "12:00",
      type: "transport",
      name: "간사이 국제공항",
      area: "이즈미사노",
      description: "오사카 도착 후 시내로 이동",
      estimatedDurationMinutes: 60,
      travelToNext: {
        mode: "public_transit",
        estimatedMinutes: 45,
      },
      bookingRecommended: true,
    },
  ],
  tips: ["교통패스를 확인하세요"],
};

describe("PlannerDaySection density", () => {
  it("shows core fields and keeps secondary details collapsed", () => {
    const placeByOrder = new Map<number, PlannerPlaceEnrichmentItem>([
      [
        1,
        {
          dayNumber: 1,
          itemOrder: 1,
          place: {
            status: "resolved",
            originalName: "간사이 국제공항",
            placeId: "p1",
            displayName: "간사이 국제공항",
            formattedAddress: "오사카부 주소",
            googleMapsUri: "https://maps.example/kix",
            location: { lat: 1, lng: 2 },
            types: [],
          },
        },
      ],
    ]);

    const { container } = render(
      <PlannerDaySection
        day={day}
        sessionId="550e8400-e29b-41d4-a716-446655440000"
        placeByOrder={placeByOrder}
      />,
    );

    expect(screen.getByText("DAY 1")).toBeInTheDocument();
    expect(screen.getByRole("heading", { level: 2 })).toHaveTextContent("도착과 적응");
    expect(screen.getByText("12:00")).toBeInTheDocument();
    expect(screen.getByText("간사이 국제공항")).toBeInTheDocument();
    expect(screen.getByText("오사카 도착 후 시내로 이동")).toBeInTheDocument();
    expect(screen.getByText("약 60분")).toBeInTheDocument();
    expect(screen.getByText("대중교통 · 약 45분")).toBeInTheDocument();
    expect(screen.getByText("이동")).toBeInTheDocument();
    expect(screen.getByText("예약 권장")).toBeInTheDocument();
    expect(container.querySelector("ol")).toBeTruthy();
    expect(container.querySelectorAll("li").length).toBeGreaterThanOrEqual(1);
    expect(container.querySelector("svg")).toBeTruthy();

    const details = screen.getByText("자세히").closest("details");
    expect(details).toBeTruthy();
    expect(details).not.toHaveAttribute("open");
    expect(details!.textContent).toContain("이즈미사노");
    expect(details!.textContent).toContain("오사카부 주소");
    expect(details!.querySelector("a")?.getAttribute("href")).toBe("https://maps.example/kix");
  });

  it("renders travel connector between items and omits trailing empty connector", () => {
    const twoItems: PlannerPlanDay = {
      ...day,
      items: [
        {
          order: 1,
          time: "09:00",
          type: "attraction",
          name: "오호리 공원",
          area: null,
          description: "아침 산책",
          estimatedDurationMinutes: 60,
          travelToNext: { mode: "walk", estimatedMinutes: 10 },
          bookingRecommended: false,
        },
        {
          order: 2,
          time: "10:30",
          type: "shopping",
          name: "텐진",
          area: null,
          description: "쇼핑 및 카페",
          estimatedDurationMinutes: 90,
          travelToNext: null,
          bookingRecommended: false,
        },
      ],
    };

    render(
      <PlannerDaySection day={twoItems} sessionId="550e8400-e29b-41d4-a716-446655440000" />,
    );

    expect(screen.getByTestId("planner-travel-connector-1-1")).toHaveTextContent(
      "도보 · 약 10분",
    );
    expect(screen.queryByTestId("planner-travel-connector-1-2")).not.toBeInTheDocument();
    expect(screen.getByText("오호리 공원")).toBeInTheDocument();
    expect(screen.getByText("텐진")).toBeInTheDocument();
  });

  it("uses enrichment route copy for travel connector when present", () => {
    const routeByFromOrder = new Map<number, PlannerRouteEnrichment>([
      [
        1,
        {
          day: 1,
          fromOrder: 1,
          toOrder: 2,
          status: "resolved",
          mode: "walk",
          durationMinutes: 12,
          distanceMeters: 800,
          provider: "google_routes",
        },
      ],
    ]);

    const twoItems: PlannerPlanDay = {
      ...day,
      items: [
        {
          order: 1,
          time: "09:00",
          type: "attraction",
          name: "A",
          area: null,
          description: "출발",
          estimatedDurationMinutes: 30,
          travelToNext: { mode: "walk", estimatedMinutes: 10 },
          bookingRecommended: false,
        },
        {
          order: 2,
          time: "10:00",
          type: "food",
          name: "B",
          area: null,
          description: "도착",
          estimatedDurationMinutes: 45,
          travelToNext: null,
          bookingRecommended: false,
        },
      ],
    };

    render(
      <PlannerDaySection
        day={twoItems}
        sessionId="550e8400-e29b-41d4-a716-446655440000"
        routeByFromOrder={routeByFromOrder}
      />,
    );

    expect(screen.getByTestId("planner-travel-connector-1-1")).toHaveTextContent(
      /도보 · 약 12분/,
    );
    expect(screen.getByTestId("planner-travel-connector-1-1")).toHaveTextContent("지도 기준");
  });

  it("renders timeless items with name and type icon", () => {
    const timeless: PlannerPlanDay = {
      ...day,
      items: [
        {
          order: 1,
          time: null,
          type: "food",
          name: "현지 맛집",
          area: null,
          description: "점심",
          estimatedDurationMinutes: 60,
          travelToNext: null,
          bookingRecommended: false,
        },
      ],
    };

    const { container } = render(
      <PlannerDaySection day={timeless} sessionId="550e8400-e29b-41d4-a716-446655440000" />,
    );

    expect(screen.queryByText(/\d{2}:\d{2}/)).not.toBeInTheDocument();
    expect(screen.getByText("현지 맛집")).toBeInTheDocument();
    expect(screen.getByText("식사")).toBeInTheDocument();
    expect(container.querySelector("svg")).toBeTruthy();
  });

  it("omits details control when no secondary info", () => {
    const simple: PlannerPlanDay = {
      ...day,
      items: [
        {
          order: 1,
          time: "10:00",
          type: "food",
          name: "점심",
          area: null,
          description: "근처에서 식사",
          estimatedDurationMinutes: 45,
          travelToNext: null,
          bookingRecommended: false,
        },
      ],
    };
    render(
      <PlannerDaySection day={simple} sessionId="550e8400-e29b-41d4-a716-446655440000" />,
    );
    expect(screen.queryByText("자세히")).not.toBeInTheDocument();
  });

  it("keeps reading order: duration before travel before details", () => {
    const placeByOrder = new Map<number, PlannerPlaceEnrichmentItem>([
      [
        1,
        {
          dayNumber: 1,
          itemOrder: 1,
          place: {
            status: "resolved",
            originalName: "간사이 국제공항",
            placeId: "p1",
            displayName: "간사이 국제공항",
            formattedAddress: "오사카부 주소",
            googleMapsUri: "https://maps.example/kix",
            location: { lat: 1, lng: 2 },
            types: [],
          },
        },
      ],
    ]);

    render(
      <PlannerDaySection
        day={day}
        sessionId="550e8400-e29b-41d4-a716-446655440000"
        placeByOrder={placeByOrder}
      />,
    );

    const duration = screen.getByText("약 60분");
    const travel = screen.getByTestId("planner-travel-connector-1-1");
    const details = screen.getByText("자세히").closest("details")!;
    expect(
      duration.compareDocumentPosition(travel) & Node.DOCUMENT_POSITION_FOLLOWING,
    ).toBeTruthy();
    expect(
      travel.compareDocumentPosition(details) & Node.DOCUMENT_POSITION_FOLLOWING,
    ).toBeTruthy();
  });
});
