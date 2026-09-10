import { MarketingAssetContractError } from "@/lib/marketing/assets/errors";
import {
  SHORT_VIDEO_DURATION_DEFAULT_PRESET,
  SHORT_VIDEO_DURATION_PRESET_MS,
  SHORT_VIDEO_DURATION_PRESETS,
  type ShortVideoDurationPreset,
} from "@/lib/marketing/assets/shortVideoBrief/contracts";
import { assertDurationPresetFitsRange } from "@/lib/marketing/assets/shortVideoBrief/validate";

export type MediaBriefDurationRange = {
  minSeconds: number | null;
  maxSeconds: number | null;
} | null;

export function durationPresetMs(preset: ShortVideoDurationPreset): number {
  return SHORT_VIDEO_DURATION_PRESET_MS[preset];
}

export function presetFitsRange(
  preset: ShortVideoDurationPreset,
  range: MediaBriefDurationRange,
): boolean {
  if (!range) return true;
  const seconds = SHORT_VIDEO_DURATION_PRESET_MS[preset] / 1000;
  if (range.minSeconds != null && seconds < range.minSeconds) return false;
  if (range.maxSeconds != null && seconds > range.maxSeconds) return false;
  return true;
}

/**
 * Deterministic preset selection (no LLM).
 * Preference order when multiple fit: normal → short → info.
 */
export function selectDurationPreset(input: {
  explicit?: ShortVideoDurationPreset | null;
  range?: MediaBriefDurationRange;
}): { preset: ShortVideoDurationPreset; source: "default" | "explicit" | "media_brief_range" } {
  if (input.explicit) {
    assertDurationPresetFitsRange(input.explicit, input.range ?? null);
    return { preset: input.explicit, source: "explicit" };
  }

  const range = input.range ?? null;
  if (range && (range.minSeconds != null || range.maxSeconds != null)) {
    const preference: ShortVideoDurationPreset[] = ["normal", "short", "info"];
    const fit = preference.find((preset) => presetFitsRange(preset, range));
    if (!fit) {
      throw new MarketingAssetContractError(
        "no duration preset fits MediaBrief.formats.shortform.targetDurationRange",
      );
    }
    return { preset: fit, source: "media_brief_range" };
  }

  return { preset: SHORT_VIDEO_DURATION_DEFAULT_PRESET, source: "default" };
}

/** Nearest preset by absolute ms distance (ties → preference normal, short, info). */
export function nearestDurationPreset(durationMs: number): ShortVideoDurationPreset {
  if (!Number.isFinite(durationMs) || durationMs <= 0) {
    throw new MarketingAssetContractError("durationMs must be a positive finite number");
  }
  let best: ShortVideoDurationPreset = SHORT_VIDEO_DURATION_DEFAULT_PRESET;
  let bestDistance = Number.POSITIVE_INFINITY;
  const preference = new Map<ShortVideoDurationPreset, number>([
    ["normal", 0],
    ["short", 1],
    ["info", 2],
  ]);
  for (const preset of SHORT_VIDEO_DURATION_PRESETS) {
    const distance = Math.abs(SHORT_VIDEO_DURATION_PRESET_MS[preset] - durationMs);
    if (
      distance < bestDistance ||
      (distance === bestDistance && (preference.get(preset) ?? 99) < (preference.get(best) ?? 99))
    ) {
      best = preset;
      bestDistance = distance;
    }
  }
  return best;
}

export function splitDurationAcrossScenes(totalMs: number, sceneCount: number): number[] {
  if (!Number.isInteger(sceneCount) || sceneCount < 1) {
    throw new MarketingAssetContractError("sceneCount must be a positive integer");
  }
  if (!Number.isInteger(totalMs) || totalMs < sceneCount) {
    throw new MarketingAssetContractError("totalMs must be an integer >= sceneCount");
  }
  const base = Math.floor(totalMs / sceneCount);
  const remainder = totalMs - base * sceneCount;
  const durations = Array.from({ length: sceneCount }, () => base);
  // Put remainder on the last scene to keep earlier scenes equal.
  durations[sceneCount - 1] = base + remainder;
  return durations;
}
