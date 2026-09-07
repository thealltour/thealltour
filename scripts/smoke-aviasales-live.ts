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
  const { selectAviasalesPriceOffer } = await import(
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

  let selection: ReturnType<typeof selectAviasalesPriceOffer> = null;
  try {
    if (!originIata || !destIata) {
      results.push({
        step: "fetch_prices_2026-10-01_2026-10-05",
        status: "FAIL",
        error: "skipped_missing_iata",
      });
    } else {
      const prices = await fetchAviasalesPricesForDates({
        origin: originIata,
        destination: destIata,
        departureAt: "2026-10-01",
        returnAt: "2026-10-05",
        oneWay: false,
        deps,
      });
      if (!prices.ok) {
        results.push({
          step: "fetch_prices_2026-10-01_2026-10-05",
          status: "FAIL",
          error: prices.errorCode,
        });
      } else if (prices.data.length === 0) {
        results.push({
          step: "fetch_prices_2026-10-01_2026-10-05",
          status: "FAIL",
          error: "empty_offers",
          detail: { originIata, destIata },
        });
      } else {
        results.push({
          step: "fetch_prices_2026-10-01_2026-10-05",
          status: "PASS",
          detail: { originIata, destIata, offerCount: prices.data.length },
        });
        selection = selectAviasalesPriceOffer({ offers: prices.data });
        results.push({
          step: "select_price_offer",
          status: selection ? "PASS" : "FAIL",
          detail: selection
            ? {
                sourceHost: maskHost(selection.sourceUrl),
                hasSearchPath: selection.sourceUrl.includes("/search"),
              }
            : undefined,
          error: selection ? undefined : "no_usable_search_link",
        });
      }
    }
  } catch (e) {
    results.push({
      step: "fetch_prices_2026-10-01_2026-10-05",
      status: "FAIL",
      error: e instanceof Error ? e.message.slice(0, 200) : "unknown",
    });
  }

  try {
    if (!selection) {
      results.push({
        step: "create_partner_link",
        status: "FAIL",
        error: "skipped_no_selection",
      });
    } else {
      const commerce = await createTravelpayoutsCommerceTarget({
        sourceUrl: selection.sourceUrl,
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
    "fetch_prices_2026-10-01_2026-10-05",
    "select_price_offer",
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
