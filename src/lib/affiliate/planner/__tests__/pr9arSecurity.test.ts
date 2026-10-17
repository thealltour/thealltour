import { describe, expect, it } from "vitest";
import { sanitizeAffiliateTravelGoodsMetadata } from "@/lib/affiliate/planner/offerMetadata";
import { sanitizeTossProductImageUrl } from "@/lib/affiliate/planner/providers/tossShopping/tossShoppingImage";
import { validateTossSharelinkUrl } from "@/lib/affiliate/planner/providers/tossShopping/tossShoppingClient";
import { readFileSync } from "node:fs";
import { join } from "node:path";

describe("PR-9AR security surface", () => {
  it("rejects unexpected Sharelink hosts and credentials URLs", () => {
    expect(validateTossSharelinkUrl("https://toss.shopping/t/1")).toBeTruthy();
    expect(validateTossSharelinkUrl("https://evil.com/x")).toBeNull();
    expect(validateTossSharelinkUrl("https://user:pass@toss.shopping/t/1")).toBeNull();
  });

  it("image allowlist is exact shopping.toss.im", () => {
    expect(sanitizeTossProductImageUrl("https://shopping.toss.im/a.jpg")).toBeTruthy();
    expect(sanitizeTossProductImageUrl("https://cdn.toss.im/a.jpg")).toBeNull();
    expect(sanitizeTossProductImageUrl("http://shopping.toss.im/a.jpg")).toBeNull();
  });

  it("travelGoods metadata drops invalid images and never carries prices", () => {
    expect(
      sanitizeAffiliateTravelGoodsMetadata({
        intent: "power_bank",
        imageUrl: "https://evil.com/x.jpg",
      }),
    ).toEqual({ intent: "power_bank" });
  });

  it("client components do not embed Toss credential env names as NEXT_PUBLIC", () => {
    const card = readFileSync(
      join(process.cwd(), "src/components/planner/AffiliateOfferCard.tsx"),
      "utf8",
    );
    const surface = readFileSync(
      join(process.cwd(), "src/components/planner/PlannerBookingSurface.tsx"),
      "utf8",
    );
    for (const src of [card, surface]) {
      expect(src).not.toMatch(/TOSS_SHARELINK_(ACCESS|SECRET)_KEY/);
      expect(src).not.toMatch(/NEXT_PUBLIC_TOSS/);
      expect(src).not.toMatch(/Bearer /);
    }
  });
});
