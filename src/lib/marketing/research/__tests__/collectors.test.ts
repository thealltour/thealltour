import { describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

import {
  UK_GOV_TRAVEL_SOURCE_ID,
  NYT_TRAVEL_SOURCE_ID,
} from "@/lib/marketing/research/collectors/config";
import { fetchResearchDocument, ResearchHttpError } from "@/lib/marketing/research/collectors/httpClient";
import { parseFeedFromXml } from "@/lib/marketing/research/collectors/feedParser";
import { mapRawResearchItemToSignalInput } from "@/lib/marketing/research/collectors/mapRawItemToSignalInput";
import { mapNytItemToRawResearchItem } from "@/lib/marketing/research/collectors/nytTravelRssCollector";
import { mapUkGovItemToRawResearchItem } from "@/lib/marketing/research/collectors/ukGovTravelAdviceCollector";
import {
  MALFORMED_XML,
  NYT_TRAVEL_RSS_SAMPLE,
  UK_GOV_ATOM_SAMPLE,
} from "@/lib/marketing/research/__tests__/feedFixtures";

const NOW = "2026-09-02T00:00:00.000Z";

describe("research collectors", () => {
  it("maps valid official UK gov item", async () => {
    const items = await parseFeedFromXml(UK_GOV_ATOM_SAMPLE, "https://example.gov/atom");
    const mapped = mapUkGovItemToRawResearchItem(items[0]!, {
      sourceId: UK_GOV_TRAVEL_SOURCE_ID,
      observedAt: NOW,
    });
    expect(mapped).not.toBeNull();
    expect(mapped!.title).toBe("Japan");
    expect(mapped!.evidence[0]!.evidenceType).toBe("official_statement");
    expect(mapped!.destinationHints).toContain("japan");

    const signal = mapRawResearchItemToSignalInput(mapped!, {
      sourceId: UK_GOV_TRAVEL_SOURCE_ID,
      sourceType: "official_government",
    });
    expect(signal).not.toBeNull();
    expect(signal!.claimSource).toBe("source");
  });

  it("maps valid NYT travel news item", async () => {
    const items = await parseFeedFromXml(NYT_TRAVEL_RSS_SAMPLE, "https://example.com/rss");
    const mapped = mapNytItemToRawResearchItem(items[0]!, {
      sourceId: NYT_TRAVEL_SOURCE_ID,
      observedAt: NOW,
    });
    expect(mapped).not.toBeNull();
    expect(mapped!.evidence[0]!.evidenceType).toBe("direct_source");
    expect(mapped!.summary).toContain("Spain");
  });

  it("rejects malformed feed item safely", async () => {
    await expect(parseFeedFromXml(MALFORMED_XML, "https://example.com/bad")).rejects.toThrow();
    const mapped = mapNytItemToRawResearchItem(
      {
        externalId: "x",
        title: "Short",
        link: "https://example.com",
        summary: "tiny",
        publishedAt: null,
      },
      { sourceId: NYT_TRAVEL_SOURCE_ID, observedAt: NOW },
    );
    expect(mapped).toBeNull();
  });

  it("classifies network failure", async () => {
    const fetchImpl = vi.fn(async () => {
      throw new TypeError("fetch failed");
    });
    await expect(
      fetchResearchDocument({
        url: "https://example.com/feed",
        fetchImpl,
        maxRetries: 0,
      }),
    ).rejects.toBeInstanceOf(ResearchHttpError);
  });

  it("fail-fast on 4xx", async () => {
    const fetchImpl = vi.fn(async () => ({
      ok: false,
      status: 404,
      headers: { get: () => null },
      body: null,
    })) as unknown as typeof fetch;

    await expect(
      fetchResearchDocument({
        url: "https://example.com/missing",
        fetchImpl,
        maxRetries: 0,
      }),
    ).rejects.toMatchObject({ code: "http_4xx", retryable: false });
  });

  it("retries retryable 503 then succeeds", async () => {
    let calls = 0;
    const fetchImpl = vi.fn(async () => {
      calls += 1;
      if (calls === 1) {
        return {
          ok: false,
          status: 503,
          headers: { get: () => null },
          body: null,
        };
      }
      const body = new TextEncoder().encode("ok");
      return {
        ok: true,
        status: 200,
        headers: { get: () => "text/plain" },
        body: {
          getReader: () => {
            let done = false;
            return {
              read: async () => {
                if (done) return { done: true, value: undefined };
                done = true;
                return { done: false, value: body };
              },
            };
          },
        },
      };
    }) as unknown as typeof fetch;

    const result = await fetchResearchDocument({
      url: "https://example.com/feed",
      fetchImpl,
      maxRetries: 2,
    });
    expect(result.body).toBe("ok");
    expect(calls).toBe(2);
  });
});
