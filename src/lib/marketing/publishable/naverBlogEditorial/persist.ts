import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";

import { stableJsonBytes } from "@/lib/marketing/assets/hashing";
import { overwritePackageArtifact } from "@/lib/marketing/assets/writeArtifact";
import type {
  NaverBlogCopy,
  NaverBlogStructurePlan,
} from "@/lib/marketing/publishable/naverBlogEditorial/contracts";
import {
  NAVER_BLOG_COPY_RELATIVE_PATH,
  NAVER_BLOG_EDITORIAL_JSON_MEDIA_TYPE,
  NAVER_BLOG_STRUCTURE_PLAN_RELATIVE_PATH,
} from "@/lib/marketing/publishable/naverBlogEditorial/paths";

export function persistNaverBlogStructurePlan(input: {
  packageRoot: string;
  plan: NaverBlogStructurePlan;
  createdAt?: string;
}): void {
  overwritePackageArtifact({
    packageRoot: input.packageRoot,
    planned: {
      relativePath: NAVER_BLOG_STRUCTURE_PLAN_RELATIVE_PATH,
      content: stableJsonBytes(input.plan),
      kind: "context",
      origin: "pipeline_export",
      mediaType: NAVER_BLOG_EDITORIAL_JSON_MEDIA_TYPE,
    },
    createdAt: input.createdAt ?? input.plan.provenance.generatedAt,
  });
}

export function persistNaverBlogCopy(input: {
  packageRoot: string;
  copy: NaverBlogCopy;
  createdAt?: string;
}): void {
  overwritePackageArtifact({
    packageRoot: input.packageRoot,
    planned: {
      relativePath: NAVER_BLOG_COPY_RELATIVE_PATH,
      content: stableJsonBytes(input.copy),
      kind: "context",
      origin: "pipeline_export",
      mediaType: NAVER_BLOG_EDITORIAL_JSON_MEDIA_TYPE,
    },
    createdAt: input.createdAt ?? input.copy.provenance.generatedAt,
  });
}

export function readNaverBlogStructurePlanFromPackage(
  packageRoot: string,
): NaverBlogStructurePlan | null {
  const absolute = join(packageRoot, NAVER_BLOG_STRUCTURE_PLAN_RELATIVE_PATH);
  if (!existsSync(absolute)) return null;
  try {
    return JSON.parse(readFileSync(absolute, "utf8")) as NaverBlogStructurePlan;
  } catch {
    return null;
  }
}

export function readNaverBlogCopyFromPackage(packageRoot: string): NaverBlogCopy | null {
  const absolute = join(packageRoot, NAVER_BLOG_COPY_RELATIVE_PATH);
  if (!existsSync(absolute)) return null;
  try {
    return JSON.parse(readFileSync(absolute, "utf8")) as NaverBlogCopy;
  } catch {
    return null;
  }
}
