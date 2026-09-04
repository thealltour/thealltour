import { existsSync, readFileSync } from "node:fs";

import { resolvePackageArtifactPath } from "@/lib/marketing/assets/paths";
import { TtsError } from "@/lib/marketing/tts/errors";
import { persistSubtitlesSrt } from "@/lib/marketing/tts/subtitles/persist";
import { renderSrtFromTimeline, TTS_SUBTITLES_RELATIVE_PATH } from "@/lib/marketing/tts/subtitles/render";
import { parseAudioMasterTimeline } from "@/lib/marketing/tts/subtitles/validate";
import { TTS_TIMELINE_RELATIVE_PATH } from "@/lib/marketing/tts/timeline/contracts";
import type { AudioMasterTimeline } from "@/lib/marketing/tts/timeline/contracts";

export function readAudioMasterTimelineFromPackage(packageRoot: string): AudioMasterTimeline {
  const absolutePath = resolvePackageArtifactPath({
    packageRoot,
    relativePath: TTS_TIMELINE_RELATIVE_PATH,
  });
  if (!existsSync(absolutePath)) {
    throw new TtsError("timeline_missing", "reel/timeline.json is required before generating subtitles");
  }
  let parsed: unknown;
  try {
    parsed = JSON.parse(readFileSync(absolutePath, "utf8"));
  } catch {
    throw new TtsError("invalid_timeline", "reel/timeline.json is not valid JSON");
  }
  return parseAudioMasterTimeline(parsed);
}

export function generateSubtitlesFromTimelinePackage(input: {
  packageRoot: string;
  createdAt?: string;
}): {
  status: "created" | "reused";
  relativePath: typeof TTS_SUBTITLES_RELATIVE_PATH;
  sha256: string;
  cueCount: number;
  srt: string;
} {
  const timeline = readAudioMasterTimelineFromPackage(input.packageRoot);
  const srt = renderSrtFromTimeline(timeline);
  const persisted = persistSubtitlesSrt({
    packageRoot: input.packageRoot,
    srt,
    createdAt: input.createdAt ?? "1970-01-01T00:00:00.000Z",
  });
  return {
    status: persisted.status,
    relativePath: TTS_SUBTITLES_RELATIVE_PATH,
    sha256: persisted.artifact.sha256,
    cueCount: timeline.segments.length,
    srt,
  };
}
