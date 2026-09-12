import { stableJsonBytes } from "@/lib/marketing/assets/hashing";
import { overwritePackageArtifact } from "@/lib/marketing/assets/writeArtifact";
import type { PublishableContentBundle } from "@/lib/marketing/publishable/contracts";
import {
  PUBLISHABLE_CONTENT_MEDIA_TYPE,
  PUBLISHABLE_CONTENT_RELATIVE_PATH,
} from "@/lib/marketing/publishable/paths";

export function persistPublishableContentBundle(input: {
  packageRoot: string;
  bundle: PublishableContentBundle;
  createdAt: string;
}): void {
  overwritePackageArtifact({
    packageRoot: input.packageRoot,
    planned: {
      relativePath: PUBLISHABLE_CONTENT_RELATIVE_PATH,
      content: stableJsonBytes(input.bundle),
      kind: "context",
      origin: "pipeline_export",
      mediaType: PUBLISHABLE_CONTENT_MEDIA_TYPE,
    },
    createdAt: input.createdAt,
  });
}
