import "server-only";

import {
  getTravelpayoutsConfig,
  TRAVELPAYOUTS_PARTNER_LINKS_TIMEOUT_MS,
  TRAVELPAYOUTS_PARTNER_LINKS_URL,
  TravelpayoutsConfigError,
} from "@/lib/affiliate/travelpayouts/config";
import { TravelpayoutsError, travelpayoutsSafeLogMeta } from "@/lib/affiliate/travelpayouts/errors";
import { validateTravelpayoutsSubId } from "@/lib/affiliate/travelpayouts/subId";
import type {
  CreateTravelpayoutsPartnerLinkInput,
  TravelpayoutsPartnerLinkResult,
} from "@/lib/affiliate/travelpayouts/types";
import {
  safeHostnameFromUrl,
  validateAffiliateSourceUrl,
  validateGeneratedAffiliateUrl,
} from "@/lib/affiliate/travelpayouts/urlPolicy";

type PartnerLinksApiResponse = {
  result?: {
    links?: Array<{
      code?: boolean | number | string;
      partner_url?: string;
      url?: string;
      sub_id?: string;
    }>;
  };
  links?: Array<{
    code?: boolean | number | string;
    partner_url?: string;
    url?: string;
    sub_id?: string;
  }>;
  code?: boolean | number | string;
  status?: string;
};

/**
 * Server-only Travelpayouts Partner Links client.
 * Never expose as a public arbitrary URL converter.
 */
export async function createTravelpayoutsPartnerLink(
  input: CreateTravelpayoutsPartnerLinkInput,
): Promise<TravelpayoutsPartnerLinkResult> {
  if (!validateTravelpayoutsSubId(input.subId)) {
    throw new TravelpayoutsError("invalid_source_url", "Invalid SubID format");
  }

  const sourceCheck = validateAffiliateSourceUrl(input.targetUrl, {
    allowedHosts: input.allowedHosts,
    httpsOnly: true,
  });
  if (!sourceCheck.ok) {
    throw sourceCheck.error;
  }

  let config;
  try {
    config = input.config ?? getTravelpayoutsConfig();
  } catch (error) {
    if (error instanceof TravelpayoutsConfigError) {
      throw new TravelpayoutsError("config_missing", "Travelpayouts configuration is incomplete");
    }
    throw error;
  }

  const fetchImpl = input.fetchImpl ?? fetch;
  const body = {
    trs: Number(config.projectId) || config.projectId,
    marker: Number(config.partnerId) || config.partnerId,
    shorten: false,
    links: [{ url: sourceCheck.url.toString(), sub_id: input.subId }],
  };

  let response: Response;
  try {
    response = await fetchWithTimeout(
      fetchImpl,
      TRAVELPAYOUTS_PARTNER_LINKS_URL,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Accept: "application/json",
          "X-Access-Token": config.apiToken,
        },
        body: JSON.stringify(body),
      },
      TRAVELPAYOUTS_PARTNER_LINKS_TIMEOUT_MS,
    );
  } catch (error) {
    if (error instanceof TravelpayoutsError) throw error;
    console.info(
      "[travelpayouts] partner_links network",
      travelpayoutsSafeLogMeta({
        hostname: sourceCheck.hostname,
        errorCode: "network_failed",
      }),
    );
    throw new TravelpayoutsError("network_failed", "Partner Links network error", {
      cause: error,
    });
  }

  if (response.status === 429) {
    const retryAfterSeconds = parseRetryAfter(response.headers.get("retry-after"));
    throw new TravelpayoutsError("rate_limited", "Partner Links rate limited", {
      retryAfterSeconds,
    });
  }

  if (response.status === 401 || response.status === 403) {
    throw new TravelpayoutsError("provider_rejected", "Partner Links unauthorized");
  }

  if (!response.ok) {
    throw new TravelpayoutsError(
      "provider_rejected",
      `Partner Links HTTP ${response.status}`,
    );
  }

  let json: PartnerLinksApiResponse;
  try {
    json = (await response.json()) as PartnerLinksApiResponse;
  } catch (error) {
    throw new TravelpayoutsError("invalid_response", "Partner Links JSON parse failed", {
      cause: error,
    });
  }

  const link =
    json.result?.links?.[0] ??
    (Array.isArray(json.links) ? json.links[0] : undefined);

  const partnerUrl = typeof link?.partner_url === "string" ? link.partner_url.trim() : "";
  if (!partnerUrl) {
    throw new TravelpayoutsError("invalid_response", "Missing partner_url");
  }

  const generated = validateGeneratedAffiliateUrl(partnerUrl, { httpsOnly: true });
  if (!generated.ok) {
    throw new TravelpayoutsError(
      "invalid_affiliate_url",
      "Generated affiliate URL failed validation",
    );
  }

  return {
    affiliateUrl: generated.url.toString(),
    subId: input.subId,
    hostname: safeHostnameFromUrl(input.targetUrl) ?? sourceCheck.hostname,
  };
}

async function fetchWithTimeout(
  fetchImpl: typeof fetch,
  url: string,
  init: RequestInit,
  timeoutMs: number,
): Promise<Response> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetchImpl(url, { ...init, signal: controller.signal });
  } catch (error) {
    if (isAbortError(error)) {
      throw new TravelpayoutsError("timeout", "Partner Links request timed out");
    }
    throw error;
  } finally {
    clearTimeout(timer);
  }
}

function isAbortError(error: unknown): boolean {
  return (
    (error instanceof Error && error.name === "AbortError") ||
    (typeof error === "object" &&
      error !== null &&
      "name" in error &&
      (error as { name: string }).name === "AbortError")
  );
}

function parseRetryAfter(header: string | null): number | null {
  if (!header) return null;
  const asInt = Number(header);
  if (Number.isFinite(asInt) && asInt >= 0) return Math.floor(asInt);
  const dateMs = Date.parse(header);
  if (!Number.isFinite(dateMs)) return null;
  const seconds = Math.ceil((dateMs - Date.now()) / 1000);
  return seconds > 0 ? seconds : 0;
}
