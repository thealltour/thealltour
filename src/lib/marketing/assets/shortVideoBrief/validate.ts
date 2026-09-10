import { MarketingAssetContractError } from "@/lib/marketing/assets/errors";
import {
  SHORT_VIDEO_BRIEF_ASPECT_RATIO,
  SHORT_VIDEO_BRIEF_CONTRACT,
  SHORT_VIDEO_DURATION_PRESET_MS,
  shortVideoBriefSchema,
  type ShortVideoBrief,
  type ShortVideoDurationPreset,
  type ShortVideoSceneRequirement,
} from "@/lib/marketing/assets/shortVideoBrief/contracts";

/** Allow ±1 scene-duration quantum of rounding when splitting without a shot list. */
export const SHORT_VIDEO_BRIEF_DURATION_TOLERANCE_MS = 50;

export function parseShortVideoBrief(value: unknown): ShortVideoBrief {
  const parsed = shortVideoBriefSchema.safeParse(value);
  if (!parsed.success) {
    throw new MarketingAssetContractError(
      `Invalid ${SHORT_VIDEO_BRIEF_CONTRACT}: ${parsed.error.issues.map((i) => i.message).join("; ")}`,
    );
  }
  assertShortVideoBriefInvariants(parsed.data);
  return parsed.data;
}

export function assertShortVideoBriefInvariants(brief: ShortVideoBrief): void {
  if (brief.contract !== SHORT_VIDEO_BRIEF_CONTRACT) {
    throw new MarketingAssetContractError(`contract must be ${SHORT_VIDEO_BRIEF_CONTRACT}`);
  }
  if (brief.aspectRatio !== SHORT_VIDEO_BRIEF_ASPECT_RATIO) {
    throw new MarketingAssetContractError("aspectRatio must be 9:16");
  }
  if (brief.scenes.length < 1) {
    throw new MarketingAssetContractError("scenes must contain at least one scene");
  }

  const expectedMs = SHORT_VIDEO_DURATION_PRESET_MS[brief.durationPreset];
  if (
    brief.provenance.durationPresetSource !== "shot_list_nearest" &&
    brief.targetDurationMs !== expectedMs
  ) {
    throw new MarketingAssetContractError(
      `targetDurationMs ${brief.targetDurationMs} does not match durationPreset ${brief.durationPreset} (${expectedMs}ms)`,
    );
  }

  const sceneIds = new Set<string>();
  const orders = brief.scenes.map((scene) => scene.order).sort((a, b) => a - b);
  for (let i = 0; i < orders.length; i += 1) {
    if (orders[i] !== i + 1) {
      throw new MarketingAssetContractError("scene order must be contiguous starting at 1");
    }
  }

  const narrationRefSet = new Set(brief.narration.segmentRefs);
  let durationSum = 0;

  for (const scene of brief.scenes) {
    if (sceneIds.has(scene.sceneId)) {
      throw new MarketingAssetContractError(`duplicate sceneId: ${scene.sceneId}`);
    }
    sceneIds.add(scene.sceneId);
    if (scene.targetDurationMs <= 0) {
      throw new MarketingAssetContractError("scene targetDurationMs must be > 0");
    }
    durationSum += scene.targetDurationMs;
    assertSceneVisualSafety(scene);
    for (const ref of scene.narrationSegmentRefs) {
      if (!narrationRefSet.has(ref)) {
        throw new MarketingAssetContractError(
          `narrationSegmentRef ${ref} is not listed in brief.narration.segmentRefs`,
        );
      }
    }
    for (const query of scene.visual.searchQueries) {
      const trimmed = query.trim();
      if (!trimmed) {
        throw new MarketingAssetContractError("searchQueries must not contain empty strings");
      }
    }
    if (!scene.visual.subject.trim()) {
      throw new MarketingAssetContractError("visual.subject must be non-empty");
    }
  }

  if (Math.abs(durationSum - brief.targetDurationMs) > SHORT_VIDEO_BRIEF_DURATION_TOLERANCE_MS) {
    throw new MarketingAssetContractError(
      `scene duration sum ${durationSum} must match targetDurationMs ${brief.targetDurationMs} within ${SHORT_VIDEO_BRIEF_DURATION_TOLERANCE_MS}ms`,
    );
  }
}

export function assertSceneVisualSafety(scene: ShortVideoSceneRequirement): void {
  if (scene.visual.factualVisualRequired && scene.visual.generatedVideoAllowed) {
    throw new MarketingAssetContractError(
      `scene ${scene.sceneId}: factualVisualRequired=true requires generatedVideoAllowed=false`,
    );
  }
}

export function assertDurationPresetFitsRange(
  preset: ShortVideoDurationPreset,
  range: { minSeconds: number | null; maxSeconds: number | null } | null | undefined,
): void {
  if (!range) return;
  const seconds = SHORT_VIDEO_DURATION_PRESET_MS[preset] / 1000;
  if (range.minSeconds != null && seconds < range.minSeconds) {
    throw new MarketingAssetContractError(
      `durationPreset ${preset} (${seconds}s) is below MediaBrief minSeconds ${range.minSeconds}`,
    );
  }
  if (range.maxSeconds != null && seconds > range.maxSeconds) {
    throw new MarketingAssetContractError(
      `durationPreset ${preset} (${seconds}s) is above MediaBrief maxSeconds ${range.maxSeconds}`,
    );
  }
}
