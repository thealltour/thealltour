import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { beforeAll, describe, expect, it } from "vitest";

import { createMemoryAviasalesCache } from "@/lib/affiliate/planner/providers/aviasales/aviasalesCache";
import { fetchAviasalesPricesForDates } from "@/lib/affiliate/planner/providers/aviasales/aviasalesDataClient";
import { resolveAviasalesLocationIata } from "@/lib/affiliate/planner/providers/aviasales/aviasalesDestinationResolver";
import {
  buildAviasalesCanonicalSearchUrl,
  selectAviasalesPriceOffer,
} from "@/lib/affiliate/planner/providers/aviasales/aviasalesSelector";
import { AVIASALES_ALLOWED_HOSTS } from "@/lib/affiliate/planner/providers/aviasales/aviasalesTypes";
import { createTravelpayoutsCommerceTarget } from "@/lib/affiliate/travelpayouts/commerceService";

function loadEnvLocal(): void {
  const file = resolve(process.cwd(), ".env.local");
  try {
    const text = readFileSync(file, "utf8");
    for (const line of text.split(/\n/)) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith("#")) continue;
      const idx = trimmed.indexOf("=");
      if (idx < 0) continue;
      const key = trimmed.slice(0, idx).trim();
      let value = trimmed.slice(idx + 1).trim();
      if (
        (value.startsWith('"') && value.endsWith('"')) ||
        (value.startsWith("'") && value.endsWith("'"))
      ) {
        value = value.slice(1, -1);
      }
      if (!process.env[key]) process.env[key] = value;
    }
  } catch {
    // ignore
  }
}

/** UTC date-only offset from the run date (prices_for_dates only covers roughly the next year). */
function utcIsoDatePlusDays(days: number, from = new Date()): string {
  return new Date(
    Date.UTC(from.getUTCFullYear(), from.getUTCMonth(), from.getUTCDate() + days),
  )
    .toISOString()
    .slice(0, 10);
}

const DEPARTURE_DATE = utcIsoDatePlusDays(90);
const RETURN_DATE = utcIsoDatePlusDays(94);
const SMOKE_TRAVELERS = { adults: 3, children: 0 };

const live = process.env.LIVE_AVIASALES_SMOKE === "1";

describe.skipIf(!live)("LIVE Aviasales smoke (no booking)", () => {
  const cache = createMemoryAviasalesCache();
  const deps = { cache };
  let originIata = "";
  let destIata = "";
  let sourceUrl = "";

  beforeAll(() => {
    loadEnvLocal();
  });

  it("env has Travelpayouts token/marker/project (names only)", () => {
    expect(Boolean(process.env.TRAVELPAYOUTS_API_TOKEN?.trim())).toBe(true);
    expect(Boolean(process.env.TRAVELPAYOUTS_PARTNER_ID?.trim())).toBe(true);
    expect(Boolean(process.env.TRAVELPAYOUTS_PROJECT_ID?.trim())).toBe(true);
  });

  it('resolveAviasalesLocationIata("서울") → IATA', async () => {
    const origin = await resolveAviasalesLocationIata({ locationText: "서울", deps });
    expect(origin).not.toBeNull();
    expect(origin!.iata).toMatch(/^[A-Z]{3}$/);
    originIata = origin!.iata;
    console.log(JSON.stringify({ step: "origin", iata: origin!.iata, name: origin!.name, type: origin!.type }));
  }, 20_000);

  it('resolveAviasalesLocationIata("오사카") → IATA', async () => {
    const dest = await resolveAviasalesLocationIata({ locationText: "오사카", deps });
    expect(dest).not.toBeNull();
    expect(dest!.iata).toMatch(/^[A-Z]{3}$/);
    destIata = dest!.iata;
    console.log(JSON.stringify({ step: "destination", iata: dest!.iata, name: dest!.name, type: dest!.type }));
  }, 20_000);

  it("fetchAviasalesPricesForDates (run-date +90/+94 months) + canonical 3-adult search URL", async () => {
    expect(originIata).toMatch(/^[A-Z]{3}$/);
    expect(destIata).toMatch(/^[A-Z]{3}$/);
    // Data API only holds cached fares: an untouched exact date pair can be empty, so the
    // connectivity check uses month granularity; the target URL still uses the exact dates.
    const prices = await fetchAviasalesPricesForDates({
      origin: originIata,
      destination: destIata,
      departureAt: DEPARTURE_DATE.slice(0, 7),
      returnAt: RETURN_DATE.slice(0, 7),
      oneWay: false,
      deps,
    });
    expect(prices.ok).toBe(true);
    if (!prices.ok) return;
    expect(prices.data.length).toBeGreaterThan(0);
    expect(selectAviasalesPriceOffer({ offers: prices.data })).not.toBeNull();

    const search = buildAviasalesCanonicalSearchUrl({
      originIata,
      destinationIata: destIata,
      departureDate: DEPARTURE_DATE,
      returnDate: RETURN_DATE,
      ...SMOKE_TRAVELERS,
    });
    expect(search.ok).toBe(true);
    if (!search.ok) return;
    sourceUrl = search.url;
    expect(new URL(sourceUrl).pathname.endsWith("3")).toBe(true);
    console.log(
      JSON.stringify({
        step: "prices",
        originIata,
        destIata,
        departureDate: DEPARTURE_DATE,
        returnDate: RETURN_DATE,
        offerCount: prices.data.length,
        sourceHost: new URL(sourceUrl).hostname,
        sourcePath: new URL(sourceUrl).pathname,
      }),
    );
  }, 30_000);

  it("createTravelpayoutsCommerceTarget Partner Link", async () => {
    expect(sourceUrl.startsWith("https://")).toBe(true);
    const commerce = await createTravelpayoutsCommerceTarget({
      sourceUrl,
      providerId: "aviasales",
      allowedHosts: [...AVIASALES_ALLOWED_HOSTS],
    });
    expect(commerce.affiliateUrl.startsWith("https://")).toBe(true);
    expect(commerce.affiliateNetwork).toBe("travelpayouts");
    console.log(
      JSON.stringify({
        step: "partner_link",
        affiliateHost: new URL(commerce.affiliateUrl).hostname,
        sourceUrlHost: commerce.sourceUrlHost,
        hasSubId: Boolean(commerce.providerSubId),
      }),
    );
  }, 30_000);
});
