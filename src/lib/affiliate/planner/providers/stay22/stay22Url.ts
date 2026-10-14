/**
 * Stay22 Allez `/allez/roam` deep link builder (pure, no network).
 * Base URL is a code constant; caller input is only ever used as query parameter values.
 */

export const STAY22_HOST = "www.stay22.com";
export const STAY22_ROAM_PATH = "/allez/roam";
export const STAY22_ROAM_BASE_URL = `https://${STAY22_HOST}${STAY22_ROAM_PATH}`;

/** Low-cardinality Stay22 campaign for the global Planner hotel offer (aggregation only). */
export const STAY22_PLANNER_HOTEL_CAMPAIGN = "planner_hotel";

const MAX_AID_LENGTH = 100;
const MAX_ADDRESS_LENGTH = 120;
const MAX_TRAVELERS = 20;

export type Stay22RoamParams = {
  aid: string | null | undefined;
  address: string | null | undefined;
  checkin: string | null | undefined;
  checkout: string | null | undefined;
  adults: number;
  children: number;
  campaign: string;
};

export type Stay22UrlFailure =
  | "config_missing"
  | "invalid_address"
  | "invalid_dates"
  | "invalid_travelers"
  | "invalid_campaign"
  | "unsafe_url";

export type Stay22UrlResult = { ok: true; url: string } | { ok: false; reason: Stay22UrlFailure };

function isIsoDate(value: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const date = new Date(`${value}T00:00:00Z`);
  return !Number.isNaN(date.getTime()) && date.toISOString().slice(0, 10) === value;
}

function isTravelerCount(value: number, min: number): boolean {
  return Number.isInteger(value) && value >= min && value <= MAX_TRAVELERS;
}

/** Exact Stay22 roam origin/path, https, no credentials. */
export function isStay22RoamUrl(raw: string): boolean {
  let url: URL;
  try {
    url = new URL(raw);
  } catch {
    return false;
  }
  return (
    url.protocol === "https:" &&
    url.hostname === STAY22_HOST &&
    url.port === "" &&
    url.pathname === STAY22_ROAM_PATH &&
    url.username === "" &&
    url.password === "" &&
    url.hash === ""
  );
}

/**
 * Builds `https://www.stay22.com/allez/roam?aid&address&checkin&checkout&adults[&children]&campaign`.
 * `children` is omitted when 0. Infants / child ages are not sent (not in Planner data).
 */
export function buildStay22RoamUrl(params: Stay22RoamParams): Stay22UrlResult {
  const aid = params.aid?.trim() ?? "";
  if (!aid || aid.length > MAX_AID_LENGTH) return { ok: false, reason: "config_missing" };

  const address = params.address?.trim() ?? "";
  if (!address || address.length > MAX_ADDRESS_LENGTH) {
    return { ok: false, reason: "invalid_address" };
  }

  const checkin = params.checkin?.trim() ?? "";
  const checkout = params.checkout?.trim() ?? "";
  if (!isIsoDate(checkin) || !isIsoDate(checkout) || checkout <= checkin) {
    return { ok: false, reason: "invalid_dates" };
  }

  if (!isTravelerCount(params.adults, 1) || !isTravelerCount(params.children, 0)) {
    return { ok: false, reason: "invalid_travelers" };
  }

  if (!/^[a-z0-9_]{1,40}$/.test(params.campaign)) {
    return { ok: false, reason: "invalid_campaign" };
  }

  const url = new URL(STAY22_ROAM_BASE_URL);
  url.searchParams.set("aid", aid);
  url.searchParams.set("address", address);
  url.searchParams.set("checkin", checkin);
  url.searchParams.set("checkout", checkout);
  url.searchParams.set("adults", String(params.adults));
  if (params.children > 0) url.searchParams.set("children", String(params.children));
  url.searchParams.set("campaign", params.campaign);

  const built = url.toString();
  if (!isStay22RoamUrl(built)) return { ok: false, reason: "unsafe_url" };
  return { ok: true, url: built };
}
