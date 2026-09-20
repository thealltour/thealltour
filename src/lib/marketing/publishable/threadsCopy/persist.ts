import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";

import { stableJsonBytes } from "@/lib/marketing/assets/hashing";
import { overwritePackageArtifact } from "@/lib/marketing/assets/writeArtifact";
import type { ThreadsCopyArtifact } from "@/lib/marketing/publishable/threadsCopy/contracts";
import {
  THREADS_COPY_MEDIA_TYPE,
  THREADS_COPY_RELATIVE_PATH,
} from "@/lib/marketing/publishable/threadsCopy/paths";

export function persistThreadsCopy(input: {
  packageRoot: string;
  copy: ThreadsCopyArtifact;
  createdAt?: string;
}): void {
  overwritePackageArtifact({
    packageRoot: input.packageRoot,
    planned: {
      relativePath: THREADS_COPY_RELATIVE_PATH,
      content: stableJsonBytes(input.copy),
      kind: "context",
      origin: "pipeline_export",
      mediaType: THREADS_COPY_MEDIA_TYPE,
    },
    createdAt: input.createdAt ?? input.copy.provenance.generatedAt,
  });
}

export function readThreadsCopyFromPackage(packageRoot: string): ThreadsCopyArtifact | null {
  const absolute = join(packageRoot, THREADS_COPY_RELATIVE_PATH);
  if (!existsSync(absolute)) return null;
  try {
    return JSON.parse(readFileSync(absolute, "utf8")) as ThreadsCopyArtifact;
  } catch {
    return null;
  }
}
