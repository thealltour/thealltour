import { describe, expect, it } from "vitest";
import fs from "node:fs";
import path from "node:path";
import {
  AIRLINE_LOGO_BY_CODE,
  IMPORTED_AIRLINE_LOGOS_MANIFEST,
} from "@/lib/airlines/airlineLogos";
import { resolveAirlineLogoUrls } from "@/lib/airlines/resolveAirlineLogoUrls";

const AIRLINES_DIR = path.join(process.cwd(), "public/assets/airlines");

describe("airline logo static assets", () => {
  it("every manifest entry has a matching PNG in public/assets/airlines", () => {
    const missing: string[] = [];
    for (const [code, entry] of Object.entries(IMPORTED_AIRLINE_LOGOS_MANIFEST)) {
      const filePath = path.join(AIRLINES_DIR, `${code}.png`);
      if (!fs.existsSync(filePath)) {
        missing.push(`${code} ← ${entry.source}`);
      }
    }
    expect(missing, `Missing PNG files: ${missing.join(", ")}`).toEqual([]);
  });

  it("AIRLINE_LOGO_BY_CODE matches manifest PNG paths", () => {
    expect(AIRLINE_LOGO_BY_CODE["7C"]).toBe("/assets/airlines/7C.png");
    expect(AIRLINE_LOGO_BY_CODE["KE"]).toBe("/assets/airlines/KE.png");
  });

  it("resolveAirlineLogoUrls prefers self-hosted PNG before data URI", () => {
    const urls = resolveAirlineLogoUrls("7C3211");
    expect(urls[0]).toBe("/assets/airlines/7C.png");
    expect(urls.at(-1)?.startsWith("data:image/svg+xml,")).toBe(true);
  });

  it("resolveAirlineLogoUrls includes self-hosted PNG for HU450 when imported", () => {
    const urls = resolveAirlineLogoUrls("HU450");
    if (IMPORTED_AIRLINE_LOGOS_MANIFEST["HU"]) {
      expect(urls[0]).toBe("/assets/airlines/HU.png");
    } else {
      expect(urls[0]?.startsWith("data:image/svg+xml,")).toBe(true);
    }
  });
});
