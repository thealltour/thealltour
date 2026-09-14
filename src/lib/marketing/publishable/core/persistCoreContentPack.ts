import { stableJsonBytes } from "@/lib/marketing/assets/hashing";
import { overwritePackageArtifact } from "@/lib/marketing/assets/writeArtifact";
import {
  CORE_CONTENT_PACK_RELATIVE_PATH,
  type CoreContentPack,
} from "@/lib/marketing/publishable/core/coreContentPack";

export function persistCoreContentPack(input: {
  packageRoot: string;
  pack: CoreContentPack;
  createdAt: string;
}): void {
  overwritePackageArtifact({
    packageRoot: input.packageRoot,
    planned: {
      relativePath: CORE_CONTENT_PACK_RELATIVE_PATH,
      content: stableJsonBytes(input.pack),
      kind: "context",
      origin: "pipeline_export",
      mediaType: "application/json",
    },
    createdAt: input.createdAt,
  });
}
