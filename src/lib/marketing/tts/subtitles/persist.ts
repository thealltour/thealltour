import { writePackageArtifact } from "@/lib/marketing/assets/writeArtifact";
import { TTS_SUBTITLES_MEDIA_TYPE, TTS_SUBTITLES_RELATIVE_PATH } from "@/lib/marketing/tts/subtitles/render";

export function persistSubtitlesSrt(input: {
  packageRoot: string;
  srt: string;
  createdAt: string;
}): ReturnType<typeof writePackageArtifact> {
  return writePackageArtifact({
    packageRoot: input.packageRoot,
    createdAt: input.createdAt,
    planned: {
      relativePath: TTS_SUBTITLES_RELATIVE_PATH,
      content: Buffer.from(input.srt, "utf8"),
      kind: "reel_subtitle",
      origin: "tts_generation",
      mediaType: TTS_SUBTITLES_MEDIA_TYPE,
    },
  });
}
