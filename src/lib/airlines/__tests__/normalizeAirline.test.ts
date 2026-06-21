import { describe, expect, it } from "vitest";
import { normalizeAirline } from "@/lib/airlines/normalizeAirline";
import { resolveAirlineLogoUrls } from "@/lib/airlines/resolveAirlineLogoUrls";

describe("normalizeAirline", () => {
  it("extracts letter-only IATA from flight number", () => {
    expect(normalizeAirline("TW501")).toBe("TW");
    expect(normalizeAirline("HU450")).toBe("HU");
    expect(normalizeAirline("티웨이항공 TW501")).toBe("TW");
  });

  it("extracts digit-letter IATA from flight number (Jeju Air 7C)", () => {
    expect(normalizeAirline("7C3211")).toBe("7C");
    expect(normalizeAirline("항공 7C3211")).toBe("7C");
    expect(normalizeAirline("7C3212")).toBe("7C");
  });

  it("returns null for unknown flight numbers", () => {
    expect(normalizeAirline("XX9999")).toBeNull();
  });
});

describe("resolveAirlineLogoUrls with Jeju Air flight", () => {
  it("resolves 7C from 7C3211 with self-hosted and data-uri fallback", () => {
    const urls = resolveAirlineLogoUrls("7C3211");
    expect(urls.some((u) => u.includes("/7C.svg"))).toBe(true);
    expect(urls.some((u) => u.startsWith("data:image/svg+xml,") && u.includes("7C"))).toBe(true);
    expect(urls.some((u) => u.includes("kiwi.com"))).toBe(false);
  });
});
