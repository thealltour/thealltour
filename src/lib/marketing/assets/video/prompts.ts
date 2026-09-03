import type { ShortformNarrationSegment } from "@/lib/marketing/assets/contracts";

export const AI_VIDEO_NEGATIVE_CONSTRAINTS = [
  "NO TEXT",
  "NO CAPTIONS",
  "NO SUBTITLES",
  "NO LOGOS",
  "NO WATERMARKS",
] as const;

const EXTRA_CONSTRAINT_LINE =
  "No readable signage, UI overlays, fake brand marks, embedded typography, or on-screen Korean or English text.";
const SUBTITLE_OWNERSHIP_LINE =
  "All textual communication belongs in editorial subtitles, not in the picture.";
const PEOPLE_SAFETY_LINE =
  "If people appear, they are generic travelers. No identifiable real persons, celebrities, copyrighted characters, brand mascots, or stereotyped portrayals.";

export function composeAiVideoShotPrompt(input: {
  narrationText: string;
  visualIntent: string;
  audience: string | null;
}): string {
  const narration = input.narrationText.trim();
  const visualIntent = input.visualIntent.trim();
  const scene = visualIntent
    ? visualIntent
    : [
        "Photorealistic travel footage that illustrates this narration.",
        "Do not add hotels, attractions, airlines, prices, awards, or brands that the source does not name.",
        `Narration: ${narration}`,
      ].join(" ");

  const audience = input.audience?.trim();
  const people = audience
    ? `Generic travelers matching this audience: ${audience}. ${PEOPLE_SAFETY_LINE}`
    : PEOPLE_SAFETY_LINE;

  const lines = [
    "Scene:",
    scene,
    "",
    "Composition:",
    "Vertical 9:16 cinematic travel footage.",
    "Keep visual continuity with the rest of this reel: same destination mood, season, and generic cast.",
    "Natural documentary lighting. Leave room for later editorial subtitles.",
    people,
    "",
    "Motion:",
    "Slow, stable camera movement suitable for short-form video. No jump cuts inside the shot.",
    "",
    "Constraints:",
    ...AI_VIDEO_NEGATIVE_CONSTRAINTS,
    EXTRA_CONSTRAINT_LINE,
    SUBTITLE_OWNERSHIP_LINE,
  ];
  return `${lines.join("\n")}\n`;
}

export function promptInputsFromBriefSegment(segment: ShortformNarrationSegment, audience: string | null) {
  return {
    narrationText: segment.narrationText,
    visualIntent: segment.visualIntent,
    audience,
  };
}
