vi.mock("server-only", () => ({}));

import { describe, expect, it } from "vitest";

import {
  createSelectedAgenda,
  DEFAULT_INFORMATIONAL_TRAVEL_AUDIENCE,
} from "@/lib/marketing/content/createSelectedAgenda";
import { prepareManagerToContentHandoff } from "@/lib/marketing/content/prepareManagerToContentHandoff";

const NOW = new Date("2026-09-04T00:00:00.000Z");

describe("default informational audience fallback", () => {
  it("preserves explicit audienceHint", () => {
    const agenda = createSelectedAgenda({
      title: "Japan autumn",
      summary: "Official update.",
      audienceHint: "Families planning autumn school trips",
      now: NOW,
    });
    expect(agenda.audienceHint).toBe("Families planning autumn school trips");
  });

  it("fills deterministic Korean traveler fallback when informational and missing", () => {
    const agenda = createSelectedAgenda({
      title: "Japan autumn",
      summary: "Official update.",
      commercialIntent: "informational",
      now: NOW,
    });
    expect(agenda.audienceHint).toBe(DEFAULT_INFORMATIONAL_TRAVEL_AUDIENCE);
  });

  it("fallback reaches ContentAssignment and content plan scaffold", () => {
    const handoff = prepareManagerToContentHandoff(
      {
        title: "Scotland golf season",
        summary: "Destination note for travelers.",
        commercialIntent: "informational",
        now: NOW,
      },
      { now: NOW },
    );
    expect(handoff.selectedAgenda.audienceHint).toBe(DEFAULT_INFORMATIONAL_TRAVEL_AUDIENCE);
    expect(handoff.contentAssignment.audience).toBe(DEFAULT_INFORMATIONAL_TRAVEL_AUDIENCE);
    expect(handoff.contentPlanScaffold.targetAudience).toBe(DEFAULT_INFORMATIONAL_TRAVEL_AUDIENCE);
  });

  it("does not invent audience for commercial content without hint", () => {
    const agenda = createSelectedAgenda({
      title: "Promo",
      summary: "Product offer.",
      commercialIntent: "commercial",
      matchedProductIds: ["prod-1"],
      now: NOW,
    });
    expect(agenda.audienceHint).toBeNull();
  });
});
