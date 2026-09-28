import { describe, expect, it } from "vitest";

import {
  buildShortformNarrationFingerprint,
  buildShortformVideoRenderLogicalRunKey,
} from "@/lib/marketing/assets/shortform/renderJob/logicalRunKey";
import type { ShortformVideoRenderJob } from "@/lib/marketing/assets/shortform/renderJob/contracts";
import {
  buildQueuedShortformVideoRenderJob,
  buildShortformVideoRenderInputSnapshot,
} from "@/lib/marketing/assets/shortform/renderJob/inMemoryRepository";
import {
  jobsMatchingNarration,
  narrationFingerprintFromMediaBriefJson,
  selectPrimaryJob,
} from "@/lib/marketing/assets/shortform/renderReady";

const SEGMENTS = [
  { segmentId: "narr-01", narrationText: "첫 문장", subtitleText: "첫 문장" },
  { segmentId: "narr-02", narrationText: "둘째 문장", subtitleText: "둘째 문장" },
];
const BASE_KEY = { candidateId: "cmc_fp", briefSha256: "a".repeat(64), selectionHash: "b".repeat(64) };
const SCENE_PICKS = [
  {
    sceneId: "scene-001",
    sourceId: "src_1",
    origin: "internal_catalog",
    rightsKind: "owned",
    factualMatch: "confirmed",
    mediaType: "video",
  },
] as ShortformVideoRenderJob["inputSnapshot"]["scenePicks"];

function job(input: {
  narrationSha256?: string | null;
  status: ShortformVideoRenderJob["status"];
  at: string;
  briefSha256?: string;
}): ShortformVideoRenderJob {
  const snapshot = buildShortformVideoRenderInputSnapshot({
    briefContract: "short-video-brief.v1",
    briefSha256: input.briefSha256 ?? "c".repeat(64),
    scenePicks: SCENE_PICKS,
    narrationSha256: input.narrationSha256,
  });
  const queued = buildQueuedShortformVideoRenderJob({
    candidateId: "cmc_fp",
    businessDateKst: "2026-09-28",
    snapshot,
    now: new Date(input.at),
  });
  return {
    ...queued,
    status: input.status,
    completedAt: input.status === "READY" ? input.at : null,
  };
}

describe("narration fingerprint", () => {
  it("changes with narration or subtitle text, ignores surrounding whitespace", () => {
    const base = buildShortformNarrationFingerprint(SEGMENTS);
    expect(base).toMatch(/^[a-f0-9]{64}$/);
    expect(
      buildShortformNarrationFingerprint(SEGMENTS.map((s) => ({ ...s, narrationText: ` ${s.narrationText}\n` }))),
    ).toBe(base);
    expect(
      buildShortformNarrationFingerprint([{ ...SEGMENTS[0]!, narrationText: "바뀐 문장" }, SEGMENTS[1]!]),
    ).not.toBe(base);
    expect(
      buildShortformNarrationFingerprint([{ ...SEGMENTS[0]!, subtitleText: "자막만 변경" }, SEGMENTS[1]!]),
    ).not.toBe(base);
  });

  it("logical run key includes narration only when known (legacy keys unchanged)", () => {
    const legacy = buildShortformVideoRenderLogicalRunKey(BASE_KEY);
    expect(buildShortformVideoRenderLogicalRunKey({ ...BASE_KEY, narrationSha256: null })).toBe(legacy);
    const a = buildShortformVideoRenderLogicalRunKey({ ...BASE_KEY, narrationSha256: "1".repeat(64) });
    const b = buildShortformVideoRenderLogicalRunKey({ ...BASE_KEY, narrationSha256: "2".repeat(64) });
    expect(a).not.toBe(legacy);
    expect(a).not.toBe(b);
  });

  it("snapshot stores the fingerprint only when present", () => {
    expect(job({ status: "QUEUED", at: "2026-09-28T00:00:00.000Z" }).inputSnapshot).not.toHaveProperty(
      "narrationSha256",
    );
    expect(
      job({ status: "QUEUED", at: "2026-09-28T00:00:00.000Z", narrationSha256: "A".repeat(64) }).inputSnapshot
        .narrationSha256,
    ).toBe("a".repeat(64));
  });

  it("reads the fingerprint from media-brief json leniently", () => {
    const brief = { formats: { shortform: { narrationSegments: SEGMENTS } } };
    expect(narrationFingerprintFromMediaBriefJson(brief)).toBe(buildShortformNarrationFingerprint(SEGMENTS));
    expect(narrationFingerprintFromMediaBriefJson({ formats: { shortform: { narrationSegments: [] } } })).toBeNull();
    expect(narrationFingerprintFromMediaBriefJson(null)).toBeNull();
  });
});

describe("selectPrimaryJob narration rule", () => {
  const current = "1".repeat(64);
  const previous = "2".repeat(64);

  it("legacy jobs count as current while no fingerprinted job exists", () => {
    const legacy = job({ status: "READY", at: "2026-09-28T00:00:00.000Z" });
    expect(jobsMatchingNarration([legacy], current)).toEqual([legacy]);
    expect(selectPrimaryJob([legacy], current)).toEqual({ job: legacy, staleJob: null });
  });

  it("once a fingerprinted job exists, legacy and other-narration jobs are stale", () => {
    const legacy = job({ status: "READY", at: "2026-09-28T00:00:00.000Z" });
    const old = job({ status: "READY", at: "2026-09-28T01:00:00.000Z", narrationSha256: previous });
    const picked = selectPrimaryJob([legacy, old], current);
    expect(picked.job).toBeNull();
    expect(picked.staleJob?.logicalRunKey).toBe(old.logicalRunKey);

    const fresh = job({ status: "QUEUED", at: "2026-09-28T02:00:00.000Z", narrationSha256: current });
    expect(selectPrimaryJob([legacy, old, fresh], current)).toEqual({ job: fresh, staleJob: null });
  });

  it("unknown current narration keeps the previous ranking", () => {
    const ready = job({ status: "READY", at: "2026-09-28T00:00:00.000Z", narrationSha256: previous });
    expect(selectPrimaryJob([ready], null).job?.logicalRunKey).toBe(ready.logicalRunKey);
  });

  it("a READY job whose final was replaced by a later other-narration render is stale", () => {
    const first = job({ status: "READY", at: "2026-09-28T00:00:00.000Z", narrationSha256: current });
    const later = job({ status: "READY", at: "2026-09-28T01:00:00.000Z", narrationSha256: previous });
    const picked = selectPrimaryJob([first, later], current);
    expect(picked.job).toBeNull();
    expect(picked.staleJob?.logicalRunKey).toBe(first.logicalRunKey);
    expect(selectPrimaryJob([first, later], previous).job?.logicalRunKey).toBe(later.logicalRunKey);
  });
});
