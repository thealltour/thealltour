import { describe, expect, it, vi } from "vitest";

import { createInMemoryResearchRepository } from "@/lib/marketing/research/repository/inMemoryResearchRepository";
import { ResearchValidationError } from "@/lib/marketing/research/repository/errors";
import {
  toResearchUtcDatetime,
  ResearchDatetimeError,
} from "@/lib/marketing/research/datetime";
import {
  adaptTrendSignalToResearch,
  assertAdaptedTrendPersistable,
  persistAdaptedTrend,
} from "../adapter/trendSourceAdapter";
import { FIXTURE_BUSAN_FAMILY_CRUISE } from "../fixtures/positiveFixtures";
import type { TrendSignalPayloadV1 } from "../types";
import { createInMemoryTravelTrendsStagingRepository } from "../staging/inMemoryTravelTrendsStagingRepository";
import { processNewTrendStagingObservations } from "../staging/processNewTrendStaging";

function offsetPayload(observationId: string): TrendSignalPayloadV1 {
  return {
    ...FIXTURE_BUSAN_FAMILY_CRUISE,
    observation_id: observationId,
    provider_run_at: "2026-09-08T17:00:00+09:00",
    observed_at: "2026-09-08T17:00:00+09:00",
    captured_at: "2026-09-08T16:50:00+09:00",
    published_at: "2026-09-06T22:36:56+09:00",
    window: {
      start: "2026-09-05T17:00:00+09:00",
      end: "2026-09-08T17:00:00+09:00",
    },
    provenance: [
      {
        level: "L1",
        platform: "instagram",
        url: "https://www.instagram.com/reel/Dc8qCMPJZG5/",
        captured_at: "2026-09-06T22:45:00+09:00",
      },
      {
        level: "L1",
        platform: "instagram",
        url: "https://www.instagram.com/reel/Dc-ie7iKW16/",
        captured_at: "2026-09-07T16:30:00+09:00",
      },
    ],
  } as TrendSignalPayloadV1;
}

describe("toResearchUtcDatetime", () => {
  it("maps +09:00 offset to UTC Z", () => {
    expect(toResearchUtcDatetime("2026-09-08T17:00:00+09:00")).toBe("2026-09-08T08:00:00.000Z");
  });

  it("keeps Z input as UTC Z", () => {
    expect(toResearchUtcDatetime("2026-09-08T08:00:00.000Z")).toBe("2026-09-08T08:00:00.000Z");
  });

  it("rejects malformed datetime", () => {
    expect(() => toResearchUtcDatetime("not-a-date")).toThrow(ResearchDatetimeError);
  });
});

describe("TrendSourceAdapter datetime canonicalization", () => {
  it("normalizes +09:00 observed_at / window / provenance to internal UTC Z", () => {
    const adapted = adaptTrendSignalToResearch(offsetPayload("obs_offset_norm_001"));
    expect(adapted.signal.observedAt).toBe("2026-09-08T08:00:00.000Z");
    expect(adapted.signal.expiresAt).toBe("2026-09-11T08:00:00.000Z");
    expect(adapted.signal.expiresAt).not.toBe(adapted.layers.discovery.window.end);
    expect(adapted.brief.freshness.expiresAt).toBe("2026-09-11T08:00:00.000Z");
    expect(adapted.layers.discovery.window.start).toBe("2026-09-05T08:00:00.000Z");
    expect(adapted.layers.discovery.window.end).toBe("2026-09-08T08:00:00.000Z");
    expect(adapted.brief.trendContext?.window.start).toBe("2026-09-05T08:00:00.000Z");
    expect(adapted.brief.freshness.observedAt).toBe("2026-09-08T08:00:00.000Z");
    expect(adapted.signal.evidence[0]?.observedAt.endsWith("Z")).toBe(true);
    expect(adapted.signal.evidence[0]?.publishedAt?.endsWith("Z")).toBe(true);
    assertAdaptedTrendPersistable(adapted);
  });

  it("preserves temporal ordering after normalization", () => {
    const adapted = adaptTrendSignalToResearch(offsetPayload("obs_offset_order_001"));
    const published = Date.parse(adapted.signal.publishedAt!);
    const evidencePublished = Date.parse(adapted.signal.evidence[0]!.publishedAt!);
    const evidenceCaptured = Date.parse(adapted.signal.evidence[0]!.observedAt);
    const observed = Date.parse(adapted.signal.observedAt);
    const winStart = Date.parse(adapted.layers.discovery.window.start);
    const winEnd = Date.parse(adapted.layers.discovery.window.end);
    expect(evidencePublished).toBeLessThanOrEqual(evidenceCaptured);
    expect(evidenceCaptured).toBeLessThanOrEqual(observed);
    expect(published).toBeLessThanOrEqual(observed);
    expect(winStart).toBeLessThanOrEqual(winEnd);
  });

  it("persists offset fixture without orphan and marks staging ingested", async () => {
    const staging = createInMemoryTravelTrendsStagingRepository();
    const payload = offsetPayload("obs_offset_persist_001");
    staging.seed(payload);
    const research = createInMemoryResearchRepository();
    const diag = await processNewTrendStagingObservations({
      stagingRepo: staging,
      researchRepo: research,
    });
    expect(diag.adaptedTrendCount).toBe(1);
    expect(diag.failedCount).toBe(0);
    expect(diag.researchBriefIds).toHaveLength(1);
    const brief = await research.findBriefById(diag.researchBriefIds[0]!);
    expect(brief?.trendContext?.observationId).toBe(payload.observation_id);
    expect(brief?.freshness.observedAt).toBe("2026-09-08T08:00:00.000Z");
    const rows = await staging.listRecentStaging(5);
    expect(rows[0]?.status).toBe("ingested");
    const candidate = await research.findAgendaCandidateById(
      (await research.findRecentAgendaCandidates({ since: "2020-01-01T00:00:00.000Z", limit: 5 }))[0]
        ?.id ?? "",
    );
    expect(candidate?.researchBriefId).toBe(brief?.id);
  });

  it("does not persist ResearchBrief when domain validation fails", async () => {
    const adapted = adaptTrendSignalToResearch(offsetPayload("obs_offset_novalid_001"));
    // Force an invalid Research datetime after adapt (simulates regression / tampering).
    adapted.signal.observedAt = "2026-09-08T17:00:00+09:00";
    const research = createInMemoryResearchRepository();
    await expect(persistAdaptedTrend(adapted, research)).rejects.toBeInstanceOf(
      ResearchValidationError,
    );
    expect(await research.findBriefById(adapted.brief.id)).toBeNull();
    expect(await research.findSignalById(adapted.signal.id)).toBeNull();
  });

  it("rolls back partial durable writes when downstream persist fails", async () => {
    const adapted = adaptTrendSignalToResearch(offsetPayload("obs_offset_rollback_001"));
    const research = createInMemoryResearchRepository();
    const upsertAgenda = vi
      .spyOn(research, "upsertAgendaCandidate")
      .mockRejectedValueOnce(new Error("forced_agenda_persist_failure"));

    await expect(persistAdaptedTrend(adapted, research)).rejects.toThrow(
      "forced_agenda_persist_failure",
    );
    expect(await research.findBriefById(adapted.brief.id)).toBeNull();
    expect(await research.findSignalById(adapted.signal.id)).toBeNull();
    upsertAgenda.mockRestore();
  });
});
