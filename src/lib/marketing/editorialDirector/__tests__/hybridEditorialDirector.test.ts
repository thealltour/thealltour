import {
  buildEditorialDirectorClipboardText,
  buildAgendaSlateEditorialExportPayload,
} from "@/lib/marketing/editorialDirector/buildSlateExport";
import { EDITORIAL_DIRECTOR_INSTRUCTION_KO } from "@/lib/marketing/editorialDirector/editorialPrompt";
import { importExternalEditorialDirector } from "@/lib/marketing/editorialDirector/importExternalStories";
import { parseExternalEditorialDirectorPayload } from "@/lib/marketing/editorialDirector/parseExternalPayload";
import { PRODUCTION_REQUEST_STORY_POINT_METADATA_KEY } from "@/lib/marketing/storyPoint/contracts";
import { PRODUCTION_OUTCOME_AWAITING_STORY_SELECTION } from "@/lib/marketing/storyPoint/humanStorySelection";
import { PRODUCTION_REQUEST_EXTERNAL_STORY_PROVENANCE_KEY } from "@/lib/marketing/editorialDirector/contracts";
import { createInMemoryMarketingProductionRequestRepository } from "@/lib/marketing/cron/daily/repository/createMarketingProductionRequestRepository";
import { describe, expect, it } from "vitest";
import {
  makeSlate,
  slateItem,
  validExternalPayload,
} from "@/lib/marketing/editorialDirector/__tests__/editorialFixtures";
import { buildQueuedProductionRequest } from "@/lib/marketing/cron/daily/repository/createMarketingProductionRequestRepository";
import type { AgendaSlateEvidenceSummary } from "@/lib/marketing/cron/daily/agendaSlate/types";
import { AGENDA_SLATE_EXPORT_PAYLOAD_CONTRACT } from "@/lib/marketing/editorialDirector/contracts";

describe("HYBRID editorial director — slate export", () => {
  it("copies slate JSON only without Editorial Director instruction prompt", () => {
    const slate = makeSlate(6);
    const built = buildEditorialDirectorClipboardText(slate);
    expect(built.agendaCount).toBe(6);
    expect(built.text).not.toContain(EDITORIAL_DIRECTOR_INSTRUCTION_KO.slice(0, 40));
    expect(built.text).not.toContain("Senior Marketing Editorial Director");
    expect(built.text).not.toContain("STEP 1");
    const parsed = JSON.parse(built.text) as {
      contract: string;
      agendaCount: number;
      agendas: Array<{ agendaId: string }>;
    };
    expect(parsed.contract).toBeTruthy();
    expect(parsed.agendaCount).toBe(6);
    expect(parsed.agendas).toHaveLength(6);
    expect(parsed.agendas.every((a) => a.agendaId.startsWith("asc_"))).toBe(true);
    const payload = buildAgendaSlateEditorialExportPayload(slate);
    expect(payload.agendas[0]?.productType).toBeNull();
    expect(payload.agendas[0]?.commercialIntent).toBeNull();
  });
});

function evidence(
  id: string,
  url: string | null,
  excerpt: string | null,
): AgendaSlateEvidenceSummary {
  return {
    evidenceId: id,
    sourceId: "src_vn",
    sourceName: "Vietnam National Tourism RSS",
    sourceType: "tourism_board",
    isOfficial: true,
    url,
    excerpt,
  };
}

const STREET_FOOD_URL = "https://vietnam.travel/things-to-do/street-food-bible";
const STREET_FOOD_EXCERPT = "The street food bible: From Michelin stars to sidewalk stools…";

function slateWithRepeatedEvidence() {
  const slate = makeSlate(3);
  slate.candidates[0] = slateItem(1, {
    evidenceSummary: [
      evidence("ev_a", STREET_FOOD_URL, STREET_FOOD_EXCERPT),
      evidence("ev_b", STREET_FOOD_URL, STREET_FOOD_EXCERPT),
      evidence("ev_c", `${STREET_FOOD_URL}/?utm_source=rss#top`, STREET_FOOD_EXCERPT),
      evidence("ev_d", "https://vietnam.travel/things-to-do/pho-guide", "Pho guide"),
      evidence("ev_e", null, "Offline press note"),
      evidence("ev_f", null, "Offline press note"),
    ],
  });
  return slate;
}

describe("slate export — semantic noise reduction", () => {
  it("omits MM channel/format hints from the export only", () => {
    const slate = makeSlate(2);
    const payload = buildAgendaSlateEditorialExportPayload(slate);
    for (const agenda of payload.agendas) {
      expect(agenda).not.toHaveProperty("recommendedChannel");
      expect(agenda).not.toHaveProperty("recommendedFormats");
    }
    expect(payload.fieldAuthority).not.toHaveProperty("recommendedChannel");
    expect(payload.fieldAuthority).not.toHaveProperty("recommendedFormats");

    const request = buildQueuedProductionRequest({ slate, candidate: slate.candidates[0]! });
    expect(request.selection.recommendedChannel).toBe("threads");
    expect(request.selection.recommendedFormats).toEqual(["threads_text"]);
    expect(slate.candidates[0]!.recommendedChannel).toBe("threads");
  });

  it("declares field authority at the payload top level", () => {
    const payload = buildAgendaSlateEditorialExportPayload(makeSlate(2));
    expect(payload.fieldAuthority).toMatchObject({
      titleKo: "mixed",
      summaryKo: "mixed",
      topicIdentity: "heuristic",
      originDestination: "heuristic",
      sourceSignals: "source",
      sourceType: "source",
      canonicalArticleIds: "source",
      "sourceFreshness.freshnessScore": "scoring",
      "sourceFreshness.freshnessWhyNow": "mm_inference",
      researchability: "scoring",
      currentResearchScore: "scoring",
      researchSnapshot: "scoring",
      scoreReasons: "scoring",
      riskFlags: "scoring",
      koreanTravelerRelevance: "mm_inference",
      businessTheAllTourRelevance: "mm_inference",
      practicalTravelValue: "mm_inference",
      contentPotential: "mm_inference",
      mmRationale: "mm_inference",
    });
    const exportedKeys = new Set(Object.keys(payload.agendas[0]!));
    for (const key of Object.keys(payload.fieldAuthority)) {
      expect(exportedKeys.has(key.split(".")[0]!)).toBe(true);
    }
    for (const agenda of payload.agendas) {
      expect(agenda).not.toHaveProperty("fieldAuthority");
    }
  });

  it("tells the Story Miner that inference/scoring fields are not factual grounds", () => {
    const payload = buildAgendaSlateEditorialExportPayload(makeSlate(2));
    const note = payload.notesKo.find((n) => n.includes("fieldAuthority"));
    expect(note).toBeDefined();
    expect(note).toContain("mm_inference");
    expect(note).toContain("scoring");
    expect(note).toContain("사실 근거가 아니라");
    expect(payload.notesKo.some((n) => n.includes("null"))).toBe(true);
    expect(payload.notesKo.some((n) => n.includes("agendaId"))).toBe(true);
  });

  it("exports one sourceSignal per canonical article and keeps URL-less evidence", () => {
    const slate = slateWithRepeatedEvidence();
    const agenda = buildAgendaSlateEditorialExportPayload(slate).agendas[0]!;
    expect(agenda.sourceSignals.map((s) => s.evidenceId)).toEqual(["ev_a", "ev_d", "ev_e", "ev_f"]);
    expect(agenda.sourceType).toBe("tourism_board");
    expect(slate.candidates[0]!.evidenceSummary).toHaveLength(6);
  });

  it("dedupes existingEvidenceSnippets from the deduped signals", () => {
    const agenda = buildAgendaSlateEditorialExportPayload(slateWithRepeatedEvidence()).agendas[0]!;
    expect(agenda.existingEvidenceSnippets).toEqual([
      STREET_FOOD_EXCERPT,
      "Pho guide",
      "Offline press note",
    ]);
  });

  it("drops empty excerpts from existingEvidenceSnippets", () => {
    const slate = makeSlate(1);
    slate.candidates[0] = slateItem(1, {
      evidenceSummary: [
        evidence("ev_1", "https://a.example/1", null),
        evidence("ev_2", "https://a.example/2", "   "),
      ],
    });
    const agenda = buildAgendaSlateEditorialExportPayload(slate).agendas[0]!;
    expect(agenda.sourceSignals).toHaveLength(2);
    expect(agenda.existingEvidenceSnippets).toEqual([]);
  });

  it("keeps the same shape and selection semantics for subset and all", () => {
    const slate = slateWithRepeatedEvidence();
    const all = buildAgendaSlateEditorialExportPayload(slate);
    const subset = buildAgendaSlateEditorialExportPayload(slate, new Date(), {
      slateItemIds: [slate.candidates[0]!.slateItemId],
    });
    expect(all.contract).toBe(AGENDA_SLATE_EXPORT_PAYLOAD_CONTRACT);
    expect(all.contract).toBe("agenda-slate-editorial-export-v1");
    expect(all.selection).toBe("all");
    expect(all.agendaCount).toBe(3);
    expect(subset.selection).toBe("subset");
    expect(subset.agendaCount).toBe(1);
    expect(Object.keys(subset).sort()).toEqual(Object.keys(all).sort());
    expect(Object.keys(subset.agendas[0]!).sort()).toEqual(Object.keys(all.agendas[0]!).sort());
    expect(subset.fieldAuthority).toEqual(all.fieldAuthority);
    expect(subset.agendas[0]!.sourceSignals).toEqual(all.agendas[0]!.sourceSignals);
  });

  it("round-trips through the clipboard JSON", () => {
    const slate = slateWithRepeatedEvidence();
    const built = buildEditorialDirectorClipboardText(slate, new Date(), {
      slateItemIds: [slate.candidates[0]!.slateItemId],
    });
    const parsed = JSON.parse(built.text) as typeof built.payload;
    expect(parsed).toEqual(built.payload);
    expect(parsed.fieldAuthority.koreanTravelerRelevance).toBe("mm_inference");
    expect(parsed.agendas[0]!.sourceSignals).toHaveLength(4);
    expect(built.text).not.toContain("recommendedChannel");
    expect(built.text).not.toContain("recommendedFormats");
  });
});

describe("HYBRID editorial director — import/parse", () => {
  it("rejects malformed JSON and unknown agenda / bad channels / empty researchQs", () => {
    expect(parseExternalEditorialDirectorPayload("not-json").ok).toBe(false);
    const slate = makeSlate(2);
    const agendaId = slate.candidates[0]!.slateItemId;
    const badAgenda = validExternalPayload("asc_unknown_agenda_xxxxxxxxx");
    const parsedBadAgenda = parseExternalEditorialDirectorPayload(JSON.stringify(badAgenda));
    expect(parsedBadAgenda.ok).toBe(true);

    const missingQs = validExternalPayload(agendaId);
    missingQs.storyCandidates[0]!.researchQuestionsKo = [];
    expect(parseExternalEditorialDirectorPayload(JSON.stringify(missingQs)).ok).toBe(false);

    const badChannel = validExternalPayload(agendaId);
    (badChannel.storyCandidates[0] as { recommendedChannels: string[] }).recommendedChannels = [
      "not_a_real_channel",
    ];
    expect(parseExternalEditorialDirectorPayload(JSON.stringify(badChannel)).ok).toBe(false);
  });

  it("imports without overwriting and preserves provenance + awaiting state", async () => {
    const slate = makeSlate(3);
    const agendaId = slate.candidates[0]!.slateItemId;
    const repo = createInMemoryMarketingProductionRequestRepository();
    const parsed = parseExternalEditorialDirectorPayload(
      JSON.stringify(validExternalPayload(agendaId)),
    );
    expect(parsed.ok).toBe(true);
    if (!parsed.ok) return;

    const first = await importExternalEditorialDirector({
      slate,
      payload: parsed.payload,
      productionRequestRepo: repo,
    });
    expect(first.request.metadata.productionOutcome).toBe(
      PRODUCTION_OUTCOME_AWAITING_STORY_SELECTION,
    );
    expect(first.preview.storyCountAccepted).toBeGreaterThanOrEqual(1);
    const set1 = first.request.metadata[PRODUCTION_REQUEST_STORY_POINT_METADATA_KEY] as {
      candidates: Array<{ pointId: string }>;
    };
    const count1 = set1.candidates.length;

    const second = await importExternalEditorialDirector({
      slate,
      payload: parsed.payload,
      productionRequestRepo: repo,
    });
    expect(second.importRecord.skippedDuplicatePointIds.length).toBeGreaterThan(0);
    const set2 = second.request.metadata[PRODUCTION_REQUEST_STORY_POINT_METADATA_KEY] as {
      candidates: Array<{ pointId: string }>;
    };
    expect(set2.candidates.length).toBe(count1);

    const provenance = second.request.metadata[
      PRODUCTION_REQUEST_EXTERNAL_STORY_PROVENANCE_KEY
    ] as Record<string, { source: string; provider: string }>;
    const anyProv = Object.values(provenance)[0];
    expect(anyProv?.source).toBe("external_editorial_director");
    expect(anyProv?.provider).toBe("chatgpt_manual");
  });

  it("rejects unknown agenda on import", async () => {
    const slate = makeSlate(2);
    const repo = createInMemoryMarketingProductionRequestRepository();
    const parsed = parseExternalEditorialDirectorPayload(
      JSON.stringify(validExternalPayload("asc_does_not_exist_zzzzzzzz")),
    );
    expect(parsed.ok).toBe(true);
    if (!parsed.ok) return;
    await expect(
      importExternalEditorialDirector({
        slate,
        payload: parsed.payload,
        productionRequestRepo: repo,
      }),
    ).rejects.toMatchObject({ code: "UNKNOWN_AGENDA" });
  });
});
