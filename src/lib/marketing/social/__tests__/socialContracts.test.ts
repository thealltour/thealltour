import { describe, expect, it } from "vitest";

import {
  CHANNEL_PROVIDER,
  PUBLICATION_FLOW_INACTIVE,
  SNS_SIDE_EFFECTS_STEP_3_2,
  SOCIAL_CHANNELS,
  assertCanInvokePublicationAdapter,
  getAutomationClassification,
  getSocialCapability,
  isAccountMetricsSupported,
  isCapabilityActionable,
  isFullySupported,
  isPublicationMetricsSupported,
  isPublicationSupported,
  isSocialChannel,
  isSocialProvider,
  listChannelsByAutomation,
  listSocialCapabilities,
  providerForChannel,
} from "@/lib/marketing/social";

describe("capability registry STEP 3-2", () => {
  it("covers every known channel exactly once with matching provider", () => {
    const caps = listSocialCapabilities();
    expect(caps.map((c) => c.channel).sort()).toEqual([...SOCIAL_CHANNELS].sort());
    for (const cap of caps) {
      expect(cap.provider).toBe(CHANNEL_PROVIDER[cap.channel]);
      expect(cap.officialApiPreferred).toBe(true);
      expect(cap.browserAutomationAllowed).toBe(false);
      expect(cap.officialSources.length).toBeGreaterThan(0);
    }
  });

  it("never collapses conditional/unknown into boolean supported helpers", () => {
    for (const channel of SOCIAL_CHANNELS) {
      const cap = getSocialCapability(channel)!;
      expect(isPublicationSupported(channel)).toBe(isFullySupported(cap.publication));
      expect(isAccountMetricsSupported(channel)).toBe(isFullySupported(cap.accountMetrics));
      expect(isPublicationMetricsSupported(channel)).toBe(isFullySupported(cap.publicationMetrics));
      // STEP 3-2 survey: no channel is unconditionally supported yet
      expect(isPublicationSupported(channel)).toBe(false);
      expect(isAccountMetricsSupported(channel)).toBe(false);
      expect(isPublicationMetricsSupported(channel)).toBe(false);
    }
    expect(isCapabilityActionable("conditional")).toBe(true);
    expect(isCapabilityActionable("unknown")).toBe(false);
    expect(isCapabilityActionable("unsupported")).toBe(false);
  });

  it("classifies automation paths from official research", () => {
    expect(listChannelsByAutomation("API_AUTOMATION").sort()).toEqual(
      ["facebook", "instagram", "threads"].sort(),
    );
    expect(listChannelsByAutomation("PARTIAL_API").sort()).toEqual(
      ["naver_band", "naver_blog", "tiktok", "youtube"].sort(),
    );
    expect(listChannelsByAutomation("HUMAN_PUBLISH")).toEqual(["kakao_channel"]);
    expect(getAutomationClassification("threads")).toBe("API_AUTOMATION");
    expect(getSocialCapability("instagram")?.publication).toBe("conditional");
    expect(getSocialCapability("kakao_channel")?.publication).toBe("unsupported");
    expect(getSocialCapability("naver_blog")?.accountMetrics).toBe("unsupported");
    expect(getSocialCapability("tiktok")?.accountMetrics).toBe("unknown");
  });

  it("keeps provider/channel distinct and publication inactive", () => {
    expect(isSocialProvider("meta")).toBe(true);
    expect(isSocialChannel("meta")).toBe(false);
    expect(providerForChannel("youtube")).toBe("google");
    expect(PUBLICATION_FLOW_INACTIVE).toBe(true);
    expect(SNS_SIDE_EFFECTS_STEP_3_2).toBe(0);
    expect(() => assertCanInvokePublicationAdapter("publication_orchestrator")).toThrow(/denied/);
    expect(() => assertCanInvokePublicationAdapter("marketing_manager")).toThrow(/denied/);
  });
});

describe("contract surfaces (no network)", () => {
  it("unsupported adapters never claim side effects", async () => {
    const { createUnsupportedPublicationAdapter, createUnsupportedPerformanceCollector, assertPublicationAdapterSurface, assertPerformanceCollectorSurface } =
      await import("@/lib/marketing/social");
    const pub = createUnsupportedPublicationAdapter("threads");
    assertPublicationAdapterSurface(pub);
    const published = await pub.publish({
      provider: "meta",
      channel: "threads",
      marketingPost: { body: "x", channel: "threads" },
    });
    expect(published.sideEffectPerformed).toBe(false);
    expect(published.status).toBe("unsupported");

    const collector = createUnsupportedPerformanceCollector("instagram");
    assertPerformanceCollectorSurface(collector);
    const perf = await collector.collectAccountPerformance({
      period: { start: "2026-08-24T00:00:00+09:00", end: "2026-08-24T23:59:59+09:00" },
    });
    expect(perf.dataAvailability).toBe("unavailable");
  });
});
