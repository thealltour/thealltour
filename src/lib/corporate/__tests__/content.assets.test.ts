import { describe, expect, it } from "vitest";
import {
  CORPORATE_HUB,
  CORPORATE_PENDING_IMAGE_FILES,
  CORPORATE_SEGMENTS,
  getCorporateHubQuoteHref,
  getCorporateProgramQuoteHref,
  getCorporateSegmentQuoteHref,
} from "@/lib/corporate/content";

describe("corporate content assets", () => {
  it("keeps quote href params for hub, segment, and program", () => {
    expect(getCorporateHubQuoteHref()).toContain("source_path=%2Fcorporate");
    expect(getCorporateHubQuoteHref()).toContain("quote_category=corporate");
    expect(getCorporateSegmentQuoteHref("business")).toContain(
      "quote_category=corporate-business",
    );
    expect(getCorporateProgramQuoteHref("business", "corporate-golf")).toContain(
      "program=corporate-golf",
    );
  });

  it("exposes PDF downloads for hub and each segment", () => {
    expect(CORPORATE_HUB.download?.href).toBe(
      "/downloads/corporate/corporate-program-guide-4p.pdf",
    );
    expect(CORPORATE_HUB.download?.pages).toBe(4);
    for (const segment of CORPORATE_SEGMENTS) {
      expect(segment.download?.href).toMatch(/^\/downloads\/corporate\//);
      expect(segment.download?.pages).toBe(1);
      expect(segment.download?.bytes).toBeGreaterThan(0);
    }
  });

  it("lists pending scene photo paths when images are not wired", () => {
    expect(CORPORATE_HUB.image).toBeNull();
    for (const segment of CORPORATE_SEGMENTS) {
      expect(segment.image).toBeNull();
    }
    expect(CORPORATE_PENDING_IMAGE_FILES).toHaveLength(5);
  });
});
