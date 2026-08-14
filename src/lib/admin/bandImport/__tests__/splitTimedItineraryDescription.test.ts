import { describe, expect, it } from "vitest";
import { splitTimedItineraryDescription } from "@/lib/admin/bandImport/splitTimedItineraryDescription";

describe("splitTimedItineraryDescription", () => {
  it("keeps a single-clock blob as one event", () => {
    const chunks = splitTimedItineraryDescription("가이드 미팅 06:30, 공항 이동 약 40분");
    expect(chunks).toHaveLength(1);
    expect(chunks[0].timeText).toBe("06:30");
  });

  it("splits two clock times into separate events", () => {
    const chunks = splitTimedItineraryDescription(
      "08:55 인천 국제공항 출발\n09:25 연태 국제공항 도착",
    );
    expect(chunks).toHaveLength(2);
    expect(chunks[0]).toMatchObject({ timeText: "08:55", heading: "인천 국제공항 출발" });
    expect(chunks[1]).toMatchObject({ timeText: "09:25", heading: "연태 국제공항 도착" });
  });
});
