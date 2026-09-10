import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

import { MEDIA_BRIEF_CONTRACT, type MediaBrief } from "@/lib/marketing/assets/contracts";
import { MarketingAssetContractError } from "@/lib/marketing/assets/errors";
import { ensurePackageLayout } from "@/lib/marketing/assets/paths";
import {
  buildShortVideoBrief,
  inferFactualVisualRequired,
} from "@/lib/marketing/assets/shortVideoBrief/buildShortVideoBrief";
import {
  SHORT_VIDEO_BRIEF_CONTRACT,
  SHORT_VIDEO_DURATION_DEFAULT_PRESET,
  SHORT_VIDEO_DURATION_PRESET_MS,
  type ShortVideoBrief,
} from "@/lib/marketing/assets/shortVideoBrief/contracts";
import {
  nearestDurationPreset,
  selectDurationPreset,
  splitDurationAcrossScenes,
} from "@/lib/marketing/assets/shortVideoBrief/duration";
import { isShortVideoBriefGenerationApplicable } from "@/lib/marketing/assets/shortVideoBrief/gating";
import { SHORT_VIDEO_BRIEF_RELATIVE_PATH } from "@/lib/marketing/assets/shortVideoBrief/paths";
import {
  persistShortVideoBrief,
  planShortVideoBriefArtifact,
} from "@/lib/marketing/assets/shortVideoBrief/persist";
import { parseShortVideoBrief } from "@/lib/marketing/assets/shortVideoBrief/validate";
import {
  AI_VIDEO_ASPECT_RATIO,
  AI_VIDEO_CONTINUITY_GROUP,
  AI_VIDEO_SHOT_LIST_CONTRACT,
  AI_VIDEO_TIMING_SOURCE,
  AI_VIDEO_TRANSITION_HINT,
  type AiVideoShotList,
} from "@/lib/marketing/assets/video/contracts";
import { createA8VerificationBrief } from "@/lib/marketing/assets/video/fixture";
import { TTS_AUTHORITATIVE_CLOCK } from "@/lib/marketing/tts/duration/probe";
import { TTS_INTER_SEGMENT_PAUSE_MS } from "@/lib/marketing/tts/timeline/contracts";

function enabledShortformBrief(overrides?: Partial<MediaBrief["formats"]["shortform"]>): MediaBrief {
  const base = createA8VerificationBrief();
  return {
    ...base,
    formats: {
      ...base.formats,
      shortform: {
        ...base.formats.shortform,
        ...overrides,
      },
    },
  };
}

describe("SV-3 ShortVideoBrief", () => {
  it("builds short-video-brief-v1 from MediaBrief deterministically", () => {
    const mediaBrief = enabledShortformBrief();
    const a = buildShortVideoBrief({ mediaBrief, destinations: ["다낭"] });
    const b = buildShortVideoBrief({ mediaBrief, destinations: ["다낭"] });
    expect(a).toEqual(b);
    expect(a.contract).toBe(SHORT_VIDEO_BRIEF_CONTRACT);
    expect(a.aspectRatio).toBe("9:16");
    expect(a.scenes.map((s) => s.sceneId)).toEqual(["scene-001", "scene-002"]);
    expect(a.durationPreset).toBe(SHORT_VIDEO_DURATION_DEFAULT_PRESET);
    expect(a.targetDurationMs).toBe(SHORT_VIDEO_DURATION_PRESET_MS.normal);
    expect(a.narration.segmentRefs).toEqual(["hook", "close"]);
  });

  it("encodes SHORT/NORMAL/INFO presets and respects MediaBrief range", () => {
    expect(SHORT_VIDEO_DURATION_PRESET_MS.short).toBe(12_000);
    expect(SHORT_VIDEO_DURATION_PRESET_MS.normal).toBe(18_000);
    expect(SHORT_VIDEO_DURATION_PRESET_MS.info).toBe(24_000);
    expect(selectDurationPreset({}).preset).toBe("normal");
    expect(selectDurationPreset({ explicit: "short" }).preset).toBe("short");
    expect(
      selectDurationPreset({ range: { minSeconds: 20, maxSeconds: 30 } }).preset,
    ).toBe("info");
    expect(
      selectDurationPreset({ range: { minSeconds: 10, maxSeconds: 15 } }).preset,
    ).toBe("short");
    expect(() =>
      selectDurationPreset({ range: { minSeconds: 13, maxSeconds: 17 } }),
    ).toThrow(MarketingAssetContractError);

    const brief = buildShortVideoBrief({
      mediaBrief: enabledShortformBrief({
        targetDurationRange: { minSeconds: 20, maxSeconds: 30 },
      }),
    });
    expect(brief.durationPreset).toBe("info");
    expect(brief.targetDurationMs).toBe(24_000);
  });

  it("keeps stable scene IDs for the same input order", () => {
    const mediaBrief = enabledShortformBrief();
    const first = buildShortVideoBrief({ mediaBrief });
    const second = buildShortVideoBrief({ mediaBrief });
    expect(first.scenes.map((s) => ({ id: s.sceneId, order: s.order }))).toEqual(
      second.scenes.map((s) => ({ id: s.sceneId, order: s.order })),
    );
  });

  it("enforces factualVisualRequired => generatedVideoAllowed=false", () => {
    const mediaBrief = enabledShortformBrief({
      narrationSegments: [
        {
          segmentId: "hook",
          narrationText: "바나힐 골든브릿지를 직접 걸어보세요.",
          subtitleText: "바나힐 골든브릿지를 직접 걸어보세요.",
          purpose: "hook",
          visualIntent: "Ba Na Hills Golden Bridge",
          evidenceRefs: ["ev-1"],
        },
      ],
    });
    const brief = buildShortVideoBrief({
      mediaBrief,
      destinations: ["바나힐"],
      durationPreset: "short",
    });
    expect(brief.scenes[0]?.visual.factualVisualRequired).toBe(true);
    expect(brief.scenes[0]?.visual.generatedVideoAllowed).toBe(false);

    const invalid = structuredClone(brief);
    invalid.scenes[0]!.visual.generatedVideoAllowed = true;
    expect(() => parseShortVideoBrief(invalid)).toThrow(/factualVisualRequired/);
  });

  it("allows generatedVideoAllowed when factualVisualRequired is false", () => {
    const mediaBrief = enabledShortformBrief({
      narrationSegments: [
        {
          segmentId: "mood",
          narrationText: "가족과 여유롭게 여행하는 느낌",
          subtitleText: "가족과 여유롭게 여행하는 느낌",
          purpose: "mood",
          visualIntent: "relaxed family travel vibe",
          evidenceRefs: [],
        },
      ],
    });
    const brief = buildShortVideoBrief({ mediaBrief, durationPreset: "short" });
    expect(brief.scenes[0]?.visual.factualVisualRequired).toBe(false);
    expect(brief.scenes[0]?.visual.generatedVideoAllowed).toBe(true);
    expect(
      inferFactualVisualRequired({
        segment: mediaBrief.formats.shortform.narrationSegments[0]!,
        destinations: [],
        entities: [],
      }),
    ).toBe(false);
  });

  it("bounds searchQueries and rejects empty query strings on validate", () => {
    const mediaBrief = enabledShortformBrief({
      narrationSegments: [
        {
          segmentId: "hook",
          narrationText: "다낭 여행",
          subtitleText: "다낭 여행",
          purpose: "hook",
          visualIntent: "Da Nang beach promenade at sunset",
          evidenceRefs: [],
        },
      ],
    });
    const brief = buildShortVideoBrief({
      mediaBrief,
      destinations: ["다낭", "Da Nang"],
      durationPreset: "short",
    });
    expect(brief.scenes[0]!.visual.searchQueries.length).toBeGreaterThan(0);
    expect(brief.scenes[0]!.visual.searchQueries.length).toBeLessThanOrEqual(3);

    const invalid = structuredClone(brief);
    invalid.scenes[0]!.visual.searchQueries = ["ok", "  "];
    expect(() => parseShortVideoBrief(invalid)).toThrow(/searchQueries/);
  });

  it("validates narration refs and scene duration totals", () => {
    const brief = buildShortVideoBrief({
      mediaBrief: enabledShortformBrief(),
      durationPreset: "normal",
    });
    expect(brief.scenes.reduce((sum, s) => sum + s.targetDurationMs, 0)).toBe(brief.targetDurationMs);
    expect(splitDurationAcrossScenes(18_000, 2)).toEqual([9_000, 9_000]);
    expect(nearestDurationPreset(17_500)).toBe("normal");

    const invalidRef = structuredClone(brief);
    invalidRef.scenes[0]!.narrationSegmentRefs = ["missing-seg"];
    expect(() => parseShortVideoBrief(invalidRef)).toThrow(/narrationSegmentRef/);
  });

  it("maps shot list timings without mutating MediaBrief or Shot List", () => {
    const mediaBrief = enabledShortformBrief();
    const beforeBrief = structuredClone(mediaBrief);
    const shotList: AiVideoShotList = {
      contract: AI_VIDEO_SHOT_LIST_CONTRACT,
      candidateId: mediaBrief.candidateId,
      aspectRatio: AI_VIDEO_ASPECT_RATIO,
      timingSource: AI_VIDEO_TIMING_SOURCE,
      authoritativeClock: TTS_AUTHORITATIVE_CLOCK,
      pauseMs: TTS_INTER_SEGMENT_PAUSE_MS,
      shots: [
        {
          shotId: "shot-0001",
          ordinal: 1,
          narrationSegmentId: "hook",
          narrationText: mediaBrief.formats.shortform.narrationSegments[0]!.narrationText,
          purpose: "hook",
          visualIntent: "Da Nang coastline",
          startMs: 0,
          durationMs: 5_000,
          endMs: 5_000,
          promptRelativePath: "reel/prompts/shot-0001.txt",
          transitionHint: AI_VIDEO_TRANSITION_HINT,
          continuityGroup: AI_VIDEO_CONTINUITY_GROUP,
        },
        {
          shotId: "shot-0002",
          ordinal: 2,
          narrationSegmentId: "close",
          narrationText: mediaBrief.formats.shortform.narrationSegments[1]!.narrationText,
          purpose: "close",
          visualIntent: "",
          startMs: 5_250,
          durationMs: 4_000,
          endMs: 9_250,
          promptRelativePath: "reel/prompts/shot-0002.txt",
          transitionHint: AI_VIDEO_TRANSITION_HINT,
          continuityGroup: AI_VIDEO_CONTINUITY_GROUP,
        },
      ],
    };
    const beforeShots = structuredClone(shotList);
    const brief = buildShortVideoBrief({ mediaBrief, shotList });
    expect(brief.targetDurationMs).toBe(9_000);
    expect(brief.provenance.durationPresetSource).toBe("shot_list_nearest");
    expect(brief.scenes[0]?.targetDurationMs).toBe(5_000);
    expect(brief.scenes[1]?.targetDurationMs).toBe(4_000);
    expect(mediaBrief).toEqual(beforeBrief);
    expect(shotList).toEqual(beforeShots);
  });

  it("gates generation explicitly and persists package artifact with sha256", () => {
    const off = enabledShortformBrief({ enabled: false, narrationSegments: [] });
    expect(isShortVideoBriefGenerationApplicable(off)).toBe(false);
    expect(isShortVideoBriefGenerationApplicable(enabledShortformBrief())).toBe(true);

    const brief = buildShortVideoBrief({ mediaBrief: enabledShortformBrief(), durationPreset: "short" });
    const planned = planShortVideoBriefArtifact(brief);
    expect(planned.relativePath).toBe(SHORT_VIDEO_BRIEF_RELATIVE_PATH);
    expect(planned.origin).toBe("short_video_brief");
    expect(planned.kind).toBe("context");
    expect(planned.content.byteLength).toBeGreaterThan(0);

    const root = mkdtempSync(join(tmpdir(), "sv3-brief-"));
    try {
      ensurePackageLayout(root);
      const written = persistShortVideoBrief({
        packageRoot: root,
        brief,
        createdAt: "2026-09-11T00:00:00.000Z",
      });
      expect(written.status).toBe("created");
      expect(written.artifact.sha256).toMatch(/^[a-f0-9]{64}$/);
      expect(written.artifact.relativePath).toBe(SHORT_VIDEO_BRIEF_RELATIVE_PATH);
      const loaded = JSON.parse(
        readFileSync(join(root, SHORT_VIDEO_BRIEF_RELATIVE_PATH), "utf8"),
      ) as ShortVideoBrief;
      expect(loaded.contract).toBe(SHORT_VIDEO_BRIEF_CONTRACT);
      expect(loaded.contract).not.toBe(MEDIA_BRIEF_CONTRACT);
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });
});
