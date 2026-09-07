import { describe, expect, it } from "vitest";
import {
  buildResearchBriefCanonicalText,
  buildResearchBriefContentHash,
} from "@/lib/marketing/semantic/entityEmbeddings/canonicalText";
import { MARKETING_SEMANTIC_SOURCE_TEXT_VERSION } from "@/lib/marketing/semantic/entityEmbeddings/types";

describe("research brief canonical text v2 editorial semantics", () => {
  it("includes editorial/trend semantics and excludes opaque noise", () => {
    const text = buildResearchBriefCanonicalText({
      title: "부산 크루즈",
      summary: "가족 항해",
      destinations: ["부산"],
      topics: ["activity_trend"],
      claims: ["[unverified] fare drop"],
      trendType: "activity_trend",
      contentAngles: ["짧은 가족 해상 휴가"],
      hookSignals: ["아이와 함께"],
      audiencePainPoints: ["장거리 항공 부담"],
    });
    expect(text).toContain("trendType:activity_trend");
    expect(text).toContain("angles:");
    expect(text).toContain("hooks:");
    expect(text).not.toContain("raw_context");
    expect(text).not.toContain("observation_id");
    expect(text).not.toContain("0.88");

    const hash = buildResearchBriefContentHash({
      title: "부산 크루즈",
      summary: "가족 항해",
    });
    expect(hash.sourceTextVersion).toBe(MARKETING_SEMANTIC_SOURCE_TEXT_VERSION);
    expect(MARKETING_SEMANTIC_SOURCE_TEXT_VERSION).toBe("v2");
  });
});
