import { existsSync, readFileSync } from "node:fs";

import type { MediaBrief } from "@/lib/marketing/assets/contracts";
import { VideoShotError } from "@/lib/marketing/assets/errors";
import { parseMediaBrief } from "@/lib/marketing/assets/parse";
import { resolvePackageArtifactPath } from "@/lib/marketing/assets/paths";
import { buildAiVideoShotList } from "@/lib/marketing/assets/video/map";
import { MEDIA_BRIEF_RELATIVE_PATH } from "@/lib/marketing/assets/video/paths";
import { persistAiVideoShotPack } from "@/lib/marketing/assets/video/persist";
import { readAudioMasterTimelineFromPackage } from "@/lib/marketing/tts/subtitles/orchestrate";

export function readMediaBriefFromPackage(packageRoot: string): MediaBrief {
  const absolutePath = resolvePackageArtifactPath({
    packageRoot,
    relativePath: MEDIA_BRIEF_RELATIVE_PATH,
  });
  if (!existsSync(absolutePath)) {
    throw new VideoShotError("media_brief_missing", "context/media-brief.json is required before planning video shots");
  }
  let parsed: unknown;
  try {
    parsed = JSON.parse(readFileSync(absolutePath, "utf8"));
  } catch {
    throw new VideoShotError("invalid_shot_list", "context/media-brief.json is not valid JSON");
  }
  return parseMediaBrief(parsed);
}

export function generateAiVideoShotPack(input: {
  packageRoot: string;
  mediaBrief?: MediaBrief;
  createdAt?: string;
}): {
  status: "created" | "reused";
  shotListRelativePath: "reel/shot-list.json";
  promptPackRelativePath: "reel/video-prompts.md";
  sha256ByPath: Record<string, string>;
  artifacts: Array<{ relativePath: string; sha256: string; status: "created" | "reused" }>;
  shotCount: number;
} {
  const timeline = readAudioMasterTimelineFromPackage(input.packageRoot);
  const mediaBrief = input.mediaBrief ?? readMediaBriefFromPackage(input.packageRoot);
  const { shotList, prompts } = buildAiVideoShotList({ mediaBrief, timeline });
  const persisted = persistAiVideoShotPack({
    packageRoot: input.packageRoot,
    shotList,
    prompts,
    createdAt: input.createdAt ?? "1970-01-01T00:00:00.000Z",
  });
  return {
    status: persisted.status,
    shotListRelativePath: "reel/shot-list.json",
    promptPackRelativePath: "reel/video-prompts.md",
    sha256ByPath: Object.fromEntries(persisted.artifacts.map((item) => [item.relativePath, item.sha256])),
    artifacts: persisted.artifacts,
    shotCount: shotList.shots.length,
  };
}
