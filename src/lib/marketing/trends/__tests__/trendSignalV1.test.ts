import { describe, expect, it } from "vitest";
import { normalizeTrendHumanPaste } from "../normalizeHumanPaste";
import { validateTrendSignalPayloadV1 } from "../validateTrendSignalV1";
import { NEGATIVE_TREND_FIXTURES } from "../fixtures/negativeFixtures";
import { POSITIVE_TREND_FIXTURES } from "../fixtures/positiveFixtures";

describe("TrendSignalPayload v1 validation", () => {
  it("accepts positive Meta fixtures", () => {
    for (const fixture of POSITIVE_TREND_FIXTURES) {
      const result = validateTrendSignalPayloadV1(fixture);
      expect(result.ok, fixture.observation_id).toBe(true);
    }
  });

  it.each(NEGATIVE_TREND_FIXTURES)(
    "rejects $id ($expectedCode)",
    ({ expectedCode, build }) => {
      const result = validateTrendSignalPayloadV1(build());
      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.issues.some((i) => i.code === expectedCode)).toBe(true);
      }
    },
  );
});

describe("normalizeTrendHumanPaste", () => {
  it("normalizes identical markdown URL to raw URI", () => {
    const raw = JSON.stringify({
      url: "[https://example.com/a](https://example.com/a)",
    });
    const result = normalizeTrendHumanPaste(raw);
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.text).toContain("https://example.com/a");
      expect(result.text).not.toContain("](");
      expect(result.normalizedCount).toBe(1);
    }
  });

  it("normalizes identical markdown URL inside JSON array paste", () => {
    const raw = JSON.stringify({
      provider: "meta_ai",
      items: [
        {
          url: "[https://example.com/a](https://example.com/a)",
        },
      ],
    });
    const result = normalizeTrendHumanPaste(raw);
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.normalizedCount).toBe(1);
      expect(result.text).toContain('"url":"https://example.com/a"');
      expect(result.text).not.toContain("](");
    }
  });

  it("rejects markdown when label != target", () => {
    const raw = `{"url":"[https://example.com/a](https://example.com/b)"}`;
    const result = normalizeTrendHumanPaste(raw);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.reason).toBe("markdown_label_target_mismatch");
    }
  });
});
