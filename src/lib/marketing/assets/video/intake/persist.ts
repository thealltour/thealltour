import { jsonContainsForbiddenBotLeak } from "@/lib/marketing/bot/sanitize";
import { VideoClipError } from "@/lib/marketing/assets/errors";
import { stableJsonBytes } from "@/lib/marketing/assets/hashing";
import { writePackageArtifact } from "@/lib/marketing/assets/writeArtifact";
import {
  VIDEO_CLIP_INTAKE_MEDIA_TYPE,
  VIDEO_CLIP_INTAKE_RELATIVE_PATH,
  videoClipIntakeSchema,
  type VideoClipIntake,
} from "@/lib/marketing/assets/video/intake/contracts";

export function persistVideoClipIntake(input: {
  packageRoot: string;
  intake: VideoClipIntake;
  createdAt: string;
}): { status: "created" | "reused"; sha256: string; relativePath: typeof VIDEO_CLIP_INTAKE_RELATIVE_PATH } {
  const parsed = videoClipIntakeSchema.safeParse(input.intake);
  if (!parsed.success || parsed.data.complete !== true) {
    throw new VideoClipError("invalid_clip_metadata", "video-clip-intake-v1 is malformed or incomplete");
  }
  if (jsonContainsForbiddenBotLeak(parsed.data)) {
    throw new VideoClipError("invalid_clip_metadata", "Clip intake contains a forbidden field");
  }
  const written = writePackageArtifact({
    packageRoot: input.packageRoot,
    createdAt: input.createdAt,
    planned: {
      relativePath: VIDEO_CLIP_INTAKE_RELATIVE_PATH,
      content: stableJsonBytes(parsed.data),
      kind: "context",
      origin: "video_clip_intake",
      mediaType: VIDEO_CLIP_INTAKE_MEDIA_TYPE,
    },
  });
  return {
    status: written.status,
    sha256: written.artifact.sha256,
    relativePath: VIDEO_CLIP_INTAKE_RELATIVE_PATH,
  };
}
