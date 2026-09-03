import { jsonContainsForbiddenBotLeak } from "@/lib/marketing/bot/sanitize";
import {
  assertPackageArtifactWritable,
  writePackageArtifact,
  type PlannedPackageArtifact,
} from "@/lib/marketing/assets/writeArtifact";
import { sha256Buffer, stableJsonBytes } from "@/lib/marketing/assets/hashing";
import { VideoShotError } from "@/lib/marketing/assets/errors";
import type { AiVideoShotList } from "@/lib/marketing/assets/video/contracts";
import type { MappedVideoShot } from "@/lib/marketing/assets/video/map";
import { renderAiVideoPromptMarkdown } from "@/lib/marketing/assets/video/markdown";
import {
  AI_VIDEO_MARKDOWN_MEDIA_TYPE,
  AI_VIDEO_PROMPT_MEDIA_TYPE,
  AI_VIDEO_PROMPT_PACK_RELATIVE_PATH,
  AI_VIDEO_SHOT_LIST_MEDIA_TYPE,
  AI_VIDEO_SHOT_LIST_RELATIVE_PATH,
} from "@/lib/marketing/assets/video/paths";

export type PlannedVideoShotArtifact = PlannedPackageArtifact;

const VIDEO_SHOT_ORIGIN = "video_shot_planning" as const;

export function planAiVideoShotArtifacts(input: {
  shotList: AiVideoShotList;
  prompts: MappedVideoShot[];
}): PlannedVideoShotArtifact[] {
  if (jsonContainsForbiddenBotLeak(input.shotList)) {
    throw new VideoShotError("invalid_shot_list", "Shot list contains a forbidden field");
  }
  const markdown = renderAiVideoPromptMarkdown(input);
  const planned: PlannedVideoShotArtifact[] = input.prompts.map(({ shot, prompt }) => ({
    relativePath: shot.promptRelativePath,
    content: Buffer.from(prompt, "utf8"),
    kind: "reel_prompt" as const,
    origin: VIDEO_SHOT_ORIGIN,
    mediaType: AI_VIDEO_PROMPT_MEDIA_TYPE,
  }));
  planned.push({
    relativePath: AI_VIDEO_PROMPT_PACK_RELATIVE_PATH,
    content: Buffer.from(markdown, "utf8"),
    kind: "reel_prompt",
    origin: VIDEO_SHOT_ORIGIN,
    mediaType: AI_VIDEO_MARKDOWN_MEDIA_TYPE,
  });
  planned.push({
    relativePath: AI_VIDEO_SHOT_LIST_RELATIVE_PATH,
    content: stableJsonBytes(input.shotList),
    kind: "context",
    origin: VIDEO_SHOT_ORIGIN,
    mediaType: AI_VIDEO_SHOT_LIST_MEDIA_TYPE,
  });
  return planned;
}

export function persistAiVideoShotPack(input: {
  packageRoot: string;
  shotList: AiVideoShotList;
  prompts: MappedVideoShot[];
  createdAt: string;
}): {
  status: "created" | "reused";
  artifacts: Array<{ relativePath: string; sha256: string; status: "created" | "reused" }>;
  markdown: string;
} {
  const planned = planAiVideoShotArtifacts(input);
  for (const item of planned) {
    assertPackageArtifactWritable({ packageRoot: input.packageRoot, planned: item });
  }

  const artifacts = planned.map((item) => {
    const written = writePackageArtifact({
      packageRoot: input.packageRoot,
      planned: item,
      createdAt: input.createdAt,
    });
    return {
      relativePath: item.relativePath,
      sha256: written.artifact.sha256,
      status: written.status,
    };
  });

  const allReused = artifacts.every((item) => item.status === "reused");
  const markdown = planned.find((item) => item.relativePath === AI_VIDEO_PROMPT_PACK_RELATIVE_PATH);
  return {
    status: allReused ? "reused" : "created",
    artifacts,
    markdown: markdown ? markdown.content.toString("utf8") : "",
  };
}

export function hashPlannedVideoShotArtifacts(planned: PlannedVideoShotArtifact[]): Record<string, string> {
  return Object.fromEntries(planned.map((item) => [item.relativePath, sha256Buffer(item.content)]));
}
