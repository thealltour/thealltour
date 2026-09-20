import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";

import { stableJsonBytes } from "@/lib/marketing/assets/hashing";
import { overwritePackageArtifact } from "@/lib/marketing/assets/writeArtifact";
import type { NaverBandCopyArtifact } from "@/lib/marketing/publishable/naverBandCopy/contracts";
import {
  NAVER_BAND_COPY_MEDIA_TYPE,
  NAVER_BAND_COPY_RELATIVE_PATH,
} from "@/lib/marketing/publishable/naverBandCopy/paths";

export function persistNaverBandCopy(input: {
  packageRoot: string;
  copy: NaverBandCopyArtifact;
  createdAt?: string;
}): void {
  overwritePackageArtifact({
    packageRoot: input.packageRoot,
    planned: {
      relativePath: NAVER_BAND_COPY_RELATIVE_PATH,
      content: stableJsonBytes(input.copy),
      kind: "context",
      origin: "pipeline_export",
      mediaType: NAVER_BAND_COPY_MEDIA_TYPE,
    },
    createdAt: input.createdAt ?? input.copy.provenance.generatedAt,
  });
}

export function readNaverBandCopyFromPackage(packageRoot: string): NaverBandCopyArtifact | null {
  const absolute = join(packageRoot, NAVER_BAND_COPY_RELATIVE_PATH);
  if (!existsSync(absolute)) return null;
  try {
    return JSON.parse(readFileSync(absolute, "utf8")) as NaverBandCopyArtifact;
  } catch {
    return null;
  }
}
