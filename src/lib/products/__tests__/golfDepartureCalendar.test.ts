import { describe, expect, it, vi, afterEach } from "vitest";
import * as desiredDeparture from "@/lib/inquiry/desiredDeparture";
import {
  buildGolfDepartureEvents,
  groupGolfDepartureEventsByDate,
  resolveGolfCalendarInitialDate,
  sortGolfDepartureEventsForList,
} from "@/lib/products/golfDepartureCalendar";
import type { Product } from "@/types/product";

describe("buildGolfDepartureEvents", () => {
  it("flattens departures and departure_from_date", () => {
    const products = [
      {
        id: "p1",
        title: "일본 골프",
        departures: ["2026-09-23", "2026-10-01"],
        departure_from_date: "2026-09-23",
        price: 1200000,
      } as Product,
    ];

    const events = buildGolfDepartureEvents(products);
    expect(events).toHaveLength(2);
    expect(events[0]).toMatchObject({
      date: "2026-09-23",
      productId: "p1",
      href: "/products/p1",
    });
  });

  it("normalizes Korean admin departure_from_date format", () => {
    const products = [
      {
        id: "p2",
        title: "동남아 골프",
        departure_from_date: "2026.02.20(금)",
        price: 980000,
      } as Product,
    ];

    const events = buildGolfDepartureEvents(products);
    expect(events).toHaveLength(1);
    expect(events[0]).toMatchObject({
      date: "2026-02-20",
      productId: "p2",
    });
  });

  it("deduplicates mixed ISO and Korean formats", () => {
    const products = [
      {
        id: "p3",
        title: "혼합 형식",
        departures: ["2026.10.01", "2026-10-05"],
        departure_from_date: "2026.10.01(수)",
      } as Product,
    ];

    const events = buildGolfDepartureEvents(products);
    expect(events.map((e) => e.date)).toEqual(["2026-10-01", "2026-10-05"]);
  });

  it("ignores unparseable departure strings", () => {
    const products = [
      {
        id: "p4",
        title: "미정 출발",
        departures: ["미정", "2026-11-01"],
        departure_from_date: "추후 안내",
      } as Product,
    ];

    const events = buildGolfDepartureEvents(products);
    expect(events).toHaveLength(1);
    expect(events[0].date).toBe("2026-11-01");
  });

  it("expands inline tilde departure range into daily events", () => {
    const products = [
      {
        id: "p-range",
        title: "연태 6색 골프",
        departure_from_date: "2026.07.01~2026.08.31",
        price: 599000,
      } as Product,
    ];

    const events = buildGolfDepartureEvents(products);
    expect(events).toHaveLength(62);
    expect(events[0]?.date).toBe("2026-07-01");
    expect(events[61]?.date).toBe("2026-08-31");
  });

  it("expands from/to departure window for home golf calendar (legacy products)", () => {
    const products = [
      {
        id: "p-trip",
        title: "패키지 골프",
        departure_from_date: "2026.07.01",
        departure_to_date: "2026.08.31",
        price: 599000,
      } as Product,
    ];

    const events = buildGolfDepartureEvents(products);
    expect(events).toHaveLength(62);
    expect(events[0]?.date).toBe("2026-07-01");
    expect(events[61]?.date).toBe("2026-08-31");
  });

  it("falls back to departure_from_date when schedules are unparseable placeholders", () => {
    const products = [
      {
        id: "p-legacy",
        title: "레거시 골프",
        departureSchedules: [{ departureDate: "미정", returnDate: null, price: null }],
        departure_from_date: "2026-10-15",
        price: 890000,
      } as Product,
    ];

    const events = buildGolfDepartureEvents(products);
    expect(events).toHaveLength(1);
    expect(events[0]).toMatchObject({
      date: "2026-10-15",
      productId: "p-legacy",
    });
  });

  it("uses only departure date for overnight flight (not arrival day)", () => {
    const products = [
      {
        id: "p-flight",
        title: "야간 항공 골프",
        departure_from_date: "2026-08-13",
        departure_to_date: "2026-08-14",
        price: 890000,
      } as Product,
    ];

    const events = buildGolfDepartureEvents(products);
    expect(events).toHaveLength(1);
    expect(events[0]).toMatchObject({
      date: "2026-08-13",
      productId: "p-flight",
    });
  });

  it("includes regionLabel and imageUrl metadata", () => {
    const products = [
      {
        id: "p-meta",
        title: "메타 골프",
        departure_from_date: "2026-10-01",
        overview_region: "중국",
        image_url: "https://example.com/golf.jpg",
      } as Product,
    ];

    const events = buildGolfDepartureEvents(products, { dest1: "베트남" });
    expect(events[0]).toMatchObject({
      regionLabel: "중국",
      imageUrl: "https://example.com/golf.jpg",
    });
  });

  it("resolves destination_id when overview_region is empty", () => {
    const products = [
      {
        id: "p-dest",
        title: "베트남 골프",
        departure_from_date: "2026-10-05",
        destination_id: "dest1",
      } as Product,
    ];

    const events = buildGolfDepartureEvents(products, { dest1: "베트남" });
    expect(events[0]?.regionLabel).toBe("베트남");
  });

  it("marks promotion campaign departures with isPromotionDeparture", () => {
    const products = [
      {
        id: "p-promo",
        title: "특가 골프",
        departure_from_date: "2026-10-10",
        campaign_card_meta: [
          {
            taxonomyId: "promo-1",
            name: "특가 기획",
            displayLabel: "시즌 특가",
            badge_priority: 1,
            badge_visible: true,
            badge_tone: "highlight",
          },
        ],
      } as Product,
      {
        id: "p-normal",
        title: "일반 골프",
        departure_from_date: "2026-10-11",
      } as Product,
    ];

    const events = buildGolfDepartureEvents(products, {}, "promo-1");
    expect(events.find((e) => e.productId === "p-promo")).toMatchObject({
      date: "2026-10-10",
      isPromotionDeparture: true,
    });
    expect(events.find((e) => e.productId === "p-normal")).toMatchObject({
      date: "2026-10-11",
      isPromotionDeparture: undefined,
    });
  });
});

describe("sortGolfDepartureEventsForList", () => {
  it("sorts promotion events before regular events on the same date", () => {
    const events = sortGolfDepartureEventsForList([
      {
        date: "2026-08-13",
        productId: "normal",
        title: "일반 골프",
        href: "/products/normal",
        isPromotionDeparture: undefined,
      },
      {
        date: "2026-08-13",
        productId: "promo",
        title: "특가 골프",
        href: "/products/promo",
        isPromotionDeparture: true,
      },
    ]);

    expect(events.map((e) => e.productId)).toEqual(["promo", "normal"]);
  });

  it("sorts by title within the same promotion tier", () => {
    const events = sortGolfDepartureEventsForList([
      {
        date: "2026-08-13",
        productId: "b",
        title: "베트남 골프",
        href: "/products/b",
      },
      {
        date: "2026-08-13",
        productId: "a",
        title: "가나다 골프",
        href: "/products/a",
      },
    ]);

    expect(events.map((e) => e.productId)).toEqual(["a", "b"]);
  });

  it("builds events only from the provided product subset", () => {
    const products = [
      {
        id: "included",
        title: "포함 상품",
        departures: ["2026-09-01"],
      } as Product,
      {
        id: "excluded",
        title: "제외 상품",
        departures: ["2026-10-01"],
      } as Product,
    ];

    const events = buildGolfDepartureEvents([products[0]]);
    expect(events).toHaveLength(1);
    expect(events[0]?.productId).toBe("included");
  });
});

describe("resolveGolfCalendarInitialDate", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("selects first upcoming departure on or after KST today", () => {
    vi.spyOn(desiredDeparture, "kstTodayYmd").mockReturnValue("2026-07-10");
    const result = resolveGolfCalendarInitialDate(["2026-05-01", "2026-08-15", "2026-09-01"]);
    expect(result.getFullYear()).toBe(2026);
    expect(result.getMonth()).toBe(7);
    expect(result.getDate()).toBe(15);
  });

  it("falls back to latest past departure when no upcoming dates remain", () => {
    vi.spyOn(desiredDeparture, "kstTodayYmd").mockReturnValue("2026-12-01");
    const result = resolveGolfCalendarInitialDate(["2026-05-01", "2026-08-15"]);
    expect(result.getFullYear()).toBe(2026);
    expect(result.getMonth()).toBe(7);
    expect(result.getDate()).toBe(15);
  });
});

describe("groupGolfDepartureEventsByDate", () => {
  it("places promotion events first within each date bucket", () => {
    const map = groupGolfDepartureEventsByDate([
      {
        date: "2026-08-13",
        productId: "normal",
        title: "일반 골프",
        href: "/products/normal",
      },
      {
        date: "2026-08-13",
        productId: "promo",
        title: "특가 골프",
        href: "/products/promo",
        isPromotionDeparture: true,
      },
    ]);

    expect(map.get("2026-08-13")?.map((e) => e.productId)).toEqual(["promo", "normal"]);
  });
});
