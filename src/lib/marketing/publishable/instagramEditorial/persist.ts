import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";

import { stableJsonBytes } from "@/lib/marketing/assets/hashing";
import { overwritePackageArtifact } from "@/lib/marketing/assets/writeArtifact";
import type { EditorialNarrativePlan } from "@/lib/marketing/publishable/editorialNarrative/contracts";
import {
  EDITORIAL_NARRATIVE_PLAN_MEDIA_TYPE,
  EDITORIAL_NARRATIVE_PLAN_RELATIVE_PATH,
} from "@/lib/marketing/publishable/editorialNarrative/paths";
import type {
  InstagramCaption,
  InstagramCardCopy,
  InstagramCarouselPlan,
} from "@/lib/marketing/publishable/instagramEditorial/contracts";
import {
  INSTAGRAM_CAPTION_RELATIVE_PATH,
  INSTAGRAM_CARD_COPY_RELATIVE_PATH,
  INSTAGRAM_CAROUSEL_PLAN_RELATIVE_PATH,
  INSTAGRAM_EDITORIAL_JSON_MEDIA_TYPE,
} from "@/lib/marketing/publishable/instagramEditorial/paths";

function readJsonIfPresent<T>(packageRoot: string, relativePath: string): T | null {
  const absolute = join(packageRoot, relativePath);
  if (!existsSync(absolute)) return null;
  try {
    return JSON.parse(readFileSync(absolute, "utf8")) as T;
  } catch {
    return null;
  }
}

export function persistEditorialNarrativePlan(input: {
  packageRoot: string;
  plan: EditorialNarrativePlan;
  createdAt?: string;
}): void {
  overwritePackageArtifact({
    packageRoot: input.packageRoot,
    planned: {
      relativePath: EDITORIAL_NARRATIVE_PLAN_RELATIVE_PATH,
      content: stableJsonBytes(input.plan),
      kind: "context",
      origin: "pipeline_export",
      mediaType: EDITORIAL_NARRATIVE_PLAN_MEDIA_TYPE,
    },
    createdAt: input.createdAt ?? input.plan.provenance.generatedAt,
  });
}

export function persistInstagramCarouselPlan(input: {
  packageRoot: string;
  plan: InstagramCarouselPlan;
  createdAt?: string;
}): void {
  overwritePackageArtifact({
    packageRoot: input.packageRoot,
    planned: {
      relativePath: INSTAGRAM_CAROUSEL_PLAN_RELATIVE_PATH,
      content: stableJsonBytes(input.plan),
      kind: "context",
      origin: "pipeline_export",
      mediaType: INSTAGRAM_EDITORIAL_JSON_MEDIA_TYPE,
    },
    createdAt: input.createdAt ?? input.plan.provenance.generatedAt,
  });
}

export function persistInstagramCardCopy(input: {
  packageRoot: string;
  copy: InstagramCardCopy;
  createdAt?: string;
}): void {
  overwritePackageArtifact({
    packageRoot: input.packageRoot,
    planned: {
      relativePath: INSTAGRAM_CARD_COPY_RELATIVE_PATH,
      content: stableJsonBytes(input.copy),
      kind: "context",
      origin: "pipeline_export",
      mediaType: INSTAGRAM_EDITORIAL_JSON_MEDIA_TYPE,
    },
    createdAt: input.createdAt ?? input.copy.provenance.generatedAt,
  });
}

export function persistInstagramCaption(input: {
  packageRoot: string;
  caption: InstagramCaption;
  createdAt?: string;
}): void {
  overwritePackageArtifact({
    packageRoot: input.packageRoot,
    planned: {
      relativePath: INSTAGRAM_CAPTION_RELATIVE_PATH,
      content: stableJsonBytes(input.caption),
      kind: "context",
      origin: "pipeline_export",
      mediaType: INSTAGRAM_EDITORIAL_JSON_MEDIA_TYPE,
    },
    createdAt: input.createdAt ?? input.caption.provenance.generatedAt,
  });
}

export function persistInstagramEditorialArtifacts(input: {
  packageRoot: string;
  narrative: EditorialNarrativePlan;
  carousel: InstagramCarouselPlan;
  cardCopy: InstagramCardCopy;
  caption?: InstagramCaption | null;
  createdAt?: string;
  /** When true, only overwrite card-copy (reuse Narrative/Carousel/Caption on disk). */
  cardCopyOnly?: boolean;
}): void {
  const createdAt = input.createdAt ?? new Date().toISOString();
  if (input.cardCopyOnly) {
    persistInstagramCardCopy({
      packageRoot: input.packageRoot,
      copy: input.cardCopy,
      createdAt,
    });
    return;
  }
  persistEditorialNarrativePlan({
    packageRoot: input.packageRoot,
    plan: input.narrative,
    createdAt,
  });
  persistInstagramCarouselPlan({
    packageRoot: input.packageRoot,
    plan: input.carousel,
    createdAt,
  });
  persistInstagramCardCopy({
    packageRoot: input.packageRoot,
    copy: input.cardCopy,
    createdAt,
  });
  if (input.caption) {
    persistInstagramCaption({
      packageRoot: input.packageRoot,
      caption: input.caption,
      createdAt,
    });
  }
}

export function readEditorialNarrativePlanFromPackage(
  packageRoot: string,
): EditorialNarrativePlan | null {
  return readJsonIfPresent(packageRoot, EDITORIAL_NARRATIVE_PLAN_RELATIVE_PATH);
}

export function readInstagramCarouselPlanFromPackage(
  packageRoot: string,
): InstagramCarouselPlan | null {
  return readJsonIfPresent(packageRoot, INSTAGRAM_CAROUSEL_PLAN_RELATIVE_PATH);
}

export function readInstagramCardCopyFromPackage(packageRoot: string): InstagramCardCopy | null {
  return readJsonIfPresent(packageRoot, INSTAGRAM_CARD_COPY_RELATIVE_PATH);
}

export function readInstagramCaptionFromPackage(packageRoot: string): InstagramCaption | null {
  return readJsonIfPresent(packageRoot, INSTAGRAM_CAPTION_RELATIVE_PATH);
}
