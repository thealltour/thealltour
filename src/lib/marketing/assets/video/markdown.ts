import { formatSrtTimestamp } from "@/lib/marketing/tts/subtitles/format";
import type { AiVideoShotList } from "@/lib/marketing/assets/video/contracts";
import { AI_VIDEO_ASPECT_RATIO, AI_VIDEO_TIMING_SOURCE } from "@/lib/marketing/assets/video/contracts";
import type { MappedVideoShot } from "@/lib/marketing/assets/video/map";

export function renderAiVideoPromptMarkdown(input: {
  shotList: AiVideoShotList;
  prompts: MappedVideoShot[];
}): string {
  const header = [
    "# AI Video Prompt Pack",
    "",
    `Candidate: ${input.shotList.candidateId}`,
    `Aspect ratio: ${AI_VIDEO_ASPECT_RATIO}`,
    `Timing source: ${AI_VIDEO_TIMING_SOURCE}`,
    `Authoritative clock: ${input.shotList.authoritativeClock}`,
    "Shot policy: one narration segment = one primary visual shot",
    "This pack does not generate images or video. Use each prompt manually.",
    "",
  ];

  const sections = input.prompts.map(({ shot, prompt }, index) => {
    const start = formatSrtTimestamp(shot.startMs);
    const end = formatSrtTimestamp(shot.endMs);
    const promptBody = prompt.endsWith("\n") ? prompt.slice(0, -1) : prompt;
    return [
      `## Shot ${index + 1}`,
      "",
      `File: ${shot.promptRelativePath}`,
      `Timing: ${start} → ${end}`,
      `Narration: ${shot.narrationText}`,
      "",
      "Prompt:",
      "",
      promptBody,
      "",
    ].join("\n");
  });

  return `${header.join("\n")}\n${sections.join("\n")}`;
}
