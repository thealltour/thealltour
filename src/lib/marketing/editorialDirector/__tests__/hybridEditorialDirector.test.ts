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
  validExternalPayload,
} from "@/lib/marketing/editorialDirector/__tests__/editorialFixtures";

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
