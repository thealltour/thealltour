import { describe, expect, it } from "vitest";
import fs from "node:fs";
import path from "node:path";
import { AIRLINE_LOGO_BY_CODE } from "@/lib/airlines/airlineLogos";
import { resolveAirlineLogoUrls } from "@/lib/airlines/resolveAirlineLogoUrls";

const AIRLINES_DIR = path.join(process.cwd(), "public/assets/airlines");

describe("airline logo static assets", () => {
  it("every AIRLINE_LOGO_BY_CODE entry has a matching SVG file in public/assets/airlines", () => {
    const missing: string[] = [];
    for (const [code, url] of Object.entries(AIRLINE_LOGO_BY_CODE)) {
      const filename = url.replace("/assets/airlines/", "");
      const filePath = path.join(AIRLINES_DIR, filename);
      if (!fs.existsSync(filePath)) {
        missing.push(`${code} → ${filename}`);
      }
    }
    expect(missing, `Missing SVG files: ${missing.join(", ")}`).toEqual([]);
  });

  it("resolveAirlineLogoUrls prefers self-hosted path before data URI", () => {
    const urls = resolveAirlineLogoUrls("7C3211");
    expect(urls[0]).toBe("/assets/airlines/7C.svg");
    expect(urls.at(-1)?.startsWith("data:image/svg+xml,")).toBe(true);
  });

  it("resolveAirlineLogoUrls includes self-hosted path for HU450", () => {
    const urls = resolveAirlineLogoUrls("HU450");
    expect(urls[0]).toBe("/assets/airlines/HU.svg");
  });
});
