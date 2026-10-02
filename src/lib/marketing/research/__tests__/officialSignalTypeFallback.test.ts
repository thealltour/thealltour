import { describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

import { createConfiguredRssCollector } from "@/lib/marketing/research/collectors/configuredRssCollector";
import {
  inferNewsSignalType,
  inferNewsSignalTypeDetailed,
  inferOfficialSignalType,
  inferOfficialSignalTypeDetailed,
} from "@/lib/marketing/research/collectors/mappers/helpers";
import { mapRawResearchItemToSignalInput } from "@/lib/marketing/research/collectors/mapRawItemToSignalInput";
import { mapNytItemToRawResearchItem } from "@/lib/marketing/research/collectors/nytTravelRssCollector";
import type { RawResearchItem } from "@/lib/marketing/research/collectors/types";
import {
  NYT_TRAVEL_SOURCE,
  TRAVELTIMES_SOURCE,
  UK_GOV_TRAVEL_SOURCE,
  VIETNAM_TRAVEL_SOURCE,
} from "@/lib/marketing/research/sources/sourceRegistry";
import { mapUkGovItemToRawResearchItem } from "@/lib/marketing/research/collectors/ukGovTravelAdviceCollector";
import type { ResearchSignalType, ResearchSourceType } from "@/lib/marketing/research/types/enums";

const NOW = new Date("2026-10-01T00:00:00.000Z");
const VN_SOURCE_ID = "a3066666-6666-4666-8666-666666666666";

const TOURISM_EDITORIAL = [
  {
    title: "A celestial journey through Vietnam",
    summary: "Stargazing nights in the northern highlands and quiet mountain homestays.",
  },
  {
    title: "Ancient craft villages",
    summary: "Pottery, silk and lacquer artisans keep centuries-old traditions alive near Hanoi.",
  },
  {
    title: "Hanoi's flavours of autumn",
    summary: "Green rice, egg coffee and street snacks define the season in the capital.",
  },
];

function rssXml(items: Array<{ title: string; summary: string }>): string {
  const body = items
    .map(
      (item, index) => `
    <item>
      <title>${item.title}</title>
      <link>https://example.org/article-${index}</link>
      <guid>https://example.org/article-${index}</guid>
      <pubDate>Tue, 29 Sep 2026 10:00:00 GMT</pubDate>
      <description>${item.summary}</description>
    </item>`,
    )
    .join("");
  return `<?xml version="1.0" encoding="UTF-8"?><rss version="2.0"><channel><title>Feed</title>${body}</channel></rss>`;
}

function fetchReturning(xml: string): typeof fetch {
  const bytes = new TextEncoder().encode(xml);
  return vi.fn(async () => ({
    ok: true,
    status: 200,
    headers: { get: () => "application/rss+xml" },
    body: {
      getReader: () => {
        let done = false;
        return {
          read: async () => {
            if (done) return { done: true, value: undefined };
            done = true;
            return { done: false, value: bytes };
          },
        };
      },
    },
  })) as unknown as typeof fetch;
}

async function collectWith(
  sourceType: ResearchSourceType,
  defaultSignalType: ResearchSignalType,
  items: Array<{ title: string; summary: string }>,
): Promise<RawResearchItem[]> {
  const collector = createConfiguredRssCollector(
    {
      collectorId: `test-${sourceType}`,
      sourceId: VN_SOURCE_ID,
      feedUrl: "https://example.org/rss",
      sourceType,
      isOfficial: sourceType === "official_government" || sourceType === "tourism_board",
      language: "en",
      destinationHints: ["vietnam"],
      defaultSignalType,
    },
    { fetchImpl: fetchReturning(rssXml(items)) },
  );
  return collector.collect({ now: NOW, sourceId: VN_SOURCE_ID, sourceType });
}

describe("official signal type terminal fallback from registry semantics", () => {
  const tourism = VIETNAM_TRAVEL_SOURCE.semantics.classification.defaultSignalType;
  const government = UK_GOV_TRAVEL_SOURCE.semantics.classification.defaultSignalType;
  const koreanTrade = TRAVELTIMES_SOURCE.semantics.classification.defaultSignalType;

  it("tourism_board without keywords falls back to destination_trend", () => {
    expect(tourism).toBe("destination_trend");
    for (const item of TOURISM_EDITORIAL) {
      expect(inferOfficialSignalType(item.title, item.summary, tourism)).toBe("destination_trend");
      expect(inferOfficialSignalTypeDetailed(item.title, item.summary, tourism)).toEqual({
        signalType: "destination_trend",
        keywordMatched: false,
      });
    }
  });

  it.each([
    ["Vietnam extends e-visa validity", "Visitors can now stay longer.", "entry_requirement"],
    ["Travel warning for central provinces", "Authorities ask visitors to check updates.", "safety"],
    ["New tourism regulation in Ha Long Bay", "Cruise operators must follow new rules.", "policy_change"],
    ["New flight connects Da Nang and Busan", "Service begins next month.", "flight_route"],
  ] as const)("tourism_board keyword wins over fallback: %s", (title, summary, expected) => {
    expect(inferOfficialSignalTypeDetailed(title, summary, tourism)).toEqual({
      signalType: expected,
      keywordMatched: true,
    });
  });

  it("official_government without keywords keeps entry_requirement", () => {
    expect(government).toBe("entry_requirement");
    expect(inferOfficialSignalTypeDetailed("Italy", "Updated travel advice summary.", government)).toEqual({
      signalType: "entry_requirement",
      keywordMatched: false,
    });
  });

  it("official_government safety keyword resolves to safety", () => {
    expect(inferOfficialSignalType("Kenya", "Terrorists are very likely to try to carry out attacks.", government)).toBe(
      "safety",
    );
  });

  it("official_government entry keyword resolves to entry_requirement via keyword", () => {
    expect(inferOfficialSignalTypeDetailed("Japan", "Updated passport validity guidance.", government)).toEqual({
      signalType: "entry_requirement",
      keywordMatched: true,
    });
  });

  it("the fallback argument is the only source of the no-keyword result", () => {
    for (const item of TOURISM_EDITORIAL) {
      expect(inferOfficialSignalType(item.title, item.summary, government)).toBe("entry_requirement");
      expect(inferOfficialSignalType(item.title, item.summary, "safety")).toBe("safety");
    }
  });

  it("UK FCDO mapper keeps entry_requirement fallback", () => {
    const mapped = mapUkGovItemToRawResearchItem(
      {
        externalId: "https://www.gov.uk/foreign-travel-advice/italy#2026-09-30",
        title: "Italy",
        link: "https://www.gov.uk/foreign-travel-advice/italy",
        summary: "Latest update: information on public holidays and local events.",
        publishedAt: "2026-09-30T10:00:00.000Z",
      },
      { sourceId: UK_GOV_TRAVEL_SOURCE.id, observedAt: NOW.toISOString() },
    );
    expect(mapped?.metadata?.signalTypeHint).toBe("entry_requirement");
    expect(mapped?.metadata).not.toHaveProperty("signalTypeFallbackApplied");
  });

  it("NYT/news inference is unchanged", () => {
    const mapped = mapNytItemToRawResearchItem(
      {
        externalId: "nyt-1",
        title: "Ancient craft villages",
        link: "https://www.nytimes.com/2026/09/29/travel/craft.html",
        summary: TOURISM_EDITORIAL[1]!.summary,
        publishedAt: "2026-09-29T10:00:00.000Z",
      },
      { sourceId: NYT_TRAVEL_SOURCE.id, observedAt: NOW.toISOString() },
    );
    expect(mapped?.metadata?.signalTypeHint).toBe(NYT_TRAVEL_SOURCE.semantics.classification.defaultSignalType);
    expect(inferNewsSignalType("Vietnam e-visa update", "Longer stays allowed.", koreanTrade)).toBe("visa");
    expect(inferNewsSignalType("Best resort stays", "Beachfront picks.", koreanTrade)).toBe("hotel_resort");
  });

  it("a generic travel keyword resolves general_travel_news and never reaches the fallback", () => {
    expect(inferNewsSignalTypeDetailed("Weekend trip ideas", "Quiet escapes nearby.", "destination_trend")).toEqual({
      signalType: "general_travel_news",
      keywordMatched: true,
    });
    expect(inferNewsSignalTypeDetailed("가을 산책", "조용한 하루", "destination_trend")).toEqual({
      signalType: "destination_trend",
      keywordMatched: false,
    });
  });
});

describe("configured RSS collector signal type hint", () => {
  const tourism = VIETNAM_TRAVEL_SOURCE.semantics.classification.defaultSignalType;
  const government = UK_GOV_TRAVEL_SOURCE.semantics.classification.defaultSignalType;
  const koreanTrade = TRAVELTIMES_SOURCE.semantics.classification.defaultSignalType;

  it("travel_industry feeds keep news inference", async () => {
    const rows = await collectWith("travel_industry", koreanTrade, [
      TOURISM_EDITORIAL[0]!,
      { title: "Airfare sale to Hanoi", summary: "Round-trip fares drop this week." },
    ]);
    expect(rows.map((row) => row.metadata?.signalTypeHint)).toEqual(["general_travel_news", "airfare"]);
    for (const row of rows) {
      expect(row.metadata).not.toHaveProperty("signalTypeFallbackApplied");
    }
  });

  it("tourism_board feeds emit destination_trend for editorial and explicit types for keywords", async () => {
    const rows = await collectWith("tourism_board", tourism, [
      ...TOURISM_EDITORIAL,
      { title: "Vietnam extends e-visa validity", summary: "Visitors can now stay longer." },
      { title: "New flight connects Da Nang and Busan", summary: "Service begins next month." },
    ]);
    expect(rows.map((row) => [row.metadata?.signalTypeHint, row.metadata?.signalTypeFallbackApplied])).toEqual([
      ["destination_trend", true],
      ["destination_trend", true],
      ["destination_trend", true],
      ["entry_requirement", false],
      ["flight_route", false],
    ]);
  });

  it("official_government feeds keep the entry_requirement fallback", async () => {
    const rows = await collectWith("official_government", government, [
      { title: "Italy", summary: "Updated travel advice summary." },
      { title: "Kenya", summary: "Crime levels have risen in some areas." },
    ]);
    expect(rows.map((row) => [row.metadata?.signalTypeHint, row.metadata?.signalTypeFallbackApplied])).toEqual([
      ["entry_requirement", true],
      ["safety", false],
    ]);
  });

  it("mapRawResearchItemToSignalInput uses the hint as-is", async () => {
    const [row] = await collectWith("tourism_board", tourism, [TOURISM_EDITORIAL[2]!]);
    const signal = mapRawResearchItemToSignalInput(row!, {
      sourceId: VN_SOURCE_ID,
      sourceType: "tourism_board",
    });
    expect(signal?.signalType).toBe("destination_trend");
    expect(signal?.metadata?.signalTypeFallbackApplied).toBe(true);
  });
});
