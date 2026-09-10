/**
 * Pure enqueue renderability validation (no DB / no live HTTP).
 */

import { ShortformVideoRenderJobError } from "@/lib/marketing/assets/shortform/renderJob/errors";

export type ShortformRenderSceneValidationInput = {
  sceneId: string;
  factualVisualRequired: boolean;
  /** When true and no stock pick, still blocked in SV-6 if origin is generated_video_plan. */
  generatedVideoAllowed: boolean;
  pick: null | {
    sourceId: string;
    rightsKind: string;
    factualMatch?: string | null;
    origin?: string | null;
    mediaType?: string | null;
  };
};

export type ShortformRenderabilityIssue = {
  sceneId: string;
  code:
    | "MISSING_PICK"
    | "UNKNOWN_RIGHTS"
    | "FACTUAL_INVALID_SOURCE"
    | "GENERATED_VIDEO_PLAN_UNSUPPORTED"
    | "INVALID_SOURCE_ID";
  message: string;
};

export type ShortformRenderabilityResult =
  | { ok: true }
  | { ok: false; issues: ShortformRenderabilityIssue[] };

/**
 * Conservative SV-6 policy:
 * - every scene needs a usable catalog PICK
 * - unknown rights blocked
 * - generated_video_plan blocked until SV-8/Fal
 * - factual scenes require confirmed|probable pick match (not generic/unknown)
 * - photo_motion with a real picked image source is allowed as input identity
 */
export function validateShortformRenderEnqueueInput(input: {
  scenes: ShortformRenderSceneValidationInput[];
}): ShortformRenderabilityResult {
  const issues: ShortformRenderabilityIssue[] = [];

  for (const scene of input.scenes) {
    if (!scene.pick) {
      issues.push({
        sceneId: scene.sceneId,
        code: "MISSING_PICK",
        message: "required scene has no picked source",
      });
      continue;
    }

    if (!scene.pick.sourceId?.trim()) {
      issues.push({
        sceneId: scene.sceneId,
        code: "INVALID_SOURCE_ID",
        message: "picked sourceId is empty",
      });
      continue;
    }

    if (scene.pick.rightsKind === "unknown") {
      issues.push({
        sceneId: scene.sceneId,
        code: "UNKNOWN_RIGHTS",
        message: "picked source has unknown rights",
      });
    }

    if (scene.pick.origin === "generated_video_plan") {
      issues.push({
        sceneId: scene.sceneId,
        code: "GENERATED_VIDEO_PLAN_UNSUPPORTED",
        message: "generated_video_plan is not renderable until SV-8",
      });
    }

    if (scene.factualVisualRequired) {
      const match = scene.pick.factualMatch ?? "unknown";
      if (match !== "confirmed" && match !== "probable") {
        issues.push({
          sceneId: scene.sceneId,
          code: "FACTUAL_INVALID_SOURCE",
          message: `factual scene pick match is ${match}`,
        });
      }
    }
  }

  if (issues.length > 0) return { ok: false, issues };
  return { ok: true };
}

export function assertShortformRenderEnqueueInput(input: {
  scenes: ShortformRenderSceneValidationInput[];
}): void {
  const result = validateShortformRenderEnqueueInput(input);
  if (result.ok) return;
  const first = result.issues[0]!;
  throw new ShortformVideoRenderJobError(
    `${first.code}:${first.sceneId}:${first.message}`,
    first.code === "GENERATED_VIDEO_PLAN_UNSUPPORTED"
      ? "JOB_NOT_RENDERABLE_YET"
      : first.code,
  );
}
