import { describe, expect, it, vi } from "vitest";
import { createTravelpayoutsCommerceTarget } from "@/lib/affiliate/travelpayouts/commerceService";
import type { TravelpayoutsPartnerLinkResult } from "@/lib/affiliate/travelpayouts/types";

describe("Travelpayouts commerceService", () => {
  it("creates SubID and passes same value to Partner Links", async () => {
    const createSubId = vi.fn(() => "tp_bbbbbbbbbbbbbbbbbbbbbbbb");
    const createPartnerLink = vi.fn(
      async (input: { subId: string; targetUrl: string }): Promise<TravelpayoutsPartnerLinkResult> => ({
        affiliateUrl: "https://tp.media/r?x=1",
        subId: input.subId,
        hostname: "www.klook.com",
      }),
    );

    const result = await createTravelpayoutsCommerceTarget({
      sourceUrl: "https://www.klook.com/activity/1",
      providerId: "klook",
      trackingToken: "550e8400-e29b-41d4-a716-446655440000",
      campaignId: "camp-1",
      createSubId,
      createPartnerLink: createPartnerLink as never,
    });

    expect(createSubId).toHaveBeenCalledOnce();
    expect(createPartnerLink).toHaveBeenCalledWith(
      expect.objectContaining({
        subId: "tp_bbbbbbbbbbbbbbbbbbbbbbbb",
        targetUrl: "https://www.klook.com/activity/1",
      }),
    );
    expect(result).toEqual({
      affiliateUrl: "https://tp.media/r?x=1",
      providerSubId: "tp_bbbbbbbbbbbbbbbbbbbbbbbb",
      affiliateNetwork: "travelpayouts",
      campaignId: "camp-1",
      sourceUrlHost: "www.klook.com",
    });
    // tracking token must not become SubID
    expect(result.providerSubId).not.toContain("550e8400");
  });

  it("does not call Partner Links when source URL invalid", async () => {
    const createPartnerLink = vi.fn();
    await expect(
      createTravelpayoutsCommerceTarget({
        sourceUrl: "https://localhost/x",
        providerId: "klook",
        createPartnerLink: createPartnerLink as never,
      }),
    ).rejects.toMatchObject({ code: "invalid_source_url" });
    expect(createPartnerLink).not.toHaveBeenCalled();
  });

  it("propagates typed Partner Links failures", async () => {
    const { TravelpayoutsError } = await import("@/lib/affiliate/travelpayouts/errors");
    await expect(
      createTravelpayoutsCommerceTarget({
        sourceUrl: "https://www.klook.com/a",
        providerId: "klook",
        createSubId: () => "tp_cccccccccccccccccccccccc",
        createPartnerLink: async () => {
          throw new TravelpayoutsError("rate_limited", "too many");
        },
      }),
    ).rejects.toMatchObject({ code: "rate_limited" });
  });
});
