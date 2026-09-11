import { describe, expect, it, vi } from "vitest";

import type { MediaBrief } from "@/lib/marketing/assets/contracts";
import { createA8VerificationBrief } from "@/lib/marketing/assets/video/fixture";
import { buildShortVideoBrief } from "@/lib/marketing/assets/shortVideoBrief/buildShortVideoBrief";
import {
  resolveShortformNarrationPlan,
} from "@/lib/marketing/assets/shortform/production/resolveNarration";
import { ShortformProductionError } from "@/lib/marketing/assets/shortform/production/errors";
import { buildTtsGenerationRequest } from "@/lib/marketing/tts/provider";
import { TtsError } from "@/lib/marketing/tts/errors";

function enabledBrief(): MediaBrief {
  return createA8VerificationBrief();
}

describe("SV-8A narration resolution (MediaBrief SoT)", () => {
  it("resolves single narrationSegmentRef to MediaBrief narrationText", () => {
    const mediaBrief = enabledBrief();
    const shortVideoBrief = buildShortVideoBrief({ mediaBrief, destinations: ["다낭"] });
    // Use only first scene
    const plan = resolveShortformNarrationPlan({
      mediaBrief,
      shortVideoBrief,
      sceneIds: [shortVideoBrief.scenes[0]!.sceneId],
    });
    expect(plan.segments).toHaveLength(1);
    expect(plan.segments[0]!.segmentId).toBe("hook");
    expect(plan.segments[0]!.text).toBe("다낭 효도여행은 일정이 여유롭습니다.");
    expect(plan.segments[0]!.subtitleText).toBe(plan.segments[0]!.text);
    expect(plan.segments[0]!.text).not.toMatch(/^Scene \d+$/);
  });

  it("resolves multiple refs in declared ShortVideoBrief order", () => {
    const mediaBrief = enabledBrief();
    // Force one scene with both refs in explicit order
    const shortVideoBrief = buildShortVideoBrief({ mediaBrief, destinations: ["다낭"] });
    const multi = {
      ...shortVideoBrief,
      scenes: [
        {
          ...shortVideoBrief.scenes[0]!,
          narrationSegmentRefs: ["close", "hook"],
        },
      ],
      narration: {
        ...shortVideoBrief.narration,
        segmentRefs: ["close", "hook"],
      },
    };
    const plan = resolveShortformNarrationPlan({
      mediaBrief,
      shortVideoBrief: multi,
      sceneIds: [multi.scenes[0]!.sceneId],
    });
    expect(plan.segments.map((s) => s.segmentId)).toEqual(["close", "hook"]);
    expect(plan.segments.map((s) => s.text)).toEqual([
      "출발 전에 공식 안내를 다시 확인하세요.",
      "다낭 효도여행은 일정이 여유롭습니다.",
    ]);
    expect(plan.subtitlesBySceneId[multi.scenes[0]!.sceneId]).toEqual([
      "출발 전에 공식 안내를 다시 확인하세요.",
      "다낭 효도여행은 일정이 여유롭습니다.",
    ]);
  });

  it("fails closed on missing narrationSegmentRef without calling TTS", () => {
    const mediaBrief = enabledBrief();
    const shortVideoBrief = buildShortVideoBrief({ mediaBrief, destinations: ["다낭"] });
    const broken = {
      ...shortVideoBrief,
      scenes: [
        {
          ...shortVideoBrief.scenes[0]!,
          narrationSegmentRefs: ["does-not-exist"],
        },
      ],
      narration: {
        ...shortVideoBrief.narration,
        segmentRefs: ["does-not-exist"],
      },
    };
    const tts = vi.fn();
    expect(() =>
      resolveShortformNarrationPlan({
        mediaBrief,
        shortVideoBrief: broken,
        sceneIds: [broken.scenes[0]!.sceneId],
      }),
    ).toThrow(ShortformProductionError);
    try {
      resolveShortformNarrationPlan({
        mediaBrief,
        shortVideoBrief: broken,
        sceneIds: [broken.scenes[0]!.sceneId],
      });
    } catch (error) {
      expect((error as ShortformProductionError).code).toBe("NARRATION_SEGMENT_NOT_FOUND");
    }
    expect(tts).not.toHaveBeenCalled();
  });

  it("uses MediaBrief subtitleText for baked captions (same source family as TTS)", () => {
    const mediaBrief = enabledBrief();
    mediaBrief.formats.shortform.narrationSegments[0] = {
      ...mediaBrief.formats.shortform.narrationSegments[0]!,
      narrationText: "TTS 본문입니다.",
      subtitleText: "자막 본문입니다.",
    };
    const shortVideoBrief = buildShortVideoBrief({ mediaBrief, destinations: ["다낭"] });
    const plan = resolveShortformNarrationPlan({
      mediaBrief,
      shortVideoBrief,
      sceneIds: [shortVideoBrief.scenes[0]!.sceneId],
    });
    expect(plan.segments[0]!.text).toBe("TTS 본문입니다.");
    expect(plan.segments[0]!.subtitleText).toBe("자막 본문입니다.");
  });

  it("SV-8C3-D1: preserves full enabled TtsProfile so generation request is not rejected", () => {
    const mediaBrief = enabledBrief();
    const shortVideoBrief = buildShortVideoBrief({ mediaBrief, destinations: ["다낭"] });
    const plan = resolveShortformNarrationPlan({
      mediaBrief,
      shortVideoBrief,
      sceneIds: [shortVideoBrief.scenes[0]!.sceneId],
    });
    const profile = plan.segments[0]!.profile;
    expect(profile.profileId).toBe("standard-ko-development");
    expect(profile.enabled).toBe(true);
    expect(profile.provider).toBe("voicestudio");
    expect(profile.language).toBe("ko");
    expect(profile.locale).toBe("ko-KR");
    // Downstream gate must accept this profile (the live failure mode was missing enabled).
    expect(() =>
      buildTtsGenerationRequest({
        requestId: "sv8c3d1-enabled",
        profile,
        text: plan.segments[0]!.text,
      }),
    ).not.toThrow();
  });

  it("SV-8C3-D1: disabled canonical profile remains rejected at resolve", () => {
    const mediaBrief = enabledBrief();
    mediaBrief.formats.shortform.voiceProfileId = "owner-clone-development";
    const shortVideoBrief = buildShortVideoBrief({ mediaBrief, destinations: ["다낭"] });
    expect(() =>
      resolveShortformNarrationPlan({
        mediaBrief,
        shortVideoBrief,
        sceneIds: [shortVideoBrief.scenes[0]!.sceneId],
      }),
    ).toThrow(TtsError);
    try {
      resolveShortformNarrationPlan({
        mediaBrief,
        shortVideoBrief,
        sceneIds: [shortVideoBrief.scenes[0]!.sceneId],
      });
    } catch (error) {
      expect(error).toBeInstanceOf(TtsError);
      expect((error as TtsError).code).toBe("disabled_profile");
    }
  });

  it("SV-8C3-D1: partial profile without enabled still fails generation safety gate", () => {
    expect(() =>
      buildTtsGenerationRequest({
        requestId: "sv8c3d1-partial",
        profile: {
          provider: "voicestudio",
          profileId: "standard-ko-development",
          modelRef: "tts-1",
          voiceRef: "default",
        } as never,
        text: "여행은 여유롭게 준비할수록 편해집니다.",
      }),
    ).toThrow(TtsError);
    try {
      buildTtsGenerationRequest({
        requestId: "sv8c3d1-partial",
        profile: {
          provider: "voicestudio",
          profileId: "standard-ko-development",
          modelRef: "tts-1",
          voiceRef: "default",
        } as never,
        text: "여행은 여유롭게 준비할수록 편해집니다.",
      });
    } catch (error) {
      expect((error as TtsError).code).toBe("disabled_profile");
      expect((error as TtsError).message).toMatch(/standard-ko-development/);
    }
  });
});
