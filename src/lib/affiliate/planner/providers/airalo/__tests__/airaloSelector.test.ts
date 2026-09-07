import { describe, expect, it } from "vitest";
import { selectAiraloOffer } from "@/lib/affiliate/planner/providers/airalo/airaloSelector";
import type { AiraloOfferRecord } from "@/lib/affiliate/planner/providers/airalo/airaloTypes";

function rec(partial: Partial<AiraloOfferRecord> & Pick<AiraloOfferRecord, "id">): AiraloOfferRecord {
  const countryCode = partial.countryCode ?? "JP";
  const countryName =
    countryCode === "KR"
      ? "South Korea"
      : countryCode === "US"
        ? "United States"
        : countryCode === "TR"
          ? "Turkey"
          : countryCode === "ES"
            ? "Spain"
            : "Japan";
  return {
    title: partial.title ?? `title-${partial.id}`,
    sourceUrl: partial.sourceUrl ?? `https://www.airalo.com/japan-esim/${partial.id}`,
    countryCode,
    price: partial.price ?? 10,
    salePrice: partial.salePrice ?? null,
    currency: "USD",
    availability: partial.availability ?? "in stock",
    productType:
      partial.productType ?? `esim > Asia > ${countryName} > Data > 1GB > 7 Days`,
    description: null,
    imageUrl: null,
    brand: "Airalo",
    isBundle: partial.isBundle ?? false,
    mpn: null,
    ...partial,
    id: partial.id,
  };
}

describe("airaloSelector", () => {
  it("matches South Korea KR via product_type country segment", () => {
    const selected = selectAiraloOffer({
      countryCode: "KR",
      records: [
        rec({
          id: "kr-local",
          countryCode: "KR",
          productType: "esim > Asia > South Korea > Data > 1GB > 7 Days",
          price: 6,
        }),
        rec({ id: "jp", countryCode: "JP", price: 1 }),
      ],
    });
    expect(selected?.id).toBe("kr-local");
  });

  it("matches United States US via product_type style name", () => {
    const selected = selectAiraloOffer({
      countryCode: "US",
      records: [
        rec({
          id: "us-1",
          countryCode: "US",
          productType: "esim > Americas > United States > Data > 3GB > 15 Days",
          sourceUrl: "https://www.airalo.com/united-states-esim/us-1",
        }),
      ],
    });
    expect(selected?.id).toBe("us-1");
  });

  it("matches Spain ES via product_type style name", () => {
    const selected = selectAiraloOffer({
      countryCode: "ES",
      records: [
        rec({
          id: "es-1",
          countryCode: "ES",
          productType: "esim > Europe > Spain > Data > 1GB > 7 Days",
          sourceUrl: "https://www.airalo.com/spain-esim/es-1",
        }),
      ],
    });
    expect(selected?.id).toBe("es-1");
  });

  it("excludes unavailable (availability !== in stock)", () => {
    const selected = selectAiraloOffer({
      countryCode: "JP",
      records: [
        rec({ id: "out", availability: "out of stock", price: 1 }),
        rec({ id: "underscore-out", availability: "out_of_stock", price: 1 }),
        rec({ id: "missing-avail", availability: null, price: 1 }),
        rec({ id: "jp-ok", availability: "in stock", price: 5 }),
      ],
    });
    expect(selected?.id).toBe("jp-ok");
  });

  it("regional/global bundle must not outrank local country product", () => {
    const selected = selectAiraloOffer({
      countryCode: "JP",
      records: [
        rec({
          id: "bundle-cheap",
          isBundle: true,
          price: 1,
          productType: "esim > Global > Japan > Data > 20GB > 30 Days",
        }),
        rec({
          id: "local",
          isBundle: false,
          price: 8,
          productType: "esim > Asia > Japan > Data > 1GB > 7 Days",
        }),
      ],
    });
    expect(selected?.id).toBe("local");
  });

  it("prefers non-bundle then lower sale price then stable id", () => {
    const selected = selectAiraloOffer({
      countryCode: "JP",
      records: [
        rec({ id: "bundle", isBundle: true, price: 1 }),
        rec({ id: "b", salePrice: 4, price: 9 }),
        rec({ id: "a", salePrice: 4, price: 9 }),
        rec({ id: "c", price: 5 }),
      ],
    });
    expect(selected?.id).toBe("a");
  });

  it("returns null when no country match", () => {
    expect(
      selectAiraloOffer({
        countryCode: "FR",
        records: [rec({ id: "jp", countryCode: "JP" })],
      }),
    ).toBeNull();
  });
});
