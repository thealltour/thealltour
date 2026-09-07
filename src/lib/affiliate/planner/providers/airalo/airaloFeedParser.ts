import { XMLParser } from "fast-xml-parser";

import { deriveAiraloCountryCode } from "@/lib/affiliate/planner/providers/airalo/airaloCountry";
import type {
  AiraloOfferRecord,
  AiraloParseResult,
} from "@/lib/affiliate/planner/providers/airalo/airaloTypes";

type JsonObject = { [key: string]: unknown };

/**
 * Parse Travelpayouts Airalo NEW feed (RSS 2.0 + Google Merchant namespace).
 * Documented fields: g:id, g:title, g:link, g:description, g:image_link,
 * g:availability, g:price, g:sale_price, g:brand, g:mpn, g:is_bundle,
 * g:product_type (`esim > REGION > COUNTRY > DATA TYPE > VOLUME > DAYS`).
 * Country is derived from the product_type COUNTRY segment only — never a
 * fabricated countryCode attribute, never city→country inference.
 * g:link is a product source URL (NOT an affiliate URL).
 *
 * XXE: processEntities disabled; no DTD/external entity expansion.
 */
export function parseAiraloFeedXml(raw: string): AiraloParseResult {
  const trimmed = raw.trim();
  if (!trimmed) return { ok: false, errorCode: "empty_feed" };
  if (trimmed[0] !== "<") return { ok: false, errorCode: "unsupported_format" };

  let parsed: unknown;
  try {
    const parser = new XMLParser({
      ignoreAttributes: false,
      attributeNamePrefix: "@_",
      processEntities: false,
      ignoreDeclaration: true,
      trimValues: true,
      removeNSPrefix: true,
      isArray: (name) => name === "item" || name === "entry",
    });
    parsed = parser.parse(trimmed);
  } catch {
    return { ok: false, errorCode: "invalid_xml" };
  }

  const items = collectItems(parsed);
  if (items.length === 0) return { ok: false, errorCode: "empty_feed" };

  const records: AiraloOfferRecord[] = [];
  for (const item of items) {
    const record = normalizeItem(item);
    if (record) records.push(record);
  }

  if (records.length === 0) return { ok: false, errorCode: "empty_feed" };
  return { ok: true, records };
}

function asObject(value: unknown): JsonObject | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  return value as JsonObject;
}

function collectItems(root: unknown): JsonObject[] {
  const r = asObject(root);
  if (!r) return [];

  const candidates: unknown[] = [
    pathGet(r, ["rss", "channel", "item"]),
    pathGet(r, ["channel", "item"]),
    pathGet(r, ["feed", "entry"]),
    pathGet(r, ["entry"]),
    pathGet(r, ["item"]),
  ];

  for (const c of candidates) {
    if (Array.isArray(c)) {
      const rows: JsonObject[] = [];
      for (const x of c) {
        const obj = asObject(x);
        if (obj) rows.push(obj);
      }
      return rows;
    }
    const single = asObject(c);
    if (single) return [single];
  }
  return [];
}

function pathGet(obj: JsonObject, path: string[]): unknown {
  let cur: unknown = obj;
  for (const key of path) {
    const next = asObject(cur);
    if (!next) return undefined;
    cur = next[key];
  }
  return cur;
}

function normalizeItem(item: JsonObject): AiraloOfferRecord | null {
  const id = textField(item, ["id", "guid"]);
  const title = textField(item, ["title"]);
  const sourceUrl = textField(item, ["link"]);
  if (!id || !title || !sourceUrl) return null;

  let url: URL;
  try {
    url = new URL(sourceUrl);
  } catch {
    return null;
  }
  if (url.protocol !== "https:") return null;

  const productType = textField(item, ["product_type"]) || null;
  const countryCode = deriveAiraloCountryCode({ productType });
  // Skip malformed / regional-only product_type (no resolvable COUNTRY segment).
  if (!countryCode) return null;

  const priceParsed = parseMoney(textField(item, ["price"]));
  const saleParsed = parseMoney(textField(item, ["sale_price"]));

  return {
    id,
    title,
    // Pass-through product page URL for Travelpayouts Partner Links conversion.
    sourceUrl: url.toString(),
    countryCode,
    price: priceParsed?.amount ?? null,
    salePrice: saleParsed?.amount ?? null,
    currency: saleParsed?.currency ?? priceParsed?.currency ?? null,
    availability: textField(item, ["availability"]) || null,
    productType,
    description: textField(item, ["description"]) || null,
    imageUrl: textField(item, ["image_link"]) || null,
    brand: textField(item, ["brand"]) || null,
    isBundle: parseBool(textField(item, ["is_bundle"])),
    mpn: textField(item, ["mpn"]) || null,
  };
}

function textField(item: JsonObject, keys: string[]): string {
  for (const key of keys) {
    const text = coerceText(item[key]);
    if (text) return text;
  }
  return "";
}

function coerceText(raw: unknown): string {
  if (typeof raw === "boolean") return raw ? "true" : "false";
  if (typeof raw === "string") return decodeBasicXmlEntities(raw.trim());
  if (typeof raw === "number" && Number.isFinite(raw)) return String(raw);
  const obj = asObject(raw);
  if (obj) {
    if (typeof obj["#text"] === "string") {
      return decodeBasicXmlEntities(String(obj["#text"]).trim());
    }
    if (typeof obj._ === "string") {
      return decodeBasicXmlEntities(String(obj._).trim());
    }
  }
  return "";
}

/**
 * Decode common XML text entities without enabling full entity/DTD processing
 * (XXE-safe). Needed because processEntities is disabled and real feeds encode
 * product_type separators as `&gt;`.
 */
function decodeBasicXmlEntities(value: string): string {
  return value
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">")
    .replace(/&quot;/gi, '"')
    .replace(/&apos;/gi, "'")
    .replace(/&#39;/g, "'")
    .replace(/&amp;/gi, "&");
}

function parseMoney(
  raw: string | null | undefined,
): { amount: number; currency: string | null } | null {
  if (!raw) return null;
  const m = raw.trim().match(/^([0-9]+(?:\.[0-9]+)?)\s*([A-Za-z]{3})?$/);
  if (!m) return null;
  const amount = Number(m[1]);
  if (!Number.isFinite(amount)) return null;
  return { amount, currency: m[2]?.toUpperCase() ?? null };
}

function parseBool(raw: string | null | undefined): boolean | null {
  if (!raw) return null;
  const v = raw.trim().toLowerCase();
  if (v === "true" || v === "1" || v === "yes") return true;
  if (v === "false" || v === "0" || v === "no") return false;
  return null;
}
