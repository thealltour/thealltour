import { describe, expect, it } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach } from "vitest";
import { PlannerDaySection } from "@/components/planner/PlannerDaySection";
import type { PlannerPlanDay } from "@/lib/planner/planSchemas";
import type { PlannerPlaceEnrichmentItem } from "@/lib/planner/enrichmentTypes";

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

    render(
      <PlannerDaySection
        day={day}
        sessionId="550e8400-e29b-41d4-a716-446655440000"
        placeByOrder={placeByOrder}
      />,
    );

    expect(screen.getByText("12:00")).toBeInTheDocument();
    expect(screen.getByText("간사이 국제공항")).toBeInTheDocument();
    expect(screen.getByText("오사카 도착 후 시내로 이동")).toBeInTheDocument();
    expect(screen.getByText("약 60분")).toBeInTheDocument();
    expect(screen.getByText(/예상 이동 약 45분/)).toBeInTheDocument();
    expect(screen.getByText("이동")).toBeInTheDocument();
    expect(screen.getByText("예약 권장")).toBeInTheDocument();

    const details = screen.getByText("자세히").closest("details");
    expect(details).toBeTruthy();
    expect(details).not.toHaveAttribute("open");
    expect(details!.textContent).toContain("이즈미사노");
    expect(details!.textContent).toContain("오사카부 주소");
    expect(details!.querySelector("a")?.getAttribute("href")).toBe("https://maps.example/kix");
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
});
