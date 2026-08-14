import { describe, expect, it } from "vitest";
import {
  filterItineraryImageUrls,
  isJunkItineraryImageUrl,
  isMoveOrFlightEvent,
  isNoticeEventHeading,
  isSightseeingEventHeading,
  sanitizeAiItinerary,
  inferIconKeyFromHeading,
  inferDisplayRoleFromHeading,
  isItinerarySummaryEvent,
} from "@/lib/admin/externalImport/sanitizeAiItinerary";
import { mapExternalItineraryToV2 } from "@/lib/admin/externalImport/mapExternalItineraryToV2";

describe("sanitizeAiItinerary", () => {
  it("flags airline and junk image URLs", () => {
    expect(isJunkItineraryImageUrl("https://cdn.jejuair.net/images/carrier/jeju.png")).toBe(true);
    expect(isJunkItineraryImageUrl("https://cdn.example.com/logo.png")).toBe(true);
    expect(isJunkItineraryImageUrl("https://cdn.example.com/sangbishan-scene.jpg")).toBe(false);
  });

  it("detects move/flight headings", () => {
    expect(isMoveOrFlightEvent("항공편")).toBe(true);
    expect(isMoveOrFlightEvent("인천국제공항 출발")).toBe(true);
    expect(isMoveOrFlightEvent("상비산")).toBe(false);
    expect(isMoveOrFlightEvent("출입국 정보")).toBe(false);
    expect(isNoticeEventHeading("출입국 정보")).toBe(true);
  });

  it("keeps QR images on notice events", () => {
    const urls = filterItineraryImageUrls(
      ["https://cdn.example.com/qr-code.png"],
      "출입국 정보",
    );
    expect(urls).toHaveLength(1);
    expect(inferIconKeyFromHeading("출입국 정보")).toBe("info");
  });

  it("strips images from flight events", () => {
    const urls = filterItineraryImageUrls(
      ["https://cdn.jejuair.net/images/carrier/jeju.png", "https://cdn.example.com/scene.jpg"],
      "항공편",
    );
    expect(urls).toHaveLength(0);
  });

  it("keeps sightseeing images and drops junk URLs", () => {
    const urls = filterItineraryImageUrls(
      [
        "https://cdn.example.com/logo.png",
        "https://cdn.example.com/sangbishan-1.jpg",
        "https://cdn.example.com/sangbishan-2.jpg",
      ],
      "상비산",
    );
    expect(urls).toEqual([
      "https://cdn.example.com/sangbishan-1.jpg",
      "https://cdn.example.com/sangbishan-2.jpg",
    ]);
  });

  it("sanitizes day cover to sightseeing only", () => {
    const result = sanitizeAiItinerary({
      days: [
        {
          day: 1,
          dateText: "11/26(목)",
          title: "1일차",
          coverImageUrl: "https://cdn.jejuair.net/images/carrier/jeju.png",
          events: [
            {
              heading: "항공편",
              description: "제주항공 7C8631",
              timeOfDay: "오후",
              timeText: "20:00",
              imageUrls: ["https://cdn.jejuair.net/images/carrier/jeju.png"],
            },
            {
              heading: "상비산",
              description: "관광 설명",
              timeOfDay: "오전",
              timeText: "09:00",
              imageUrls: ["https://cdn.example.com/sangbishan-1.jpg"],
            },
          ],
        },
      ],
    });

    expect(result?.days[0].events[0].imageUrls).toHaveLength(0);
    expect(result?.days[0].coverImageUrl).toBe("https://cdn.example.com/sangbishan-1.jpg");
  });

  it("infers iconKey and displayRole from headings", () => {
    expect(inferIconKeyFromHeading("항공편")).toBe("plane");
    expect(inferIconKeyFromHeading("호텔")).toBe("hotel");
    expect(inferIconKeyFromHeading("숙소")).toBe("hotel");
    expect(inferIconKeyFromHeading("식사")).toBe("utensils");
    expect(inferIconKeyFromHeading("중식")).toBe("utensils");
    expect(inferIconKeyFromHeading("상비산")).toBe("landmark");
    expect(inferDisplayRoleFromHeading("호텔")).toBe("summary");
    expect(inferDisplayRoleFromHeading("중식")).toBe("summary");
    expect(inferDisplayRoleFromHeading("석식")).toBe("summary");
    expect(inferDisplayRoleFromHeading("숙소")).toBe("summary");
    expect(inferDisplayRoleFromHeading("호텔로 이동")).toBe("activity");
    expect(inferDisplayRoleFromHeading("석식 후 호텔 휴식")).toBe("activity");
    expect(inferDisplayRoleFromHeading("상비산")).toBe("activity");
    expect(isSightseeingEventHeading("상비산")).toBe(true);
    expect(isSightseeingEventHeading("항공편")).toBe(false);
  });

  it("treats explicit displayRole as authoritative for summary placement", () => {
    expect(isItinerarySummaryEvent({ heading: "중식" })).toBe(true);
    expect(isItinerarySummaryEvent({ heading: "호텔로 이동" })).toBe(false);
    expect(isItinerarySummaryEvent({ heading: "중식", displayRole: "activity" })).toBe(false);
    expect(isItinerarySummaryEvent({ heading: "상비산", displayRole: "summary" })).toBe(true);
  });
});

describe("mapExternalItineraryToV2 with sanitize", () => {
  it("maps flight without images and sightseeing with images", () => {
    const result = mapExternalItineraryToV2({
      days: [
        {
          day: 1,
          dateText: "11/26(목)",
          title: "1일차",
          coverImageUrl: null,
          events: [
            {
              heading: "항공편",
              description: "제주항공",
              timeOfDay: "오후",
              timeText: "20:00",
              imageUrls: ["https://cdn.jejuair.net/images/carrier/jeju.png"],
            },
          ],
        },
        {
          day: 2,
          dateText: "11/27(금)",
          title: "2일차",
          coverImageUrl: null,
          events: [
            {
              heading: "상비산",
              description: "명산 설명",
              timeOfDay: "오전",
              timeText: "09:00",
              imageUrls: ["https://cdn.example.com/sangbishan-1.jpg"],
            },
          ],
        },
      ],
    });

    const day1Flight = result?.days[0].events[0];
    expect(day1Flight?.heading).toBe("항공편");
    expect(day1Flight?.images).toBeUndefined();
    expect(day1Flight?.iconKey).toBe("plane");
    expect(result?.days[0].coverImageUrl).toBeUndefined();

    const day2 = result?.days[1];
    expect(day2?.events[0].images).toHaveLength(1);
    expect(day2?.coverImageUrl).toBe("https://cdn.example.com/sangbishan-1.jpg");
    expect(day2?.events[0].iconKey).toBe("landmark");
  });
});
