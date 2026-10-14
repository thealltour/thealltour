/**
 * Live Aviasales smoke (no booking).
 * Loads .env.local; never prints secrets.
 *
 * Run: npx tsx --import ./scripts/stub-server-only-register.mjs scripts/smoke-aviasales-live.ts
 */
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

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
    // missing .env.local
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

function maskHost(url: string): string {
  try {
    return new URL(url).hostname;
  } catch {
    return "(invalid-url)";
  }
}

type StepResult = {
  step: string;
  status: "PASS" | "FAIL";
  detail?: Record<string, unknown>;
  error?: string;
};

async function main() {
  loadEnvLocal();
  const results: StepResult[] = [];

  const hasToken = Boolean(process.env.TRAVELPAYOUTS_API_TOKEN?.trim());
  const hasMarker = Boolean(process.env.TRAVELPAYOUTS_PARTNER_ID?.trim());
  const hasProject = Boolean(process.env.TRAVELPAYOUTS_PROJECT_ID?.trim());
  results.push({
    step: "env_config",
    status: hasToken && hasMarker && hasProject ? "PASS" : "FAIL",
    detail: {
      hasToken,
      hasPartnerId: hasMarker,
      hasProjectId: hasProject,
    },
  });

  const { createMemoryAviasalesCache } = await import(
    "@/lib/affiliate/planner/providers/aviasales/aviasalesCache"
  );
  const { resolveAviasalesLocationIata } = await import(
    "@/lib/affiliate/planner/providers/aviasales/aviasalesDestinationResolver"
  );
  const { fetchAviasalesPricesForDates } = await import(
    "@/lib/affiliate/planner/providers/aviasales/aviasalesDataClient"
  );
  const { buildAviasalesCanonicalSearchUrl, selectAviasalesPriceOffer } = await import(
    "@/lib/affiliate/planner/providers/aviasales/aviasalesSelector"
  );
  const { AVIASALES_ALLOWED_HOSTS } = await import(
    "@/lib/affiliate/planner/providers/aviasales/aviasalesTypes"
  );
  const { createTravelpayoutsCommerceTarget } = await import(
    "@/lib/affiliate/travelpayouts/commerceService"
  );

  const cache = createMemoryAviasalesCache();
  const deps = { cache };

  let originIata: string | null = null;
  let destIata: string | null = null;

  try {
    const origin = await resolveAviasalesLocationIata({
      locationText: "서울",
      deps,
    });
    originIata = origin?.iata ?? null;
    results.push({
      step: "resolve_origin_서울",
      status: originIata ? "PASS" : "FAIL",
      detail: origin
        ? { iata: origin.iata, name: origin.name, type: origin.type, countryCode: origin.countryCode }
        : undefined,
      error: originIata ? undefined : "null_resolution",
    });
  } catch (e) {
    results.push({
      step: "resolve_origin_서울",
      status: "FAIL",
      error: e instanceof Error ? e.message.slice(0, 200) : "unknown",
    });
  }

  try {
    const dest = await resolveAviasalesLocationIata({
      locationText: "오사카",
      deps,
    });
    destIata = dest?.iata ?? null;
    results.push({
      step: "resolve_destination_오사카",
      status: destIata ? "PASS" : "FAIL",
      detail: dest
        ? { iata: dest.iata, name: dest.name, type: dest.type, countryCode: dest.countryCode }
        : undefined,
      error: destIata ? undefined : "null_resolution",
    });
  } catch (e) {
    results.push({
      step: "resolve_destination_오사카",
      status: "FAIL",
      error: e instanceof Error ? e.message.slice(0, 200) : "unknown",
    });
  }

  let sourceUrl: string | null = null;
  try {
    if (!originIata || !destIata) {
      results.push({
        step: "fetch_prices",
        status: "FAIL",
        error: "skipped_missing_iata",
      });
    } else {
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
      if (!prices.ok) {
        results.push({
          step: "fetch_prices",
          status: "FAIL",
          error: prices.errorCode,
          detail: { departureDate: DEPARTURE_DATE, returnDate: RETURN_DATE },
        });
      } else if (prices.data.length === 0) {
        results.push({
          step: "fetch_prices",
          status: "FAIL",
          error: "empty_offers",
          detail: { originIata, destIata, departureDate: DEPARTURE_DATE, returnDate: RETURN_DATE },
        });
      } else {
        results.push({
          step: "fetch_prices",
          status: "PASS",
          detail: {
            originIata,
            destIata,
            departureDate: DEPARTURE_DATE,
            returnDate: RETURN_DATE,
            offerCount: prices.data.length,
          },
        });
        const selection = selectAviasalesPriceOffer({ offers: prices.data });
        results.push({
          step: "select_price_offer",
          status: selection ? "PASS" : "FAIL",
          error: selection ? undefined : "no_usable_search_link",
        });
        if (selection) {
          const search = buildAviasalesCanonicalSearchUrl({
            originIata,
            destinationIata: destIata,
            departureDate: DEPARTURE_DATE,
            returnDate: RETURN_DATE,
            ...SMOKE_TRAVELERS,
          });
          sourceUrl = search.ok ? search.url : null;
          results.push({
            step: "build_canonical_search_url",
            status: search.ok ? "PASS" : "FAIL",
            detail: search.ok
              ? { sourceHost: maskHost(search.url), sourcePath: new URL(search.url).pathname }
              : undefined,
            error: search.ok ? undefined : search.reason,
          });
        }
      }
    }
  } catch (e) {
    results.push({
      step: "fetch_prices",
      status: "FAIL",
      error: e instanceof Error ? e.message.slice(0, 200) : "unknown",
    });
  }

  try {
    if (!sourceUrl) {
      results.push({
        step: "create_partner_link",
        status: "FAIL",
        error: "skipped_no_source_url",
      });
    } else {
      const commerce = await createTravelpayoutsCommerceTarget({
        sourceUrl,
        providerId: "aviasales",
        allowedHosts: [...AVIASALES_ALLOWED_HOSTS],
      });
      const ok =
        typeof commerce.affiliateUrl === "string" &&
        commerce.affiliateUrl.startsWith("https://") &&
        commerce.affiliateNetwork === "travelpayouts";
      results.push({
        step: "create_partner_link",
        status: ok ? "PASS" : "FAIL",
        detail: {
          affiliateHost: maskHost(commerce.affiliateUrl),
          sourceUrlHost: commerce.sourceUrlHost,
          network: commerce.affiliateNetwork,
          hasSubId: Boolean(commerce.providerSubId),
        },
        error: ok ? undefined : "invalid_affiliate_url",
      });
    }
  } catch (e) {
    const code =
      e && typeof e === "object" && "code" in e
        ? String((e as { code: unknown }).code)
        : e instanceof Error
          ? e.message.slice(0, 200)
          : "unknown";
    results.push({
      step: "create_partner_link",
      status: "FAIL",
      error: code,
    });
  }

  const critical = [
    "resolve_origin_서울",
    "resolve_destination_오사카",
    "fetch_prices",
    "select_price_offer",
    "build_canonical_search_url",
    "create_partner_link",
  ];
  const fullPass = critical.every(
    (s) => results.find((r) => r.step === s)?.status === "PASS",
  );

  console.log(
    JSON.stringify(
      {
        fullPass,
        verdict: fullPass ? "FULL_PASS" : "NOT_FULL_PASS",
        results,
      },
      null,
      2,
    ),
  );
  process.exit(fullPass ? 0 : 1);
}

main().catch((e) => {
  console.log(
    JSON.stringify({
      fullPass: false,
      verdict: "FATAL",
      error: e instanceof Error ? e.message.slice(0, 300) : "unknown",
    }),
  );
  process.exit(1);
});
