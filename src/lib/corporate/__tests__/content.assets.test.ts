import { existsSync, statSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import {
  CORPORATE_HUB,
  CORPORATE_IMAGE_FILES,
  CORPORATE_SEGMENTS,
  getCorporateHubQuoteHref,
  getCorporateProgramQuoteHref,
  getCorporateSegmentQuoteHref,
} from "@/lib/corporate/content";

const repoRoot = process.cwd();

function assertPublicFile(href: string, minBytes = 1) {
  const relative = href.replace(/^\//, "");
  const absolute = join(repoRoot, "public", relative);
  expect(existsSync(absolute), `missing ${relative}`).toBe(true);
  expect(statSync(absolute).size).toBeGreaterThanOrEqual(minBytes);
}

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

  it("exposes PDF downloads for hub and each segment with real files", () => {
    expect(CORPORATE_HUB.download?.href).toBe(
      "/downloads/corporate/corporate-program-guide-4p.pdf",
    );
    expect(CORPORATE_HUB.download?.pages).toBe(4);
    assertPublicFile(CORPORATE_HUB.download!.href, CORPORATE_HUB.download!.bytes);

    for (const segment of CORPORATE_SEGMENTS) {
      expect(segment.download?.href).toMatch(/^\/downloads\/corporate\//);
      expect(segment.download?.pages).toBe(1);
      expect(segment.download?.bytes).toBeGreaterThan(0);
      assertPublicFile(segment.download!.href, segment.download!.bytes);
    }
  });

  it("wires scene photos for hub and segments with real files on disk", () => {
    expect(CORPORATE_IMAGE_FILES).toHaveLength(5);
    for (const relative of CORPORATE_IMAGE_FILES) {
      const absolute = join(repoRoot, relative);
      expect(existsSync(absolute), `missing ${relative}`).toBe(true);
      expect(statSync(absolute).size).toBeGreaterThan(50_000);
    }

    expect(CORPORATE_HUB.image).not.toBeNull();
    expect(CORPORATE_HUB.image?.src).toBe("/images/corporate/hub-hotel-briefing.jpg");
    expect(CORPORATE_HUB.image?.showExampleCaption).toBe(true);
    assertPublicFile(CORPORATE_HUB.image!.src, 50_000);

    const expectedSrc = {
      business: "/images/corporate/business-reward-dinner.jpg",
      "public-enterprises": "/images/corporate/public-enterprises-facility.jpg",
      "public-institutions": "/images/corporate/public-institutions-field.jpg",
      councils: "/images/corporate/councils-briefing.jpg",
    } as const;

    for (const segment of CORPORATE_SEGMENTS) {
      expect(segment.image).not.toBeNull();
      expect(segment.image?.src).toBe(expectedSrc[segment.id]);
      expect(segment.image?.showExampleCaption).toBe(true);
      expect(segment.image?.mobileObjectPosition).toMatch(/^object-\[/);
      assertPublicFile(segment.image!.src, 50_000);
    }
  });
});
