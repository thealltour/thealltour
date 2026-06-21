import { describe, expect, it } from "vitest";
import { buildAirlinePlaceholderDataUri } from "@/lib/airlines/airlinePlaceholderDataUri";

describe("buildAirlinePlaceholderDataUri", () => {
  it("returns encoded SVG data URI for IATA code", () => {
    const uri = buildAirlinePlaceholderDataUri("7C");
    expect(uri.startsWith("data:image/svg+xml,")).toBe(true);
    expect(decodeURIComponent(uri.replace("data:image/svg+xml,", ""))).toContain("7C");
  });
});
