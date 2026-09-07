import { describe, expect, it } from "vitest";
import { pickCity } from "@/lib/affiliate/planner/providers/wegotrip/weGoTripResolver";
import {
  buildWeGoTripProductUrl,
  selectWeGoTripProduct,
} from "@/lib/affiliate/planner/providers/wegotrip/weGoTripSelector";
import type { WeGoTripCity, WeGoTripProduct } from "@/lib/affiliate/planner/providers/wegotrip/weGoTripTypes";

const osaka: WeGoTripCity = { id: 1853909, name: "Osaka", slug: "osaka" };
const paris: WeGoTripCity = { id: 2988507, name: "Paris", slug: "paris" };

function product(
  partial: Partial<WeGoTripProduct> & Pick<WeGoTripProduct, "id" | "title" | "slug">,
): WeGoTripProduct {
  return {
    available: true,
    rating: null,
    reviewsCount: null,
    category: "Tours",
    city: osaka,
    ...partial,
  };
}

describe("weGoTripResolver pickCity", () => {
  it("prefers exact name match then lowest id", () => {
    expect(
      pickCity(
        [
          { ...paris, id: 10 },
          { ...osaka, id: 2 },
          { id: 3, name: "Osaka Bay", slug: "osaka-bay" },
        ],
        "Osaka",
      )?.id,
    ).toBe(2);
  });

  it("returns null when no cities", () => {
    expect(pickCity([], "Osaka")).toBeNull();
  });
});

describe("weGoTripSelector + URL builder", () => {
  it("boosts placeName lexical match", () => {
    const selected = selectWeGoTripProduct({
      placeName: "Pantheon",
      products: [
        product({ id: 1, title: "Generic city walk", slug: "walk" }),
        product({ id: 2, title: "Paris Pantheon Ticket", slug: "pantheon", city: paris }),
      ],
    });
    expect(selected?.product.id).toBe(2);
    expect(selected?.placeMatched).toBe(true);
  });

  it("excludes unavailable and keeps API order otherwise", () => {
    const selected = selectWeGoTripProduct({
      products: [
        product({ id: 9, title: "A", slug: "a", available: false }),
        product({ id: 3, title: "B", slug: "b" }),
        product({ id: 4, title: "C", slug: "c" }),
      ],
    });
    expect(selected?.product.id).toBe(3);
    expect(selected?.placeMatched).toBe(false);
  });

  it("builds documented product URL and rejects bad slugs", () => {
    expect(
      buildWeGoTripProductUrl(
        product({
          id: 10677,
          title: "t",
          slug: "a-stroll-through-time-historic-highlights-of-osaka",
          city: osaka,
        }),
      ),
    ).toBe(
      "https://wegotrip.com/osaka-d1853909/a-stroll-through-time-historic-highlights-of-osaka-p10677/",
    );
    expect(
      buildWeGoTripProductUrl(product({ id: 1, title: "t", slug: "bad slug", city: osaka })),
    ).toBeNull();
  });
});
