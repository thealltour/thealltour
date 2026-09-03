import { VIDEO_CLIP_INTAKE_RELATIVE_PATH } from "@/lib/marketing/assets/video/intake/contracts";
import {
  buildCompleteClipIntake,
  inspectVideoClipIntake,
  type VideoClipIntakeInspection,
} from "@/lib/marketing/assets/video/intake/inspect";
import { persistVideoClipIntake } from "@/lib/marketing/assets/video/intake/persist";
import type { IncomingVideoProbe } from "@/lib/marketing/assets/video/intake/probe";

export async function intakeVideoClipsFromPackage(input: {
  packageRoot: string;
  persist: boolean;
  probe?: IncomingVideoProbe;
  createdAt?: string;
}): Promise<{
  complete: boolean;
  persisted: boolean;
  status: "created" | "reused" | "incomplete" | "inspected";
  relativePath: typeof VIDEO_CLIP_INTAKE_RELATIVE_PATH;
  sha256: string | null;
  inspection: VideoClipIntakeInspection;
}> {
  const inspection = await inspectVideoClipIntake({
    packageRoot: input.packageRoot,
    probe: input.probe,
  });

  if (!input.persist) {
    return {
      complete: inspection.complete,
      persisted: false,
      status: "inspected",
      relativePath: VIDEO_CLIP_INTAKE_RELATIVE_PATH,
      sha256: null,
      inspection,
    };
  }

  if (!inspection.complete) {
    return {
      complete: false,
      persisted: false,
      status: "incomplete",
      relativePath: VIDEO_CLIP_INTAKE_RELATIVE_PATH,
      sha256: null,
      inspection,
    };
  }

  const written = persistVideoClipIntake({
    packageRoot: input.packageRoot,
    intake: buildCompleteClipIntake(inspection),
    createdAt: input.createdAt ?? "1970-01-01T00:00:00.000Z",
  });
  return {
    complete: true,
    persisted: true,
    status: written.status,
    relativePath: written.relativePath,
    sha256: written.sha256,
    inspection,
  };
}
