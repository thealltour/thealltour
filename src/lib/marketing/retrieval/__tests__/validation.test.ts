import { describe, expect, it } from "vitest";
import { ContextValidationError } from "@/lib/marketing/context/errors";
import {
  clampRetrievalLimit,
  parseMarketingRetrievalRequest,
  resolveRetrievalPeriod,
} from "@/lib/marketing/retrieval/validation";
import { DEFAULT_RETRIEVAL_LIMIT, MAX_RETRIEVAL_LIMIT } from "@/lib/marketing/retrieval/constants";

describe("retrieval filters and limits", () => {
  it("defaults limit to 100 and clamps 1000 to 100", () => {
    expect(clampRetrievalLimit()).toBe(DEFAULT_RETRIEVAL_LIMIT);
    expect(clampRetrievalLimit(1000)).toBe(MAX_RETRIEVAL_LIMIT);
    expect(parseMarketingRetrievalRequest({ purpose: "create_content", limit: 1000 }).limit).toBe(100);
  });

  it("prefers startAt/endAt over lookbackDays", () => {
    const period = resolveRetrievalPeriod({
      lookbackDays: 30,
      startAt: "2026-08-01T00:00:00.000Z",
      endAt: "2026-08-10T00:00:00.000Z",
    });
    expect(period).toEqual({
      start: "2026-08-01T00:00:00.000Z",
      end: "2026-08-10T00:00:00.000Z",
    });
  });

  it("uses lookbackDays from now when dates are omitted", () => {
    const period = resolveRetrievalPeriod({
      lookbackDays: 2,
      now: new Date("2026-08-24T00:00:00.000Z"),
    });
    expect(period?.end).toBe("2026-08-24T00:00:00.000Z");
    expect(period?.start).toBe("2026-08-22T00:00:00.000Z");
  });

  it("does not invent a period when none is provided", () => {
    expect(resolveRetrievalPeriod({})).toBeNull();
  });

  it("keeps productId, channel, and date range on the parsed request", () => {
    const parsed = parseMarketingRetrievalRequest({
      purpose: "analyze_performance",
      productId: "11111111-1111-4111-8111-111111111111",
      channel: "threads",
      startAt: "2026-08-01T00:00:00.000Z",
      endAt: "2026-08-20T00:00:00.000Z",
      limit: 5,
    });
    expect(parsed.productId).toBe("11111111-1111-4111-8111-111111111111");
    expect(parsed.channel).toBe("threads");
    expect(parsed.period).toEqual({
      start: "2026-08-01T00:00:00.000Z",
      end: "2026-08-20T00:00:00.000Z",
    });
    expect(parsed.limit).toBe(5);
  });

  it("rejects a non-uuid productId", () => {
    expect(() =>
      parseMarketingRetrievalRequest({ purpose: "create_content", productId: "not-a-uuid" }),
    ).toThrow(ContextValidationError);
  });
});
