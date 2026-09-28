vi.mock("server-only", () => ({}));

import { describe, expect, it } from "vitest";

import { createAgendaSlateService } from "@/lib/marketing/cron/daily/agendaSlate/agendaSlateService";
import type { MarketingProductionRequest } from "@/lib/marketing/cron/daily/agendaSlate/productionRequestTypes";
import type { DailyAgendaSlate } from "@/lib/marketing/cron/daily/agendaSlate/types";
import { createInMemoryDailyAgendaSlateRepository } from "@/lib/marketing/cron/daily/repository/createDailyAgendaSlateRepository";
import {
  createInMemoryMarketingProductionRequestRepository,
  type MarketingProductionRequestRepository,
} from "@/lib/marketing/cron/daily/repository/createMarketingProductionRequestRepository";
import { buildAgendaSlateEditorialExportPayload } from "@/lib/marketing/editorialDirector/buildSlateExport";
import {
  PRODUCTION_REQUEST_EXTERNAL_EDITORIAL_IMPORTS_KEY,
  PRODUCTION_REQUEST_EXTERNAL_STORY_PROVENANCE_KEY,
} from "@/lib/marketing/editorialDirector/contracts";
import { importExternalEditorialDirector } from "@/lib/marketing/editorialDirector/importExternalStories";
import { parseExternalEditorialDirectorPayload } from "@/lib/marketing/editorialDirector/parseExternalPayload";
import { listStoryCandidatePointIds } from "@/lib/marketing/editorialDirector/resetStoryCandidates";
import { PRODUCTION_REQUEST_STORY_POINT_METADATA_KEY } from "@/lib/marketing/storyPoint/contracts";
import { PRODUCTION_OUTCOME_AWAITING_STORY_SELECTION } from "@/lib/marketing/storyPoint/humanStorySelection";
import {
  makeSlate,
  validExternalPayload,
} from "@/lib/marketing/editorialDirector/__tests__/editorialFixtures";

const NOW = new Date("2026-09-15T03:00:00.000Z");
const DAY = "2026-09-15";

function parsedPayload(raw: unknown) {
  const parsed = parseExternalEditorialDirectorPayload(JSON.stringify(raw));
  if (!parsed.ok) throw new Error(`fixture payload failed to parse: ${JSON.stringify(parsed)}`);
  return parsed.payload;
}

/** A different Story for the same agenda, so its pointId differs from the fixture Stories. */
function secondPayload(agendaId: string) {
  const payload = validExternalPayload(agendaId);
  const base = payload.storyCandidates[0]!;
  payload.storyCandidates = [
    {
      ...base,
      externalStoryId: "ext_solo",
      storyTitleKo: "혼자 가는 닌빈 1박은 충분한가",
      storyQuestionKo: "혼자 여행자에게 닌빈 1박 일정이 회복에 충분할까?",
      audienceProblemKo: "짧은 일정에서 회복 효과를 얻기 어려움",
      decisionAtStakeKo: "닌빈 체류 일수 결정",
      audienceTensionKo: "하노이 경유 일정을 줄이고 싶은 마음 vs 1박으로는 고요함을 못 느낄 것 같은 불안",
      curiosityGapKo: "혼자 여행자 후기에서 1박이 짧다는 불만이 반복되는지",
      readerPayoffKo: "혼자 닌빈에 갈 때 1박과 2박 중 무엇이 회복 목적에 맞는지 판단 기준을 얻음",
      researchQuestionsKo: [
        "혼자 여행자 닌빈 후기에서 1박이 짧다는 언급이 반복되는가?",
        "닌빈 2박 이상 추천 비율이 높은가?",
      ],
    },
  ];
  return payload;
}

async function seedImported(
  slate: DailyAgendaSlate,
  repo: MarketingProductionRequestRepository,
  index: number,
): Promise<MarketingProductionRequest> {
  const agendaId = slate.candidates[index]!.slateItemId;
  const result = await importExternalEditorialDirector({
    slate,
    payload: parsedPayload(validExternalPayload(agendaId)),
    productionRequestRepo: repo,
    now: NOW,
  });
  return result.request;
}

async function setup(count = 3) {
  const slate = makeSlate(count);
  const slateRepo = createInMemoryDailyAgendaSlateRepository();
  await slateRepo.saveSlate(slate);
  const productionRequestRepo = createInMemoryMarketingProductionRequestRepository();
  const service = await createAgendaSlateService({ slateRepo, productionRequestRepo, now: NOW });
  return { slate, slateRepo, productionRequestRepo, service };
}

describe("partial slate export", () => {
  it("includes only the chosen agendas and marks the payload as a subset", () => {
    const slate = makeSlate(5);
    const chosen = [slate.candidates[1]!.slateItemId, slate.candidates[3]!.slateItemId];
    const payload = buildAgendaSlateEditorialExportPayload(slate, NOW, { slateItemIds: chosen });
    expect(payload.selection).toBe("subset");
    expect(payload.agendaCount).toBe(2);
    expect(payload.agendas.map((a) => a.agendaId)).toEqual(chosen);
    expect(payload.notesKo[0]).toContain("2건만");
  });

  it("keeps the full export unchanged without a selection", () => {
    const slate = makeSlate(4);
    const payload = buildAgendaSlateEditorialExportPayload(slate, NOW);
    expect(payload.selection).toBe("all");
    expect(payload.agendaCount).toBe(4);
  });

  it("rejects an empty or unknown selection at the service", async () => {
    const { service, slate } = await setup(3);
    await expect(
      service.buildChatGptSlateExport({ businessDateKst: DAY, slateItemIds: ["  "] }),
    ).rejects.toMatchObject({ code: "SLATE_SELECTION_EMPTY" });
    await expect(
      service.buildChatGptSlateExport({
        businessDateKst: DAY,
        slateItemIds: [slate.candidates[0]!.slateItemId, "asc_not_on_slate"],
      }),
    ).rejects.toMatchObject({ code: "UNKNOWN_AGENDA" });

    const built = await service.buildChatGptSlateExport({
      businessDateKst: DAY,
      slateItemIds: [slate.candidates[2]!.slateItemId, slate.candidates[2]!.slateItemId],
    });
    expect(built.agendaCount).toBe(1);
  });
});

describe("replace import", () => {
  it("wipes internal + external candidates, selection and research state, keeping only new Stories", async () => {
    const { slate, productionRequestRepo } = await setup(3);
    const agendaId = slate.candidates[0]!.slateItemId;
    const first = await seedImported(slate, productionRequestRepo, 0);
    const oldIds = listStoryCandidatePointIds(first.metadata);
    expect(oldIds.length).toBeGreaterThan(0);

    await productionRequestRepo.update({
      ...first,
      metadata: {
        ...first.metadata,
        storyPointCandidateSetFull: first.metadata[PRODUCTION_REQUEST_STORY_POINT_METADATA_KEY],
        humanStorySelection: { pointId: oldIds[0], selectedAt: NOW.toISOString() },
        audienceContentResearchBrief: { stale: true },
        lastStoryResearchRejectReason: "stale",
      },
    });

    const replaced = await importExternalEditorialDirector({
      slate,
      payload: parsedPayload(secondPayload(agendaId)),
      productionRequestRepo,
      now: NOW,
      mode: "replace",
    });
    const meta = replaced.request.metadata;
    const newIds = listStoryCandidatePointIds(meta);
    expect(newIds).toHaveLength(1);
    expect(newIds.some((id) => oldIds.includes(id))).toBe(false);
    expect(meta.storyPointCandidateSetFull).toBeUndefined();
    expect(meta.audienceContentResearchBrief).toBeUndefined();
    expect(meta.lastStoryResearchRejectReason).toBeUndefined();
    expect(meta.humanStorySelection).toBeNull();
    expect(Object.keys(meta[PRODUCTION_REQUEST_EXTERNAL_STORY_PROVENANCE_KEY] as object)).toEqual(newIds);

    const log = meta[PRODUCTION_REQUEST_EXTERNAL_EDITORIAL_IMPORTS_KEY] as Array<Record<string, unknown>>;
    const reset = log.find((r) => r.kind === "reset");
    expect(reset).toMatchObject({ reason: "replace_import" });
    expect([...(reset!.removedPointIds as string[])].sort()).toEqual([...oldIds].sort());
    expect(log.at(-1)?.importId).toBe(replaced.importRecord.importId);
  });

  it("merge still accumulates prior candidates", async () => {
    const { slate, productionRequestRepo } = await setup(3);
    const agendaId = slate.candidates[0]!.slateItemId;
    const first = await seedImported(slate, productionRequestRepo, 0);
    const oldIds = listStoryCandidatePointIds(first.metadata);

    const merged = await importExternalEditorialDirector({
      slate,
      payload: parsedPayload(secondPayload(agendaId)),
      productionRequestRepo,
      now: NOW,
    });
    const ids = listStoryCandidatePointIds(merged.request.metadata);
    expect(ids).toHaveLength(oldIds.length + 1);
    expect(oldIds.every((id) => ids.includes(id))).toBe(true);
  });

  it("leaves existing candidates untouched when every new Story is rejected", async () => {
    const { slate, productionRequestRepo } = await setup(3);
    const agendaId = slate.candidates[0]!.slateItemId;
    const first = await seedImported(slate, productionRequestRepo, 0);
    const before = structuredClone(first.metadata);

    const bad = secondPayload(agendaId);
    bad.storyCandidates[0]!.storyTitleKo = "도쿄 긴자 쇼핑 가이드";
    bad.storyCandidates[0]!.storyQuestionKo = "도쿄 긴자 백화점 면세 쇼핑이 이득일까?";
    bad.storyCandidates[0]!.audienceProblemKo = "도쿄 쇼핑 예산";
    bad.storyCandidates[0]!.decisionAtStakeKo = "도쿄 긴자 쇼핑 여부";
    bad.storyCandidates[0]!.curiosityGapKo = "도쿄 긴자 면세 혜택 체감";
    bad.storyCandidates[0]!.readerPayoffKo = "도쿄 쇼핑 판단";
    bad.storyCandidates[0]!.researchQuestionsKo = [
      "도쿄 긴자 면세 한도는 얼마인가?",
      "도쿄 긴자 백화점 환급 절차는?",
    ];

    await expect(
      importExternalEditorialDirector({
        slate,
        payload: parsedPayload(bad),
        productionRequestRepo,
        now: NOW,
        mode: "replace",
      }),
    ).rejects.toMatchObject({ code: expect.stringMatching(/ALL_STORIES_REJECTED|NO_PASS_STORIES/) });

    const after = await productionRequestRepo.findByLogicalKey(first.logicalRunKey);
    expect(after?.metadata).toEqual(before);
  });

  it("refuses to replace once the canonical asset exists", async () => {
    const { slate, productionRequestRepo } = await setup(3);
    const agendaId = slate.candidates[0]!.slateItemId;
    const first = await seedImported(slate, productionRequestRepo, 0);
    await productionRequestRepo.update({
      ...first,
      metadata: { ...first.metadata, canonicalMarketingAsset: { assetId: "cma_x" } },
    });
    await expect(
      importExternalEditorialDirector({
        slate,
        payload: parsedPayload(secondPayload(agendaId)),
        productionRequestRepo,
        now: NOW,
        mode: "replace",
      }),
    ).rejects.toMatchObject({ code: "PRODUCTION_ALREADY_COMPLETE" });
  });
});

describe("clearStoryCandidates", () => {
  it("clears one agenda and records the reset", async () => {
    const { slate, productionRequestRepo, service } = await setup(3);
    const request = await seedImported(slate, productionRequestRepo, 0);
    const oldIds = listStoryCandidatePointIds(request.metadata);

    const result = await service.clearStoryCandidates({
      businessDateKst: DAY,
      slateItemId: request.slateItemId,
    });
    expect(result.cleared).toEqual([{ slateItemId: request.slateItemId, removedCount: oldIds.length }]);

    const after = await productionRequestRepo.findByLogicalKey(request.logicalRunKey);
    expect(listStoryCandidatePointIds(after?.metadata)).toEqual([]);
    expect(after?.metadata[PRODUCTION_REQUEST_EXTERNAL_STORY_PROVENANCE_KEY]).toBeUndefined();
    expect(after?.metadata.productionOutcome).toBe(PRODUCTION_OUTCOME_AWAITING_STORY_SELECTION);
    expect(after?.status).toBe("COMPLETED");
    const log = after?.metadata[PRODUCTION_REQUEST_EXTERNAL_EDITORIAL_IMPORTS_KEY] as Array<
      Record<string, unknown>
    >;
    expect(log.at(-1)).toMatchObject({ kind: "reset", reason: "manual_clear" });
  });

  it("blocks a single clear for completed, canonical-asset and busy productions", async () => {
    const { slate, productionRequestRepo, service } = await setup(3);
    const done = await seedImported(slate, productionRequestRepo, 0);
    const asset = await seedImported(slate, productionRequestRepo, 1);
    const busy = await seedImported(slate, productionRequestRepo, 2);
    await productionRequestRepo.update({ ...done, completedCandidateId: "cmc_done" });
    await productionRequestRepo.update({
      ...asset,
      metadata: { ...asset.metadata, canonicalMarketingAsset: { assetId: "cma_x" } },
    });
    await productionRequestRepo.update({ ...busy, status: "QUEUED" });

    await expect(
      service.clearStoryCandidates({ businessDateKst: DAY, slateItemId: done.slateItemId }),
    ).rejects.toMatchObject({ code: "PRODUCTION_ALREADY_COMPLETE", status: 409 });
    await expect(
      service.clearStoryCandidates({ businessDateKst: DAY, slateItemId: asset.slateItemId }),
    ).rejects.toMatchObject({ code: "PRODUCTION_ALREADY_COMPLETE", status: 409 });
    await expect(
      service.clearStoryCandidates({ businessDateKst: DAY, slateItemId: busy.slateItemId }),
    ).rejects.toMatchObject({ code: "PRODUCTION_BUSY", status: 409 });

    const untouched = await productionRequestRepo.findByLogicalKey(done.logicalRunKey);
    expect(listStoryCandidatePointIds(untouched?.metadata).length).toBeGreaterThan(0);
  });

  it("bulk clear resets eligible agendas and reports skipped ones", async () => {
    const { slate, productionRequestRepo, service } = await setup(3);
    const open = await seedImported(slate, productionRequestRepo, 0);
    const done = await seedImported(slate, productionRequestRepo, 1);
    const busy = await seedImported(slate, productionRequestRepo, 2);
    await productionRequestRepo.update({ ...done, completedCandidateId: "cmc_done" });
    await productionRequestRepo.update({ ...busy, status: "RUNNING" });

    const result = await service.clearStoryCandidates({ businessDateKst: DAY, all: true });
    expect(result.cleared.map((c) => c.slateItemId)).toEqual([open.slateItemId]);
    expect(result.skipped.map((s) => s.slateItemId).sort()).toEqual(
      [done.slateItemId, busy.slateItemId].sort(),
    );
    expect(result.skipped.every((s) => s.reason.length > 0)).toBe(true);

    const openAfter = await productionRequestRepo.findByLogicalKey(open.logicalRunKey);
    expect(listStoryCandidatePointIds(openAfter?.metadata)).toEqual([]);
    const log = openAfter?.metadata[PRODUCTION_REQUEST_EXTERNAL_EDITORIAL_IMPORTS_KEY] as Array<
      Record<string, unknown>
    >;
    expect(log.at(-1)).toMatchObject({ kind: "reset", reason: "bulk_clear" });

    const doneAfter = await productionRequestRepo.findByLogicalKey(done.logicalRunKey);
    expect(listStoryCandidatePointIds(doneAfter?.metadata).length).toBeGreaterThan(0);
  });
});
