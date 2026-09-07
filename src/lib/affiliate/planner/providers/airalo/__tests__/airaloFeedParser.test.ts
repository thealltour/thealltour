import { describe, expect, it } from "vitest";
import {
  airaloProductTypeMatchesCountryCode,
  canonicalEnglishCountryNameFromIso,
  deriveAiraloCountryCode,
  parseAiraloProductTypeCountrySegment,
} from "@/lib/affiliate/planner/providers/airalo/airaloCountry";
import { parseAiraloFeedXml } from "@/lib/affiliate/planner/providers/airalo/airaloFeedParser";

/** Minimal real-schema subset (RSS 2.0 + Google ns). Not production XML. */
const SAMPLE_FEED = `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0" xmlns:g="http://base.google.com/ns/1.0">
  <channel>
    <title>Airalo</title>
    <item>
      <g:id>jp-local-1</g:id>
      <g:title>Moshi Moshi 1GB 7 Days</g:title>
      <g:link>https://www.airalo.com/japan-esim/moshi-moshi-1gb-7days</g:link>
      <g:image_link>https://cdn.airalo.com/img/jp.png</g:image_link>
      <g:price>4.50 USD</g:price>
      <g:sale_price>3.90 USD</g:sale_price>
      <g:brand>Airalo</g:brand>
      <g:availability>in stock</g:availability>
      <g:product_type>esim &gt; Asia &gt; Japan &gt; Data &gt; 1GB &gt; 7 Days</g:product_type>
      <g:description>Japan local eSIM</g:description>
      <g:is_bundle>false</g:is_bundle>
      <g:mpn>JP-1</g:mpn>
    </item>
    <item>
      <g:id>missing-link</g:id>
      <g:title>Broken</g:title>
      <g:price>1.00 USD</g:price>
    </item>
    <item>
      <g:id>out</g:id>
      <g:title>Out</g:title>
      <g:link>https://www.airalo.com/japan-esim/out</g:link>
      <g:price>9.00 USD</g:price>
      <g:availability>out of stock</g:availability>
      <g:product_type>esim &gt; Asia &gt; Japan &gt; Data &gt; 3GB &gt; 30 Days</g:product_type>
    </item>
    <item>
      <g:id>kr-1</g:id>
      <g:title>Korea plan</g:title>
      <g:link>https://www.airalo.com/south-korea-esim/plan</g:link>
      <g:price>5.00 USD</g:price>
      <g:availability>in stock</g:availability>
      <g:product_type>esim &gt; Asia &gt; South Korea &gt; Data &gt; 1GB &gt; 7 Days</g:product_type>
      <g:is_bundle>false</g:is_bundle>
    </item>
    <item>
      <g:id>malformed-pt</g:id>
      <g:title>Bad type</g:title>
      <g:link>https://www.airalo.com/japan-esim/bad</g:link>
      <g:availability>in stock</g:availability>
      <g:product_type>Local eSIMs &gt; Japan</g:product_type>
    </item>
    <item>
      <g:id>regional-asia</g:id>
      <g:title>Asia pack</g:title>
      <g:link>https://www.airalo.com/asia-esim/pack</g:link>
      <g:availability>in stock</g:availability>
      <g:product_type>esim &gt; Asia &gt; Asia &gt; Data &gt; 10GB &gt; 30 Days</g:product_type>
      <g:is_bundle>true</g:is_bundle>
    </item>
  </channel>
</rss>`;

describe("airaloFeedParser", () => {
  it("parses NEW feed Google Merchant fields and derives country from product_type", () => {
    const result = parseAiraloFeedXml(SAMPLE_FEED);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    const jp = result.records.find((r) => r.id === "jp-local-1");
    expect(jp?.countryCode).toBe("JP");
    expect(jp?.salePrice).toBe(3.9);
    expect(jp?.price).toBe(4.5);
    expect(jp?.isBundle).toBe(false);
    expect(jp?.availability).toBe("in stock");
    expect(jp?.sourceUrl).toContain("airalo.com/japan-esim");
    expect(jp?.productType).toContain("Japan");
  });

  it("skips malformed rows missing required link", () => {
    const result = parseAiraloFeedXml(SAMPLE_FEED);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.records.some((r) => r.id === "missing-link")).toBe(false);
  });

  it("skips malformed product_type (guessed schema / too few segments)", () => {
    const result = parseAiraloFeedXml(SAMPLE_FEED);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.records.some((r) => r.id === "malformed-pt")).toBe(false);
  });

  it("skips regional product_type whose COUNTRY segment is not a country", () => {
    const result = parseAiraloFeedXml(SAMPLE_FEED);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.records.some((r) => r.id === "regional-asia")).toBe(false);
  });

  it("keeps unavailable rows for selector filtering (availability preserved)", () => {
    const result = parseAiraloFeedXml(SAMPLE_FEED);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    const out = result.records.find((r) => r.id === "out");
    expect(out?.availability?.toLowerCase()).toContain("out");
  });

  it("rejects invalid / non-xml payload", () => {
    expect(parseAiraloFeedXml("not xml").ok).toBe(false);
    expect(parseAiraloFeedXml("").ok).toBe(false);
    expect(parseAiraloFeedXml("<rss><channel></channel></rss>").ok).toBe(false);
  });

  it("does not invent countryCode from URL slug — product_type COUNTRY only", () => {
    const xml = `<?xml version="1.0"?>
    <rss xmlns:g="http://base.google.com/ns/1.0"><channel><item>
      <g:id>x</g:id>
      <g:title>t</g:title>
      <g:link>https://www.airalo.com/asia-esim/pack</g:link>
      <g:product_type>esim &gt; Europe &gt; France &gt; Data &gt; 1GB &gt; 7 Days</g:product_type>
      <g:availability>in stock</g:availability>
    </item></channel></rss>`;
    const result = parseAiraloFeedXml(xml);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.records[0]?.countryCode).toBe("FR");
    expect(
      deriveAiraloCountryCode({
        productType: null,
      }),
    ).toBeNull();
    expect(parseAiraloProductTypeCountrySegment("Local eSIMs > Japan")).toBeNull();
  });
});

describe("airalo country matching (ISO → feed product_type names)", () => {
  it("maps KR/US/TR/ES to canonical English names used in product_type", () => {
    expect(canonicalEnglishCountryNameFromIso("KR")).toBe("south korea");
    expect(canonicalEnglishCountryNameFromIso("US")).toBe("united states");
    expect(canonicalEnglishCountryNameFromIso("TR")).toBe("turkey");
    expect(canonicalEnglishCountryNameFromIso("ES")).toBe("spain");
  });

  it("matches South Korea / United States / Turkey / Spain product_type style", () => {
    expect(
      airaloProductTypeMatchesCountryCode(
        "esim > Asia > South Korea > Data > 1GB > 7 Days",
        "KR",
      ),
    ).toBe(true);
    expect(
      airaloProductTypeMatchesCountryCode(
        "esim > Americas > United States > Data > 3GB > 15 Days",
        "US",
      ),
    ).toBe(true);
    expect(
      airaloProductTypeMatchesCountryCode(
        "esim > Europe > Turkey > Data > 5GB > 30 Days",
        "TR",
      ),
    ).toBe(true);
    expect(
      airaloProductTypeMatchesCountryCode(
        "esim > Europe > Spain > Data > 1GB > 7 Days",
        "ES",
      ),
    ).toBe(true);
  });

  it("parses KR/US/TR/ES from real-schema product_type into ISO", () => {
    expect(
      deriveAiraloCountryCode({
        productType: "esim > Asia > South Korea > Data > 1GB > 7 Days",
      }),
    ).toBe("KR");
    expect(
      deriveAiraloCountryCode({
        productType: "esim > Americas > United States > Unlimited > 10 Days",
      }),
    ).toBe("US");
    expect(
      deriveAiraloCountryCode({
        productType: "esim > Europe > Turkey > Data > 3GB > 30 Days",
      }),
    ).toBe("TR");
    expect(
      deriveAiraloCountryCode({
        productType: "esim > Europe > Spain > Data > 2GB > 15 Days",
      }),
    ).toBe("ES");
  });
});
